"use client";

// Ojito del encabezado: oculta todas las cantidades ($1,234.56 → $ •••) para abrir la app en público.
// Se recuerda en este celular. Funciona con cualquier pantalla: busca los montos en el texto y los tapa.
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

const CLAVE = "taos-ocultar-montos";
const MONTO = /[-+−]?\$\s?\d[\d,]*(\.\d+)?(\s?(k|mil|M))?/g;
const TAPADO = "$ •••";

export function OcultarMontos() {
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    try {
      setOculto(localStorage.getItem(CLAVE) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (!oculto) return;
    const originales = new Map<Text, string>();
    const tapar = (raiz: Node) => {
      const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      for (let n = recorrido.nextNode() as Text | null; n; n = recorrido.nextNode() as Text | null) {
        const v = n.nodeValue ?? "";
        MONTO.lastIndex = 0;
        if (!MONTO.test(v) || n.parentElement?.closest("input,textarea,[data-sin-ocultar]")) continue;
        originales.set(n, v);
        n.nodeValue = v.replace(MONTO, TAPADO);
      }
    };
    tapar(document.body);
    const observador = new MutationObserver((cambios) => {
      for (const c of cambios) {
        if (c.type === "characterData") tapar(c.target);
        else c.addedNodes.forEach(tapar);
      }
    });
    observador.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => {
      observador.disconnect();
      for (const [n, v] of originales) if (n.isConnected && n.nodeValue?.includes(TAPADO)) n.nodeValue = v;
    };
  }, [oculto]);

  function cambiar() {
    const nuevo = !oculto;
    setOculto(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo ? "1" : "0");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      aria-pressed={oculto}
      aria-label={oculto ? "Mostrar cantidades" : "Ocultar cantidades"}
      data-recorrido="ojito"
      className="flex size-11 items-center justify-center rounded-full border text-muted-foreground active:scale-95"
    >
      {oculto ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  );
}
