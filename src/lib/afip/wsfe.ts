import { AFIP_ENDPOINTS, type Ambiente } from "./config";
import { AfipError } from "./errors";
import { asArray, callWsfeSoap, formatAfipIssues, xmlEscape } from "./soap";
import { CBTE_TIPO_FACTURA_C, type FacturaItem, type NuevaFacturaInput } from "./types";

export interface ComprobanteAsociado {
  cbteTipo: number;
  puntoVenta: number;
  numeroComprobante: number;
}

interface AuthParams {
  token: string;
  sign: string;
  cuit: string;
}

function authBlock(auth: AuthParams): string {
  return `<ar:Auth>
    <ar:Token>${auth.token}</ar:Token>
    <ar:Sign>${auth.sign}</ar:Sign>
    <ar:Cuit>${auth.cuit}</ar:Cuit>
  </ar:Auth>`;
}

function todayYYYYMMDD(): string {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0")
  );
}

function toAfipDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function fromAfipDate(afipDate: string): string {
  return `${afipDate.slice(0, 4)}-${afipDate.slice(4, 6)}-${afipDate.slice(6, 8)}`;
}

export function importeTotal(items: FacturaItem[]): number {
  return Math.round(
    items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0) * 100
  ) / 100;
}

/** Devuelve el próximo número de comprobante a usar (último autorizado + 1). */
export async function getProximoNumeroComprobante(params: {
  ambiente: Ambiente;
  auth: AuthParams;
  puntoVenta: number;
  cbteTipo?: number;
}): Promise<number> {
  const { ambiente, auth, puntoVenta, cbteTipo = CBTE_TIPO_FACTURA_C } = params;

  const body = `<ar:FECompUltimoAutorizado>
    ${authBlock(auth)}
    <ar:PtoVta>${puntoVenta}</ar:PtoVta>
    <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
  </ar:FECompUltimoAutorizado>`;

  const responseBody = await callWsfeSoap({
    endpoint: AFIP_ENDPOINTS[ambiente].wsfe,
    soapAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
    body,
  });

  const result = (responseBody as Record<string, Record<string, unknown>>)
    .FECompUltimoAutorizadoResponse?.FECompUltimoAutorizadoResult as Record<string, unknown>;

  const errors = asArray(
    (result?.Errors as Record<string, unknown>)?.Err as
      | { Code?: string; Msg?: string }
      | { Code?: string; Msg?: string }[]
      | undefined
  );
  if (errors.length > 0) {
    throw new AfipError(
      `AFIP rechazó la consulta del último comprobante: ${formatAfipIssues(errors)}`
    );
  }

  const cbteNro = Number(result?.CbteNro ?? 0);
  return cbteNro + 1;
}

export interface CaeResult {
  cae: string;
  caeFchVto: string;
  numeroComprobante: number;
  fechaEmision: string;
  observaciones: string[];
}

/** Pide el CAE para un comprobante (Factura C o Nota de Crédito C) con un solo
 * detalle (`FeDetReq` de un ítem). */
export async function solicitarCae(params: {
  ambiente: Ambiente;
  auth: AuthParams;
  puntoVenta: number;
  numeroComprobante: number;
  factura: NuevaFacturaInput;
  importeTotal: number;
  cbteTipo?: number;
  comprobantesAsociados?: ComprobanteAsociado[];
}): Promise<CaeResult> {
  const {
    ambiente,
    auth,
    puntoVenta,
    numeroComprobante,
    factura,
    importeTotal,
    cbteTipo = CBTE_TIPO_FACTURA_C,
    comprobantesAsociados = [],
  } = params;

  const fechaEmision = factura.fechaComprobante
    ? toAfipDate(factura.fechaComprobante)
    : todayYYYYMMDD();
  const esServicio = factura.concepto === 2 || factura.concepto === 3;

  const fechasServicio = esServicio
    ? `
    <ar:FchServDesde>${toAfipDate(factura.fechaServicioDesde ?? factura.fechaVtoPago ?? "")}</ar:FchServDesde>
    <ar:FchServHasta>${toAfipDate(factura.fechaServicioHasta ?? factura.fechaVtoPago ?? "")}</ar:FchServHasta>
    <ar:FchVtoPago>${toAfipDate(factura.fechaVtoPago ?? "")}</ar:FchVtoPago>`
    : "";

  const cbtesAsocBlock =
    comprobantesAsociados.length > 0
      ? `
          <ar:CbtesAsoc>
            ${comprobantesAsociados
              .map(
                (c) => `<ar:CbteAsoc>
              <ar:Tipo>${c.cbteTipo}</ar:Tipo>
              <ar:PtoVta>${c.puntoVenta}</ar:PtoVta>
              <ar:Nro>${c.numeroComprobante}</ar:Nro>
            </ar:CbteAsoc>`
              )
              .join("\n            ")}
          </ar:CbtesAsoc>`
      : "";

  // RG 5616/2024: MonId != PES habilita moneda extranjera. CanMisMonExt indica
  // si el pago es en la misma moneda ("S", ARCA asigna la cotización oficial
  // automáticamente — informarla obliga a que coincida exacto, error 10038)
  // o en pesos ("N", la cotización va a cargo del emisor).
  const monId = factura.monedaId && factura.monedaId !== "PES" ? factura.monedaId : "PES";
  const esMonedaExtranjera = monId !== "PES";
  const canMisMonExt = esMonedaExtranjera && factura.canMisMonExt === "S" ? "S" : "N";

  const monCotizTag = !esMonedaExtranjera
    ? `\n          <ar:MonCotiz>1</ar:MonCotiz>`
    : canMisMonExt === "S"
    ? ""
    : `\n          <ar:MonCotiz>${(factura.monedaCotizacion ?? 0).toFixed(4)}</ar:MonCotiz>`;
  const canMisMonExtTag = esMonedaExtranjera
    ? `\n          <ar:CanMisMonExt>${canMisMonExt}</ar:CanMisMonExt>`
    : "";

  // Factura C / Nota de Crédito C: el monotributista no discrimina IVA, así
  // que todo el importe va como "neto" y el resto de los importes
  // discriminados quedan en 0.
  const body = `<ar:FECAESolicitar>
    ${authBlock(auth)}
    <ar:FeCAEReq>
      <ar:FeCabReq>
        <ar:CantReg>1</ar:CantReg>
        <ar:PtoVta>${puntoVenta}</ar:PtoVta>
        <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
      </ar:FeCabReq>
      <ar:FeDetReq>
        <ar:FECAEDetRequest>
          <ar:Concepto>${factura.concepto}</ar:Concepto>
          <ar:DocTipo>${factura.docTipo}</ar:DocTipo>
          <ar:DocNro>${xmlEscape(factura.docNro)}</ar:DocNro>
          <ar:CbteDesde>${numeroComprobante}</ar:CbteDesde>
          <ar:CbteHasta>${numeroComprobante}</ar:CbteHasta>
          <ar:CbteFch>${fechaEmision}</ar:CbteFch>
          <ar:ImpTotal>${importeTotal.toFixed(2)}</ar:ImpTotal>
          <ar:ImpTotConc>0.00</ar:ImpTotConc>
          <ar:ImpNeto>${importeTotal.toFixed(2)}</ar:ImpNeto>
          <ar:ImpOpEx>0.00</ar:ImpOpEx>
          <ar:ImpIVA>0.00</ar:ImpIVA>
          <ar:ImpTrib>0.00</ar:ImpTrib>${fechasServicio}${cbtesAsocBlock}
          <ar:MonId>${monId}</ar:MonId>${monCotizTag}${canMisMonExtTag}
          <ar:CondicionIVAReceptorId>${factura.condicionIvaReceptorId}</ar:CondicionIVAReceptorId>
        </ar:FECAEDetRequest>
      </ar:FeDetReq>
    </ar:FeCAEReq>
  </ar:FECAESolicitar>`;

  const responseBody = await callWsfeSoap({
    endpoint: AFIP_ENDPOINTS[ambiente].wsfe,
    soapAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
    body,
  });

  const result = (responseBody as Record<string, Record<string, unknown>>).FECAESolicitarResponse
    ?.FECAESolicitarResult as Record<string, unknown>;

  const topLevelErrors = asArray(
    (result?.Errors as Record<string, unknown>)?.Err as
      | { Code?: string; Msg?: string }
      | { Code?: string; Msg?: string }[]
      | undefined
  );
  if (topLevelErrors.length > 0) {
    throw new AfipError(`AFIP rechazó la solicitud: ${formatAfipIssues(topLevelErrors)}`);
  }

  const detalles = asArray(
    (result?.FeDetResp as Record<string, unknown>)?.FECAEDetResponse as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );
  const detalle = detalles[0];

  if (!detalle) {
    throw new AfipError("AFIP no devolvió el detalle de autorización de la factura.");
  }

  const observaciones = asArray(
    (detalle.Observaciones as Record<string, unknown>)?.Obs as
      | { Code?: string; Msg?: string }
      | { Code?: string; Msg?: string }[]
      | undefined
  ).map((o) => `[${o.Code ?? "?"}] ${o.Msg ?? "sin detalle"}`);

  if (detalle.Resultado !== "A") {
    throw new AfipError(
      `AFIP rechazó la factura (resultado: ${detalle.Resultado}). ${
        observaciones.length > 0 ? observaciones.join(" | ") : "Sin observaciones detalladas."
      }`
    );
  }

  if (!detalle.CAE || !detalle.CAEFchVto) {
    throw new AfipError("AFIP aprobó la factura pero no devolvió CAE. Reintentá la operación.");
  }

  return {
    cae: String(detalle.CAE),
    caeFchVto: fromAfipDate(String(detalle.CAEFchVto)),
    numeroComprobante,
    fechaEmision: fromAfipDate(fechaEmision),
    observaciones,
  };
}

export interface CotizacionOficial {
  monId: string;
  monCotiz: number;
  fchCotiz: string;
}

/** Cotización de referencia de AFIP para una moneda (FEParamGetCotizacion).
 * El propio manual del desarrollador la marca como "orientativa" — sirve
 * para prellenar/mostrar un valor, no reemplaza la que asigna ARCA al
 * autorizar un comprobante con CanMisMonExt="S". */
export async function getCotizacionOficial(params: {
  ambiente: Ambiente;
  auth: AuthParams;
  monedaId: string;
  fecha?: string;
}): Promise<CotizacionOficial> {
  const { ambiente, auth, monedaId, fecha } = params;

  const body = `<ar:FEParamGetCotizacion>
    ${authBlock(auth)}
    <ar:MonId>${xmlEscape(monedaId)}</ar:MonId>${
    fecha ? `\n    <ar:FchCotiz>${toAfipDate(fecha)}</ar:FchCotiz>` : ""
  }
  </ar:FEParamGetCotizacion>`;

  const responseBody = await callWsfeSoap({
    endpoint: AFIP_ENDPOINTS[ambiente].wsfe,
    soapAction: "http://ar.gov.afip.dif.FEV1/FEParamGetCotizacion",
    body,
  });

  const result = (responseBody as Record<string, Record<string, unknown>>)
    .FEParamGetCotizacionResponse?.FEParamGetCotizacionResult as Record<string, unknown>;

  const errors = asArray(
    (result?.Errors as Record<string, unknown>)?.Err as
      | { Code?: string; Msg?: string }
      | { Code?: string; Msg?: string }[]
      | undefined
  );
  if (errors.length > 0) {
    throw new AfipError(`AFIP rechazó la consulta de cotización: ${formatAfipIssues(errors)}`);
  }

  const resultGet = result?.ResultGet as Record<string, unknown> | undefined;
  if (!resultGet?.MonCotiz) {
    throw new AfipError("AFIP no devolvió una cotización para esa moneda.");
  }

  return {
    monId: String(resultGet.MonId ?? monedaId),
    monCotiz: Number(resultGet.MonCotiz),
    fchCotiz: resultGet.FchCotiz ? fromAfipDate(String(resultGet.FchCotiz)) : "",
  };
}
