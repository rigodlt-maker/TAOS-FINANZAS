import { redirect } from "next/navigation";
import { cache } from "react";
import { repoMemoria } from "./datos/memoria";
import type { Repo } from "./datos/repo";
import { repoSupabase } from "./datos/supabase";
import { correoPermitido, supabaseConfigurado } from "./supabase/config";
import { clienteServidor } from "./supabase/servidor";

// Datos del usuario con sesión; en modo demostración usa la memoria con datos de ejemplo
export const obtenerRepo = cache(async (): Promise<Repo> => {
  if (!supabaseConfigurado()) return repoMemoria();
  const db = await clienteServidor();
  const { data } = await db.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  if (!correoPermitido(data.claims.email as string | undefined)) redirect("/acceso-denegado");
  return repoSupabase(db, data.claims.sub);
});

export const correoActual = cache(async (): Promise<string | null> => {
  if (!supabaseConfigurado()) return null;
  const db = await clienteServidor();
  const { data } = await db.auth.getClaims();
  return (data?.claims?.email as string | undefined) ?? null;
});
