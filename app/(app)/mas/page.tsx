import { ArrowLeftRight, ChartPie, FileUp, HandCoins, Inbox, Mail, Settings, Target } from "lucide-react";
import { dinero } from "@/lib/formato";
import { abiertos, pendiente } from "@/lib/envios";
import Link from "next/link";
import { Titulo } from "@/components/taos/encabezado";
import { obtenerRepo } from "@/lib/sesion";

export default async function Mas() {
  const repo = await obtenerRepo();
  const porRevisar = await repo.contarPorRevisar();
  // Si todavía no se corre el SQL de avisos, la lista no truena
  const avisos = await repo.correos({ estado: "pendiente" }).then((x) => x.length).catch(() => 0);
  const teDeben = await repo.prestamos().then((ps) => abiertos(ps).reduce((t, p) => t + pendiente(p), 0)).catch(() => 0);
  const opciones = [
    { ruta: "/entre-cuentas", nombre: "Pagar tarjeta o mover dinero", detalle: "Entre tus propias cuentas", icono: ArrowLeftRight },
    { ruta: "/revisar", nombre: "Por revisar", detalle: porRevisar ? `${porRevisar} sin categoría` : "Todo al día", icono: Inbox, alerta: porRevisar > 0 },
    { ruta: "/metas", nombre: "Metas de ahorro", detalle: "Cuánto llevas y cuánto falta", icono: Target },
    { ruta: "/prestamos", nombre: "Préstamos", detalle: teDeben ? `Te deben ${dinero(teDeben)}` : "Lo que prestaste", icono: HandCoins },
    { ruta: "/correos", nombre: "Avisos del banco", detalle: avisos ? `${avisos} por confirmar` : "Desde tu Gmail", icono: Mail, alerta: avisos > 0 },
    { ruta: "/agregar", nombre: "Agregar o importar", detalle: "A mano o estado de cuenta", icono: FileUp },
    { ruta: "/presupuesto", nombre: "Presupuesto", detalle: "Categorías y gráficas", icono: ChartPie },
    { ruta: "/ajustes", nombre: "Ajustes", detalle: "Cuentas, categorías, avisos y contraseña", icono: Settings },
  ];
  return (
    <div className="grid gap-4">
      <Titulo detalle="Todo lo que puedes hacer, a un toque. ¿Dudas? Toca el botón dorado de Tao arriba.">Menú</Titulo>
      <div className="grid grid-cols-2 gap-3">
        {opciones.map((o) => (
          <Link key={o.ruta} href={o.ruta} className="relative flex min-h-32 flex-col justify-between gap-3 rounded-2xl border bg-card p-4 active:scale-[0.98] active:bg-muted">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
              <o.icono className="size-6 text-primary" />
            </span>
            {o.alerta && <span className="absolute top-4 right-4 size-2.5 rounded-full bg-primary" />}
            <span className="min-w-0">
              <span className="block leading-tight font-semibold">{o.nombre}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{o.detalle}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
