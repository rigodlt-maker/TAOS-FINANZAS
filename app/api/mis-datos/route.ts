// Nube F1 · «Descargar mis datos»: todo lo tuyo de esta app en un archivo .json (solo con tu sesión)
import { APP_DATOS, exportarMisDatos } from "@/lib/mis-datos";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { clienteServidor } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigurado()) return Response.json({ ok: false, mensaje: "En modo demostración no hay datos tuyos que descargar." }, { status: 400 });
  const db = await clienteServidor();
  const { data } = await db.auth.getUser();
  if (!data.user) return Response.json({ ok: false, mensaje: "Vuelve a entrar a tu cuenta." }, { status: 401 });
  try {
    const archivo = await exportarMisDatos(db, data.user.id);
    const nombre = `${APP_DATOS.toLowerCase().replace(/\s+/g, "-")}-mis-datos-${archivo.generado.slice(0, 10)}.json`;
    return new Response(JSON.stringify(archivo, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json({ ok: false, mensaje: (e as Error).message }, { status: 500 });
  }
}
