import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Fisca — Facturá sin burocracia",
  description:
    "Facturas electrónicas con CAE de ARCA, desde tu celular. Emití Factura C y Factura E para monotributistas argentinos.",
  keywords: [
    "facturación electrónica monotributista",
    "factura C ARCA",
    "factura E exportación",
    "app facturar Argentina",
    "monotributo facturación",
    "CAE monotributista",
  ],
  openGraph: {
    title: "Fisca — Facturá sin burocracia",
    description: "Facturas electrónicas con CAE de ARCA, desde tu celular.",
    url: "https://fisca.vercel.app",
    siteName: "Fisca",
    locale: "es_AR",
    type: "website",
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
    <main
      className="flex h-dvh flex-col overflow-hidden bg-[#003366] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-1 flex-col justify-end px-8 pb-16">
        <h1 className="mb-4 text-5xl font-semibold leading-[1.05] tracking-tight">
          Facturá sin
          <br />
          burocracia.
        </h1>
        <p className="mb-10 max-w-xs text-[15px] leading-relaxed text-[#7bb0e0]">
          Facturas electrónicas con CAE de ARCA, desde tu celular.
        </p>

        <ul className="space-y-4">
          <li className="flex items-center gap-3 text-[15px]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3z" />
              <path d="M8 7h8M8 11h8M8 15h5" />
            </svg>
            <span>Factura C y E</span>
          </li>
          <li className="flex items-center gap-3 text-[15px]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            <span>CAE autorizado al instante</span>
          </li>
          <li className="flex items-center gap-3 text-[15px]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Compartí el PDF por WhatsApp</span>
          </li>
        </ul>
      </div>

      <div className="px-6 pb-8">
        <Link
          href="/signup"
          className="block rounded-2xl bg-white px-6 py-4 text-center text-[16px] font-semibold text-[#003366] active:bg-white/90"
        >
          Comenzar
        </Link>
        <Link
          href="/login"
          className="mt-3 block text-center text-sm font-medium text-white/90 active:text-white/60"
        >
          Ya tengo cuenta
        </Link>
        <p className="mt-4 text-center text-xs text-[#7bb0e0]">
          Usás tu CUIT y clave fiscal. No guardamos tu clave.
        </p>
      </div>
    </main>
  );
}
