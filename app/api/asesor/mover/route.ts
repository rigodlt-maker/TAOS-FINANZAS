import { deshacerTransferencia, registrarTransferencia } from "@/lib/acciones";

export const dynamic = "force-dynamic";

// Confirmación del chat: registra el movimiento entre cuentas que el asesor entendió ("Moví 5 mil de Revolut a Nu")
export async function POST(req: Request) {
  const datos = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const f = new FormData();
  for (const campo of ["origen_id", "destino_id", "monto", "fecha"]) f.set(campo, String(datos[campo] ?? ""));
  f.set("nota", "Registrado desde el asesor");
  return Response.json(await registrarTransferencia(f));
}

// Deshacer desde el chat
export async function DELETE(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  return Response.json(await deshacerTransferencia(String(id ?? "")));
}
