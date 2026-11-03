"use client";

// Recorrido de bienvenida con "reflector": toda la app se oscurece y solo se ilumina el botón que se explica,
// con flecha, un título corto y 1–2 frases. Sale una sola vez en cada celular (o con ?recorrido=1). Igual en las apps TAOS.
// Para iluminar algo, ponle data-recorrido="nombre" y usa ese nombre en "donde" del paso.
import { X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type Paso = { icono: string; titulo: string; texto: string; donde?: string };

const CLAVE = "taos-recorrido-v2";
const NO_MOSTRAR_EN = ["/bienvenida", "/login", "/configurar", "/acceso-denegado"];
type Caja = { x: number; y: number; w: number; h: number };

export function Recorrido({ pasos }: { pasos: Paso[] }) {
  const [paso, setPaso] = useState<number | null>(null);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [vista, setVista] = useState({ w: 400, h: 800 });
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

  // Busca el botón del paso y mide dónde está (también al girar el celular o al hacer scroll)
  const medir = useCallback(() => {
    setVista({ w: window.innerWidth, h: window.innerHeight });
    const donde = paso === null ? undefined : pasos[paso]?.donde;
    const el = donde ? document.querySelector<HTMLElement>(`[data-recorrido="${donde}"]`) : null;
    if (!el) return setCaja(null);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.top > window.innerHeight || r.bottom < 0) {
      el.scrollIntoView({ block: "center" });
      const r2 = el.getBoundingClientRect();
      return setCaja({ x: r2.left, y: r2.top, w: r2.width, h: r2.height });
    }
    setCaja({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [paso, pasos]);

  useEffect(() => {
    if (paso === null) return;
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [paso, medir]);

  function cerrar() {
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {}
    setPaso(null);
  }

  if (paso === null) return null;
  const actual = pasos[paso];
  const ultimo = paso === pasos.length - 1;
  const m = 8; // margen de la luz alrededor del botón
  const abajo = caja ? caja.y + caja.h / 2 > vista.h / 2 : false; // el botón está en la mitad de abajo → texto arriba
  const centroX = caja ? caja.x + caja.w / 2 : vista.w / 2;
  const controlesArriba = caja ? caja.y > vista.h * 0.72 : false;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Recorrido de la app">
      {/* Oscurece todo menos el botón */}
      {caja ? (
        <div
          className="pointer-events-none fixed rounded-2xl border-2 border-primary transition-all duration-300"
          style={{ left: caja.x - m, top: caja.y - m, width: caja.w + m * 2, height: caja.h + m * 2, boxShadow: "0 0 0 9999px rgba(0,0,0,0.8), 0 0 24px rgba(212,175,55,0.6)" }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/80" />
      )}

      {/* Explicación */}
      <div
        className="fixed inset-x-0 px-6 text-center transition-all duration-300"
        style={caja ? (abajo ? { bottom: vista.h - caja.y + m + 56 } : { top: caja.y + caja.h + m + 56 }) : { top: "30%" }}
      >
        <p className="text-4xl" aria-hidden>
          {actual.icono}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-primary">{actual.titulo}</h2>
        <p className="mx-auto mt-2 max-w-sm text-[17px] leading-snug text-white">{actual.texto}</p>
      </div>

      {/* Flecha hacia el botón */}
      {caja && (
        <svg
          className="pointer-events-none fixed text-primary"
          width="44"
          height="48"
          viewBox="0 0 44 48"
          style={{ left: Math.min(Math.max(centroX - 22, 8), vista.w - 52), ...(abajo ? { top: caja.y - m - 52 } : { top: caja.y + caja.h + m + 4 }), transform: abajo ? undefined : "scaleY(-1)" }}
          aria-hidden
        >
          <path d="M8 4 C 30 10, 30 26, 22 42" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M14 36 L22 44 L28 34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {/* Saltar */}
      <button type="button" onClick={cerrar} aria-label="Saltar recorrido" className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-3 flex min-h-11 items-center gap-1 rounded-full bg-white/10 px-4 text-sm text-white">
        Saltar <X className="size-4" />
      </button>

      {/* Anterior · puntitos · Siguiente */}
      <div
        className="fixed inset-x-0 flex items-center justify-between gap-3 px-4"
        style={controlesArriba ? { top: "max(4rem, calc(env(safe-area-inset-top) + 3.5rem))" } : { bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <button type="button" onClick={() => setPaso(paso - 1)} className={`min-h-12 rounded-full bg-[#1c1c1c] px-5 text-base font-semibold text-white ${paso === 0 ? "invisible" : ""}`}>
          Anterior
        </button>
        <div className="flex gap-1.5" aria-label={`Paso ${paso + 1} de ${pasos.length}`}>
          {pasos.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === paso ? "w-5 bg-primary" : "w-2 bg-white/40"}`} />
          ))}
        </div>
        <button type="button" onClick={() => (ultimo ? cerrar() : setPaso(paso + 1))} className="min-h-12 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground">
          {ultimo ? "Finalizar" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
