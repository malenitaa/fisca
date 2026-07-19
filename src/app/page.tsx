import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Landing pública, orientada a SEO. Usuarios autenticados se redirigen
// directo a la app; los no autenticados ven este contenido indexable.
export const metadata: Metadata = {
  title: "Fisca — Facturación electrónica ARCA para monotributistas | Factura C y E desde el celular",
  description:
    "Emití Facturas C (mercado interno) y Facturas E (exportación de servicios como Deel, Upwork) con CAE real de ARCA en 30 segundos desde tu teléfono. Sin dashboards, sin terceros que toquen tu clave fiscal.",
  keywords: [
    "facturación electrónica monotributista",
    "factura C ARCA",
    "factura E exportación",
    "app facturar Argentina",
    "facturar Deel Argentina",
    "monotributo facturación",
    "AFIP factura app",
    "CAE monotributista",
  ],
  openGraph: {
    title: "Fisca — Facturación electrónica ARCA para monotributistas",
    description:
      "Factura C y Factura E con CAE, desde el celular, en 30 segundos. Sin gestión contable, sin dashboards.",
    url: "https://fisca.vercel.app",
    siteName: "Fisca",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fisca — Facturación ARCA en 30 segundos",
    description: "Factura C y E, CAE real, desde el celular. Sin dashboards.",
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
    <main className="min-h-dvh bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-12 sm:py-20">
        <header className="mb-16 flex items-center justify-between">
          <span className="text-lg font-semibold">Fisca</span>
          <Link
            href="/login"
            className="rounded-md bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-[#002855] dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
          >
            Ingresar
          </Link>
        </header>

        <section className="mb-16 flex-1">
          <h1 className="mb-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Facturación electrónica ARCA para monotributistas.
            <br />
            <span className="text-[#003366] dark:text-[#7bb0e0]">
              Sin dashboards, sin fricción.
            </span>
          </h1>

          {/* BAB: Before */}
          <p className="mb-4 text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
            <strong>Sos monotributista</strong> y facturar te lleva 20 minutos: la web de
            ARCA se cuelga, los sistemas contables te obligan a pagar por dashboards que
            no vas a usar, y las apps &quot;fáciles&quot; mandan tu certificado a un
            servidor tercero para que firmen la autenticación por vos.
          </p>

          {/* BAB: After */}
          <p className="mb-4 text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
            <strong>Con Fisca son 30 segundos</strong>: abrís la app en el teléfono,
            tocás un cliente reciente, cargás los ítems, y ya tenés el PDF con CAE listo
            para mandar por WhatsApp. Emitís Factura C para clientes de Argentina o
            Factura E si trabajás por Deel, Upwork o cualquier plataforma extranjera.
          </p>

          {/* BAB: Bridge */}
          <p className="mb-10 text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
            <strong>Conectás tu certificado de ARCA una sola vez</strong>. Se guarda
            cifrado en el servidor de Fisca — ningún tercero lo ve, ni siquiera nosotros.
            Después es abrir, tocar, facturar.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-[#003366] px-6 py-3 text-base font-medium text-white hover:bg-[#002855] dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
          >
            Empezar gratis →
          </Link>
        </section>

        <section aria-labelledby="features" className="mb-16 border-t border-neutral-200 pt-12 dark:border-neutral-800">
          <h2 id="features" className="mb-8 text-2xl font-semibold">
            Lo que hace Fisca
          </h2>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <li>
              <h3 className="mb-1 font-medium">Factura C (mercado interno)</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Para clientes en Argentina. CAE real de ARCA vía WSFEv1, en pesos, con
                QR y PDF listo para descargar.
              </p>
            </li>
            <li>
              <h3 className="mb-1 font-medium">Factura E (exportación)</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Para Deel, Upwork y cualquier cliente del exterior. En USD, EUR o la
                moneda que uses, con cotización del BNA y el destino correcto.
              </p>
            </li>
            <li>
              <h3 className="mb-1 font-medium">Clientes recientes al toque</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Cada factura guarda al cliente automáticamente. La próxima vez que le
                facturás lo elegís con un tap y se autocompletan CUIT, IVA y nombre.
              </p>
            </li>
            <li>
              <h3 className="mb-1 font-medium">Historial con filtros</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Filtrás por mes, por estado (válidas/anuladas), por tipo. Descargás
                cualquier PDF de nuevo cuando quieras.
              </p>
            </li>
            <li>
              <h3 className="mb-1 font-medium">Instalable en iPhone y Android</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Se instala como PWA desde Safari o Chrome — ícono en el home, modo
                pantalla completa, sin barras de navegador.
              </p>
            </li>
            <li>
              <h3 className="mb-1 font-medium">Tu clave privada no la ve nadie</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Cifrado AES-256-GCM en reposo. Ningún tercero entre Fisca y ARCA. El
                único lugar donde tu clave se usa es para firmar el pedido al WS de
                AFIP.
              </p>
            </li>
          </ul>
        </section>

        <footer className="border-t border-neutral-200 pt-6 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <p>
            Hecho por{" "}
            <a
              href="https://github.com/malenitaa/fisca"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              malenitaa
            </a>{" "}
            · Código abierto en GitHub · No es servicio oficial de ARCA / AFIP.
          </p>
        </footer>
      </div>
    </main>
  );
}
