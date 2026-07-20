import { cache } from "react";
import { createClient } from "./server";

/** Devuelve el user actual y el cliente de Supabase, deduplicando el
 * `supabase.auth.getUser()` dentro del mismo request via React.cache().
 *
 * Antes: layout + page + otros componentes server llamaban getUser cada
 * uno por su cuenta, o sea 2-3 requests al auth endpoint por navegación.
 * Ahora: la primera llamada resuelve, las siguientes en el mismo request
 * reutilizan el resultado. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});
