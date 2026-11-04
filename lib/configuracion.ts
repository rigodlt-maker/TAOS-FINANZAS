// Estado de la base de datos en Supabase. Hay una prueba (tabla, columna) por cada migración:
//   - si falta la primera, es la primera vez → la app manda a Configurar con el código completo (supabase/instalar.sql);
//   - si solo faltan algunas (la app se actualizó), sale un aviso con SOLO el código nuevo. Nunca se borra nada:
//     las migraciones solo agregan tablas o columnas (lo revisa tests/actualizaciones.test.ts).
import { cache } from "react";
import { MIGRACIONES, SQL_INSTALAR } from "./sql";
import { supabaseConfigurado } from "./supabase/config";
import { clienteServidor } from "./supabase/servidor";

// Toda migración nueva necesita su prueba aquí (la prueba automática lo exige)
export const PRUEBAS_MIGRACIONES: Record<string, [string, string]> = {
  "0001_esquema.sql": ["accounts", "id"],
  "0002_transferencias.sql": ["transfers", "id"],
  "0003_correos.sql": ["bank_emails", "id"],
  "0004_saldo_al_corte.sql": ["accounts", "saldo_al_corte"],
  "0005_rendimientos.sql": ["accounts", "tasa_anual"],
  "0006_prestamos.sql": ["loans", "id"],
  "0007_push.sql": ["push_subscriptions", "id"],
  "0008_terminacion.sql": ["accounts", "terminacion"],
  "0009_creditos.sql": ["debts", "id"],
};

export const faltaTabla = (e: { message: string; code?: string } | null) =>
  !!e && (["42P01", "42703", "PGRST204", "PGRST205"].includes(e.code ?? "") || /does not exist|could not find the|schema cache/i.test(e.message));

export type EstadoBD = { primeraVez: boolean; pendientes: string[] };

export const estadoBD = cache(async (): Promise<EstadoBD> => {
  if (!supabaseConfigurado()) return { primeraVez: false, pendientes: [] };
  const db = await clienteServidor();
  const archivos = Object.keys(PRUEBAS_MIGRACIONES).sort();
  const resultados = await Promise.all(archivos.map((a) => db.from(PRUEBAS_MIGRACIONES[a][0]).select(PRUEBAS_MIGRACIONES[a][1]).limit(1)));
  const pendientes = archivos.filter((_, i) => faltaTabla(resultados[i].error));
  return { primeraVez: pendientes.includes(archivos[0]), pendientes };
});

// Primera vez: todavía no hay tablas
export const configuracionPendiente = cache(async (): Promise<boolean> => (await estadoBD()).primeraVez);

// El código que hay que pegar: todo (primera vez) o solo lo que falta (después de una actualización)
export function sqlPendiente(e: EstadoBD): string {
  if (e.primeraVez) return SQL_INSTALAR;
  return "-- Actualización de tu base de datos: solo agrega lo nuevo, no borra ni cambia tus datos.\n-- Pega todo en Supabase › SQL Editor y toca Run.\n\n" + e.pendientes.map((a) => MIGRACIONES[a]).join("\n");
}
