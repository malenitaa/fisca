import forge from "node-forge";
import { AFIP_ENDPOINTS, type Ambiente } from "./config";
import { AfipError } from "./errors";

export interface TicketAcceso {
  token: string;
  sign: string;
  expirationTime: string;
}

/** Arma el XML del Ticket de Requerimiento de Acceso (TRA) que hay que firmar. */
function buildTRA(service: string): string {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 60_000);
  const expirationTime = new Date(now.getTime() + 10 * 60_000);
  const uniqueId = Math.floor(now.getTime() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime.toISOString()}</generationTime>
    <expirationTime>${expirationTime.toISOString()}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

/** Firma el TRA como CMS/PKCS#7 (SignedData) usando el certificado y clave privada del contribuyente. */
function signTRA(traXml: string, certPem: string, keyPem: string): string {
  let cert: forge.pki.Certificate;
  let privateKey: forge.pki.PrivateKey;
  try {
    cert = forge.pki.certificateFromPem(certPem);
    privateKey = forge.pki.privateKeyFromPem(keyPem);
  } catch {
    throw new AfipError(
      "El certificado o la clave privada no tienen un formato PEM válido. Verificá los archivos .crt/.key generados en ARCA."
    );
  }

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime },
    ],
  });
  p7.sign({ detached: false });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Pide un Ticket de Acceso (TA) nuevo a WSAA. El TA es válido 12hs; el llamador
 * es responsable de cachearlo (ver `getTicketAcceso` en `ta-cache.ts`).
 */
export async function requestTicketAcceso(params: {
  cert: string;
  key: string;
  service: string;
  ambiente: Ambiente;
}): Promise<TicketAcceso> {
  const { cert, key, service, ambiente } = params;
  const traXml = buildTRA(service);
  const cms = signTRA(traXml, cert, key);

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const endpoint = AFIP_ENDPOINTS[ambiente].wsaa;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      body: soapEnvelope,
    });
  } catch (err) {
    throw new AfipError(
      `No se pudo contactar al servicio de autenticación de AFIP (WSAA, ${ambiente}). ${
        err instanceof Error ? err.message : ""
      }`
    );
  }

  const responseText = await response.text();

  const fault = extractTag(responseText, "faultstring");
  if (fault) {
    throw new AfipError(`AFIP (WSAA) rechazó la autenticación: ${decodeXmlEntities(fault)}`);
  }

  const loginCmsReturn = extractTag(responseText, "loginCmsReturn");
  if (!loginCmsReturn) {
    throw new AfipError(
      `Respuesta inesperada de WSAA (${ambiente}). No se encontró el ticket de acceso en la respuesta.`
    );
  }

  const taXml = decodeXmlEntities(loginCmsReturn);
  const token = extractTag(taXml, "token");
  const sign = extractTag(taXml, "sign");
  const expirationTime = extractTag(taXml, "expirationTime");

  if (!token || !sign || !expirationTime) {
    throw new AfipError("El ticket de acceso devuelto por WSAA está incompleto.");
  }

  return { token, sign, expirationTime };
}
