import { revalidatePath } from "next/cache";
import { deshacerGastoChat, registrarGastoChat, type DatosGasto } from "@/lib/gasto-chat";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Confirmación del chat: guarda el gasto o ingreso que el asesor entendió
export async function POST(req: Request) {
  const d = (await req.json().catch(() => ({}))) as Partial<DatosGasto>;
  try {
    const r = await registrarGastoChat(await obtenerRepo(), {
      tipo: d.tipo === "ingreso" ? "ingreso" : "gasto",
      monto: Number(String(d.monto ?? "").replace(/[$,\s]/g, "")),
      comercio: String(d.comercio ?? "Gasto").slice(0, 120) || "Gasto",
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha)) ? String(d.fecha) : new Date().toISOString().slice(0, 10),
      account_id: String(d.account_id ?? ""),
      category_id: d.category_id ? String(d.category_id) : null,
    });
    revalidatePath("/", "layout");
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, mensaje: (e as Error).message });
  }
}

// Deshacer desde el chat
export async function DELETE(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  try {
    const mensaje = await deshacerGastoChat(await obtenerRepo(), String(id ?? ""));
    revalidatePath("/", "layout");
    return Response.json({ ok: true, mensaje });
  } catch (e) {
    return Response.json({ ok: false, mensaje: (e as Error).message });
  }
}
