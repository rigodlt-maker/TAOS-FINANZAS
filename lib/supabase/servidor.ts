import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_LLAVE_PUBLICA, SUPABASE_URL } from "./config";

export async function clienteServidor() {
  const almacen = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_LLAVE_PUBLICA, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // En componentes de servidor no se pueden escribir cookies; el proxy ya renueva la sesión
        }
      },
    },
  });
}
