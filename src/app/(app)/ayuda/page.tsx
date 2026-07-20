import Link from "next/link";
import { getAfipStatus } from "@/lib/afip/status";
import { FeedbackRow } from "@/components/feedback-row";

const FAQS: { pregunta: string; respuesta: React.ReactNode }[] = [
  {
    pregunta: "¿Qué factura tengo que emitir?",
    respuesta: (
      <>
        Depende de dónde está tu cliente:
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li>
            <strong>Factura C</strong>: cliente en Argentina (empresa, particular
            o monotributista). En pesos.
          </li>
          <li>
            <strong>Factura E</strong>: cliente en el exterior (Deel, freelance
            para empresas extranjeras, exportación). En la moneda que te pagan
            (USD casi siempre), con la cotización tipo <strong>vendedor</strong>{" "}
            del BNA del día. Legalmente el comprobante es en pesos al tipo de
            cambio del día — la app lo calcula automático.
          </li>
        </ul>
      </>
    ),
  },
  {
    pregunta: "¿Hace falta habilitación aparte para emitir Factura E?",
    respuesta: (
      <>
        Sí. Al ser monotributista se puede emitir Factura E, pero antes hay que:
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li>
            Dar de alta el punto de venta específicamente para{" "}
            <strong>&quot;Factura Electrónica - Exportación&quot;</strong>{" "}
            (webservice) en el portal de ARCA. Es un tipo distinto al de la Factura C.
          </li>
          <li>
            Habilitar el certificado digital para el servicio{" "}
            <strong>&quot;ws - Facturación Electrónica de Exportación&quot;</strong>{" "}
            (wsfex) en el Administrador de Relaciones. Es una relación aparte de la
            que usa la Factura C.
          </li>
        </ul>
        Los dos pasos se hacen una sola vez y son gratis — sin eso, ARCA rechaza la
        Factura E incluso si el resto está bien.
      </>
    ),
  },
  {
    pregunta: "¿Cómo genero el certificado de ARCA que me pide Configuración?",
    respuesta: (
      <>
        Se genera una sola vez en el portal de ARCA, con tu Clave Fiscal. Hay una guía paso a
        paso completa (con los comandos de OpenSSL) en el{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">README</code> del
        proyecto, sección &quot;Generar el certificado digital en el portal de ARCA&quot;. En
        criollo: generás un pedido de certificado (CSR) en tu computadora, lo subís al servicio
        WSASS (para homologación) o Administración de Certificados Digitales (para producción),
        y ARCA te devuelve el archivo <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">.crt</code> que
        subís acá junto con tu clave privada.
      </>
    ),
  },
  {
    pregunta: "ARCA me rechazó la factura, ¿qué hago?",
    respuesta: (
      <>
        La app te muestra el motivo real que devuelve ARCA (no un error genérico), en el cartel
        rojo que aparece al emitir. Los más comunes:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Condición IVA receptor obligatoria</strong>: elegí una opción en el campo
            &quot;Condición IVA del cliente&quot;.
          </li>
          <li>
            <strong>CUIT no autorizado / no incluido en Token</strong>: el certificado no está
            asociado al servicio <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">wsfe</code> para
            ese CUIT, o el CUIT en Configuración no coincide con el del certificado.
          </li>
          <li>
            <strong>Punto de venta no habilitado</strong>: hay que darlo de alta como punto de
            venta de tipo &quot;Factura Electrónica - Web Services&quot; en ARCA antes de poder
            facturar (y estar inscripto como monotributista).
          </li>
        </ul>
      </>
    ),
  },
  {
    pregunta: "Facturé mal (importe equivocado, dos veces, etc.), ¿puedo borrarla?",
    respuesta: (
      <>
        No — una vez que ARCA te da el CAE, es un comprobante fiscal real y no se puede eliminar.
        Lo que corresponde es emitir una <strong>Nota de Crédito</strong> que la anula: en el
        Historial, al lado de la factura, tocá &quot;Anular&quot;. Es otro comprobante con su
        propio CAE, que ARCA asocia a la factura original.
      </>
    ),
  },
  {
    pregunta: "¿Es seguro cargar mi certificado y clave privada acá?",
    respuesta: (
      <>
        El certificado y la clave privada se guardan cifrados y nunca se muestran de nuevo en
        pantalla ni se envían al navegador. A diferencia de otras integraciones con ARCA, tu
        clave privada no pasa por ningún servidor de terceros — solo viaja, cifrada por HTTPS,
        directo a los servidores de ARCA.
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
