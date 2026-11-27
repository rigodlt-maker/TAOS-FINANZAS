"use server";
// Nube F1 · Crea (o cambia) la clave del script de esta persona y devuelve el script listo para copiar.
import { headers } from "next/headers";
import { crearClave } from "@/lib/claves-script";
import { urlDeLaApp } from "@/lib/correo";
import { esNube } from "@/lib/modo";
import { scriptGmail } from "@/lib/script-gmail";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function generarMiScript(): Promise<{ ok: boolean; script?: string; mensaje?: string }> {
  try {
    if (!esNube()) return { ok: false, mensaje: "Esta opción es solo para TAOS Nube." };
    const db = await clienteServidor();
    const { data } = await db.auth.getUser();
    if (!data.user) return { ok: false, mensaje: "Vuelve a entrar a tu cuenta." };
    const clave = await crearClave(db, data.user.id, "correos");
    const h = await headers();
    return { ok: true, script: scriptGmail(urlDeLaApp() ?? `https://${h.get("host")}`, clave) };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}
