import { describe, it, expect, vi, afterEach } from "vitest";
import { getProximoNumeroComprobante, solicitarCae } from "../wsfe";
import { AfipError } from "../errors";
import type { NuevaFacturaInput } from "../types";

const auth = { token: "t", sign: "s", cuit: "20111111112" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetchOnce(xml: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(xml, { status: 200 }))
  );
}

function stubFetchOnceCapturing(xml: string) {
  let capturedBody = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      return new Response(xml, { status: 200 });
    })
  );
  return () => capturedBody;
}

describe("getProximoNumeroComprobante", () => {
  it("devuelve último autorizado + 1", async () => {
    stubFetchOnce(`<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECompUltimoAutorizadoResponse>
      <ar:FECompUltimoAutorizadoResult>
        <ar:PtoVta>1</ar:PtoVta>
        <ar:CbteTipo>11</ar:CbteTipo>
        <ar:CbteNro>42</ar:CbteNro>
      </ar:FECompUltimoAutorizadoResult>
    </ar:FECompUltimoAutorizadoResponse>
  </soapenv:Body>
</soapenv:Envelope>`);

    const next = await getProximoNumeroComprobante({
      ambiente: "homologacion",
      auth,
      puntoVenta: 1,
    });
    expect(next).toBe(43);
  });
});

const baseFactura: NuevaFacturaInput = {
  concepto: 1,
  docTipo: 99,
  docNro: "0",
  condicionIvaReceptorId: 5,
  items: [{ descripcion: "Consultoría", cantidad: 1, precioUnitario: 1000 }],
};

describe("solicitarCae", () => {
  it("devuelve el CAE cuando AFIP aprueba la factura (Resultado A)", async () => {
    stubFetchOnce(`<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECAESolicitarResponse>
      <ar:FECAESolicitarResult>
        <ar:FeCabResp>
          <ar:Resultado>A</ar:Resultado>
        </ar:FeCabResp>
        <ar:FeDetResp>
          <ar:FECAEDetResponse>
            <ar:Resultado>A</ar:Resultado>
            <ar:CAE>75186784560756</ar:CAE>
            <ar:CAEFchVto>20260725</ar:CAEFchVto>
          </ar:FECAEDetResponse>
        </ar:FeDetResp>
      </ar:FECAESolicitarResult>
    </ar:FECAESolicitarResponse>
  </soapenv:Body>
</soapenv:Envelope>`);

    const result = await solicitarCae({
      ambiente: "homologacion",
      auth,
      puntoVenta: 1,
      numeroComprobante: 43,
      factura: baseFactura,
      importeTotal: 1000,
    });

    expect(result.cae).toBe("75186784560756");
    expect(result.caeFchVto).toBe("2026-07-25");
  });

  it("tira AfipError con el motivo real cuando AFIP rechaza la factura (Resultado R)", async () => {
    stubFetchOnce(`<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECAESolicitarResponse>
      <ar:FECAESolicitarResult>
        <ar:FeCabResp>
          <ar:Resultado>R</ar:Resultado>
        </ar:FeCabResp>
        <ar:FeDetResp>
          <ar:FECAEDetResponse>
            <ar:Resultado>R</ar:Resultado>
            <ar:Observaciones>
              <ar:Obs>
                <ar:Code>10242</ar:Code>
                <ar:Msg>El campo Condicion IVA Receptor es obligatorio</ar:Msg>
              </ar:Obs>
            </ar:Observaciones>
          </ar:FECAEDetResponse>
        </ar:FeDetResp>
      </ar:FECAESolicitarResult>
    </ar:FECAESolicitarResponse>
  </soapenv:Body>
</soapenv:Envelope>`);

    await expect(
      solicitarCae({
        ambiente: "homologacion",
        auth,
        puntoVenta: 1,
        numeroComprobante: 43,
        factura: baseFactura,
        importeTotal: 1000,
      })
    ).rejects.toThrow(/Condicion IVA Receptor es obligatorio/);
  });

  it("tira AfipError con el motivo real cuando AFIP rechaza a nivel request (Errors)", async () => {
    stubFetchOnce(`<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECAESolicitarResponse>
      <ar:FECAESolicitarResult>
        <ar:Errors>
          <ar:Err>
            <ar:Code>600</ar:Code>
            <ar:Msg>CUIT representado no incluido en Token</ar:Msg>
          </ar:Err>
        </ar:Errors>
      </ar:FECAESolicitarResult>
    </ar:FECAESolicitarResponse>
  </soapenv:Body>
</soapenv:Envelope>`);

    await expect(
      solicitarCae({
        ambiente: "homologacion",
        auth,
        puntoVenta: 1,
        numeroComprobante: 43,
        factura: baseFactura,
        importeTotal: 1000,
      })
    ).rejects.toThrow(/CUIT representado no incluido en Token/);
  });

  it("propaga AfipError como instancia (no genérica)", async () => {
    stubFetchOnce(`<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECAESolicitarResponse>
      <ar:FECAESolicitarResult>
        <ar:Errors>
          <ar:Err><ar:Code>600</ar:Code><ar:Msg>x</ar:Msg></ar:Err>
        </ar:Errors>
      </ar:FECAESolicitarResult>
    </ar:FECAESolicitarResponse>
  </soapenv:Body>
</soapenv:Envelope>`);

    await expect(
      solicitarCae({
        ambiente: "homologacion",
        auth,
        puntoVenta: 1,
        numeroComprobante: 43,
        factura: baseFactura,
        importeTotal: 1000,
      })
    ).rejects.toBeInstanceOf(AfipError);
  });

  it("manda CbteTipo 13 y el CbtesAsoc correcto al anular con Nota de Crédito", async () => {
    const getBody = stubFetchOnceCapturing(`<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Body>
    <ar:FECAESolicitarResponse>
      <ar:FECAESolicitarResult>
        <ar:FeDetResp>
          <ar:FECAEDetResponse>
            <ar:Resultado>A</ar:Resultado>
            <ar:CAE>1234567890</ar:CAE>
            <ar:CAEFchVto>20260725</ar:CAEFchVto>
          </ar:FECAEDetResponse>
        </ar:FeDetResp>
      </ar:FECAESolicitarResult>
    </ar:FECAESolicitarResponse>
  </soapenv:Body>
</soapenv:Envelope>`);

    const result = await solicitarCae({
      ambiente: "homologacion",
      auth,
      puntoVenta: 1,
      numeroComprobante: 1,
      cbteTipo: 13,
      comprobantesAsociados: [{ cbteTipo: 11, puntoVenta: 1, numeroComprobante: 43 }],
      factura: baseFactura,
      importeTotal: 1000,
    });

    expect(result.cae).toBe("1234567890");

    const body = getBody();
    expect(body).toContain("<ar:CbteTipo>13</ar:CbteTipo>");
    expect(body).toMatch(/<ar:CbtesAsoc>[\s\S]*<ar:Tipo>11<\/ar:Tipo>[\s\S]*<\/ar:CbtesAsoc>/);
    expect(body).toContain("<ar:PtoVta>1</ar:PtoVta>");
    expect(body).toContain("<ar:Nro>43</ar:Nro>");
  });
});
