import { createClient } from "@/lib/supabase/server";
import { ConfiguracionForm } from "@/components/configuracion-form";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, razon_social, punto_venta, ambiente")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Configuración</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Se carga una sola vez. El certificado y la clave privada se guardan cifrados y nunca se
        muestran de nuevo en pantalla.
      </p>
      <ConfiguracionForm
        existing={
          config
            ? {
                cuit: config.cuit,
                razonSocial: config.razon_social ?? "",
                puntoVenta: config.punto_venta,
                ambiente: config.ambiente as "homologacion" | "produccion",
              }
            : null
        }
      />
    </div>
  );
}
