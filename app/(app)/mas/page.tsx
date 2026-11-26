import Link from "next/link";
import { BarraBuscar } from "@/components/taos/buscador";
import { Titulo } from "@/components/taos/encabezado";
import { resumenCreditos } from "@/lib/creditos";
import { DESTINOS, GRUPOS } from "@/lib/destinos";
import { abiertos, pendiente } from "@/lib/envios";
import { dinero, hoyLocal } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";

// Lo que ya está en la barra de abajo o en el encabezado no se repite aquí
const EN_LA_BARRA = new Set(["/", "/movimientos", "/pagos", "/presupuesto", "/asesor"]);

// Menú: todo lo que puedes hacer, ordenado por grupos, con una barra para buscar
export default async function Mas() {
  const repo = await obtenerRepo();
  const porRevisar = await repo.contarPorRevisar();
  // Si todavía no se corre algún SQL, el menú no truena
  const avisos = await repo.correos({ estado: "pendiente" }).then((x) => x.length).catch(() => 0);
  const teDeben = await repo.prestamos().then((ps) => abiertos(ps).reduce((t, p) => t + pendiente(p), 0)).catch(() => 0);
  const debo = await repo.creditos().then((cs) => resumenCreditos(cs, hoyLocal()).total).catch(() => 0);
  // Datos al momento en algunos mosaicos
  const vivo: Record<string, { detalle?: string; alerta?: boolean }> = {
    "/revisar": { detalle: porRevisar ? `${porRevisar} sin categoría` : "Todo al día", alerta: porRevisar > 0 },
    "/correos": { detalle: avisos ? `${avisos} por confirmar` : undefined, alerta: avisos > 0 },
    "/creditos": { detalle: debo ? `Debes ${dinero(debo)} en créditos (carro, casa u otros)` : undefined },
    "/prestamos": { detalle: teDeben ? `Te deben ${dinero(teDeben)}` : undefined },
  };
  return (
    <div className="grid gap-5">
      <Titulo detalle="Todo lo que puedes hacer, ordenado. ¿No lo encuentras? Búscalo o pregúntale a Tao.">Menú</Titulo>
      <BarraBuscar />
      {GRUPOS.map((g) => {
        const opciones = DESTINOS.filter((d) => d.grupo === g && !EN_LA_BARRA.has(d.ruta));
        if (!opciones.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g}</h2>
            <div className="grid grid-cols-2 gap-3">
              {opciones.map((o) => {
                const v = vivo[o.ruta] ?? {};
                return (
                  <Link key={o.ruta} href={o.ruta} className="relative flex min-h-28 flex-col justify-between gap-3 rounded-2xl border bg-card p-4 active:scale-[0.98] active:bg-muted">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
                      <o.icono className="size-5 text-primary" />
                    </span>
                    {v.alerta && <span className="absolute top-4 right-4 size-2.5 rounded-full bg-primary" />}
                    <span className="min-w-0">
                      <span className="block leading-tight font-semibold">{o.nombre}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{v.detalle ?? o.detalle}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
