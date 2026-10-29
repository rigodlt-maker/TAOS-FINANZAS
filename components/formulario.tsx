"use client";

import { useRef, useState, useTransition } from "react";
import type { Resultado } from "@/lib/acciones";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

// Formulario que llama a una acción del servidor y muestra el resultado debajo
export function Formulario({
  accion,
  children,
  boton = "Guardar",
  className,
  limpiar = false,
  alTerminar,
}: {
  accion: (f: FormData) => Promise<Resultado>;
  children: React.ReactNode;
  boton?: string;
  className?: string;
  limpiar?: boolean;
  alTerminar?: () => void;
}) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={cn("grid gap-3", className)}
      action={(f) =>
        iniciar(async () => {
          const r = await accion(f);
          setResultado(r);
          if (r.ok) {
            if (limpiar) ref.current?.reset();
            alTerminar?.();
          }
        })
      }
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : boton}
        </Button>
        {resultado && <Mensaje resultado={resultado} />}
      </div>
    </form>
  );
}

export function Mensaje({ resultado }: { resultado: Resultado }) {
  return (
    <p role="status" className={cn("text-sm", resultado.ok ? "text-muted-foreground" : "text-destructive")}>
      {resultado.mensaje}
    </p>
  );
}

// Botón que ejecuta una acción con confirmación opcional (para borrar)
export function BotonAccion({
  accion,
  confirmar,
  children,
  variant = "ghost",
  size = "sm",
}: {
  accion: () => Promise<Resultado>;
  confirmar?: string;
  children: React.ReactNode;
  variant?: "ghost" | "outline" | "destructive" | "default";
  size?: "sm" | "default" | "icon";
}) {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pendiente}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return;
          iniciar(async () => setResultado(await accion()));
        }}
      >
        {children}
      </Button>
      {resultado && <Mensaje resultado={resultado} />}
    </span>
  );
}

// Sección que se abre y se cierra (para formularios de edición)
export function Desplegable({ titulo, children, abierto = false }: { titulo: React.ReactNode; children: React.ReactNode; abierto?: boolean }) {
  return (
    <details className="group rounded-2xl border bg-card" open={abierto}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 font-medium">
        {titulo}
        <span className="text-xl text-muted-foreground transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}
