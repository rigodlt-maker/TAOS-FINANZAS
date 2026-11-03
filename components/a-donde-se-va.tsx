// "¿A dónde se va mi dinero?" (dona por categoría + Debo / Necesito / Quiero) y "Tendencia del saldo". SVG propio, sin librerías.
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dinero, dineroCorto, fechaCorta } from "@/lib/formato";
import type { gastoPorCategoria, resumenNaturaleza, tendenciaSaldo } from "@/lib/naturaleza";

const COLORES = ["#d4af37", "#f0d878", "#9c7f2a", "#b8b8b8", "#777777", "#4a4a4a"];
const COLOR_NATURALEZA = { debo: "#9c7f2a", necesito: "#d4af37", quiero: "#f0d878" } as const;

export function ADondeSeVa({ dona, naturaleza, periodo }: { dona: ReturnType<typeof gastoPorCategoria>; naturaleza: ReturnType<typeof resumenNaturaleza>; periodo: string }) {
  if (!dona.total) return null;
  // Dona: cada categoría es un arco del círculo
  const r = 42;
  const largo = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <Card className="grid gap-4">
      <CardHeader>
        <CardTitle>¿A dónde se va mi dinero?</CardTitle>
        <Link href="/movimientos" className="flex min-h-11 items-center text-sm text-primary">
          Ver gastos
        </Link>
      </CardHeader>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="size-32 shrink-0 -rotate-90" role="img" aria-label="Gasto por categoría">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#222" strokeWidth="18" />
          {dona.partes.map((p, i) => {
            const tramo = (p.porcentaje / 100) * largo;
            const el = <circle key={p.nombre} cx="60" cy="60" r={r} fill="none" stroke={COLORES[i % COLORES.length]} strokeWidth="18" strokeDasharray={`${Math.max(tramo - 1.5, 0.5)} ${largo}`} strokeDashoffset={-acumulado} />;
            acumulado += tramo;
            return el;
          })}
        </svg>
        <ul className="grid min-w-0 flex-1 gap-1.5 text-sm">
          {dona.partes.map((p, i) => (
            <li key={p.nombre} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
              <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
              <span className="text-muted-foreground">{Math.round(p.porcentaje)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        {dinero(dona.total)} gastados {periodo}
      </p>

      {/* Debo / Necesito / Quiero */}
      <div className="grid gap-3 border-t pt-4">
        <div>
          <p className="font-medium">¿Lo debo, lo necesito o lo quiero?</p>
          <p className="text-xs text-muted-foreground">Se calcula solo con la categoría de cada gasto.</p>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {naturaleza.partes.map((p) => (
            <span key={p.id} style={{ width: `${p.porcentaje}%`, background: COLOR_NATURALEZA[p.id] }} />
          ))}
        </div>
        <ul className="grid grid-cols-3 gap-2 text-center">
          {naturaleza.partes.map((p) => (
            <li key={p.id} className="rounded-xl bg-muted/50 px-2 py-2.5">
              <p className="text-sm">
                {p.emoji} <span className="font-semibold">{p.nombre}</span>
              </p>
              <p className="mt-0.5 font-semibold">{dineroCorto(p.monto)}</p>
              <p className="text-xs text-muted-foreground">{Math.round(p.porcentaje)}%</p>
            </li>
          ))}
        </ul>
        {naturaleza.sinCategoria > 0 && (
          <Link href="/revisar" className="text-sm text-muted-foreground underline-offset-2 active:underline">
            {dinero(naturaleza.sinCategoria)} sin categoría no cuentan aquí · ponles categoría →
          </Link>
        )}
        {naturaleza.total > 0 && naturaleza.partes[2].porcentaje >= 35 && (
          <p className="text-sm text-muted-foreground">
            💡 Más de un tercio se va en <strong className="text-foreground">gustos</strong>. Ahí está lo más fácil de recortar.
          </p>
        )}
      </div>
    </Card>
  );
}

export function TendenciaSaldo({ puntos }: { puntos: ReturnType<typeof tendenciaSaldo> }) {
  if (puntos.length < 2) return null;
  const valores = puntos.map((p) => p.saldo);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const W = 300;
  const H = 110;
  const xy = puntos.map((p, i) => [(i / (puntos.length - 1)) * W, 8 + (1 - (p.saldo - min) / rango) * (H - 16)] as const);
  const linea = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const hoy = puntos.at(-1)!.saldo;
  const antes = puntos[0].saldo;
  const cambio = antes ? ((hoy - antes) / Math.abs(antes)) * 100 : 0;
  return (
    <Card className="grid gap-2">
      <CardTitle>Tendencia del saldo</CardTitle>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">HOY</p>
          <p className="text-2xl font-semibold tracking-tight">{dinero(hoy)}</p>
        </div>
        <p className={`text-right text-lg font-semibold ${cambio < 0 ? "text-destructive" : "text-primary"}`}>
          {cambio > 0 ? "+" : ""}
          {Math.round(cambio)}%<span className="block text-xs font-normal text-muted-foreground">vs hace 30 días</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none" role="img" aria-label="Saldo de los últimos 30 días">
        <defs>
          <linearGradient id="relleno-saldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d4af37" stopOpacity="0.35" />
            <stop offset="1" stopColor="#d4af37" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${linea} L${W} ${H} L0 ${H} Z`} fill="url(#relleno-saldo)" />
        <path d={linea} fill="none" stroke="#d4af37" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{fechaCorta(puntos[0].fecha)}</span>
        <span>Hoy</span>
      </div>
      <CardDescription>Suma de tus cuentas (lo que tienes menos lo que debes de tarjetas), según tus movimientos.</CardDescription>
    </Card>
  );
}
