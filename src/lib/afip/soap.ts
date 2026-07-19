import { XMLParser } from "fast-xml-parser";
import { AfipError } from "./errors";

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,
});

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

  let response: Response;
  try {
    response = await fetch(params.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: params.soapAction,
      },
      body: envelope,
    });
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
