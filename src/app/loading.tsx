import { LogoBolt } from "@/components/logo";

export default function Loading() {
  return (
    <div className="fixed inset-0 h-dvh flex flex-col items-center justify-center bg-[#003366]">
      <div style={{ animation: "fisca-splash-in .9s cubic-bezier(.2,.8,.2,1) both" }}>
        <LogoBolt className="h-24 w-24" pulse />
      </div>
      <div
        className="absolute left-0 right-0 flex flex-col items-center gap-1.5"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 56px)" }}
      >
        <span
          className="text-base font-semibold tracking-tight text-white"
          style={{ animation: "fisca-splash-in .9s .15s cubic-bezier(.2,.8,.2,1) both" }}
        >
          fisca
        </span>
        <span
          className="text-[11px] text-[#7bb0e0]"
          style={{ animation: "fisca-splash-in .9s .3s cubic-bezier(.2,.8,.2,1) both" }}
        >
          Conectando con ARCA…
        </span>
      </div>
    </div>
  );
}
