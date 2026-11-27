// Al abrir la app: si este celular está suscrito a las notificaciones con una llave vieja (se cambió la llave secreta),
// se vuelve a suscribir solo con la nueva. Así nadie se queda sin avisos sin darse cuenta, aunque nunca entre a Notificaciones.
// Solo actúa si ya había suscripción y permiso; si no se puede guardar en el servidor, deja todo como para «Activar».

const SIN_SESION = ["/login", "/acceso-denegado", "/configurar"];

export function bytesDeLlave(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// ¿La suscripción se hizo con esta llave? Si el navegador no la informa, se da por buena (no se puede comparar)
export function mismaLlave(s: PushSubscription, llave: string) {
  const actual = s.options?.applicationServerKey;
  if (!actual) return true;
  const a = new Uint8Array(actual);
  const b = bytesDeLlave(llave);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function nombreDispositivo() {
  const ua = navigator.userAgent;
  const sistema = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Otro";
  const navegador = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `${sistema}${navegador ? ` · ${navegador}` : ""}`;
}

// Devuelve true si renovó la suscripción
export async function renovarPushSiHaceFalta(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
  if (Notification.permission !== "granted" || SIN_SESION.some((r) => location.pathname.startsWith(r))) return false;
  try {
    if (sessionStorage.getItem("taos-push-revisado")) return false;
    sessionStorage.setItem("taos-push-revisado", "1");
  } catch {}
  const registro = await navigator.serviceWorker.ready;
  const actual = await registro.pushManager.getSubscription();
  if (!actual) return false;
  const r = (await (await fetch("/api/push")).json().catch(() => ({}))) as { ok?: boolean; llave?: string };
  if (!r.ok || !r.llave || mismaLlave(actual, r.llave)) return false;
  const anterior = actual.endpoint;
  await actual.unsubscribe().catch(() => {});
  const nueva = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeLlave(r.llave) });
  const guardado = (await (
    await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suscripcion: nueva.toJSON(), dispositivo: nombreDispositivo(), anterior }) })
  )
    .json()
    .catch(() => ({ ok: false }))) as { ok?: boolean };
  // Si el servidor no la guardó, se quita también del celular: Notificaciones mostrará «Activar» en vez de un «activo» falso
  if (!guardado.ok) await nueva.unsubscribe().catch(() => {});
  return !!guardado.ok;
}
