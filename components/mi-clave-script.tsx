"use client";
// Nube F1 · En TAOS Nube cada persona crea su propia clave para el script de Google. Se muestra una sola vez.
import { useState, useTransition } from "react";
import { Copiar } from "@/components/copiar";
import { Button } from "@/components/ui/button";

export function MiClaveScript({ generar }: { generar: () => Promise<{ ok: boolean; script?: string; mensaje?: string }> }) {
  const [script, setScript] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  if (script)
    return (
      <div className="grid gap-2">
        <Copiar texto={script} />
        <p className="text-xs text-muted-foreground">Cópialo ahora: por seguridad no se vuelve a mostrar. Si lo pierdes, crea otra clave (la anterior deja de servir).</p>
      </div>
    );
  return (
    <div className="grid gap-2">
      <Button type="button" disabled={pendiente} onClick={() => iniciar(async () => { const r = await generar(); if (r.ok && r.script) setScript(r.script); else setMensaje(r.mensaje ?? "No se pudo crear tu clave."); })}>
        Crear mi clave y ver el código
      </Button>
      <p className="text-xs text-muted-foreground">Si ya tenías una, esta la reemplaza: vuelve a pegar el código nuevo en tu script.</p>
      {mensaje && <p className="text-sm text-destructive">{mensaje}</p>}
    </div>
  );
}
