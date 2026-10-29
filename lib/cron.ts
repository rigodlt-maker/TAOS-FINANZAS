import { repoMemoria } from "./datos/memoria";
import type { Repo } from "./datos/repo";
import { repoSupabase } from "./datos/supabase";
import { clienteAdmin, idDelDueno } from "./supabase/admin";
import { supabaseConfigurado } from "./supabase/config";

// Los crons de Vercel mandan "Authorization: Bearer <CRON_SECRET>"
export function cronAutorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  return !!secreto && req.headers.get("authorization") === `Bearer ${secreto}`;
}

// Los crons corren sin sesión: usan la llave secreta y los datos del dueño
export async function repoDelDueno(): Promise<Repo> {
  if (!supabaseConfigurado()) return repoMemoria();
  return repoSupabase(clienteAdmin(), await idDelDueno());
}
