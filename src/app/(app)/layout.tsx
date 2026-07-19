import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomTabs } from "@/components/bottom-tabs";
import { ShakeToFeedback } from "@/components/shake-to-feedback";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Arquitectura anti-scroll-de-página:
  // - El contenedor está `fixed inset-0` (anclado al viewport).
  // - Main es `flex-1 overflow-y-auto` — SCROLL INTERNO, no de página.
  // - BottomTabs es shrink-0, hijo natural del flex column: siempre al
  //   fondo del contenedor, sin moverse jamás.
  // La página en sí (body) nunca scrollea, por eso el tab bar queda
  // realmente fijo en Capacitor iOS WebView.
  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-2xl px-4 pt-4">{children}</div>
      </main>
      <BottomTabs />
      <ShakeToFeedback />
    </div>
  );
}
