"use client";

// Respuesta de Tao con sus botones de opciones (si los trae). Igual en las apps TAOS.
import { separarOpciones } from "@/lib/opciones";
import { Markdown } from "../markdown";

export function RespuestaTao({ texto, onOpcion }: { texto: string; onOpcion?: (opcion: string) => void }) {
  const { texto: limpio, opciones } = separarOpciones(texto);
  return (
    <div className="grid gap-3">
      <Markdown texto={limpio} />
      {onOpcion && opciones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {opciones.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onOpcion(o)}
              className="min-h-11 rounded-full border border-primary/60 bg-primary/10 px-4 text-left text-sm font-medium text-primary active:bg-primary/20"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
