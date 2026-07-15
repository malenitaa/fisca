const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Período actual en formato 'YYYY-MM'. */
export function periodoActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function periodoLabel(periodo: string): string {
  const [year, month] = periodo.split("-");
  return `${MESES[Number(month) - 1]} ${year}`;
}
