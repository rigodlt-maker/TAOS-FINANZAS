"use client";

import { Zap } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { capturaRapida, type Resultado } from "@/lib/acciones";
import { agregarACola, sinInternet } from "@/lib/cola";
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
        // Sin internet: se guarda en el celular y se registra solo al volver la señal
        const guardarSinInternet = () => {
          if (!agregarACola({ tipo: "frase", frase })) return setResultado({ ok: false, mensaje: "Sin internet y sin poder guardarlo en este celular. Intenta de nuevo con señal." });
          setResultado({ ok: true, mensaje: `Sin internet: guardé "${frase}". Se registra solo al volver la señal.` });
          if (ref.current) ref.current.value = "";
        };
        if (sinInternet()) return guardarSinInternet();
        iniciar(async () => {
          try {
            const r = await capturaRapida(frase);
            setResultado(r);
            if (r.ok && ref.current) ref.current.value = "";
          } catch (e) {
            if (sinInternet(e)) guardarSinInternet();
            else setResultado({ ok: false, mensaje: "No se pudo guardar. Intenta otra vez." });
          }
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
