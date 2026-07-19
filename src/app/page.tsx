import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoIcon } from "@/components/logo";

export const metadata: Metadata = {
  title: "Fisca — Facturación electrónica ARCA",
  description:
    "Facturación electrónica ARCA para monotributistas argentinos. Emití Facturas C y E con CAE real desde el celular.",
  keywords: [
    "facturación electrónica monotributista",
    "factura C ARCA",
    "factura E exportación",
    "app facturar Argentina",
    "monotributo facturación",
    "CAE monotributista",
  ],
  openGraph: {
    title: "Fisca — Facturación electrónica ARCA",
    description:
      "Facturación electrónica ARCA para monotributistas. Factura C y E con CAE, desde el celular.",
    url: "https://fisca.vercel.app",
    siteName: "Fisca",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fisca — Facturación electrónica ARCA",
    description: "Factura C y E con CAE, desde el celular.",
  },
  alternates: {
    canonical: "https://fisca.vercel.app",
  },
};

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/facturas");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-2">
          <LogoIcon className="h-9 w-9" />
          <span className="text-2xl font-semibold tracking-tight">Fisca</span>
        </div>

        <h1 className="mb-4 text-3xl font-semibold leading-tight tracking-tight">
          Facturación electrónica ARCA
        </h1>

        <p className="mb-8 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Conectás tu certificado de ARCA una sola vez. Se guarda cifrado en el
          servidor — ningún tercero lo ve, ni siquiera nosotros.
        </p>

        <Link
          href="/login"
          className="rounded-xl bg-[#003366] px-6 py-3.5 text-center text-[15px] font-semibold text-white hover:bg-[#002855] dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
        >
          Comenzar
        </Link>
      </div>
    </main>
  );
}
