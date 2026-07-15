/** Tipos de comprobante soportados: Factura C y su Nota de Crédito (para
 * anular una factura emitida por error). Son los únicos que un
 * monotributista puede emitir por el régimen general de WSFEv1. */
export const CBTE_TIPO_FACTURA_C = 11;
export const CBTE_TIPO_NOTA_CREDITO_C = 13;

export type Concepto = 1 | 2 | 3; // 1 Productos, 2 Servicios, 3 Productos y Servicios

export const CONCEPTOS: { value: Concepto; label: string }[] = [
  { value: 1, label: "Productos" },
  { value: 2, label: "Servicios" },
  { value: 3, label: "Productos y servicios" },
];

export type DocTipo = 80 | 96 | 99; // CUIT, DNI, Consumidor Final (sin identificar)

export const DOC_TIPOS: { value: DocTipo; label: string }[] = [
  { value: 80, label: "CUIT" },
  { value: 96, label: "DNI" },
  { value: 99, label: "Consumidor Final (sin identificar)" },
];

/** Condición frente al IVA del receptor (obligatorio desde RG 5616/2024). */
export const CONDICION_IVA_RECEPTOR = [
  { value: 1, label: "IVA Responsable Inscripto" },
  { value: 4, label: "IVA Sujeto Exento" },
  { value: 5, label: "Consumidor Final" },
  { value: 6, label: "Responsable Monotributo" },
  { value: 7, label: "Sujeto No Categorizado" },
  { value: 13, label: "Monotributista Social" },
  { value: 15, label: "IVA No Alcanzado" },
] as const;

export interface FacturaItem {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface NuevaFacturaInput {
  concepto: Concepto;
  docTipo: DocTipo;
  docNro: string;
  clienteNombre?: string;
  condicionIvaReceptorId: number;
  items: FacturaItem[];
  /** Requeridas por AFIP cuando concepto incluye Servicios (2 o 3). */
  fechaServicioDesde?: string;
  fechaServicioHasta?: string;
  fechaVtoPago?: string;
}

export interface FacturaEmitida {
  cbteTipo: number;
  puntoVenta: number;
  numeroComprobante: number;
  cae: string;
  caeVencimiento: string;
  fechaEmision: string;
  importeTotal: number;
}
