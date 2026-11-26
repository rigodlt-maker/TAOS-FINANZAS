"use client";

// Buscador 🔍 del encabezado, igual en las 4 apps TAOS: "¿Qué quieres hacer?" → te lleva a la pantalla.
// Sin escribir, muestra todo ordenado por grupos (como un menú). Si no hay pantalla, ofrece preguntarle a Tao.
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Destino = { ruta: string; nombre: string; detalle: string; grupo: string; icono: LucideIcon; palabras: string };

const normal = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Palabras que no ayudan a buscar
const VACIAS = new Set("a al de del la las el los lo un una unos unas mi mis tu tus en con por para que como donde quiero ver hacer poner cambiar".split(" "));

function parecida(a: string, b: string): boolean {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previa = actual;
  }
  return previa[b.length] <= 1;
}

// Puntos de cada pantalla para lo que escribiste: nombre > palabras clave > detalle; tolera una letra mal escrita
export function buscarDestinos(consulta: string, destinos: Destino[]): Destino[] {
  const q = normal(consulta);
  if (!q) return [];
  const palabras = q.split(" ").filter((w) => w.length >= 2 && !VACIAS.has(w));
  if (!palabras.length) return [];
  return destinos
    .map((d) => {
      const nombre = normal(d.nombre);
      const claves = normal(`${d.palabras} ${d.detalle}`).split(" ");
      let puntos = nombre.startsWith(q) ? 20 : nombre.includes(q) ? 12 : 0;
      for (const w of palabras) {
        if (nombre.split(" ").some((n) => n.startsWith(w))) puntos += 6;
        else if (claves.some((c) => c.startsWith(w) || (w.length >= 4 && c.startsWith(w.slice(0, -1))))) puntos += 4;
        else if (nombre.split(" ").some((n) => parecida(w, n))) puntos += 5;
        else if (claves.some((c) => parecida(w, c))) puntos += 2;
      }
      return { d, puntos };
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 8)
    .map((x) => x.d);
}

// Barra "¿Qué quieres hacer?" para poner dentro de una pantalla (abre el buscador del encabezado)
export function BarraBuscar() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("taos-buscar"))}
      className="flex min-h-12 w-full items-center gap-2 rounded-full border bg-card px-4 text-left text-muted-foreground active:bg-muted"
    >
      <Search className="size-5 shrink-0" /> ¿Qué quieres hacer?
    </button>
  );
}

// Pedirle algo a Tao desde cualquier parte: abre su hoja y manda la pregunta
export const preguntarATao = (pregunta: string) => window.dispatchEvent(new CustomEvent("taos-preguntar", { detail: pregunta }));

export function Buscador({
  destinos,
  grupos,
  conTao = true,
  ejemplo = "Ej. pagar mi tarjeta",
  pistas = "pagar, tarjeta, ticket",
}: {
  destinos: Destino[];
  grupos: readonly string[];
  conTao?: boolean;
  ejemplo?: string; // marcador de la caja
  pistas?: string; // palabras sugeridas cuando no hay resultados
}) {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [consulta, setConsulta] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const ruta = usePathname();
  const router = useRouter();
  const resultados = useMemo(() => buscarDestinos(consulta, destinos), [consulta, destinos]);

  useEffect(() => setMontado(true), []);
  useEffect(() => setAbierto(false), [ruta]);
  useEffect(() => {
    document.body.style.overflow = abierto ? "hidden" : "";
    if (abierto) setTimeout(() => entrada.current?.focus(), 50);
    else setConsulta("");
    return () => {
      document.body.style.overflow = "";
    };
  }, [abierto]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    // Otras pantallas (la barra de búsqueda del Menú) lo pueden abrir
    const abrir = () => setAbierto(true);
    window.addEventListener("keydown", tecla);
    window.addEventListener("taos-buscar", abrir);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("taos-buscar", abrir);
    };
  }, []);

  const fila = (d: Destino) => (
    <li key={d.ruta}>
      <Link href={d.ruta} onClick={() => setAbierto(false)} className="flex min-h-14 items-center gap-3 rounded-xl px-2 active:bg-muted">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <d.icono className="size-5 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{d.nombre}</span>
          <span className="block truncate text-xs text-muted-foreground">{d.detalle}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Buscar en la app"
        aria-haspopup="dialog"
        data-recorrido="buscar"
        className="flex size-11 items-center justify-center rounded-full border active:scale-95"
      >
        <Search className="size-5" />
      </button>
      {montado &&
        abierto &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60" onClick={() => setAbierto(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Buscar"
              className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-b-3xl border bg-background px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-2 px-1 text-lg font-semibold">¿Qué quieres hacer?</h2>
              <form
                className="mb-3 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (resultados[0]) {
                    setAbierto(false);
                    router.push(resultados[0].ruta);
                  } else if (conTao && consulta.trim()) {
                    setAbierto(false);
                    preguntarATao(consulta);
                  }
                }}
              >
                <label className="flex min-h-12 flex-1 items-center gap-2 rounded-full border bg-card px-4" title="¿Qué quieres hacer?">
                  <Search className="size-5 shrink-0 text-muted-foreground" />
                  <input
                    ref={entrada}
                    value={consulta}
                    onChange={(e) => setConsulta(e.target.value)}
                    placeholder={ejemplo}
                    aria-label="¿Qué quieres hacer?"
                    enterKeyHint="search"
                    className="min-w-0 flex-1 bg-transparent text-base outline-none"
                  />
                </label>
                <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
                  <X className="size-5" />
                </button>
              </form>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {consulta.trim() ? (
                  <>
                    {resultados.length > 0 ? (
                      <ul className="grid gap-1">{resultados.map(fila)}</ul>
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground">No encontré eso con esas palabras. Prueba con otras, por ejemplo: {pistas}.</p>
                    )}
                    {conTao && (
                      <button
                        type="button"
                        onClick={() => {
                          setAbierto(false);
                          preguntarATao(consulta);
                        }}
                        className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/50 px-3 text-left active:bg-muted"
                      >
                        <Sparkles className="size-5 shrink-0 text-primary" />
                        {/* Dos renglones: la pregunta completa se ve (antes se cortaba con "…") */}
                        <span className="grid min-w-0 flex-1 py-2">
                          <span className="text-sm text-muted-foreground">Preguntarle a Tao</span>
                          <strong className="line-clamp-2 break-words">“{consulta.trim()}”</strong>
                        </span>
                      </button>
                    )}
                  </>
                ) : (
                  grupos.map((g) => (
                    <section key={g} className="mb-3">
                      <h3 className="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g}</h3>
                      <ul className="grid gap-1">{destinos.filter((d) => d.grupo === g).map(fila)}</ul>
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
