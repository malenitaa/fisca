/** Ícono de Fisca: rayo blanco sobre cuadrado azul ARCA redondeado.
 * Usado en el header de la app y como marca visual. */
export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-[#003366] text-white dark:bg-[#4a90c8] ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="currentColor"
        aria-hidden
      >
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    </span>
  );
}
