import { revalidatePath } from "next/cache";
import { deshacerEnvio, registrarEnvio, type DatosEnvio } from "@/lib/envios";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

const fecha = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null);

// Confirmación del chat: dinero que le mandaste a otra persona (gasto o préstamo)
export async function POST(req: Request) {
  const d = (await req.json().catch(() => ({}))) as Partial<DatosEnvio>;
  try {
    const r = await registrarEnvio(await obtenerRepo(), {
      persona: String(d.persona ?? "").trim().slice(0, 80) || "Otra persona",
      monto: Number(String(d.monto ?? "").replace(/[$,\s]/g, "")),
      cuenta_id: String(d.cuenta_id ?? ""),
      fecha: fecha(d.fecha) ?? new Date().toISOString().slice(0, 10),
      prestamo: !!d.prestamo,
      fecha_pago: d.prestamo ? fecha(d.fecha_pago) : null,
      nota: d.prestamo ? String(d.nota ?? "").trim().slice(0, 200) || null : null,
    });
    revalidatePath("/", "layout");
    return Response.json({ ok: true, ...r });
  } catch (e) {
    const m = (e as Error).message;
    return Response.json({ ok: false, mensaje: /loans/.test(m) ? 'Falta correr en Supabase el SQL de "préstamos" (0006).' : m });
  }
}

export async function DELETE(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  try {
    const mensaje = await deshacerEnvio(await obtenerRepo(), String(id ?? ""));
    revalidatePath("/", "layout");
    return Response.json({ ok: true, mensaje });
  } catch (e) {
    return Response.json({ ok: false, mensaje: (e as Error).message });
  }
}
