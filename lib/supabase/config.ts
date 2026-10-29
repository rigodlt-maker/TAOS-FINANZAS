// Solo el dominio del proyecto: si se copió con una ruta (p. ej. ".../rest/v1/"), Supabase responde "Invalid path"
function soloDominio(url: string): string {
  try {
    return url ? new URL(url.trim()).origin : "";
  } catch {
    return url.trim();
  }
}

export const SUPABASE_URL = soloDominio(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
export const SUPABASE_LLAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// Sin Supabase configurado la app corre en modo demostración
export function supabaseConfigurado(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_LLAVE_PUBLICA;
}

// Compara correos como lo hace Gmail: sin mayúsculas, sin puntos y sin "+etiqueta" (ana.lopez = analopez)
export function normalizarCorreo(correo: string): string {
  const limpio = correo.trim().replace(/^["']+|["']+$/g, "").toLowerCase();
  const [usuario, dominio] = limpio.split("@");
  if (!dominio) return limpio;
  if (dominio === "gmail.com" || dominio === "googlemail.com") {
    return `${usuario.split("+")[0].replace(/\./g, "")}@gmail.com`;
  }
  return limpio;
}

export function correosPermitidos(): string[] {
  return (process.env.ALLOWED_EMAIL ?? "")
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(normalizarCorreo);
}

// El único correo con acceso a la app
export function correoPermitido(correo: string | null | undefined): boolean {
  return !!correo && correosPermitidos().includes(normalizarCorreo(correo));
}
