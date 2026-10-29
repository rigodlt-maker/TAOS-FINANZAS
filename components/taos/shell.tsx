"use client";

// Piezas compartidas del estilo TAOS (iguales en Finanzas y Segundo Cerebro):
// barra de navegación inferior y botón flotante para la acción principal.
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type Seccion = { ruta: string; nombre: string; icono: LucideIcon; insignia?: number; tambien?: string[] };

const activa = (actual: string, s: Seccion) =>
  s.ruta === "/" ? actual === "/" : [s.ruta, ...(s.tambien ?? [])].some((r) => actual.startsWith(r));

// Máximo 5 secciones, al alcance del pulgar
export function BarraInferior({ secciones }: { secciones: Seccion[] }) {
  const actual = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${secciones.length}, minmax(0, 1fr))` }}>
        {secciones.map((s) => {
          const on = activa(actual, s);
          return (
            <li key={s.ruta}>
              <Link
                href={s.ruta}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors",
                  on && "font-semibold text-primary",
                )}
              >
                <span className={cn("absolute top-0 h-0.5 w-8 rounded-full", on ? "bg-primary" : "bg-transparent")} />
                <span className="relative">
                  <s.icono className="size-6" strokeWidth={on ? 2.2 : 1.8} />
                  {!!s.insignia && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-primary-foreground">
                      {s.insignia > 99 ? "99+" : s.insignia}
                    </span>
                  )}
                </span>
                {s.nombre}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Acción principal de la app, abajo a la derecha, encima de la barra
export function BotonFlotante({
  href,
  etiqueta,
  icono: Icono,
  ocultarEn = [],
}: {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  ocultarEn?: string[];
}) {
  const actual = usePathname();
  if (actual === href || ocultarEn.some((r) => actual.startsWith(r))) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30">
      <div className="mx-auto flex max-w-2xl justify-end px-4">
        <Link
          href={href}
          className="pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-primary pr-6 pl-5 text-base font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(212,175,55,0.35)] active:scale-95"
        >
          <Icono className="size-6" strokeWidth={2.4} />
          {etiqueta}
        </Link>
      </div>
    </div>
  );
}
