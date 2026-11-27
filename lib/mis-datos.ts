// Nube F1 · Tus datos son tuyos: descargarlos todos (cualquier modo) y borrar tu cuenta (TAOS Nube).
// Toda consulta lleva tu user_id explícito, aunque también la proteja RLS.
import type { SupabaseClient } from "@supabase/supabase-js";

export const APP_DATOS = "Administrador Tao";
// Tablas de esta app con datos de cada persona (todas tienen user_id y se borran en cascada con la cuenta)
export const TABLAS_MIAS = ["accounts", "bank_emails", "categories", "categorization_rules", "debts", "goal_contributions", "imports", "loans", "push_subscriptions", "savings_goals", "scheduled_payments", "script_claves", "suscripciones", "transactions", "transfers"] as const;
// Columnas que no salen en la descarga (con el token de compra alguien podría consultar tu suscripción)
const OCULTAS: Record<string, string[]> = { suscripciones: ["token_compra"] };
// Carpetas de archivos de las apps TAOS (cada archivo vive en <user_id>/…). En TAOS Nube las 4 apps comparten servidor.
export const CARPETAS_ARCHIVOS = ["estados-de-cuenta", "documentos"] as const;

const noInstalada = (e: { code?: string; message: string }) => ["42P01", "PGRST205", "PGRST204"].includes(e.code ?? "") || /does not exist|could not find the|schema cache/i.test(e.message);

export async function exportarMisDatos(db: SupabaseClient, usuario: string, tablas: readonly string[] = TABLAS_MIAS) {
  const datos: Record<string, unknown[] | "no instalada"> = {};
  for (const t of tablas) {
    const { data, error } = await db.from(t).select("*").eq("user_id", usuario);
    if (error) {
      if (noInstalada(error)) datos[t] = "no instalada";
      else throw new Error(`No se pudo leer ${t}: ${error.message}`);
    } else datos[t] = (data ?? []).map((fila: Record<string, unknown>) => Object.fromEntries(Object.entries(fila).filter(([c]) => !(OCULTAS[t] ?? []).includes(c))));
  }
  return { app: APP_DATOS, generado: new Date().toISOString(), usuario, datos };
}

// Borra para siempre: primero tus archivos y después tu usuario (Postgres borra en cascada todas tus filas).
// Solo con la llave secreta y solo con el user_id de la sesión.
export async function borrarCuenta(admin: SupabaseClient, usuario: string): Promise<{ archivos: number }> {
  if (!/^[0-9a-f-]{36}$/i.test(usuario)) throw new Error("Usuario inválido");
  let archivos = 0;
  for (const carpeta of CARPETAS_ARCHIVOS) {
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const { data, error } = await admin.storage.from(carpeta).list(usuario, { limit: 100 });
      if (error || !data?.length) break;
      const rutas = data.map((a) => `${usuario}/${a.name}`);
      const quitar = await admin.storage.from(carpeta).remove(rutas);
      if (quitar.error) throw new Error(`No se pudieron borrar tus archivos: ${quitar.error.message}`);
      archivos += rutas.length;
    }
  }
  const { error } = await admin.auth.admin.deleteUser(usuario);
  if (error) throw new Error(`No se pudo borrar tu cuenta: ${error.message}`);
  return { archivos };
}
