import Link from "next/link";
import { getAfipStatus } from "@/lib/afip/status";
import { FeedbackRow } from "@/components/feedback-row";

const FAQS: { pregunta: string; respuesta: React.ReactNode }[] = [
  {
    pregunta: "¿Cómo anulo una factura?",
    respuesta: (
      <>
        En Historial, tocá la factura y después &quot;Anular&quot;. Emite una
        Nota de Crédito con su propio CAE que ARCA asocia a la original. No
        se puede borrar una factura con CAE — es un comprobante fiscal real.
      </>
    ),
  },
  {
    pregunta: "¿Qué pasa si me paso de categoría?",
    respuesta: (
      <>
        El monotributo tiene topes de facturación por categoría, revisados
        cada 6 meses. Si te pasás, hay que recategorizarse en el portal de
        ARCA (en enero o julio). La app te muestra cuánto llevás facturado
        en el mes en el resumen de Historial para que puedas seguirlo.
      </>
    ),
  },
  {
    pregunta: "¿Cuándo uso Factura C o E?",
    respuesta: (
      <>
        <strong>C</strong> para clientes en Argentina, en pesos.{" "}
        <strong>E</strong> para clientes en el exterior (Deel, freelance
        para empresas extranjeras, exportación de servicios).
      </>
    ),
  },
  {
    pregunta: "¿Cómo facturo en dólares?",
    respuesta: (
      <>
        Con Factura E, pestaña <strong>Exportación (E)</strong> arriba del
        formulario. Cargás la cotización tipo <strong>vendedor</strong> del
        BNA del día y los ítems en dólares — la app pasa a pesos con esa
        cotización, que es lo que ARCA guarda en el comprobante.
        <br />
        <br />
        Para emitir Factura E hace falta tener el punto de venta habilitado
        para &quot;Factura Electrónica - Exportación&quot; y el certificado
        asociado al servicio <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">wsfex</code> en
        el portal de ARCA.
      </>
    ),
  },
  {
    pregunta: "¿Fisca guarda mi clave fiscal?",
    respuesta: (
      <>
        No. La clave fiscal la usás una sola vez en el portal de ARCA para
        generar tu certificado digital — Fisca nunca la ve. Lo que sí
        guardamos es el certificado y la clave privada del certificado,
        cifrados. Nunca se muestran de nuevo en pantalla y no pasan por
        ningún servidor de terceros — solo viajan a ARCA por HTTPS.
      </>
    ),
  },
  {
    pregunta: "¿ARCA me rechazó una factura, qué hago?",
    respuesta: (
      <>
        La app te muestra el motivo real de ARCA en el cartel rojo al
        emitir. Los más comunes:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Condición IVA receptor obligatoria</strong>: elegí una
            opción en &quot;Condición IVA del cliente&quot;.
          </li>
          <li>
            <strong>CUIT no autorizado</strong>: el certificado no está
            asociado al servicio{" "}
            <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">wsfe</code>,
            o el CUIT en Configuración no coincide con el del certificado.
          </li>
          <li>
            <strong>Punto de venta no habilitado</strong>: hay que darlo de
            alta como &quot;Factura Electrónica - Web Services&quot; en ARCA.
          </li>
        </ul>
      </>
    ),
  },
  {
    pregunta: "¿Cómo genero el certificado de ARCA?",
    respuesta: (
      <>
        Se genera una sola vez con tu Clave Fiscal en el portal de ARCA. La
        guía paso a paso, con los comandos de OpenSSL, está en el{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">README</code>{" "}
        del proyecto. En criollo: generás un CSR en tu compu, lo subís al
        servicio WSASS (homologación) o Administración de Certificados
        Digitales (producción), y ARCA te devuelve un{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">.crt</code>{" "}
        que subís acá con tu clave privada.
      </>
    ),
  },
];

export default async function AyudaPage() {
  const arcaStatus = await getAfipStatus();

  return (
    <div className="space-y-5">
      <Link
        href="/configuracion"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        ‹ Perfil
      </Link>

      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Ayuda</h1>

      <div className="rounded-2xl bg-[#003366] p-4 text-white dark:bg-[#4a90c8]">
        <p className="text-[14.5px] font-semibold">¿Te rechazó ARCA una factura?</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#cfe0f2] dark:text-white/85">
          Te mostramos el motivo real que devuelve ARCA en el cartel que aparece al emitir — no
          un error genérico. Las causas más comunes están en las preguntas de abajo.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Preguntas frecuentes
        </h2>
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white px-4 dark:divide-neutral-900 dark:border-neutral-800 dark:bg-neutral-950">
          {FAQS.map((faq) => (
            <details key={faq.pregunta} className="group py-3.5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-neutral-900 marker:content-none dark:text-neutral-100">
                {faq.pregunta}
                <span className="mt-0.5 shrink-0 text-neutral-400 transition-transform group-open:rotate-90 dark:text-neutral-500">
                  ›
                </span>
              </summary>
              <div className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {faq.respuesta}
              </div>
            </details>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Si tu duda no está acá, escribinos desde &quot;Queja o sugerencia&quot; o consultá
          directo con ARCA.
        </p>
      </div>

      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white px-4 dark:divide-neutral-900 dark:border-neutral-800 dark:bg-neutral-950">
        <FeedbackRow />
        <div className="flex items-center justify-between gap-3 py-3.5">
          <span className="text-sm text-neutral-900 dark:text-neutral-100">
            Estado de los servicios de ARCA
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${arcaStatus.ok ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {arcaStatus.ok ? "Operativo" : "Con problemas"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
