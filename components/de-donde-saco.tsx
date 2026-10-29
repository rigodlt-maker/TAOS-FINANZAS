"use client";

import { useState, useTransition } from "react";
import { deDondeSaco } from "@/lib/acciones";
import type { Recorte } from "@/lib/consejos";
import { dinero } from "@/lib/formato";
import { Button } from "./ui/button";

type Respuesta = Awaited<ReturnType<typeof deDondeSaco>>;

// "¿De dónde saco la diferencia?": recortes concretos por categoría (y propuesta con IA si está activa)
export function DeDondeSaco({ metaId }: { metaId: string }) {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="grid gap-2">
      <Button variant="outline" disabled={pendiente} onClick={() => iniciar(async () => setRespuesta(await deDondeSaco(metaId)))}>
        {pendiente ? "Calculando…" : "¿De dónde saco la diferencia?"}
      </Button>
      {respuesta && !respuesta.ok && <p className="text-sm text-destructive">{respuesta.mensaje}</p>}
      {respuesta?.ok && (
        <div className="grid gap-2 rounded-lg bg-muted p-3 text-sm">
          <p>
            Necesitas juntar <strong>{dinero(respuesta.diferencia)}</strong> más al mes.
          </p>
          {respuesta.textoIA ? (
            <p className="whitespace-pre-line">{respuesta.textoIA}</p>
          ) : respuesta.recortes.length ? (
            <ListaRecortes recortes={respuesta.recortes} diferencia={respuesta.diferencia} />
          ) : (
            <p className="text-muted-foreground">
              No encontré gastos claros para recortar este mes. Revisa tus presupuestos o considera mover la fecha de la meta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ListaRecortes({ recortes, diferencia }: { recortes: Recorte[]; diferencia: number }) {
  const total = recortes.reduce((t, r) => t + r.monto, 0);
  return (
    <>
      <ul className="grid gap-1">
        {recortes.map((r) => (
          <li key={r.categoria} className="flex justify-between gap-2">
            <span>
              {r.categoria}
              <span className="block text-xs text-muted-foreground">{r.motivo}</span>
            </span>
            <strong className="whitespace-nowrap">−{dinero(r.monto)}</strong>
          </li>
        ))}
      </ul>
      <p className="border-t pt-2 text-xs text-muted-foreground">
        Con estos recortes juntas {dinero(total)} al mes
        {total < diferencia ? `; aún faltarían ${dinero(diferencia - total)}.` : "."}
      </p>
    </>
  );
}
