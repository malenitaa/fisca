import { AFIP_ENDPOINTS, type Ambiente } from "./config";
import { AfipError } from "./errors";
import { callWsfeSoap } from "./soap";
import { CBTE_TIPO_FACTURA_E, type FacturaItem } from "./types";

/** WSFEXv1 devuelve un único bloque `<FEXErr><ErrCode>N</ErrCode><ErrMsg>...</ErrMsg></FEXErr>`
 * (ErrCode 0 = sin error). No es un array como en WSFEv1. */
function throwIfFexErr(result: Record<string, unknown> | undefined, ctx: string): void {
  const fexErr = result?.FEXErr as { ErrCode?: unknown; ErrMsg?: unknown } | undefined;
  if (!fexErr) return;
  const code = Number(fexErr.ErrCode ?? 0);
  if (code === 0) return;
  const msg = String(fexErr.ErrMsg ?? "sin detalle");
  throw new AfipError(`AFIP (WSFEXv1) rechazó ${ctx}: [${code}] ${msg}`);
}

const WSFEX_NAMESPACE = "http://ar.gov.afip.dif.fexv1/";
const WSFEX_SOAP_ACTION_PREFIX = "http://ar.gov.afip.dif.fexv1/";
const WSFEX_SERVICE_NAME = "WSFEXv1";

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

function fromAfipDate(afipDate: string): string {
  return `${afipDate.slice(0, 4)}-${afipDate.slice(4, 6)}-${afipDate.slice(6, 8)}`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function importeTotalE(items: FacturaItem[]): number {
  return (
    Math.round(items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0) * 100) / 100
  );
}

/** Consulta el ID de la última operación registrada en WSFEXv1 (para armar
 * el próximo). Se pide un `Id` monotónico por CUIT. */
async function getUltimoIdOperacion(params: { ambiente: Ambiente; auth: AuthParams }): Promise<number> {
  const { ambiente, auth } = params;

  const body = `<ar:FEXGetLast_ID>
    ${authBlock(auth)}
  </ar:FEXGetLast_ID>`;

  const responseBody = await callWsfeSoap({
    endpoint: AFIP_ENDPOINTS[ambiente].wsfex,
    soapAction: `${WSFEX_SOAP_ACTION_PREFIX}FEXGetLast_ID`,
    body,
    namespace: WSFEX_NAMESPACE,
    serviceName: WSFEX_SERVICE_NAME,
  });

  const result = (responseBody as Record<string, Record<string, unknown>>)
    .FEXGetLast_IDResponse?.FEXGetLast_IDResult as Record<string, unknown>;

  throwIfFexErr(result, "FEXGetLast_ID");

  return Number((result?.FEX_event as Record<string, unknown>)?.Id ?? result?.Id ?? 0);
}

/** Devuelve el próximo número de Factura E (o NC E) a usar para un punto
 * de venta dado. */
export async function getProximoNumeroComprobanteE(params: {
  ambiente: Ambiente;
  auth: AuthParams;
  puntoVenta: number;
  cbteTipo?: number;
}): Promise<number> {
  const { ambiente, auth, puntoVenta, cbteTipo = CBTE_TIPO_FACTURA_E } = params;

  // FEXGetLast_CMP mete Pto_venta y Cbte_Tipo DENTRO del bloque <Auth>
  // (tipo ClsFEX_LastCMP en el WSDL, no ClsFEXAuthRequest).
  const body = `<ar:FEXGetLast_CMP>
    <ar:Auth>
      <ar:Token>${auth.token}</ar:Token>
      <ar:Sign>${auth.sign}</ar:Sign>
      <ar:Cuit>${auth.cuit}</ar:Cuit>
      <ar:Pto_venta>${puntoVenta}</ar:Pto_venta>
      <ar:Cbte_Tipo>${cbteTipo}</ar:Cbte_Tipo>
    </ar:Auth>
  </ar:FEXGetLast_CMP>`;

  const responseBody = await callWsfeSoap({
    endpoint: AFIP_ENDPOINTS[ambiente].wsfex,
    soapAction: `${WSFEX_SOAP_ACTION_PREFIX}FEXGetLast_CMP`,
    body,
    namespace: WSFEX_NAMESPACE,
    serviceName: WSFEX_SERVICE_NAME,
  });

  const result = (responseBody as Record<string, Record<string, unknown>>)
    .FEXGetLast_CMPResponse?.FEXGetLast_CMPResult as Record<string, unknown>;

  throwIfFexErr(result, "la consulta del último comprobante E");

  const cbteNro = Number(
    (result?.FEXResult_LastCMP as Record<string, unknown>)?.Cbte_nro ?? 0
  );
  return cbteNro + 1;
}

export interface NuevaFacturaEInput {
  clienteNombre: string;
  clientePais: number; // Dst_cmp (código país AFIP)
  clienteCuitPais: string; // Cuit_pais_cliente (formato AFIP: 500...)
  clienteDomicilio?: string;
  clienteIdImpositivo?: string; // ID fiscal extranjero, opcional
  monedaId: string; // e.g. "DOL"
  monedaCotizacion: number;
  tipoExpo: 1 | 2 | 4; // 1=servicios, 2=bienes, 4=otros
  idiomaCbte: 1 | 2 | 3; // 1=ES, 2=EN, 3=PT
  items: FacturaItem[];
}

export interface CaeEResult {
  cae: string;
  caeFchVto: string;
  numeroComprobante: number;
  fechaEmision: string;
  observaciones: string[];
}

/** Pide CAE para una Factura E (o NC E). WSFEXv1 usa un esquema
 * completamente distinto al de WSFEv1: sin discriminación de IVA
 * (por definición, la exportación es no gravada). */
export async function solicitarCaeE(params: {
  ambiente: Ambiente;
  auth: AuthParams;
  puntoVenta: number;
  numeroComprobante: number;
  factura: NuevaFacturaEInput;
  importeTotal: number;
  cbteTipo?: number;
  idOperacion?: number;
}): Promise<CaeEResult> {
  const {
    ambiente,
    auth,
    puntoVenta,
    numeroComprobante,
    factura,
    importeTotal,
    cbteTipo = CBTE_TIPO_FACTURA_E,
  } = params;

  const idOperacion =
    params.idOperacion ?? (await getUltimoIdOperacion({ ambiente, auth })) + 1;

  const fechaEmision = todayYYYYMMDD();

  const itemsXml = factura.items
    .map(
      (it, i) => `<ar:Item>
              <ar:Pro_codigo>${String(i + 1).padStart(3, "0")}</ar:Pro_codigo>
              <ar:Pro_ds>${xmlEscape(it.descripcion)}</ar:Pro_ds>
              <ar:Pro_qty>${it.cantidad}</ar:Pro_qty>
              <ar:Pro_umed>7</ar:Pro_umed>
              <ar:Pro_precio_uni>${it.precioUnitario.toFixed(2)}</ar:Pro_precio_uni>
              <ar:Pro_total_item>${(it.cantidad * it.precioUnitario).toFixed(2)}</ar:Pro_total_item>
            </ar:Item>`
    )
    .join("\n            ");

  const body = `<ar:FEXAuthorize>
    ${authBlock(auth)}
    <ar:Cmp>
      <ar:Id>${idOperacion}</ar:Id>
      <ar:Fecha_cbte>${fechaEmision}</ar:Fecha_cbte>
      <ar:Cbte_Tipo>${cbteTipo}</ar:Cbte_Tipo>
      <ar:Punto_vta>${puntoVenta}</ar:Punto_vta>
      <ar:Cbte_nro>${numeroComprobante}</ar:Cbte_nro>
      <ar:Tipo_expo>${factura.tipoExpo}</ar:Tipo_expo>
      <ar:Permiso_existente>${factura.tipoExpo === 1 ? "N" : "S"}</ar:Permiso_existente>
      <ar:Dst_cmp>${factura.clientePais}</ar:Dst_cmp>
      <ar:Cliente>${xmlEscape(factura.clienteNombre)}</ar:Cliente>
      <ar:Cuit_pais_cliente>${factura.clienteCuitPais}</ar:Cuit_pais_cliente>
      <ar:Domicilio_cliente>${xmlEscape(factura.clienteDomicilio ?? "")}</ar:Domicilio_cliente>
      <ar:Id_impositivo>${xmlEscape(factura.clienteIdImpositivo ?? "")}</ar:Id_impositivo>
      <ar:Moneda_Id>${factura.monedaId}</ar:Moneda_Id>
      <ar:Moneda_ctz>${factura.monedaCotizacion.toFixed(6)}</ar:Moneda_ctz>
      <ar:Obs_comerciales></ar:Obs_comerciales>
      <ar:Imp_total>${importeTotal.toFixed(2)}</ar:Imp_total>
      <ar:Obs></ar:Obs>
      <ar:Idioma_cbte>${factura.idiomaCbte}</ar:Idioma_cbte>
      <ar:Items>
          ${itemsXml}
      </ar:Items>
    </ar:Cmp>
  </ar:FEXAuthorize>`;

  const responseBody = await callWsfeSoap({
    endpoint: AFIP_ENDPOINTS[ambiente].wsfex,
    soapAction: `${WSFEX_SOAP_ACTION_PREFIX}FEXAuthorize`,
    body,
    namespace: WSFEX_NAMESPACE,
    serviceName: WSFEX_SERVICE_NAME,
  });

  const result = (responseBody as Record<string, Record<string, unknown>>).FEXAuthorizeResponse
    ?.FEXAuthorizeResult as Record<string, unknown>;

  throwIfFexErr(result, "la Factura E");

  const auth_ = result?.FEXResultAuth as Record<string, unknown> | undefined;
  if (!auth_) {
    throw new AfipError("AFIP no devolvió el detalle de autorización de la Factura E.");
  }

  const motivosObs = auth_.Motivos_Obs as
    | { Motivo_Obs_Cod?: unknown; Motivo_Obs_Msg?: unknown }
    | Array<{ Motivo_Obs_Cod?: unknown; Motivo_Obs_Msg?: unknown }>
    | undefined;
  const observacionesArray = Array.isArray(motivosObs) ? motivosObs : motivosObs ? [motivosObs] : [];
  const observaciones = observacionesArray
    .filter((o) => o && (o.Motivo_Obs_Cod || o.Motivo_Obs_Msg))
    .map(
      (o) =>
        `[${o.Motivo_Obs_Cod ?? "?"}] ${o.Motivo_Obs_Msg ?? "sin detalle"}`
    );

  if (auth_.Resultado !== "A") {
    throw new AfipError(
      `AFIP rechazó la Factura E (resultado: ${auth_.Resultado}). ${
        observaciones.length > 0 ? observaciones.join(" | ") : "Sin observaciones detalladas."
      }`
    );
  }

  if (!auth_.Cae || !auth_.Fch_venc_Cae) {
    throw new AfipError(
      "AFIP aprobó la Factura E pero no devolvió CAE. Reintentá la operación."
    );
  }

  return {
    cae: String(auth_.Cae),
    caeFchVto: fromAfipDate(String(auth_.Fch_venc_Cae)),
    numeroComprobante,
    fechaEmision: fromAfipDate(fechaEmision),
    observaciones,
  };
}
