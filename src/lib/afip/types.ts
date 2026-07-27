/** Tipos de comprobante soportados por la app:
 *
 * - **Factura C / NC C** (WSFEv1): mercado interno, en pesos, únicos
 *   que un monotributista puede emitir para clientes locales.
 * - **Factura E / NC E** (WSFEXv1): exportación de servicios (o bienes),
 *   típicamente en dólares. Un monotributista habilitado como exportador
 *   puede emitirlas para clientes del exterior (ej. Deel, Upwork).
 */
export const CBTE_TIPO_FACTURA_C = 11;
export const CBTE_TIPO_NOTA_CREDITO_C = 13;
export const CBTE_TIPO_FACTURA_E = 19;
export const CBTE_TIPO_NOTA_CREDITO_E = 21;

/** Monedas aceptadas por WSFEXv1. Los códigos son los de AFIP
 * (`FEXGetPARAM_MON`). USD es la más común para contractors por Deel. */
export const MONEDAS = [
  { value: "DOL", label: "Dólar estadounidense (USD)", symbol: "US$" },
  { value: "060", label: "Euro (EUR)", symbol: "€" },
  { value: "021", label: "Libra esterlina (GBP)", symbol: "£" },
  { value: "012", label: "Real (BRL)", symbol: "R$" },
] as const;

export type MonedaId = (typeof MONEDAS)[number]["value"];

/** Tipo de exportación (WSFEXv1 `Tipo_expo`). Los valores son de AFIP:
 * 1 = mercadería (requiere Incoterms), 2 = servicios (típico Deel), 4 = otros. */
export const TIPO_EXPO = [
  { value: 2, label: "Exportación de servicios" },
  { value: 1, label: "Exportación de bienes" },
  { value: 4, label: "Otros" },
] as const;

/** Idioma del comprobante en Factura E (WSFEXv1 `Idioma_cbte`). */
export const IDIOMA_CBTE = [
  { value: 1, label: "Español" },
  { value: 2, label: "Inglés" },
  { value: 3, label: "Portugués" },
] as const;

/** Países de destino más frecuentes para contractors argentinos.
 * `codigoPais` es el "Dst_cmp" de AFIP y `cuitPais` es el "Cuit_pais_cliente"
 * que AFIP asigna a cada país (persona jurídica). Lista incompleta pero
 * cubre los casos reales de Deel/Upwork. */
export const PAISES = [
  { codigoPais: 200, cuitPais: "50000000059", label: "Estados Unidos" },
  { codigoPais: 212, cuitPais: "55000000067", label: "Reino Unido" },
  { codigoPais: 218, cuitPais: "55000004744", label: "Alemania" },
  { codigoPais: 224, cuitPais: "55000005449", label: "Francia" },
  { codigoPais: 221, cuitPais: "55000004485", label: "España" },
  { codigoPais: 249, cuitPais: "55000006356", label: "Países Bajos" },
  { codigoPais: 203, cuitPais: "55000015310", label: "Canadá" },
  { codigoPais: 202, cuitPais: "55000007085", label: "México" },
  { codigoPais: 105, cuitPais: "50000000521", label: "Brasil" },
  { codigoPais: 219, cuitPais: "55000009381", label: "Italia" },
  { codigoPais: 999, cuitPais: "55000000000", label: "Otro (verificar en ARCA)" },
] as const;

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
  /** Fecha del comprobante (CbteFch). Si no se especifica, AFIP usa la fecha
   * de asignación del CAE. AFIP acepta hasta 5 días (Productos) o 10 días
   * (Servicios) de diferencia respecto a hoy. */
  fechaComprobante?: string;
  /** Moneda del comprobante (RG 5616/2024). Si no se especifica, es pesos. */
  monedaId?: string;
  /** Cotización de la moneda. Obligatoria si monedaId no es PES y
   * canMisMonExt !== "S" (si el pago es en la misma moneda extranjera,
   * ARCA asigna el tipo de cambio automáticamente). */
  monedaCotizacion?: number;
  /** Si el pago del comprobante se realiza en la misma moneda extranjera
   * facturada ("S") o en pesos ("N"). Solo aplica si monedaId no es PES. */
  canMisMonExt?: "S" | "N";
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
