"use client";

// Recorrido de bienvenida: 4 o 5 tarjetas que explican la app. Sale una sola vez en cada celular
// (o cuando entras con ?recorrido=1). Igual en las apps TAOS.
import { X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export type Paso = { icono: string; titulo: string; texto: string };

const CLAVE = "taos-recorrido-v1";
const NO_MOSTRAR_EN = ["/bienvenida", "/login", "/configurar", "/acceso-denegado"];

export function Recorrido({ pasos }: { pasos: Paso[] }) {
  const [paso, setPaso] = useState<number | null>(null);
  const ruta = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (NO_MOSTRAR_EN.some((r) => ruta.startsWith(r))) return;
    let visto = false;
    try {
      visto = localStorage.getItem(CLAVE) === "1";
    } catch {}
    if (!visto || params.get("recorrido") === "1") setPaso(0);
  }, [ruta, params]);

  function cerrar() {
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {}
    setPaso(null);
  }

  if (paso === null) return null;
  const actual = pasos[paso];
  const ultimo = paso === pasos.length - 1;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center" role="dialog" aria-modal="true" aria-label="Recorrido de la app">
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl">
        <button type="button" onClick={cerrar} aria-label="Saltar recorrido" className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <X className="size-5" />
        </button>
        <p className="text-5xl">{actual.icono}</p>
        <h2 className="mt-4 text-xl font-semibold">{actual.titulo}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{actual.texto}</p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-label={`Paso ${paso + 1} de ${pasos.length}`}>
            {pasos.map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === paso ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {paso > 0 && (
              <button type="button" onClick={() => setPaso(paso - 1)} className="min-h-12 rounded-full border px-4 text-sm">
                Atrás
              </button>
            )}
            <button type="button" onClick={() => (ultimo ? cerrar() : setPaso(paso + 1))} className="min-h-12 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
              {ultimo ? "¡Listo!" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
