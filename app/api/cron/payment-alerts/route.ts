import { cronAutorizado, repoDelDueno } from "@/lib/cron";
import { enviarCorreo, plantilla, urlDeLaApp } from "@/lib/correo";
import { abiertos, pendiente } from "@/lib/envios";
import { diasEntre, dinero, fechaCorta, hoyLocal } from "@/lib/formato";
import { aplicarRendimientos } from "@/lib/rendimientos";
import { avisosDePago, enviarPush } from "@/lib/push";
import { prepararAlertasDePago } from "@/lib/reportes";

export const dynamic = "force-dynamic";

// Todos los días a las 8:00 (hora de México): suma el rendimiento de tus cajitas y avisa de pagos a 7 y 2 días
export async function GET(req: Request) {
  if (!cronAutorizado(req)) return new Response("No autorizado", { status: 401 });
  try {
    const repo = await repoDelDueno();
    // Si todavía no se corre el SQL de rendimientos, las alertas siguen funcionando
    const rendimientos = await aplicarRendimientos(repo, hoyLocal()).catch((e) => {
      console.error("Rendimientos:", e);
      return [];
    });
    const { alertas, tarjetas, bloques } = await prepararAlertasDePago(repo);
    // Préstamos que te pagan hoy o en 2 días (o que ya se pasaron ayer)
    const hoy = hoyLocal();
    const cobros = abiertos(await repo.prestamos().catch(() => [])).filter((p) => p.fecha_pago && [2, 0, -1].includes(diasEntre(hoy, p.fecha_pago)));
    for (const p of cobros)
      bloques.push(
        `<strong>Cobrar a ${p.persona}</strong>: ${dinero(pendiente(p))}<br>${p.fecha_pago === hoy ? "Te paga hoy" : p.fecha_pago! < hoy ? `Se pasó del ${fechaCorta(p.fecha_pago!)}` : `Te paga el ${fechaCorta(p.fecha_pago!)}`}.${p.nota ? `<br>${p.nota}` : ""}`,
      );
    const total = alertas.length + tarjetas.length + cobros.length;
    // Notificación en el celular además del correo
    const push = await enviarPush(repo, avisosDePago(alertas, tarjetas, cobros, hoy));
    if (total) {
      const asunto =
        cobros.length === total
          ? `💰 Cobrar a ${cobros[0].persona}${cobros.length > 1 ? ` y ${cobros.length - 1} más` : ""}`
          : total > 1
          ? `⏰ ${total} pagos próximos`
          : alertas.length
            ? `⏰ Pago próximo: ${alertas[0].pago.nombre}`
            : `⏰ Pago de tarjeta ${tarjetas[0].cuenta.nombre}`;
      await enviarCorreo(asunto, plantilla("Pagos que se acercan", bloques, urlDeLaApp()));
    }
    return Response.json({ ok: true, alertas: total, push, rendimientos });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
