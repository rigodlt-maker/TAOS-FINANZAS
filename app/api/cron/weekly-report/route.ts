import { cronAutorizado, repoDelDueno } from "@/lib/cron";
import { enviarCorreo, plantilla, urlDeLaApp } from "@/lib/correo";
import { prepararReporteSemanal } from "@/lib/reportes";

export const dynamic = "force-dynamic";

// Domingos a las 20:00 (hora de México): resumen de la semana
export async function GET(req: Request) {
  if (!cronAutorizado(req)) return new Response("No autorizado", { status: 401 });
  try {
    const { bloques } = await prepararReporteSemanal(await repoDelDueno());
    await enviarCorreo("📊 Tu reporte financiero de la semana", plantilla("Reporte semanal", bloques, urlDeLaApp()));
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
