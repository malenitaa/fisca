import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomTabs } from "@/components/bottom-tabs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 sm:pt-8">
        {children}
      </main>
      <BottomTabs />
    </div>
  );
}
