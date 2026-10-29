"use client";

// Botón "Tao" del encabezado, igual en las 4 apps TAOS: siempre arriba a la derecha y abre el chat
// en una hoja desde abajo, sin salir de la pantalla. La conversación se conserva mientras navegas.
import { Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function BotonTao({ titulo = "Pregúntale a Tao", children }: { titulo?: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const ruta = usePathname();

  // La hoja se dibuja directo en <body>: dentro del encabezado (que tiene desenfoque) quedaría atrapada fuera de la pantalla
  useEffect(() => setMontado(true), []);

  // Al tocar un enlace de la respuesta, la hoja se cierra para mostrar la pantalla
  useEffect(() => setAbierto(false), [ruta]);

  useEffect(() => {
    // "/" o Ctrl+K lo abren en computadora; Escape lo cierra
    const tecla = (e: KeyboardEvent) => {
      const escribiendo = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if (e.key === "Escape") setAbierto(false);
      else if (!escribiendo && (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        setAbierto(true);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  useEffect(() => {
    // Mientras está abierto, la página de atrás no se desplaza
    document.body.style.overflow = abierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_rgba(212,175,55,0.3)] active:scale-95"
      >
        <Sparkles className="size-5" />
        Tao
      </button>
      {montado &&
        createPortal(
          <div className={cn("fixed inset-0 z-50 flex items-end justify-center bg-black/60", !abierto && "hidden")} onClick={() => setAbierto(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={titulo}
              className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl border bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/40" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="size-5 text-primary" />
                  {titulo}
                </h2>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onClick={(e) => (e.target as HTMLElement).closest("a") && setAbierto(false)}>
                {children}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
