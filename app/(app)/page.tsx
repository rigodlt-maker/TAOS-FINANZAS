import { ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import { DineroLibre } from "@/components/dinero-libre";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progreso } from "@/components/ui/campos";
import { dinero, dineroCorto, fechaCorta, hoyLocal, mesDe, nombreMes, rangoDelMes, sumarDias } from "@/lib/formato";
import { detectarHormiga } from "@/lib/hormiga";
import { pagosDeTarjeta, pagosProximos } from "@/lib/pagos";
import { porcentajeDelMes, resumenPorCategoria } from "@/lib/presupuesto";
import { obtenerRepo } from "@/lib/sesion";
import { abiertos, pendiente } from "@/lib/envios";
import { ganaRendimiento, interesDelDia } from "@/lib/rendimientos";
import { contextoTarjetas, estadoTarjeta, lineaTarjeta } from "@/lib/tarjetas";
import { resumenDinero } from "@/lib/transferencias";

// Inicio con lo esencial: cómo va el mes, qué hay que pagar pronto y qué categorías vigilar
export default async function Inicio({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  const hoy = hoyLocal();
  const mes = mesDe(hoy);
  const repo = await obtenerRepo();
  const [categorias, movimientos, pagos, cuentas, porRevisar, ultimos30] = await Promise.all([
    repo.categorias(),
    repo.movimientos({ desde: rangoDelMes(mes).inicio }),
    repo.pagos(),
    repo.cuentas(),
    repo.contarPorRevisar(),
    repo.movimientos({ desde: sumarDias(hoyLocal(), -30) }),
  ]);
  const hormiga = detectarHormiga(ultimos30, categorias, hoy);
  const avisosPendientes = await repo.correos({ estado: "pendiente" }).then((x) => x.length).catch(() => 0);
  const ctx = await contextoTarjetas(repo, hoy);
  const teDeben = await repo.prestamos().then((ps) => abiertos(ps).reduce((t, p) => t + pendiente(p), 0)).catch(() => 0);
  const detalleTarjetas = Object.fromEntries([
    ...cuentas.filter((c) => c.tipo === "credito").map((c) => [c.id, lineaTarjeta(estadoTarjeta(c, ctx.movimientos, ctx.transferencias, hoy))]),
    // Cajitas: cuánto ganan al día
    ...cuentas.filter(ganaRendimiento).map((c) => [c.id, `+${dinero(interesDelDia(c))} al día (${c.tasa_anual}% anual)`]),
  ]);

  const gastado = movimientos.filter((m) => m.tipo === "gasto").reduce((t, m) => t + m.monto, 0);
  const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((t, m) => t + m.monto, 0);
  const presupuestoTotal = categorias.reduce((t, c) => t + c.presupuesto_mensual, 0);
  const pctGastado = presupuestoTotal ? (gastado / presupuestoTotal) * 100 : 0;
  const pctMes = porcentajeDelMes(mes, hoy);
  const vigilar = resumenPorCategoria(mes, hoy, categorias, movimientos)
    .filter((r) => r.presupuesto > 0)
    .sort((a, b) => b.porcentajeGastado - a.porcentajeGastado)
    .slice(0, 3);
  const proximos = [
    ...pagosProximos(pagos, hoy, 14).map((p) => ({ id: p.id, href: "/pagos", nombre: p.nombre, fecha: p.proximo_vencimiento, monto: p.monto as number | null })),
    ...pagosDeTarjeta(cuentas, hoy, 14, ctx).filter((t) => t.yaCorto && t.deuda > 0.5).map((t) => ({
      id: `tarjeta-${t.cuenta.id}`,
      href: `/pagar/${t.cuenta.id}`,
      nombre: `Tarjeta ${t.cuenta.nombre}`,
      fecha: t.vence,
      monto: t.deuda > 0 ? t.deuda : null,
    })),
  ]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 3);

  return (
    <div className="grid gap-4">
      {aviso && <p className="rounded-2xl border border-primary/60 bg-card px-4 py-3 text-sm">✅ {aviso}</p>}
      {avisosPendientes > 0 && (
        <Link href="/correos" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-primary/60 bg-card px-4 py-3 text-sm active:bg-muted">
          <span>
            📩 {avisosPendientes === 1 ? "1 aviso del banco" : `${avisosPendientes} avisos del banco`} por confirmar
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      )}
      <DineroLibre r={resumenDinero(cuentas)} detalle={detalleTarjetas} teDeben={teDeben} />

      <Card className="grid gap-3">
        <p className="text-sm text-muted-foreground first-letter:uppercase">Gastado en {nombreMes(mes)}</p>
        <p className="text-3xl font-semibold tracking-tight">{dinero(gastado)}</p>
        <Progreso valor={pctGastado} rojo={pctGastado > 100} />
        <p className="text-sm text-muted-foreground">
          {Math.round(pctGastado)}% de {dineroCorto(presupuestoTotal)} · va el {Math.round(pctMes)}% del mes
        </p>
        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <div>
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="text-lg font-semibold">{dineroCorto(ingresos)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className={`text-lg font-semibold ${ingresos - gastado < 0 ? "text-destructive" : "text-primary"}`}>{dineroCorto(ingresos - gastado)}</p>
          </div>
        </div>
      </Card>

      {hormiga.grupos.length > 0 && (
        <Card className="grid gap-3">
          <div>
            <CardTitle>🐜 Gastos hormiga</CardTitle>
            <CardDescription className="mt-1">
              En 30 días se te fueron <strong className="text-foreground">{dinero(hormiga.total)}</strong> en gastitos que se repiten. Al año serían{" "}
              <strong className="text-primary">{dineroCorto(hormiga.alAnio)}</strong>.
            </CardDescription>
          </div>
          <ul className="divide-y">
            {hormiga.grupos.slice(0, 3).map((g) => (
              <li key={g.nombre} className="flex min-h-12 items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{g.nombre}</span>
                  <span className="block text-xs text-muted-foreground">
                    {g.veces} veces · {dinero(g.promedio)} en promedio
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{dinero(g.total)}</span>
                  <span className="block text-xs text-muted-foreground">{dineroCorto(g.alAnio)} al año</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Compras de hasta $250 que se repiten 3 veces o más en el mismo lugar.</p>
        </Card>
      )}

      {porRevisar > 0 && (
        <Link href="/revisar" className="flex min-h-16 items-center gap-3 rounded-2xl border border-primary/50 bg-card px-4 active:bg-muted">
          <Inbox className="size-6 text-primary" />
          <span className="flex-1">
            <span className="block font-medium">{porRevisar} movimientos por revisar</span>
            <span className="block text-xs text-muted-foreground">Toca para ponerles categoría</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Próximos pagos</CardTitle>
          <Link href="/pagos" className="flex min-h-11 items-center text-sm text-primary">
            Ver todos
          </Link>
        </CardHeader>
        {proximos.length === 0 ? (
          <CardDescription>Nada por pagar en las próximas 2 semanas.</CardDescription>
        ) : (
          <ul className="divide-y">
            {proximos.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="flex min-h-14 items-center justify-between gap-3 active:bg-muted">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.nombre}</span>
                    <span className="block text-xs text-muted-foreground">{fechaCorta(p.fecha)}</span>
                  </span>
                  <span className="flex items-center gap-1 font-semibold whitespace-nowrap">
                    {p.monto !== null ? dinero(p.monto) : "—"}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vigila estas categorías</CardTitle>
          <Link href="/presupuesto" className="flex min-h-11 items-center text-sm text-primary">
            Ver todas
          </Link>
        </CardHeader>
        {vigilar.length === 0 ? (
          <CardDescription>Pon presupuestos a tus categorías en Más › Ajustes.</CardDescription>
        ) : (
          <ul className="grid gap-4">
            {vigilar.map((r) => (
              <li key={r.categoria.id} className="grid gap-1.5">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{r.categoria.nombre}</span>
                  <span className="text-sm whitespace-nowrap">
                    {dineroCorto(r.gastado)} <span className="text-muted-foreground">/ {dineroCorto(r.presupuesto)}</span>
                  </span>
                </div>
                <Progreso valor={r.porcentajeGastado} rojo={r.estado === "excedido"} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
