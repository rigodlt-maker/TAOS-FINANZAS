import { Titulo } from "@/components/taos/encabezado";
import { Repeat, Trash2 } from "lucide-react";
import { CamposMovimiento } from "@/components/campos-movimiento";
import { BotonAccion, Formulario } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, Select } from "@/components/ui/campos";
import { borrarMovimiento, guardarMovimiento } from "@/lib/acciones";
import { dinero, dineroCorto, fechaCorta, hoyLocal, mesDe, nombreMes, rangoDelMes, sumarMeses } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";

export default async function Movimientos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; categoria?: string; cuenta?: string }>;
}) {
  const filtro = await searchParams;
  const hoy = hoyLocal();
  const mes = /^\d{4}-\d{2}$/.test(filtro.mes ?? "") ? filtro.mes! : mesDe(hoy);
  const { inicio, fin } = rangoDelMes(mes);
  const repo = await obtenerRepo();
  const [cuentas, categorias, movimientos] = await Promise.all([
    repo.cuentas(),
    repo.categorias(),
    repo.movimientos({ desde: inicio, hasta: fin, categoria: filtro.categoria, cuenta: filtro.cuenta }),
  ]);
  const nombreCuenta = (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? "";
  const nombreCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nombre;
  const gastos = movimientos.filter((m) => m.tipo === "gasto").reduce((t, m) => t + m.monto, 0);
  const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((t, m) => t + m.monto, 0);
  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(mesDe(hoy), -i));

  // Agrupa por día para leer la lista más fácil
  const porDia = new Map<string, typeof movimientos>();
  for (const m of movimientos) porDia.set(m.fecha, [...(porDia.get(m.fecha) ?? []), m]);

  return (
    <div className="grid gap-4">
      <Titulo>Movimientos</Titulo>
      <form className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select name="mes" defaultValue={mes} aria-label="Mes">
          {meses.map((m) => (
            <option key={m} value={m}>
              {nombreMes(m)}
            </option>
          ))}
        </Select>
        <Select name="categoria" defaultValue={filtro.categoria ?? ""} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          <option value="sin">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Select name="cuenta" defaultValue={filtro.cuenta ?? ""} aria-label="Cuenta">
          <option value="">Todas las cuentas</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Card className="p-3">
          <p className="text-muted-foreground">Ingresos</p>
          <p className="text-base font-semibold sm:text-lg">{dineroCorto(ingresos)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-muted-foreground">Gastos</p>
          <p className="text-base font-semibold sm:text-lg">{dineroCorto(gastos)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-muted-foreground">Balance</p>
          <p className="text-base font-semibold sm:text-lg">{dineroCorto(ingresos - gastos)}</p>
        </Card>
      </div>

      {movimientos.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">No hay movimientos con estos filtros.</p>
        </Card>
      ) : (
        [...porDia.entries()].map(([fecha, lista]) => (
          <section key={fecha}>
            <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{fechaCorta(fecha)}</h3>
            <div className="divide-y rounded-xl border bg-card">
              {lista.map((m) => (
                <details key={m.id} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.comercio || m.descripcion_original}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {nombreCategoria(m.category_id) ?? (m.tipo === "ingreso" ? "Ingreso" : "Sin categoría")} · {nombreCuenta(m.account_id)}
                        {m.es_recurrente && <Repeat className="size-3" aria-label="Recurrente" />}
                        {m.requiere_revision && <Badge>por revisar</Badge>}
                      </span>
                    </span>
                    <span className={m.tipo === "ingreso" ? "font-semibold whitespace-nowrap" : "whitespace-nowrap"}>
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {dinero(m.monto)}
                    </span>
                  </summary>
                  <div className="border-t bg-background/50 p-3">
                    <p className="mb-3 text-xs text-muted-foreground">Original del banco: {m.descripcion_original}</p>
                    <Formulario accion={guardarMovimiento}>
                      <CamposMovimiento cuentas={cuentas} categorias={categorias} movimiento={m} hoy={hoy} />
                    </Formulario>
                    <div className="mt-3 border-t pt-3">
                      <BotonAccion accion={borrarMovimiento.bind(null, m.id)} confirmar="¿Borrar este movimiento?" variant="destructive">
                        <Trash2 className="size-4" /> Borrar
                      </BotonAccion>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
