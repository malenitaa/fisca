import { LogoBolt } from "@/components/logo";

/** Idéntica a src/app/loading.tsx a propósito: RootPage redirige acá
 * (server-side, navegación nueva) cuando ya hay sesión, así que este
 * boundary se muestra justo después del splash de la raíz. Que se vean
 * exactamente igual hace que el segundo flash sea invisible — un solo
 * splash continuo, en vez de dos pantallas distintas parpadeando. */
export default function Loading() {
  return (
    <div className="fixed inset-0 h-dvh flex flex-col items-center justify-center bg-[#003366]">
      <LogoBolt className="h-24 w-24" pulse />
      <div
        className="absolute left-0 right-0 flex flex-col items-center gap-1.5"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 56px)" }}
      >
        <span className="text-base font-semibold tracking-tight text-white">fisca</span>
        <span className="text-[11px] text-[#7bb0e0]">Conectando con ARCA…</span>
      </div>
    </div>
  );
}
