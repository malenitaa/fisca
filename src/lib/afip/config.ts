export type Ambiente = "homologacion" | "produccion";

export const AFIP_ENDPOINTS: Record<
  Ambiente,
  { wsaa: string; wsfe: string; wsfex: string }
> = {
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
    wsfex: "https://wswhomo.afip.gov.ar/wsfexv1/service.asmx",
  },
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
    wsfex: "https://servicios1.afip.gov.ar/wsfexv1/service.asmx",
  },
};

/** Servicio (`service`) del TRA para autenticarse contra WSFEv1
 * (Factura C — mercado interno). */
export const WSFE_SERVICE_NAME = "wsfe";

/** Servicio (`service`) del TRA para autenticarse contra WSFEXv1
 * (Factura E — exportación). Es un TA aparte del de WSFEv1. */
export const WSFEX_SERVICE_NAME = "wsfex";
