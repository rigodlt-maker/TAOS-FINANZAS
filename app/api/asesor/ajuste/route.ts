import { revalidatePath } from "next/cache";
import { aplicarAjuste } from "@/lib/ajuste-chat";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Confirmación del chat: cambia el saldo de una cuenta (y "Deshacer" lo regresa al anterior con la misma ruta)
export async function POST(req: Request) {
  const d = (await req.json().catch(() => ({}))) as { cuenta_id?: string; nuevo?: number | string };
  try {
    const r = await aplicarAjuste(await obtenerRepo(), String(d.cuenta_id ?? ""), Number(String(d.nuevo ?? "").replace(/[$,\s]/g, "")));
    revalidatePath("/", "layout");
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, mensaje: (e as Error).message });
  }
}
