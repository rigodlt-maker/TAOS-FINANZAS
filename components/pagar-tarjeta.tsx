"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { pagarTarjeta } from "@/lib/acciones";
import { dinero } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/campos";

type Origen = { id: string; nombre: string; saldo: number };

// Elegir de dónde sale el dinero y cuánto: botones grandes, sin escribir de más
export function PagarTarjeta({ tarjetaId, deuda, alCorte, origenes }: { tarjetaId: string; deuda: number; alCorte: number; origenes: Origen[] }) {
  const sugerido = alCorte > 0.5 ? alCorte : deuda;
  const [origen, setOrigen] = useState(origenes.find((o) => o.saldo >= sugerido)?.id ?? origenes[0]?.id ?? "");
  const [modo, setModo] = useState<"corte" | "completo" | "otra">(alCorte > 0.5 ? "corte" : deuda > 0 ? "completo" : "otra");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState("");
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const elegido = origenes.find((o) => o.id === origen);
  const cantidad = modo === "corte" ? alCorte : modo === "completo" ? deuda : Number(monto.replace(/[$,\s]/g, "")) || 0;
  const hayNuevas = deuda - alCorte > 0.5;

  const opcion = (activa: boolean) =>
    cn("flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-left active:bg-muted", activa && "border-primary bg-primary/10");

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const f = new FormData();
        f.set("tarjeta_id", tarjetaId);
        f.set("origen_id", origen);
        f.set("modo", modo);
        f.set("monto", monto);
        iniciar(async () => {
          const r = await pagarTarjeta(f);
          if (r.ok) router.push(`/?aviso=${encodeURIComponent(r.mensaje)}`);
          else setError(r.mensaje);
        });
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium text-muted-foreground">¿De dónde sale el dinero?</legend>
        {origenes.map((o) => (
          <button key={o.id} type="button" className={opcion(origen === o.id)} onClick={() => setOrigen(o.id)} aria-pressed={origen === o.id}>
            <span className="flex-1">
              <span className="block font-medium">{o.nombre}</span>
              <span className="block text-sm text-muted-foreground">Tienes {dinero(o.saldo)}</span>
            </span>
            {origen === o.id && <Check className="size-5 text-primary" />}
          </button>
        ))}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium text-muted-foreground">¿Cuánto pagaste?</legend>
        {alCorte > 0.5 && (
          <button type="button" className={opcion(modo === "corte")} onClick={() => setModo("corte")} aria-pressed={modo === "corte"}>
            <span className="flex-1">
              <span className="block font-medium">{hayNuevas ? "Lo del corte" : "Pagado completo"}</span>
              <span className="block text-sm text-muted-foreground">
                {dinero(alCorte)}
                {hayNuevas && " · para no generar intereses"}
              </span>
            </span>
            {modo === "corte" && <Check className="size-5 text-primary" />}
          </button>
        )}
        {deuda > 0 && (hayNuevas || alCorte <= 0.5) && (
          <button type="button" className={opcion(modo === "completo")} onClick={() => setModo("completo")} aria-pressed={modo === "completo"}>
            <span className="flex-1">
              <span className="block font-medium">Todo (dejarla en ceros)</span>
              <span className="block text-sm text-muted-foreground">{dinero(deuda)}</span>
            </span>
            {modo === "completo" && <Check className="size-5 text-primary" />}
          </button>
        )}
        <button type="button" className={opcion(modo === "otra")} onClick={() => setModo("otra")} aria-pressed={modo === "otra"}>
          <span className="flex-1 font-medium">Otra cantidad</span>
          {modo === "otra" && <Check className="size-5 text-primary" />}
        </button>
        {modo === "otra" && (
          <Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" placeholder="¿Cuánto?" autoFocus aria-label="Cantidad pagada" />
        )}
      </fieldset>

      {elegido && cantidad > elegido.saldo && (
        <p className="rounded-xl border border-destructive/60 px-4 py-3 text-sm text-destructive">
          Ojo: en {elegido.nombre} tienes {dinero(elegido.saldo)}, menos de lo que vas a pagar.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={pendiente || !origen || !(cantidad > 0)}>
        {pendiente ? <Loader2 className="size-5 animate-spin" /> : null}
        {cantidad > 0 ? `Registrar pago de ${dinero(cantidad)}` : "Registrar pago"}
      </Button>
    </form>
  );
}
