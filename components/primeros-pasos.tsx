"use client";

import { Check, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardDescription, CardTitle } from "./ui/card";

const CLAVE = "taos-primeros-pasos-oculto";

export type Paso = { hecho: boolean; titulo: string; detalle: string; href: string };

// Guía de inicio: qué registrar primero y dónde. Se va palomeando sola y desaparece al terminar (o si la ocultas).
export function PrimerosPasos({ pasos }: { pasos: Paso[] }) {
  const [oculto, setOculto] = useState(true);
  useEffect(() => {
    try {
      setOculto(localStorage.getItem(CLAVE) === "1");
    } catch {
      setOculto(false);
    }
  }, []);
  const hechos = pasos.filter((p) => p.hecho).length;
  if (oculto || hechos === pasos.length) return null;
  return (
    <Card className="grid gap-3 border-primary/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Primeros pasos</CardTitle>
          <CardDescription className="mt-1">
            Llevas {hechos} de {pasos.length}. Así la app sabe cuánto tienes y cuánto debes.
          </CardDescription>
        </div>
        <button
          type="button"
          aria-label="Ocultar primeros pasos"
          className="-m-2 flex size-11 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          onClick={() => {
            try {
              localStorage.setItem(CLAVE, "1");
            } catch {}
            setOculto(true);
          }}
        >
          <X className="size-5" />
        </button>
      </div>
      <ol className="grid gap-2">
        {pasos.map((p, i) => (
          <li key={p.titulo}>
            <Link href={p.href} className="flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 active:bg-muted">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${p.hecho ? "bg-primary text-primary-foreground" : "border border-primary text-primary"}`}
              >
                {p.hecho ? <Check className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${p.hecho ? "text-muted-foreground line-through" : ""}`}>{p.titulo}</span>
                <span className="block text-xs text-muted-foreground">{p.detalle}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">¿No tienes tarjetas o créditos? Toca la ✕ para ocultar esta guía.</p>
    </Card>
  );
}
