/** Marca de Fisca (1c del design): rayo geométrico blanco sobre cuadrado
 * azul ARCA redondeado. Diseñado para leerse desde 16px hasta 512px. */
export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      aria-hidden
    >
      <rect width="512" height="512" rx="115" fill="#003366" />
      <path
        d="M292 96 L172 300 H248 L226 416 L346 212 H270 Z"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="26"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Rayo de Fisca sin el contenedor cuadrado (2e del design): sólo la marca
 * blanca, recortada a su bounding box. Pensado para fondos ya azules
 * (splash). `pulse` la hace latir como indicador de carga. */
export function LogoBolt({
  className = "",
  pulse = false,
}: {
  className?: string;
  pulse?: boolean;
}) {
  return (
    <svg viewBox="128 56 256 400" className={className} aria-hidden>
      <path
        d="M292 96 L172 300 H248 L226 416 L346 212 H270 Z"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="26"
        strokeLinejoin="round"
        style={pulse ? { animation: "fisca-splash-pulse 1.4s ease-in-out infinite" } : undefined}
      />
    </svg>
  );
}
