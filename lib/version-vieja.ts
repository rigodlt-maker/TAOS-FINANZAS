// Después de publicar una versión nueva, una pantalla que ya estaba abierta puede mandar un formulario a la versión
// anterior y Next responde «Server Action not found». No es un error de la persona: se recarga la página una vez.
export const esVersionVieja = (e: { message?: string } | null | undefined) => /Server Action .*not found|Failed to find Server Action/i.test(e?.message ?? "");

export function recargarSiCambioLaVersion(e: { message?: string } | null | undefined) {
  if (typeof window === "undefined" || !esVersionVieja(e)) return;
  try {
    const clave = "taos-recargado-por-version";
    if (sessionStorage.getItem(clave) === location.pathname) return; // ya se intentó: mejor mostrar el error
    sessionStorage.setItem(clave, location.pathname);
  } catch {
    // sin sessionStorage igual se recarga
  }
  location.reload();
}
