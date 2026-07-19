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

  return (
    <div className="min-h-svh">
      <main
        className="mx-auto w-full max-w-2xl px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
      >
        {children}
      </main>
      <BottomTabs />
      <ShakeToFeedback />
    </div>
  );
}
