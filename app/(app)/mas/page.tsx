import { ArrowLeftRight, ChartPie, ChevronRight, FileUp, HandCoins, Inbox, Mail, Settings, Target } from "lucide-react";
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
    { ruta: "/entre-cuentas", nombre: "Entre cuentas", detalle: "Pagar tarjetas y mover dinero entre tus cuentas", icono: ArrowLeftRight },
    { ruta: "/correos", nombre: "Avisos del banco", detalle: avisos ? `${avisos} por confirmar` : "Lo que tu banco te manda a Gmail, registrado solo", icono: Mail },
    { ruta: "/prestamos", nombre: "Préstamos", detalle: teDeben ? `Te deben ${dinero(teDeben)}` : "Dinero que prestaste y te van a regresar", icono: HandCoins },
    { ruta: "/presupuesto", nombre: "Presupuesto", detalle: "Cómo vas en cada categoría y tus gráficas", icono: ChartPie },
    { ruta: "/metas", nombre: "Metas de ahorro", detalle: "Cuánto llevas y cuánto te falta", icono: Target },
    { ruta: "/revisar", nombre: "Por revisar", detalle: porRevisar ? `${porRevisar} movimientos sin categoría` : "Todo al día", icono: Inbox },
    { ruta: "/agregar", nombre: "Agregar e importar", detalle: "Captura rápida, a mano o desde un estado de cuenta", icono: FileUp },
    { ruta: "/ajustes", nombre: "Ajustes", detalle: "Cuentas, categorías, reglas y contraseña", icono: Settings },
  ];
  return (
    <div className="grid gap-3">
      <Titulo>Más</Titulo>
      {opciones.map((o) => (
        <Link key={o.ruta} href={o.ruta} className="flex min-h-18 items-center gap-4 rounded-2xl border bg-card px-4 py-3 active:bg-muted">
          <o.icono className="size-6 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{o.nombre}</span>
            <span className="block truncate text-sm text-muted-foreground">{o.detalle}</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
