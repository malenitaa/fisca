import Link from "next/link";

const FAQS: { pregunta: string; respuesta: React.ReactNode }[] = [
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
    pregunta: "¿Qué diferencia hay entre Homologación y Producción?",
    respuesta: (
      <>
        Homologación es el ambiente de pruebas de ARCA — las facturas que emitís ahí no son
        válidas legalmente, es solo para probar que todo funciona. Producción es el ambiente
        real: ahí sí genera comprobantes fiscales de verdad. Necesitás un certificado distinto
        para cada uno, y elegís cuál usar en Configuración.
      </>
    ),
  },
  {
    pregunta: "AFIP me rechazó la factura, ¿qué hago?",
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
  {
    pregunta: "¿Cómo paso a producción cuando esté todo probado?",
    respuesta: (
      <>
        Generá el certificado de producción (mismo proceso que homologación, pero en el servicio
        de Administración de Certificados Digitales real de ARCA), y en Configuración cambiá el
        ambiente a &quot;Producción&quot; y subí ese certificado. La primera factura que emitas
        ahí ya es una factura real.
      </>
    ),
  },
];

export default function AyudaPage() {
  return (
    <div>
      <Link
        href="/configuracion"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        ‹ Perfil
      </Link>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Ayuda</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Preguntas frecuentes. Si tu duda no está acá, revisá el README del proyecto.
      </p>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {FAQS.map((faq) => (
          <details key={faq.pregunta} className="group py-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900 marker:content-none dark:text-neutral-100">
              <span className="mr-2 inline-block text-neutral-400 group-open:rotate-90 dark:text-neutral-500">
                ›
              </span>
              {faq.pregunta}
            </summary>
            <div className="mt-2 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
              {faq.respuesta}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
