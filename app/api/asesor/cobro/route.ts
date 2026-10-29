import { revalidatePath } from "next/cache";
import { registrarCobro } from "@/lib/envios";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Confirmación del chat: alguien te pagó (todo o una parte) un préstamo
export async function POST(req: Request) {
  const d = (await req.json().catch(() => ({}))) as { prestamo_id?: string; monto?: number | string; cuenta_id?: string };
  try {
    const mensaje = await registrarCobro(await obtenerRepo(), String(d.prestamo_id ?? ""), Number(String(d.monto ?? "").replace(/[$,\s]/g, "")), String(d.cuenta_id ?? ""));
    revalidatePath("/", "layout");
    return Response.json({ ok: true, mensaje });
  } catch (e) {
    return Response.json({ ok: false, mensaje: (e as Error).message });
  }
}
