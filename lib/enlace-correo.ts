// Nube F5 · Enlaces de los correos de la cuenta (confirmar, entrar sin contraseña, recuperar, cambiar correo).
// El correo trae token_hash (no el «code» de PKCE): así funciona aunque se abra en otra pestaña, otra app de correo u otro
// celular, porque no depende de un verificador guardado en el navegador donde se creó la cuenta.
// Además el enlace NO se canjea al abrirlo: primero se muestra un botón. Algunos correos (Outlook/Hotmail) abren los enlaces
// solos para revisarlos y, si se canjeara al abrir, la persona encontraría el enlace «ya usado».
import type { EmailOtpType } from "@supabase/supabase-js";

const TIPOS: readonly EmailOtpType[] = ["email", "signup", "magiclink", "recovery", "email_change", "invite"];

export const tipoDeEnlace = (t: string | null | undefined): EmailOtpType | null => (TIPOS as readonly string[]).includes(t ?? "") ? (t as EmailOtpType) : null;

// El token_hash de Supabase es hexadecimal; cualquier otra cosa se rechaza antes de mandarla
export const tokenValido = (t: string | null | undefined): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(t);

export const destinoConfirmar = (token: string, tipo: EmailOtpType) => `/auth/confirmar?token_hash=${encodeURIComponent(token)}&type=${encodeURIComponent(tipo)}`;

// Mensajes en español (nunca el texto técnico de Supabase)
export function mensajeDeEnlace(error: { message?: string; code?: string } | null | undefined): string {
  const t = `${error?.code ?? ""} ${error?.message ?? ""}`;
  if (/expired|invalid|already|not found|otp/i.test(t)) return "Este enlace ya se usó o caducó. Entra con tu correo y contraseña, o pide uno nuevo.";
  return "No pudimos abrir el enlace. Entra con tu correo y contraseña; si no puedes, pide uno nuevo.";
}
