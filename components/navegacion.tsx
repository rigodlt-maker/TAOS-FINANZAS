"use client";

import { CalendarClock, ChartPie, Home, LayoutGrid, List, Plus } from "lucide-react";
import { BarraInferior, BotonFlotante } from "./taos/shell";

// Tao ya no es una pestaña: vive en el botón dorado del encabezado, igual que en las otras apps TAOS
export function Navegacion({ porRevisar }: { porRevisar: number }) {
  return (
    <>
      <BotonFlotante href="/agregar" etiqueta="Agregar" icono={Plus} ocultarEn={["/ajustes", "/asesor", "/entre-cuentas", "/pagar", "/correos", "/mas"]} />
      <BarraInferior
        secciones={[
          { ruta: "/", nombre: "Inicio", icono: Home },
          { ruta: "/movimientos", nombre: "Movimientos", icono: List, tambien: ["/revisar"] },
          { ruta: "/pagos", nombre: "Pagos", icono: CalendarClock, tambien: ["/pagar"] },
          { ruta: "/presupuesto", nombre: "Presupuesto", icono: ChartPie, tambien: ["/metas"] },
          { ruta: "/mas", nombre: "Menú", icono: LayoutGrid, insignia: porRevisar, tambien: ["/ajustes", "/agregar", "/entre-cuentas", "/correos", "/prestamos", "/asesor"] },
        ]}
      />
    </>
  );
}
