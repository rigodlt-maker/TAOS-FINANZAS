"use client";

import { Zap } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { capturaRapida, type Resultado } from "@/lib/acciones";
import { Mensaje } from "./formulario";
import { Button } from "./ui/button";
import { Input } from "./ui/campos";

// Registrar un gasto escribiendo una sola línea, pensado para usarse desde el celular
export function CapturaRapida() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const frase = ref.current?.value.trim();
        if (!frase) return;
        iniciar(async () => {
          const r = await capturaRapida(frase);
          setResultado(r);
          if (r.ok && ref.current) ref.current.value = "";
        });
      }}
    >
      <div className="flex gap-2">
        <Input ref={ref} name="frase" placeholder='"350 súper con débito"' autoComplete="off" className="h-12 text-base" />
        <Button type="submit" size="lg" disabled={pendiente} aria-label="Registrar">
          <Zap className="size-5" />
          <span className="hidden sm:inline">{pendiente ? "Guardando…" : "Registrar"}</span>
        </Button>
      </div>
      {resultado && <Mensaje resultado={resultado} />}
    </form>
  );
}
