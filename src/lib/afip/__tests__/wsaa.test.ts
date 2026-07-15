import { describe, it, expect, vi, afterEach } from "vitest";
import forge from "node-forge";
import { requestTicketAcceso } from "../wsaa";
import { AfipError } from "../errors";
import { generateTestCertKeyPair } from "./test-cert";

function escapeXml(xml: string): string {
  return xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mockWsaaSuccessResponse() {
  const taXml = `<loginTicketResponse>
    <header>
      <source>ARCA</source>
      <destination>CN=test</destination>
      <uniqueId>123</uniqueId>
      <generationTime>2026-07-15T10:00:00-03:00</generationTime>
      <expirationTime>2026-07-15T22:00:00-03:00</expirationTime>
    </header>
    <credentials>
      <token>test-token-value</token>
      <sign>test-sign-value</sign>
    </credentials>
  </loginTicketResponse>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <loginCmsResponse>
      <loginCmsReturn>${escapeXml(taXml)}</loginCmsReturn>
    </loginCmsResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestTicketAcceso", () => {
  it("firma el TRA como CMS válido y parsea el TA de una respuesta exitosa de WSAA", async () => {
    const { cert, key } = generateTestCertKeyPair();

    let capturedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return new Response(mockWsaaSuccessResponse(), { status: 200 });
      })
    );

    const ta = await requestTicketAcceso({
      cert,
      key,
      service: "wsfe",
      ambiente: "homologacion",
    });

    expect(ta.token).toBe("test-token-value");
    expect(ta.sign).toBe("test-sign-value");
    expect(ta.expirationTime).toContain("2026-07-15");

    // El CMS que se manda en el body tiene que ser un PKCS#7 SignedData DER válido
    // que contenga el TRA original (con el <service>wsfe</service>).
    const in0Match = capturedBody.match(/<wsaa:in0>([\s\S]*?)<\/wsaa:in0>/);
    expect(in0Match).not.toBeNull();
    const der = forge.util.decode64(in0Match![1]);
    const asn1 = forge.asn1.fromDer(der);
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as unknown as {
      rawCapture: { content: { value: [{ value: string }] } };
    };
    const traContent = p7.rawCapture.content.value[0].value;
    expect(traContent).toContain("<service>wsfe</service>");
  });

  it("tira AfipError si el certificado no es PEM válido", async () => {
    await expect(
      requestTicketAcceso({
        cert: "no-es-un-certificado",
        key: "tampoco-es-una-clave",
        service: "wsfe",
        ambiente: "homologacion",
      })
    ).rejects.toBeInstanceOf(AfipError);
  });

  it("tira AfipError con el mensaje real cuando WSAA devuelve un SOAP Fault", async () => {
    const { cert, key } = generateTestCertKeyPair();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>ns1:Client.Auth</faultcode>
      <faultstring>El CEE ya posee un TA valido para el acceso al WSN</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`,
          { status: 500 }
        )
      )
    );

    await expect(
      requestTicketAcceso({ cert, key, service: "wsfe", ambiente: "homologacion" })
    ).rejects.toThrow(/El CEE ya posee un TA valido/);
  });
});
