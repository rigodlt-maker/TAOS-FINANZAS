"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

// Botón grande para copiar un texto largo (el script de Gmail)
export function Copiar({ texto, etiqueta = "Copiar código" }: { texto: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
          } catch {
            // Si el navegador no deja copiar, se selecciona el texto para copiarlo a mano
            const area = document.getElementById("texto-a-copiar") as HTMLTextAreaElement | null;
            area?.select();
          }
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        }}
      >
        {copiado ? <Check className="size-5" /> : <Copy className="size-5" />}
        {copiado ? "¡Copiado!" : etiqueta}
      </Button>
      <textarea
        id="texto-a-copiar"
        readOnly
        value={texto}
        rows={6}
        className="w-full rounded-xl border bg-background p-3 font-mono text-xs text-muted-foreground"
        aria-label="Código del script"
      />
    </div>
  );
}
