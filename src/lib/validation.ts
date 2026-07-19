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

export const nuevaFacturaSchema = z
  .object({
    concepto: z.coerce.number().int().refine((v) => [1, 2, 3].includes(v)),
    docTipo: z.coerce.number().int().refine((v) => [80, 96, 99].includes(v)),
    docNro: z.string().trim(),
    clienteNombre: z.string().trim().max(200).optional(),
    condicionIvaReceptorId: z.coerce.number().int(),
    items: z.array(itemSchema).min(1, "Agregá al menos un ítem."),
    fechaServicioDesde: z.string().optional(),
    fechaServicioHasta: z.string().optional(),
    fechaVtoPago: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.docTipo === 99) {
      // Consumidor Final sin identificar: AFIP espera DocNro "0".
      return;
    }
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
    if (data.concepto !== 1 && (!data.fechaServicioDesde || !data.fechaServicioHasta || !data.fechaVtoPago)) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaServicioDesde"],
        message: "Para servicios, AFIP requiere fecha desde/hasta y vencimiento de pago.",
      });
    }
  });

export type NuevaFacturaFormInput = z.infer<typeof nuevaFacturaSchema>;

/** Schema para Factura E (exportación de servicios/bienes). */
export const nuevaFacturaESchema = z.object({
  clienteNombre: z.string().trim().min(1, "Falta el nombre del cliente.").max(200),
  clientePais: z.coerce.number().int().min(1),
  clienteCuitPais: z.string().trim().min(1, "Falta el CUIT del país del cliente."),
  clienteDomicilio: z.string().trim().max(300).optional(),
  clienteIdImpositivo: z.string().trim().max(50).optional(),
  monedaId: z.string().trim().min(3).max(4),
  monedaCotizacion: z.coerce.number().positive("La cotización debe ser positiva."),
  tipoExpo: z.coerce.number().int().refine((v) => [1, 2, 4].includes(v)),
  idiomaCbte: z.coerce.number().int().refine((v) => [1, 2, 3].includes(v)),
  items: z.array(itemSchema).min(1, "Agregá al menos un ítem."),
});

export type NuevaFacturaEFormInput = z.infer<typeof nuevaFacturaESchema>;
