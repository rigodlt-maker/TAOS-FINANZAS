"use client";

// Campana 🔔 del encabezado: los avisos que te ha mandado la app (los guarda el service worker en este celular, sin servidor),
// con un numerito de los que no has visto y el acceso para activar las notificaciones. Igual en las apps TAOS.
import { Bell, BellOff, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Aviso = { titulo: string; cuerpo: string; url: string; fecha: number };
const VISTO = "taos-avisos-visto";

async function leerBandeja(): Promise<Aviso[]> {
  try {
    const r = await (await caches.open("bandeja-avisos")).match("/__avisos");
    const lista = r ? await r.json() : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function hace(fecha: number) {
  const min = Math.round((Date.now() - fecha) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export function Campana({ ajustes }: { ajustes: string }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [visto, setVisto] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const [permiso, setPermiso] = useState<NotificationPermission | "no">("default");

  const cargar = useCallback(async () => {
    setAvisos(await leerBandeja());
    try {
      setVisto(Number(localStorage.getItem(VISTO) ?? 0));
    } catch {}
    setPermiso(typeof Notification === "undefined" ? "no" : Notification.permission);
  }, []);

  useEffect(() => {
    cargar();
    const alLlegar = (e: MessageEvent) => e.data?.tipo === "taos-aviso" && cargar();
    navigator.serviceWorker?.addEventListener("message", alLlegar);
    document.addEventListener("visibilitychange", cargar);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", alLlegar);
      document.removeEventListener("visibilitychange", cargar);
    };
  }, [cargar]);

  const nuevos = avisos.filter((a) => a.fecha > visto).length;

  // Al abrir quedan como vistos; el puntito de "nuevo" se conserva hasta cerrar la bandeja
  function abrir() {
    setAbierta(true);
    try {
      localStorage.setItem(VISTO, String(Date.now()));
    } catch {}
  }

  function cerrar() {
    setAbierta(false);
    setVisto(Date.now());
  }

  const activos = permiso === "granted";
  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={nuevos ? `Avisos: ${nuevos} nuevos` : "Avisos"}
        data-recorrido="campana"
        className="relative flex size-11 items-center justify-center rounded-full border text-muted-foreground active:scale-95"
      >
        {activos || permiso === "default" ? <Bell className="size-5" /> : <BellOff className="size-5" />}
        {nuevos > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
            {nuevos > 9 ? "+9" : nuevos}
          </span>
        )}
      </button>
      {abierta &&
        createPortal(
          <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-modal="true" aria-label="Avisos" onClick={cerrar}>
            <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Avisos</h2>
                <button type="button" onClick={cerrar} aria-label="Cerrar" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                  <X className="size-5" />
                </button>
              </div>

              {!activos && (
                <a href={ajustes} onClick={cerrar} className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl border border-primary/60 px-4 py-3 text-sm active:bg-muted">
                  <Bell className="size-5 shrink-0 text-primary" />
                  <span>
                    <strong className="block">{permiso === "denied" ? "Los avisos están bloqueados" : "Activa los avisos"}</strong>
                    <span className="text-muted-foreground">
                      {permiso === "denied" ? "Permítelos en los ajustes de tu celular para esta app." : "Te aviso a tiempo de lo importante. Tócalo para activarlos."}
                    </span>
                  </span>
                </a>
              )}

              {avisos.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Aquí verás los avisos que te mande la app. Por ahora no hay ninguno.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {avisos.map((a, i) => (
                    <li key={`${a.fecha}-${i}`}>
                      <a href={a.url} onClick={cerrar} className="flex min-h-14 gap-3 py-3 active:bg-muted">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.fecha > visto ? "bg-primary" : "bg-transparent"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{a.titulo}</span>
                          {a.cuerpo && <span className="block text-sm text-muted-foreground">{a.cuerpo}</span>}
                          <span className="mt-0.5 block text-xs text-muted-foreground">{hace(a.fecha)}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {activos && (
                <a href={ajustes} onClick={cerrar} className="mt-3 flex min-h-11 items-center justify-center text-sm text-primary">
                  Configurar avisos
                </a>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
