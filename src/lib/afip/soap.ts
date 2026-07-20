import { request as httpsRequest, Agent as HttpsAgent } from "node:https";
import { XMLParser } from "fast-xml-parser";
import { AfipError } from "./errors";

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,
});

/**
 * servicios1.afip.gov.ar (WSFEv1/WSFEXv1 de PRODUCCIÓN — no homologación,
 * no WSAA) todavía negocia TLS con un primo Diffie-Hellman demasiado
 * chico para el nivel de seguridad default de OpenSSL 3 ("dh key too
 * small"). Es un problema de la infraestructura de ARCA, reportado por
 * muchas integraciones (facturajs, pyafipws, python-zeep), no algo que
 * podamos arreglar de su lado. Ver README § "TLS legacy de AFIP".
 *
 * El fix baja el SECLEVEL de OpenSSL de 2 a 1 (sigue exigiendo TLS 1.2+ y
 * cifrado fuerte, solo permite primos DH más chicos) pero SOLO para
 * conexiones a este host puntual, via un https.Agent de Node dedicado —
 * todo lo demás (Supabase, WSAA, homologación) sigue usando `fetch` con
 * la configuración default de Node/OpenSSL sin tocar.
 *
 * No se puede lograr lo mismo pasándole un `dispatcher` de undici a
 * `fetch`: el undici interno de Node y el paquete `undici` de npm no son
 * intercambiables (rompe con "invalid onRequestStart method"), así que
 * para este host puntual hacemos el POST con `node:https` en vez de
 * `fetch`.
 */
const LEGACY_TLS_HOSTS = new Set(["servicios1.afip.gov.ar"]);

let legacyAgent: HttpsAgent | undefined;
function legacyTlsAgentFor(endpoint: string): HttpsAgent | undefined {
  if (!LEGACY_TLS_HOSTS.has(new URL(endpoint).hostname)) return undefined;
  legacyAgent ??= new HttpsAgent({ ciphers: "DEFAULT@SECLEVEL=1" });
  return legacyAgent;
}

/** POST vía `node:https` con un Agent puntual, devuelto como `Response`
 * estándar para que el resto de `callWsfeSoap` no tenga que distinguir
 * de dónde vino. */
function postWithAgent(
  endpoint: string,
  headers: Record<string, string>,
  body: string,
  agent: HttpsAgent
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      endpoint,
      { method: "POST", agent, headers: { ...headers, "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 0 })));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function callWsfeSoap(params: {
  endpoint: string;
  soapAction: string;
  body: string;
  /** Namespace ARCA a usar para el `xmlns:ar` del envelope. Por default el
   * de WSFEv1; WSFEXv1 pasa el suyo. */
  namespace?: string;
  /** Nombre del servicio para los mensajes de error legibles. */
  serviceName?: string;
}): Promise<Record<string, unknown>> {
  const ns = params.namespace ?? "http://ar.gov.afip.dif.FEV1/";
  const svcName = params.serviceName ?? "WSFEv1";

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${ns}">
  <soapenv:Header/>
  <soapenv:Body>
    ${params.body}
  </soapenv:Body>
</soapenv:Envelope>`;

  const headers = {
    "Content-Type": "text/xml; charset=utf-8",
    SOAPAction: params.soapAction,
  };

  let response: Response;
  try {
    const legacyAgentForEndpoint = legacyTlsAgentFor(params.endpoint);
    response = legacyAgentForEndpoint
      ? await postWithAgent(params.endpoint, headers, envelope, legacyAgentForEndpoint)
      : await fetch(params.endpoint, { method: "POST", headers, body: envelope });
  } catch (err) {
    throw new AfipError(
      `No se pudo contactar al servicio de facturación de AFIP (${svcName}). ${
        err instanceof Error ? err.message : ""
      }`
    );
  }

  const text = await response.text();
  const parsed = parser.parse(text);
  const body = parsed?.Envelope?.Body;

  const fault = body?.Fault;
  if (fault) {
    const faultString =
      typeof fault.faultstring === "string" ? fault.faultstring : JSON.stringify(fault);
    throw new AfipError(`AFIP (${svcName}) rechazó la solicitud: ${faultString}`);
  }

  if (!body) {
    throw new AfipError(`Respuesta vacía o inesperada del webservice de AFIP (${svcName}).`);
  }

  return body as Record<string, unknown>;
}

/** Escapa texto para insertarlo en un nodo XML. Todo campo con texto
 * ingresado por la usuaria (nombre de cliente, domicilio, docNro, etc.)
 * tiene que pasar por acá antes de interpolarse en el SOAP body — si no,
 * un `&`/`<`/`>` en el input rompe la estructura del XML (o peor, permite
 * inyectar nodos ajenos al pedido). */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Normaliza un campo que puede venir como objeto único o array (fast-xml-parser). */
export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

interface ErrItem {
  Code?: string | number;
  Msg?: string;
}

/** Junta los Errors/Events/Observaciones de una respuesta de WSFEv1 en un solo mensaje legible. */
export function formatAfipIssues(issues: ErrItem[]): string {
  return issues.map((i) => `[${i.Code ?? "?"}] ${i.Msg ?? "sin detalle"}`).join(" | ");
}
