"use client";

// Tamaño de letra de la app (Normal, Grande, Muy grande). Se guarda en este celular.
// El script de app/layout.tsx lo aplica antes de pintar la pantalla, para que no "brinque".
import { useEffect, useState } from "react";

const CLAVE = "taos-letra";
const OPCIONES = [
  { id: "normal", nombre: "Normal", muestra: "text-[15px]" },
  { id: "grande", nombre: "Grande", muestra: "text-[17px]" },
  { id: "muy-grande", nombre: "Muy grande", muestra: "text-[19px]" },
] as const;

// Se pone en el <head> del layout raíz
export const SCRIPT_LETRA = `try{var l=localStorage.getItem("${CLAVE}");if(l&&l!=="normal")document.documentElement.dataset.letra=l}catch(e){}`;

export function TamanoLetra() {
  const [actual, setActual] = useState("normal");
  useEffect(() => {
    try {
      setActual(localStorage.getItem(CLAVE) ?? "normal");
    } catch {}
  }, []);

  function elegir(id: string) {
    setActual(id);
    try {
      localStorage.setItem(CLAVE, id);
    } catch {}
    if (id === "normal") delete document.documentElement.dataset.letra;
    else document.documentElement.dataset.letra = id;
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamaño de letra">
      {OPCIONES.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={actual === o.id}
          onClick={() => elegir(o.id)}
          className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border px-2 ${actual === o.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
        >
          <span className={`font-semibold ${o.muestra}`}>Aa</span>
          <span className="text-xs">{o.nombre}</span>
        </button>
      ))}
    </div>
  );
}
