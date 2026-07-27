import { z } from "zod";

const cuitRegex = /^\d{11}$/;

export const configuracionSchema = z.object({
  cuit: z
    .string()
    .transform((v) => v.replace(/[^0-9]/g, ""))
    .pipe(z.string().regex(cuitRegex, "El CUIT debe tener 11 dígitos (sin guiones).")),
  razonSocial: z.string().trim().max(200).optional(),
  puntoVenta: z.coerce.number().int().min(1).max(9999),
  ambiente: z.enum(["homologacion", "produccion"]),
  cert: z.string().min(1, "Falta el certificado (.crt)."),
  key: z.string().min(1, "Falta la clave privada (.key)."),
});

export type ConfiguracionInput = z.infer<typeof configuracionSchema>;

const itemSchema = z.object({
  descripcion: z.string().trim().min(1, "Falta la descripción.").max(300),
  cantidad: z.coerce.number().positive("La cantidad tiene que ser mayor a 0."),
  precioUnitario: z.coerce.number().positive("El precio tiene que ser mayor a 0."),
});

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
  .optional();

/** Medianoche de hoy en Argentina (UTC-3 fijo, sin horario de verano),
 * independiente de la zona horaria del proceso que ejecuta el servidor. */
function hoyArgentinaUTCms(): number {
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return Date.UTC(argNow.getUTCFullYear(), argNow.getUTCMonth(), argNow.getUTCDate());
}

/** Diferencia en días (con signo) entre una fecha ISO y hoy en Argentina. */
function diffDiasDesdeHoy(iso: string): number {
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  return Math.round((target - hoyArgentinaUTCms()) / 86_400_000);
}

export const nuevaFacturaSchema = z
  .object({
    concepto: z.coerce.number().int().refine((v) => [1, 2, 3].includes(v)),
    docTipo: z.coerce.number().int().refine((v) => [80, 96, 99].includes(v)),
    docNro: z.string().trim().max(50),
    clienteNombre: z.string().trim().max(200).optional(),
    condicionIvaReceptorId: z.coerce.number().int(),
    items: z.array(itemSchema).min(1, "Agregá al menos un ítem."),
    fechaComprobante: isoDateSchema,
    fechaServicioDesde: isoDateSchema,
    fechaServicioHasta: isoDateSchema,
    fechaVtoPago: isoDateSchema,
    monedaId: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{3,4}$/, "Moneda inválida.")
      .optional(),
    monedaCotizacion: z.coerce.number().positive("La cotización debe ser positiva.").optional(),
    canMisMonExt: z.enum(["S", "N"]).optional(),
  })
  .superRefine((data, ctx) => {
    // Consumidor Final (docTipo 99) sin identificar: AFIP espera DocNro "0",
    // así que el CUIT/DNI no se valida. El resto de las reglas (fechas de
    // servicio, rango de fechaComprobante) rigen para cualquier docTipo.
    if (data.docTipo !== 99) {
      const digits = data.docNro.replace(/[^0-9]/g, "");
      if (data.docTipo === 80 && digits.length !== 11) {
        ctx.addIssue({
          code: "custom",
          path: ["docNro"],
          message: "El CUIT del cliente debe tener 11 dígitos.",
        });
      }
      if (data.docTipo === 96 && (digits.length < 7 || digits.length > 8)) {
        ctx.addIssue({
          code: "custom",
          path: ["docNro"],
          message: "El DNI del cliente debe tener 7 u 8 dígitos.",
        });
      }
    }
    if (data.concepto !== 1 && (!data.fechaServicioDesde || !data.fechaServicioHasta || !data.fechaVtoPago)) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaServicioDesde"],
        message: "Para servicios, AFIP requiere fecha desde/hasta y vencimiento de pago.",
      });
    }
    if (data.fechaComprobante) {
      // AFIP: hasta 5 días (Productos) o 10 días (Servicios / Productos y Servicios)
      // de diferencia respecto a hoy, en cualquier sentido.
      const limite = data.concepto === 1 ? 5 : 10;
      if (Math.abs(diffDiasDesdeHoy(data.fechaComprobante)) > limite) {
        ctx.addIssue({
          code: "custom",
          path: ["fechaComprobante"],
          message: `La fecha del comprobante no puede diferir más de ${limite} días de hoy para este concepto.`,
        });
      }
    }
    if (data.monedaId && data.monedaId !== "PES") {
      // RG 5616/2024: en moneda extranjera hay que indicar si el pago es en
      // la misma moneda (ARCA asigna la cotización) o en pesos (la informa
      // el emisor).
      if (data.canMisMonExt !== "S" && data.canMisMonExt !== "N") {
        ctx.addIssue({
          code: "custom",
          path: ["canMisMonExt"],
          message: "Indicá si el pago se realiza en la misma moneda o en pesos.",
        });
      } else if (data.canMisMonExt === "N" && !(data.monedaCotizacion && data.monedaCotizacion > 0)) {
        ctx.addIssue({
          code: "custom",
          path: ["monedaCotizacion"],
          message: "Ingresá la cotización usada para convertir a pesos.",
        });
      }
    }
  });

export type NuevaFacturaFormInput = z.infer<typeof nuevaFacturaSchema>;

/** Schema para Factura E (exportación de servicios/bienes). */
export const nuevaFacturaESchema = z.object({
  clienteNombre: z.string().trim().min(1, "Falta el nombre del cliente.").max(200),
  clientePais: z.coerce.number().int().min(1),
  // Cuit_pais_cliente de AFIP es solo dígitos (ej 50000000059 para Estados Unidos).
  clienteCuitPais: z
    .string()
    .trim()
    .regex(/^\d{1,15}$/, "El CUIT del país tiene que ser numérico."),
  clienteDomicilio: z.string().trim().min(1, "El domicilio del cliente es obligatorio.").max(300),
  clienteIdImpositivo: z.string().trim().max(50).optional(),
  // Moneda: código AFIP de 3 letras (DOL, PES, EUR, ...) mayúscula.
  monedaId: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{3,4}$/, "Moneda inválida."),
  monedaCotizacion: z.coerce.number().positive("La cotización debe ser positiva."),
  tipoExpo: z.coerce.number().int().refine((v) => [1, 2, 4].includes(v)),
  idiomaCbte: z.coerce.number().int().refine((v) => [1, 2, 3].includes(v)),
  fechaPago: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
    .optional(),
  items: z.array(itemSchema).min(1, "Agregá al menos un ítem."),
}).superRefine((data, ctx) => {
  // ARCA exige Fecha_pago cuando tipo_expo es servicios (2) u otros (4).
  if ((data.tipoExpo === 2 || data.tipoExpo === 4) && !data.fechaPago) {
    ctx.addIssue({
      code: "custom",
      path: ["fechaPago"],
      message: "La fecha de pago es obligatoria en Factura E de servicios/otros.",
    });
  }
});

/** Edición manual de un contacto de la libreta (solo nombre/condición IVA
 * — el tipo/número de documento es la identidad del contacto y no se
 * edita, para no chocar con el unique(user_id, doc_tipo, doc_numero)). */
export const clienteUpdateSchema = z
  .object({
    nombre: z.string().trim().max(200).optional(),
    condicionIvaId: z.coerce.number().int().optional(),
  })
  .refine((d) => d.nombre !== undefined || d.condicionIvaId !== undefined, {
    message: "No hay nada para actualizar.",
  });

export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>;

export type NuevaFacturaEFormInput = z.infer<typeof nuevaFacturaESchema>;
