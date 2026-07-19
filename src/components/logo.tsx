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
