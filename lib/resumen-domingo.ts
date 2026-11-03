// Resumen del domingo: UNA notificación con tu semana en las apps TAOS (dinero, entrenos, documentos y hábitos).
// Lo manda Administrador Tao en su cron semanal. Lee las tablas de las otras apps del mismo Supabase solo para contar;
// si alguna app no está instalada (no existe su tabla), esa parte simplemente no sale.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dineroCorto, fechaCorta, sumarDias } from "./formato";
import type { Aviso } from "./push";

export type SemanaTaos = {
  gasto: number; // gastos de los últimos 7 días
  gastoAntes: number; // los 7 días anteriores
  entrenos: { hechos: number; meta: number } | null; // Tao Fit
  porVencer: { nombre: string; fecha: string }[] | null; // Segundo Cerebro, próximos 30 días
  habitos: { hechos: number; posibles: number } | null; // Optimizador de Vida
};

export function armarResumenDomingo(s: SemanaTaos): Aviso {
  const lineas: string[] = [];
  const cambio = s.gastoAntes > 0 ? Math.round(((s.gasto - s.gastoAntes) / s.gastoAntes) * 100) : null;
  lineas.push(
    `💸 Gastaste ${dineroCorto(s.gasto)}${cambio === null ? "" : cambio <= 0 ? ` (${Math.abs(cambio)}% menos que la semana pasada 👏)` : ` (${cambio}% más que la semana pasada)`}.`,
  );
  if (s.entrenos) lineas.push(`🏋️ Entrenaste ${s.entrenos.hechos} de ${s.entrenos.meta} días${s.entrenos.hechos >= s.entrenos.meta ? " ✅" : ""}.`);
  if (s.habitos && s.habitos.posibles > 0) lineas.push(`🌱 Cumpliste ${Math.round((s.habitos.hechos / s.habitos.posibles) * 100)}% de tus hábitos.`);
  if (s.porVencer?.length) {
    const [d] = s.porVencer;
    lineas.push(`📄 ${d.nombre} vence el ${fechaCorta(d.fecha)}${s.porVencer.length > 1 ? ` (y ${s.porVencer.length - 1} más)` : ""}.`);
  }
  return { titulo: "📊 Tu semana TAOS", cuerpo: lineas.join(" "), url: "/", etiqueta: "resumen-domingo" };
}

// Lo de las otras apps. Cada parte falla en silencio (devuelve null) si esa app no está instalada.
export async function semanaDeLasOtrasApps(db: SupabaseClient, usuario: string, hoy: string): Promise<Pick<SemanaTaos, "entrenos" | "porVencer" | "habitos">> {
  const hace7 = sumarDias(hoy, -6);
  const entrenos = await (async () => {
    const [series, perfil] = await Promise.all([
      db.from("fit_sets").select("fecha").eq("user_id", usuario).gte("fecha", hace7).lte("fecha", hoy),
      db.from("fit_profiles").select("dias_semana").eq("user_id", usuario).maybeSingle(),
    ]);
    if (series.error || perfil.error || !perfil.data) return null;
    return { hechos: new Set(series.data.map((x) => x.fecha)).size, meta: perfil.data.dias_semana as number };
  })().catch(() => null);

  const porVencer = await (async () => {
    const { data, error } = await db
      .from("document_facts")
      .select("fecha_vencimiento, documents(nombre)")
      .eq("user_id", usuario)
      .gte("fecha_vencimiento", hoy)
      .lte("fecha_vencimiento", sumarDias(hoy, 30))
      .order("fecha_vencimiento");
    if (error) return null;
    return data.map((x) => {
      const doc = x.documents as { nombre?: string } | { nombre?: string }[] | null;
      return { nombre: (Array.isArray(doc) ? doc[0]?.nombre : doc?.nombre) ?? "Un documento", fecha: x.fecha_vencimiento as string };
    });
  })().catch(() => null);

  const habitos = await (async () => {
    const { data, error } = await db.from("panel_config").select("datos").eq("user_id", usuario).maybeSingle();
    const h = (data?.datos as { habitos?: { lista?: { id: string }[]; hechos?: Record<string, string[]> } } | null)?.habitos;
    if (error || !h?.lista?.length) return null;
    let hechos = 0;
    for (let i = 0; i < 7; i++) hechos += (h.hechos?.[sumarDias(hoy, -i)] ?? []).filter((id) => h.lista!.some((x) => x.id === id)).length;
    return { hechos, posibles: h.lista.length * 7 };
  })().catch(() => null);

  return { entrenos, porVencer, habitos };
}
