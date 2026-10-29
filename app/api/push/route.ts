import { enviarPush, llavesVapid } from "@/lib/push";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

type Cuerpo = {
  suscripcion?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  anterior?: string | null;
  dispositivo?: string;
  prueba?: boolean;
};

// Llave pública para que el celular pueda suscribirse
export async function GET() {
  const llaves = llavesVapid();
  return Response.json(llaves ? { ok: true, llave: llaves.publica } : { ok: false, mensaje: "Las notificaciones necesitan Supabase configurado." });
}

// Guarda el celular donde activaste los avisos, o manda una notificación de prueba
export async function POST(req: Request) {
  const d = (await req.json().catch(() => ({}))) as Cuerpo;
  try {
    const repo = await obtenerRepo();
    if (d.prueba) {
      const r = await enviarPush(repo, { titulo: "✅ Notificaciones activas", cuerpo: "Así te van a llegar los avisos de pagos, cobros y correos del banco.", url: "/ajustes", etiqueta: "prueba" });
      if (!r.enviados) return Response.json({ ok: false, mensaje: "No se pudo enviar. Desactiva y vuelve a activar las notificaciones." });
      return Response.json({ ok: true, mensaje: `Enviada a ${r.enviados} ${r.enviados === 1 ? "dispositivo" : "dispositivos"}.` });
    }
    const s = d.suscripcion;
    if (!s?.endpoint?.startsWith("https://") || !s.keys?.p256dh || !s.keys.auth) return Response.json({ ok: false, mensaje: "Suscripción inválida" }, { status: 400 });
    if (d.anterior && d.anterior !== s.endpoint) await repo.borrarSuscripcionPush(d.anterior);
    await repo.guardarSuscripcionPush({
      endpoint: s.endpoint.slice(0, 1000),
      p256dh: s.keys.p256dh.slice(0, 200),
      auth: s.keys.auth.slice(0, 100),
      dispositivo: d.dispositivo ? String(d.dispositivo).slice(0, 100) : null,
    });
    return Response.json({ ok: true, mensaje: "Notificaciones activadas en este dispositivo." });
  } catch (e) {
    return Response.json({ ok: false, mensaje: (e as Error).message });
  }
}

// Desactivar en este dispositivo
export async function DELETE(req: Request) {
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  try {
    if (endpoint) await (await obtenerRepo()).borrarSuscripcionPush(String(endpoint));
    return Response.json({ ok: true, mensaje: "Notificaciones desactivadas en este dispositivo." });
  } catch (e) {
    return Response.json({ ok: false, mensaje: (e as Error).message });
  }
}
