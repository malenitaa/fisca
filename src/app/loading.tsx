import { LogoBolt } from "@/components/logo";

export default function Loading() {
  return (
    <div
      className="fixed inset-0 h-dvh flex flex-col items-center justify-center bg-[#003366]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div style={{ animation: "fisca-splash-in .7s cubic-bezier(.2,.8,.2,1) both" }}>
        <LogoBolt className="h-24 w-24" pulse />
      </div>
      <div className="absolute bottom-14 flex flex-col items-center gap-1.5">
        <span
          className="text-base font-semibold tracking-tight text-white"
          style={{ animation: "fisca-splash-in .7s .15s cubic-bezier(.2,.8,.2,1) both" }}
        >
          fisca
        </span>
        <span
          className="text-[11px] text-[#7bb0e0]"
          style={{ animation: "fisca-splash-in .7s .3s cubic-bezier(.2,.8,.2,1) both" }}
        >
          Conectando con ARCA…
        </span>
      </div>
    </div>
  );
}
