"use client";

import { useState, useTransition } from "react";
import { confirmarCategoria, corregirCategoria, type Resultado } from "@/lib/acciones";
import type { Categoria } from "@/lib/tipos";
import { Mensaje } from "./formulario";
import { Button } from "./ui/button";

// Un clic en la categoría correcta: guarda, crea la regla y la aplica a los parecidos
export function SelectorCategoria({
  movimientoId,
  sugerida,
  categorias,
}: {
  movimientoId: string;
  sugerida: string | null;
  categorias: Categoria[];
}) {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  if (resultado?.ok) return <Mensaje resultado={resultado} />;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {sugerida && (
          <Button size="sm" disabled={pendiente} onClick={() => iniciar(async () => setResultado(await confirmarCategoria(movimientoId)))}>
            ✓ {categorias.find((c) => c.id === sugerida)?.nombre}
          </Button>
        )}
        {categorias
          .filter((c) => c.id !== sugerida)
          .map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant="outline"
              disabled={pendiente}
              onClick={() => iniciar(async () => setResultado(await corregirCategoria(movimientoId, c.id)))}
            >
              {c.nombre}
            </Button>
          ))}
      </div>
      {resultado && <Mensaje resultado={resultado} />}
    </div>
  );
}
