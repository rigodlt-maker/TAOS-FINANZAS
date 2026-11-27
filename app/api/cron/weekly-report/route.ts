import { cronAutorizado, porCadaUsuario, type UsuarioCron } from "@/lib/cron";
import type { Repo } from "@/lib/datos/repo";
import { enviarCorreo, plantilla, urlDeLaApp } from "@/lib/correo";
import { hoyLocal, sumarDias } from "@/lib/formato";
import { enviarPush } from "@/lib/push";
import { prepararReporteSemanal } from "@/lib/reportes";
import { armarResumenDomingo, semanaDeLasOtrasApps } from "@/lib/resumen-domingo";
import { clienteAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

// Domingos a las 20:00 (hora de México): reporte por correo y el "Resumen del domingo" en el celular
export async function GET(req: Request) {
  if (!cronAutorizado(req)) return new Response("No autorizado", { status: 401 });
  try {
    const r = await porCadaUsuario(reporteDe);
    return Response.json({ ok: true, usuarios: r.usuarios, fallas: r.fallas });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

async function reporteDe(repo: Repo, u: UsuarioCron) {
  const { bloques } = await prepararReporteSemanal(repo);
  await enviarCorreo("📊 Tu reporte financiero de la semana", plantilla("Reporte semanal", bloques, urlDeLaApp()), u.correo);

  // Notificación con tu semana en las apps TAOS (si una falla, el correo ya salió)
  try {
    const hoy = hoyLocal();
    const movs = await repo.movimientos({ desde: sumarDias(hoy, -13) });
    const suma = (desde: string, hasta: string) => movs.filter((m) => m.tipo === "gasto" && m.fecha >= desde && m.fecha <= hasta).reduce((t, m) => t + m.monto, 0);
    const otras = supabaseConfigurado() ? await semanaDeLasOtrasApps(clienteAdmin(), u.id, hoy) : { entrenos: null, porVencer: null, habitos: null };
    await enviarPush(repo, armarResumenDomingo({ gasto: suma(sumarDias(hoy, -6), hoy), gastoAntes: suma(sumarDias(hoy, -13), sumarDias(hoy, -7)), ...otras }));
  } catch (e) {
    console.error("Resumen del domingo:", e);
  }
}
