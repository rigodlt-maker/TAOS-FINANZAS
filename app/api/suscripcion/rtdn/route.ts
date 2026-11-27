// Nube F4 · Avisos en tiempo real de Google Play (Pub/Sub «push» a /api/suscripcion/rtdn?k=<PLAY_RTDN_CLAVE>).
// Responder 200 = recibido; un error hace que Pub/Sub lo reintente. El estado siempre se le vuelve a pedir a Google.
import { mismaClave } from "@/lib/cron";
import { esNube } from "@/lib/modo";
import { playConfigurado } from "@/lib/google-play";
import { leerAviso } from "@/lib/suscripcion";
import { actualizarPorAviso } from "@/lib/suscripcion-servidor";
import { clienteAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const clave = process.env.PLAY_RTDN_CLAVE?.trim();
  if (!esNube() || !playConfigurado() || !clave || clave.length < 24) return new Response(null, { status: 404 });
  if (!mismaClave(new URL(req.url).searchParams.get("k"), clave)) return new Response(null, { status: 401 });
  const aviso = leerAviso(await req.json().catch(() => null), process.env.PLAY_PAQUETE!.trim());
  if (!aviso || "prueba" in aviso) return Response.json({ ok: true, ignorado: !aviso }); // mal formado o de prueba: no reintentar
  try {
    return Response.json({ ok: true, resultado: await actualizarPorAviso(clienteAdmin(), aviso.token) });
  } catch (e) {
    console.error("Aviso de Google Play:", (e as Error).message);
    return new Response(null, { status: 500 });
  }
}
