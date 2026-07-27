import { describe, it, expect } from "vitest";
import { nuevaFacturaSchema } from "../validation";

/** Misma referencia horaria que usa validation.ts: "hoy" en Argentina
 * (UTC-3 fijo), para no depender de la zona horaria de quien corre el test. */
function argISO(offsetDays: number): string {
  const arg = new Date(Date.now() - 3 * 60 * 60 * 1000);
  arg.setUTCDate(arg.getUTCDate() + offsetDays);
  return `${arg.getUTCFullYear()}-${String(arg.getUTCMonth() + 1).padStart(2, "0")}-${String(
    arg.getUTCDate()
  ).padStart(2, "0")}`;
}

const base = {
  docTipo: 99 as const,
  docNro: "0",
  condicionIvaReceptorId: 5,
  items: [{ descripcion: "Consultoría", cantidad: 1, precioUnitario: 1000 }],
};

describe("nuevaFacturaSchema — rango de fechaComprobante", () => {
  it("acepta hoy sin fechaComprobante (AFIP usa la fecha de asignación del CAE)", () => {
    const result = nuevaFacturaSchema.safeParse({ ...base, concepto: 1 });
    expect(result.success).toBe(true);
  });

  it("Productos: acepta hasta 5 días antes o después", () => {
    for (const offset of [-5, 0, 5]) {
      const result = nuevaFacturaSchema.safeParse({
        ...base,
        concepto: 1,
        fechaComprobante: argISO(offset),
      });
      expect(result.success, `offset ${offset} debería ser válido`).toBe(true);
    }
  });

  it("Productos: rechaza 6 días antes o después", () => {
    for (const offset of [-6, 6]) {
      const result = nuevaFacturaSchema.safeParse({
        ...base,
        concepto: 1,
        fechaComprobante: argISO(offset),
      });
      expect(result.success, `offset ${offset} debería ser inválido`).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["fechaComprobante"]);
      }
    }
  });

  it("Servicios: acepta hasta 10 días antes o después", () => {
    for (const offset of [-10, 0, 10]) {
      const result = nuevaFacturaSchema.safeParse({
        ...base,
        concepto: 2,
        fechaComprobante: argISO(offset),
        fechaServicioDesde: argISO(offset),
        fechaServicioHasta: argISO(offset),
        fechaVtoPago: argISO(offset),
      });
      expect(result.success, `offset ${offset} debería ser válido`).toBe(true);
    }
  });

  it("Servicios: rechaza 11 días antes o después", () => {
    for (const offset of [-11, 11]) {
      const result = nuevaFacturaSchema.safeParse({
        ...base,
        concepto: 2,
        fechaComprobante: argISO(offset),
        fechaServicioDesde: argISO(offset),
        fechaServicioHasta: argISO(offset),
        fechaVtoPago: argISO(offset),
      });
      expect(result.success, `offset ${offset} debería ser inválido`).toBe(false);
    }
  });
});

describe("nuevaFacturaSchema — moneda extranjera (RG 5616/2024)", () => {
  it("sin monedaId (pesos) no exige canMisMonExt ni cotización", () => {
    const result = nuevaFacturaSchema.safeParse({ ...base, concepto: 1 });
    expect(result.success).toBe(true);
  });

  it("con monedaId y canMisMonExt=S no exige monedaCotizacion (ARCA la asigna)", () => {
    const result = nuevaFacturaSchema.safeParse({
      ...base,
      concepto: 1,
      monedaId: "DOL",
      canMisMonExt: "S",
    });
    expect(result.success).toBe(true);
  });

  it("con monedaId y canMisMonExt=N exige monedaCotizacion > 0", () => {
    const sinCotizacion = nuevaFacturaSchema.safeParse({
      ...base,
      concepto: 1,
      monedaId: "DOL",
      canMisMonExt: "N",
    });
    expect(sinCotizacion.success).toBe(false);
    if (!sinCotizacion.success) {
      expect(sinCotizacion.error.issues[0].path).toEqual(["monedaCotizacion"]);
    }

    const conCotizacion = nuevaFacturaSchema.safeParse({
      ...base,
      concepto: 1,
      monedaId: "DOL",
      canMisMonExt: "N",
      monedaCotizacion: 1481,
    });
    expect(conCotizacion.success).toBe(true);
  });

  it("con monedaId pero sin canMisMonExt rechaza (hay que indicar cómo se paga)", () => {
    const result = nuevaFacturaSchema.safeParse({ ...base, concepto: 1, monedaId: "DOL" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["canMisMonExt"]);
    }
  });
});
