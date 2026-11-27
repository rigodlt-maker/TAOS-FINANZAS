import { redirect } from "next/navigation";
import { cache } from "react";
import { repoMemoria } from "./datos/memoria";
import type { Repo } from "./datos/repo";
import { repoSupabase } from "./datos/supabase";
import { correoPermitido, supabaseConfigurado } from "./supabase/config";
import { clienteServidor } from "./supabase/servidor";
import { conCandado } from "./candado";
import { esNube } from "./modo";
import { suscripcionDe } from "./suscripcion-servidor";
import { clienteAdmin } from "./supabase/admin";

// Datos del usuario con sesión; en modo demostración usa la memoria con datos de ejemplo
export const obtenerRepo = cache(async (): Promise<Repo> => {
  if (!supabaseConfigurado()) return repoMemoria();
  const db = await clienteServidor();
  const { data } = await db.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  if (!correoPermitido(data.claims.email as string | undefined)) redirect("/acceso-denegado");
  const repo = repoSupabase(db, data.claims.sub);
  // Nube F4: sin suscripción vigente, solo lectura (la suscripción se lee con la llave secreta y TU user_id)
  if (esNube()) return conCandado(repo, () => suscripcionDe(clienteAdmin(), data.claims.sub));
  return repo;
});

// Id de la sesión actual, para marcar de quién es cada borrador guardado sin internet (S15-R6). Demo: "demo".
export const duenoActual = cache(async (): Promise<string> => {
  if (!supabaseConfigurado()) return "demo";
  const db = await clienteServidor();
  const { data } = await db.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return data.claims.sub;
});

export const correoActual = cache(async (): Promise<string | null> => {
  if (!supabaseConfigurado()) return null;
  const db = await clienteServidor();
  const { data } = await db.auth.getClaims();
  return (data?.claims?.email as string | undefined) ?? null;
});
