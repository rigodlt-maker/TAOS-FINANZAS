// ¿Falta crear las tablas en Supabase? Se revisan las tablas y columnas más nuevas; si alguna no existe,
// la app manda a la pantalla Configurar con el código de supabase/instalar.sql.
import { cache } from "react";
import { supabaseConfigurado } from "./supabase/config";
import { clienteServidor } from "./supabase/servidor";

const PRUEBAS: [string, string][] = [["accounts", "saldo_al_corte"], ["accounts", "tasa_anual"], ["transfers", "id"], ["bank_emails", "id"], ["loans", "id"], ["push_subscriptions", "id"]];

export const faltaTabla = (e: { message: string; code?: string } | null) =>
  !!e && (["42P01", "42703", "PGRST204", "PGRST205"].includes(e.code ?? "") || /does not exist|could not find the|schema cache/i.test(e.message));

export const configuracionPendiente = cache(async (): Promise<boolean> => {
  if (!supabaseConfigurado()) return false;
  const db = await clienteServidor();
  const resultados = await Promise.all(PRUEBAS.map(([tabla, columna]) => db.from(tabla).select(columna).limit(1)));
  return resultados.some((r) => faltaTabla(r.error));
});
