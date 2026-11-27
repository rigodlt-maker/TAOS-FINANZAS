import { mismaClave, repoDelDueno } from "@/lib/cron";
import { claveDelEncabezado, duenoDeClave } from "@/lib/claves-script";
import type { Repo } from "@/lib/datos/repo";
import { repoSupabase } from "@/lib/datos/supabase";
import { esNube } from "@/lib/modo";
import { puedeEscribir } from "@/lib/suscripcion";
import { suscripcionDe } from "@/lib/suscripcion-servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { procesarCorreos, type CorreoEntrante } from "@/lib/correos";
import { avisoDeCorreos, enviarPush } from "@/lib/push";
import { claveCorreos } from "@/lib/script-gmail";

export const dynamic = "force-dynamic";

// El script de Gmail manda "Authorization: Bearer <clave>"
function autorizado(req: Request) {
  const clave = claveCorreos();
  return !!clave && clave.length >= 12 && mismaClave(req.headers.get("authorization"), `Bearer ${clave}`);
}

// Nube F1: ¿de quién es este envío? Propia: la clave única → el dueño. Nube: la clave de cada persona → su user_id.
class SinSuscripcion extends Error {}

async function repoDelEnvio(req: Request): Promise<Repo | null> {
  if (!esNube()) return autorizado(req) ? repoDelDueno() : null;
  const usuario = await duenoDeClave(clienteAdmin(), "correos", claveDelEncabezado(req));
  if (!usuario) return null;
  // Nube F4: sin suscripción vigente el script ya no registra nada (solo lectura); contesta 402 para que no reintente
  if (!puedeEscribir(await suscripcionDe(clienteAdmin(), usuario))) throw new SinSuscripcion();
  return repoSupabase(clienteAdmin(), usuario);
}

// Prueba de conexión desde el script
export async function GET(req: Request) {
  if (!esNube() && !claveCorreos()) return Response.json({ ok: false, error: "Falta SUPABASE_SECRET_KEY en Vercel" }, { status: 500 });
  // La clave sirve aunque la suscripción no esté activa (eso se avisa al mandar datos)
  const valida = esNube() ? !!(await repoDelEnvio(req).catch((e) => (e instanceof SinSuscripcion ? true : null))) : autorizado(req);
  if (!valida) return Response.json({ ok: false, error: "La clave no coincide" }, { status: 401 });
  return Response.json({ ok: true, mensaje: "Conexión lista" });
}

// Recibe los avisos de tu banco que llegaron a Gmail y los registra
export async function POST(req: Request) {
  let repoEnvio: Repo | null = null;
  try {
    repoEnvio = await repoDelEnvio(req);
  } catch (e) {
    if (e instanceof SinSuscripcion) return Response.json({ ok: false, error: "Tu suscripción de TAOS no está activa: por ahora no se registra nada nuevo." }, { status: 402 });
  }
  if (!repoEnvio) return Response.json({ ok: false, error: "La clave no coincide" }, { status: 401 });
  const cuerpo = (await req.json().catch(() => null)) as { correos?: Partial<CorreoEntrante>[] } | null;
  const correos = (cuerpo?.correos ?? [])
    .slice(0, 100)
    .filter((c): c is CorreoEntrante => typeof c?.id === "string" && typeof c.de === "string" && typeof c.fecha === "string")
    .map((c) => ({ id: c.id.slice(0, 100), de: c.de.slice(0, 200), asunto: String(c.asunto ?? "").slice(0, 300), fecha: c.fecha, texto: String(c.texto ?? "").slice(0, 8000), auth: String(c.auth ?? "").slice(0, 2000) }))
    .filter((c) => !Number.isNaN(Date.parse(c.fecha)));
  try {
    const repo = repoEnvio;
    const resumen = await procesarCorreos(repo, correos);
    const aviso = avisoDeCorreos(resumen);
    if (aviso) await enviarPush(repo, aviso);
    return Response.json({ ok: true, ...resumen });
  } catch (e) {
    console.error("Correos:", e);
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
