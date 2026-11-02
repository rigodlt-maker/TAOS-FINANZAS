// Código de compra de TAOS: el código de tu compra en Hotmart (empieza con HP), en la variable CODIGO_COMPRA de Vercel.
// Lo revisa el servidor de TAOS. Cada código instala cada app hasta 3 veces.
// Si el servidor de TAOS no responde, la app sigue funcionando: una falla nuestra no debe dejarte sin tu app.
export const LICENCIAS_URL = "https://taos-licencias.SUBDOMINIO.workers.dev";
export const APP_TAOS = "finanzas";

export type Licencia = { ok: true } | { ok: false; problema: string };

export const normalizarCodigo = (codigo?: string) => (codigo ?? "").replace(/\s+/g, "").toUpperCase();

export async function revisarLicencia(variables: Record<string, string | undefined> = process.env, buscar: typeof fetch = fetch): Promise<Licencia> {
  const codigo = normalizarCodigo(variables.CODIGO_COMPRA);
  if (!codigo) return { ok: false, problema: "Falta CODIGO_COMPRA: tu código de compra de Hotmart (empieza con HP). Viene en el correo de tu compra." };
  if (codigo.startsWith("SB_") || codigo.includes("@") || codigo.startsWith("HTTP"))
    return { ok: false, problema: "En CODIGO_COMPRA pegaste otro dato. Ahí va tu código de compra de Hotmart (empieza con HP)." };
  // La dirección fija de tu app en Vercel: así cada instalación cuenta una sola vez
  const direccion = variables.VERCEL_PROJECT_PRODUCTION_URL ?? variables.VERCEL_URL ?? "local";
  const url = `${LICENCIAS_URL}/validar?${new URLSearchParams({ codigo, app: APP_TAOS, url: direccion })}`;
  try {
    // Se recuerda 6 horas: no se pregunta en cada visita
    const r = await buscar(url, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(4000) } as RequestInit);
    if (!r.ok) return { ok: true };
    const datos = (await r.json()) as { ok?: boolean; problema?: string };
    return datos.ok === false ? { ok: false, problema: datos.problema ?? "Tu código de compra no es válido." } : { ok: true };
  } catch {
    return { ok: true };
  }
}
