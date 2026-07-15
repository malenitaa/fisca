import QRCode from "qrcode";

/**
 * Genera el código QR obligatorio en comprobantes electrónicos (RG 4892/2020).
 * Devuelve un data URL (PNG en base64) listo para incrustar en el PDF.
 */
export async function generarQrDataUrl(params: {
  cuitEmisor: string;
  fechaEmision: string; // yyyy-MM-dd
  puntoVenta: number;
  cbteTipo: number;
  numeroComprobante: number;
  importeTotal: number;
  docTipoReceptor: number;
  docNroReceptor: string;
  cae: string;
}): Promise<string> {
  const payload = {
    ver: 1,
    fecha: params.fechaEmision,
    cuit: Number(params.cuitEmisor),
    ptoVta: params.puntoVenta,
    tipoCmp: params.cbteTipo,
    nroCmp: params.numeroComprobante,
    importe: params.importeTotal,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: params.docTipoReceptor,
    nroDocRec: Number(params.docNroReceptor) || 0,
    tipoCodAut: "E",
    codAut: Number(params.cae),
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const url = `https://www.afip.gob.ar/fe/qr/?p=${base64Payload}`;

  return QRCode.toDataURL(url, { margin: 1, width: 200 });
}
