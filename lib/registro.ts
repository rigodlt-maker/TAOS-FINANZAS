// Nube F3 · Registro abierto en TAOS Nube: cualquiera crea su cuenta con correo y contraseña.
// - Supabase manda el correo de confirmación (Authentication › «Confirm email» encendido): sin confirmar, no se entra.
// - Anti-bots con Cloudflare Turnstile (gratis) si existen NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY.
// - La respuesta es la misma si el correo ya existía: así nadie puede averiguar quién tiene cuenta.

export type DatosRegistro = { correo: string; contrasena: string; confirmar: string; acepta: boolean; sensibles?: boolean };

// Versión del aviso de privacidad y los términos que acepta la persona (se guarda en su cuenta como constancia)
export const VERSION_AVISO = "2026-11-28-preliminar";
export const constanciaDeConsentimiento = (ahora = new Date()) => ({ consentimiento: { aviso: VERSION_AVISO, sensibles: true, fecha: ahora.toISOString() } });

export function validarRegistro(d: DatosRegistro): string | null {
  const correo = d.correo.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo) || correo.length > 200) return "Escribe un correo válido, por ejemplo tunombre@gmail.com.";
  if (d.contrasena.length < 8) return "Usa al menos 8 caracteres en tu contraseña.";
  if (d.contrasena.length > 72) return "Tu contraseña es demasiado larga (máximo 72 caracteres).";
  if (d.contrasena !== d.confirmar) return "Las dos contraseñas no coinciden. Escríbelas otra vez.";
  if (!d.acepta) return "Para crear tu cuenta, acepta el aviso de privacidad y los términos.";
  // Datos sensibles (salud, finanzas, documentos de identidad): la ley pide consentimiento expreso, aparte
  if (!d.sensibles) return "Para crear tu cuenta, autoriza el uso de tus datos sensibles (salud, finanzas y documentos).";
  return null;
}

export const turnstileActivo = (v: Record<string, string | undefined> = process.env) => !!(v.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() && v.TURNSTILE_SECRET_KEY?.trim());

// Revisa con Cloudflare que quien llena el formulario no es un robot. Sin llaves configuradas, no se revisa.
export async function pasaTurnstile(token: string | null, ip: string | null, v: Record<string, string | undefined> = process.env, buscar: typeof fetch = fetch): Promise<boolean> {
  if (!turnstileActivo(v)) return true;
  if (!token) return false;
  try {
    const cuerpo = new URLSearchParams({ secret: v.TURNSTILE_SECRET_KEY!.trim(), response: token });
    if (ip) cuerpo.set("remoteip", ip);
    const r = await buscar("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: cuerpo });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch {
    return false; // si Cloudflare no responde, no se crea la cuenta (se puede reintentar)
  }
}

// Mensajes de Supabase en español. Nunca dice si el correo ya tenía cuenta.
export function mensajeDeRegistro(error: { message: string } | null): { ok: boolean; mensaje: string } {
  if (!error) return { ok: true, mensaje: "Te mandamos un correo para confirmar tu cuenta. Ábrelo y toca el enlace; después entra con tu correo y contraseña." };
  if (/weak|pwned|common|short/i.test(error.message)) return { ok: false, mensaje: "Esa contraseña es muy fácil de adivinar. Usa otra más larga." };
  if (/rate limit|too many/i.test(error.message)) return { ok: false, mensaje: "Hay muchos registros seguidos. Espera unos minutos y vuelve a intentar." };
  if (/already registered|already exists/i.test(error.message))
    return { ok: true, mensaje: "Te mandamos un correo para confirmar tu cuenta. Ábrelo y toca el enlace; después entra con tu correo y contraseña." };
  return { ok: false, mensaje: "No se pudo crear tu cuenta. Intenta de nuevo en un momento." };
}
