export type Ambiente = "homologacion" | "produccion";

export const AFIP_ENDPOINTS: Record<Ambiente, { wsaa: string; wsfe: string }> = {
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
};

/** Servicio (`service`) del TRA para autenticarse contra WSFEv1. */
export const WSFE_SERVICE_NAME = "wsfe";
