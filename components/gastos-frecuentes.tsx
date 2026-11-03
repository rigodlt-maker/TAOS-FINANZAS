"use client";

// Botones de "Gastos frecuentes": un toque y queda registrado (con Deshacer). Sin internet, se guarda y se manda después.
import { useState, useTransition } from "react";
import { deshacerFrecuente, registrarFrecuente } from "@/lib/acciones";
import { agregarACola, sinInternet } from "@/lib/cola";
import type { Frecuente } from "@/lib/frecuentes";

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;

export function GastosFrecuentes({ frecuentes, cuentas }: { frecuentes: Frecuente[]; cuentas: Record<string, string> }) {
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ texto: string; hash?: string; error?: boolean } | null>(null);

  function tocar(f: Frecuente) {
    const datos = { comercio: f.comercio, monto: f.monto, account_id: f.account_id, category_id: f.category_id };
    const guardarSinInternet = () => {
      agregarACola({ tipo: "frecuente", datos });
      setAviso({ texto: `Sin internet: guardé ${pesos(f.monto)} en ${f.comercio}. Se registra solo al volver la señal.` });
    };
    if (sinInternet()) return guardarSinInternet();
    iniciar(async () => {
      try {
        const r = await registrarFrecuente(datos);
        setAviso({ texto: r.mensaje, hash: r.ok ? r.hash : undefined, error: !r.ok });
      } catch (e) {
        if (sinInternet(e)) guardarSinInternet();
        else setAviso({ texto: "No se pudo guardar. Intenta otra vez.", error: true });
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {frecuentes.map((f) => (
          <button
            key={f.clave}
            type="button"
            disabled={pendiente}
            onClick={() => tocar(f)}
            className="flex min-h-12 flex-col items-start justify-center rounded-2xl border px-4 py-1.5 text-left active:scale-95 active:bg-muted disabled:opacity-60"
          >
            <span className="text-sm font-semibold">
              {f.comercio} · {pesos(f.monto)}
            </span>
            <span className="text-xs text-muted-foreground">{cuentas[f.account_id] ?? ""}</span>
          </button>
        ))}
      </div>
      {aviso && (
        <p className={`flex flex-wrap items-center gap-x-3 text-sm ${aviso.error ? "text-destructive" : "text-muted-foreground"}`} role="status">
          {aviso.error ? "⚠️" : "✅"} {aviso.texto}
          {aviso.hash && (
            <button
              type="button"
              className="min-h-11 font-semibold text-primary"
              onClick={() => iniciar(async () => setAviso({ texto: (await deshacerFrecuente(aviso.hash!)).mensaje }))}
            >
              Deshacer
            </button>
          )}
        </p>
      )}
    </div>
  );
}
