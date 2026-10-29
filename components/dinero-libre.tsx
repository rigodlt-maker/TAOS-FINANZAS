import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { dinero } from "@/lib/formato";
import type { ResumenDinero } from "@/lib/transferencias";
import { Card } from "./ui/card";

// Lo que tienes, menos lo que debes en tarjetas = lo que te queda libre
export function DineroLibre({ r, detalle = {}, teDeben = 0 }: { r: ResumenDinero; detalle?: Record<string, string>; teDeben?: number }) {
  return (
    <Card className="grid gap-3">
      <p className="text-sm text-muted-foreground">{r.libre >= 0 ? "Dinero libre" : "Te falta para cubrir tus tarjetas"}</p>
      <p className={`text-4xl font-semibold tracking-tight ${r.libre < 0 ? "text-destructive" : "text-primary"}`}>{dinero(Math.abs(r.libre))}</p>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm text-muted-foreground">
          <span>
            Tienes {dinero(r.tengo)} · debes {dinero(r.debo)}
          </span>
          <span className="text-lg transition-transform group-open:rotate-45">+</span>
        </summary>
        <ul className="mt-2 grid gap-1 text-sm">
          {r.cuentas.map((c) => (
            <li key={c.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate">{c.nombre}</span>
                {detalle[c.id] && <span className="block truncate text-xs text-primary">{detalle[c.id]}</span>}
              </span>
              <span>{dinero(c.saldo_actual)}</span>
            </li>
          ))}
          {r.tarjetas.map((c) => (
            <li key={c.id}>
              {/* Tocar la deuda lleva directo a registrar el pago */}
              <Link href={`/pagar/${c.id}`} className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-destructive active:bg-muted">
                <span className="min-w-0">
                  <span className="block truncate">Debes en {c.nombre}</span>
                  {/* Lo del corte vs. compras nuevas */}
                  {detalle[c.id] && <span className="block truncate text-xs text-muted-foreground">{detalle[c.id]}</span>}
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  −{dinero(-c.saldo_actual)}
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Pagar</span>
                </span>
              </Link>
            </li>
          ))}
          {teDeben > 0 && (
            <li>
              {/* Préstamos: dinero a tu favor (no se suma al dinero libre hasta que te paguen) */}
              <Link href="/prestamos" className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-primary active:bg-muted">
                <span className="truncate">Te deben (préstamos)</span>
                <span className="whitespace-nowrap">+{dinero(teDeben)}</span>
              </Link>
            </li>
          )}
          <li className="mt-1 flex justify-between gap-3 border-t pt-2 font-semibold">
            <span>{r.libre >= 0 ? "Te queda libre" : "Te falta"}</span>
            <span>{dinero(r.libre)}</span>
          </li>
        </ul>
      </details>
      <Link href="/entre-cuentas" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium text-primary active:bg-muted">
        <ArrowLeftRight className="size-4" /> Pagar tarjeta o mover dinero
      </Link>
    </Card>
  );
}
