// Asistente de la primera vez, en la pantalla de entrada. Revisa en orden:
//   1) que las variables de Vercel estén y tengan la forma correcta (incluido el código de compra),
//   2) que ya se haya corrido el código SQL en Supabase,
//   3) si el dueño todavía no tiene contraseña → la crea aquí mismo, SIN mandar correos.
// Así nadie depende del correo de Supabase (que solo deja mandar 2 por hora) ni de configurar
// las "Redirect URLs" para poder entrar la primera vez. Las 4 apps TAOS comparten la misma cuenta:
// la contraseña que se crea en la primera app sirve para las demás.
import type { User } from "@supabase/supabase-js";
import { clienteAdmin } from "./supabase/admin";
import { revisarLicencia } from "./licencia";
import { correosPermitidos, normalizarCorreo, SUPABASE_LLAVE_PUBLICA, SUPABASE_URL } from "./supabase/config";

export type PasoEntrada =
  | { paso: "variables"; problemas: string[] }
  | { paso: "sql" }
  | { paso: "crear" }
  | { paso: "entrar" };

const faltaTabla = (e: { message: string; code?: string } | null) =>
  !!e && (["42P01", "42703", "PGRST204", "PGRST205"].includes(e.code ?? "") || /does not exist|could not find the|schema cache/i.test(e.message));

// Revisa que cada dato esté en su casilla. Devuelve frases sencillas, sin mostrar los valores.
export function revisarVariables(v: Record<string, string | undefined> = process.env): string[] {
  const problemas: string[] = [];
  const url = (v.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const publica = (v.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  const secreta = (v.SUPABASE_SECRET_KEY ?? "").trim();
  const correo = (v.ALLOWED_EMAIL ?? "").trim();
  const pareceLlave = (t: string) => t.startsWith("sb_") || t.startsWith("eyJ");

  if (pareceLlave(url)) problemas.push("En NEXT_PUBLIC_SUPABASE_URL pegaste una llave. Ahí va la dirección del proyecto: empieza con https:// y termina en .supabase.co");
  else if (!/^https:\/\/[^\s]+\.supabase\.co\/?/i.test(url)) problemas.push("NEXT_PUBLIC_SUPABASE_URL debe empezar con https:// y terminar en .supabase.co");

  if (publica.startsWith("sb_secret_")) problemas.push("En NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY pegaste la llave secreta. Ahí va la que empieza con sb_publishable_");
  else if (!pareceLlave(publica)) problemas.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY debe empezar con sb_publishable_");

  if (!secreta) problemas.push("Falta SUPABASE_SECRET_KEY (la llave que empieza con sb_secret_)");
  else if (secreta.startsWith("sb_publishable_")) problemas.push("En SUPABASE_SECRET_KEY pegaste la llave pública. Ahí va la que empieza con sb_secret_");
  else if (!pareceLlave(secreta)) problemas.push("SUPABASE_SECRET_KEY debe empezar con sb_secret_");

  if (!correo) problemas.push("Falta ALLOWED_EMAIL (tu correo, el mismo con el que vas a entrar)");
  else if (!correo.includes("@")) problemas.push("ALLOWED_EMAIL debe ser un correo, por ejemplo tunombre@gmail.com");
  return problemas;
}

// El usuario dueño (el de ALLOWED_EMAIL) en Supabase, si ya existe
export async function buscarDueno(): Promise<User | null> {
  const permitidos = correosPermitidos();
  const admin = clienteAdmin();
  for (let pagina = 1; pagina <= 10; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 100 });
    if (error) throw new Error(error.message);
    const usuario = data.users.find((u) => !!u.email && permitidos.includes(normalizarCorreo(u.email)));
    if (usuario) return usuario;
    if (data.users.length < 100) break;
  }
  return null;
}

// "crear" solo mientras el dueño no exista o nunca haya entrado (p. ej. pidió un enlace que no le llegó)
export const puedeCrearContrasena = (dueno: User | null) => !dueno || !dueno.last_sign_in_at;

export async function pasoDeEntrada(tablas: [string, string][]): Promise<PasoEntrada> {
  if (!SUPABASE_URL || !SUPABASE_LLAVE_PUBLICA) return { paso: "entrar" }; // modo demostración
  const problemas = revisarVariables();
  if (problemas.length) return { paso: "variables", problemas };
  const licencia = await revisarLicencia();
  if (!licencia.ok) return { paso: "variables", problemas: [licencia.problema] };
  try {
    const admin = clienteAdmin();
    const resultados = await Promise.all(tablas.map(([tabla, columna]) => admin.from(tabla).select(columna).limit(1)));
    const errores = resultados.map((r) => r.error);
    if (errores.some(faltaTabla)) return { paso: "sql" };
    if (errores.some((e) => e && /fetch failed|ENOTFOUND|network/i.test(e.message)))
      return { paso: "variables", problemas: ["No se pudo conectar con tu proyecto de Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL, o espera 2 minutos si acabas de crear el proyecto."] };
    const otro = errores.find((e) => e && /api key|jwt|unauthorized|invalid/i.test(e.message));
    if (otro) return { paso: "variables", problemas: ["Supabase no aceptó tu llave secreta. Revisa que SUPABASE_SECRET_KEY esté completa y sea del mismo proyecto que la URL."] };
    return puedeCrearContrasena(await buscarDueno()) ? { paso: "crear" } : { paso: "entrar" };
  } catch {
    // Si Supabase no responde, se muestra la entrada normal
    return { paso: "entrar" };
  }
}
