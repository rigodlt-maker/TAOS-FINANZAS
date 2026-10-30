import { mismaClave, repoDelDueno } from "@/lib/cron";
import { procesarCorreos, type CorreoEntrante } from "@/lib/correos";
import { avisoDeCorreos, enviarPush } from "@/lib/push";
import { claveCorreos } from "@/lib/script-gmail";

export const dynamic = "force-dynamic";

// El script de Gmail manda "Authorization: Bearer <clave>"
function autorizado(req: Request) {
  const clave = claveCorreos();
  return !!clave && clave.length >= 12 && mismaClave(req.headers.get("authorization"), `Bearer ${clave}`);
}

// Prueba de conexión desde el script
export async function GET(req: Request) {
  if (!claveCorreos()) return Response.json({ ok: false, error: "Falta SUPABASE_SECRET_KEY en Vercel" }, { status: 500 });
  if (!autorizado(req)) return Response.json({ ok: false, error: "La clave no coincide" }, { status: 401 });
  return Response.json({ ok: true, mensaje: "Conexión lista" });
}

// Recibe los avisos de tu banco que llegaron a Gmail y los registra
export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "La clave no coincide" }, { status: 401 });
  const cuerpo = (await req.json().catch(() => null)) as { correos?: Partial<CorreoEntrante>[] } | null;
  const correos = (cuerpo?.correos ?? [])
    .slice(0, 100)
    .filter((c): c is CorreoEntrante => typeof c?.id === "string" && typeof c.de === "string" && typeof c.fecha === "string")
    .map((c) => ({ id: c.id.slice(0, 100), de: c.de.slice(0, 200), asunto: String(c.asunto ?? "").slice(0, 300), fecha: c.fecha, texto: String(c.texto ?? "").slice(0, 8000) }))
    .filter((c) => !Number.isNaN(Date.parse(c.fecha)));
  try {
    const repo = await repoDelDueno();
    const resumen = await procesarCorreos(repo, correos);
    const aviso = avisoDeCorreos(resumen);
    if (aviso) await enviarPush(repo, aviso);
    return Response.json({ ok: true, ...resumen });
  } catch (e) {
    console.error("Correos:", e);
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
