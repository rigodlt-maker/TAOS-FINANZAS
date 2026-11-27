// Nube F4 · Después de pagar en Google Play, el celular manda aquí el token de la compra (con tu sesión)
import { esNube } from "@/lib/modo";
import { playConfigurado } from "@/lib/google-play";
import { verificarCompra } from "@/lib/suscripcion-servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { clienteServidor } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!esNube() || !playConfigurado()) return Response.json({ ok: false, mensaje: "Las suscripciones son solo de TAOS Nube." }, { status: 404 });
  const { data } = await (await clienteServidor()).auth.getUser();
  if (!data.user) return Response.json({ ok: false, mensaje: "Vuelve a entrar a tu cuenta." }, { status: 401 });
  const cuerpo = (await req.json().catch(() => ({}))) as { token?: unknown; producto?: unknown };
  try {
    const r = await verificarCompra(clienteAdmin(), data.user.id, String(cuerpo.token ?? ""), String(cuerpo.producto ?? ""));
    return Response.json(r, { status: r.ok ? 200 : 400 });
  } catch (e) {
    console.error("Suscripción:", (e as Error).message);
    return Response.json({ ok: false, mensaje: "No pudimos confirmar tu compra con Google. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
