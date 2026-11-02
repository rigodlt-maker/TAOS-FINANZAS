"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// Un dato corto (como una dirección) con su botón de copiar al lado
export function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-background p-2">
      <code className="min-w-0 flex-1 break-all text-xs">{texto}</code>
      <button
        type="button"
        className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          } catch {}
        }}
      >
        {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
