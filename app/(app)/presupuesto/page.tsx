import Link from "next/link";
import { GraficaMeses, GraficaPresupuesto } from "@/components/graficas-diferidas";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Progreso } from "@/components/ui/campos";
import { dinero, dineroCorto, fechaCorta, hoyLocal, mesDe, nombreMes, rangoDelMes, sumarMeses } from "@/lib/formato";
import { evolucionMensual, resumenPorCategoria, type EstadoCategoria } from "@/lib/presupuesto";
import { obtenerRepo } from "@/lib/sesion";

const ESTADOS: Record<EstadoCategoria, { texto: string; tono: "neutro" | "fuerte" | "rojo" }> = {
  excedido: { texto: "Excedido", tono: "rojo" },
  en_riesgo: { texto: "En riesgo", tono: "fuerte" },
  ok: { texto: "Bien", tono: "neutro" },
  sin_presupuesto: { texto: "Sin presupuesto", tono: "neutro" },
};

export default async function Presupuesto() {
  const hoy = hoyLocal();
  const mes = mesDe(hoy);
  const repo = await obtenerRepo();
  const [categorias, movimientos] = await Promise.all([
    repo.categorias(),
    repo.movimientos({ desde: rangoDelMes(sumarMeses(mes, -5)).inicio }),
  ]);
  const resumen = resumenPorCategoria(mes, hoy, categorias, movimientos).filter((r) => r.presupuesto > 0 || r.gastado > 0);

  return (
    <div className="grid gap-4">
      <Titulo detalle={<span className="first-letter:uppercase">{nombreMes(mes)} · toca una categoría para ver qué pesa más</span>}>Presupuesto</Titulo>
      <Card>
        <CardHeader>
          <CardTitle>Por categoría</CardTitle>
          <Link href="/ajustes" className="flex min-h-11 items-center text-sm text-primary">
            Editar
          </Link>
        </CardHeader>
          {resumen.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pon presupuestos a tus categorías en Ajustes o carga los datos de ejemplo para ver este tablero.
            </p>
          ) : (
            <ul className="divide-y">
              {resumen.map((r) => (
                <li key={r.categoria.id}>
                  <details className="group py-3">
                    <summary className="grid cursor-pointer list-none gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium">
                          {r.categoria.nombre}
                          <Badge tono={ESTADOS[r.estado].tono}>{ESTADOS[r.estado].texto}</Badge>
                        </span>
                        <span className="text-sm whitespace-nowrap">
                          {dinero(r.gastado)}
                          {r.presupuesto > 0 && <span className="text-muted-foreground"> / {dineroCorto(r.presupuesto)}</span>}
                        </span>
                      </div>
                      {r.presupuesto > 0 && (
                        <>
                          <div className="relative">
                            <Progreso valor={r.porcentajeGastado} rojo={r.estado === "excedido"} />
                            {/* Marca de cuánto del mes ya pasó: si la barra la rebasa, vas adelantado */}
                            <div
                              className="absolute -top-0.5 h-3 w-0.5 rounded bg-muted-foreground"
                              style={{ left: `${Math.min(100, r.porcentajeMes)}%` }}
                              title="Avance del mes"
                            />
                          </div>
                          <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                            <span>
                              {r.diferencia >= 0 ? `Quedan ${dinero(r.diferencia)}` : `Excedido por ${dinero(-r.diferencia)}`} ·{" "}
                              {Math.round(r.porcentajeGastado)}% gastado
                            </span>
                            <span>Al cierre: ~{dineroCorto(r.proyeccion)}</span>
                          </div>
                        </>
                      )}
                    </summary>
                    {r.principales.length > 0 && (
                      <ul className="mt-2 grid gap-1 rounded-lg bg-muted p-2 text-sm">
                        <li className="text-xs text-muted-foreground">Lo que más pesa este mes:</li>
                        {r.principales.map((m) => (
                          <li key={m.id} className="flex justify-between gap-2">
                            <span className="truncate">
                              {fechaCorta(m.fecha)} · {m.comercio || m.descripcion_original}
                            </span>
                            <span className="whitespace-nowrap">{dinero(m.monto)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
      </Card>
      {resumen.some((r) => r.presupuesto > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Presupuesto contra gastado</CardTitle>
          </CardHeader>
          <GraficaPresupuesto
            datos={resumen
              .filter((r) => r.presupuesto > 0)
              .map((r) => ({
                categoria: r.categoria.nombre,
                presupuesto: r.presupuesto,
                gastado: r.gastado,
                excedido: r.estado === "excedido",
              }))}
          />
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Últimos 6 meses</CardTitle>
        </CardHeader>
        <GraficaMeses
          datos={evolucionMensual(movimientos, mes, 6).map((t) => ({ ...t, mes: nombreMes(t.mes, true) }))}
        />
      </Card>
    </div>
  );
}
