// Nube F1 · Claves de los scripts de Google (Gmail / Drive).
// - Modo propia: una sola clave, derivada de la llave secreta (como siempre) → los datos del dueño.
// - Modo nube: cada persona genera la suya en la app; se guarda solo su huella (sha256) en script_claves.
//   El servidor busca la huella para saber de quién es el envío y trabaja SOLO con el user_id de esa persona.
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppScript = "correos" | "drive";

export const huellaClave = (clave: string) => createHash("sha256").update(clave).digest("hex");
export const nuevaClave = (app: AppScript) => `tk_${app}_${randomBytes(24).toString("base64url")}`;

export function claveDelEncabezado(req: Request): string | null {
  const m = req.headers.get("authorization")?.trim().match(/^Bearer\s+(\S{12,200})$/);
  return m ? m[1] : null;
}

// ¿De quién es esta clave? Es la única consulta con la llave secreta que no puede llevar user_id: es la que lo encuentra.
export async function duenoDeClave(admin: SupabaseClient, app: AppScript, clave: string | null): Promise<string | null> {
  if (!clave || !clave.startsWith(`tk_${app}_`)) return null;
  const { data, error } = await admin.from("script_claves").select("user_id").eq("app", app).eq("huella", huellaClave(clave)).maybeSingle();
  if (error) throw new Error(`Claves: ${error.message}`);
  return (data?.user_id as string | undefined) ?? null;
}

// Crea (o cambia) la clave de esta persona. Se hace con SU sesión: RLS solo le deja escribir la suya.
// La clave se muestra una sola vez; si la pierde, genera otra y la anterior deja de servir.
export async function crearClave(db: SupabaseClient, usuario: string, app: AppScript): Promise<string> {
  const clave = nuevaClave(app);
  const { error } = await db.from("script_claves").upsert({ user_id: usuario, app, huella: huellaClave(clave), creada: new Date().toISOString() }, { onConflict: "user_id,app" });
  if (error) throw new Error(`No se pudo crear tu clave: ${error.message}`);
  return clave;
}
