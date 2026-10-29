"use client";

import { CalendarClock, Ellipsis, Home, List, Plus, Sparkles } from "lucide-react";
import { BarraInferior, BotonFlotante } from "./taos/shell";

export function Navegacion({ porRevisar }: { porRevisar: number }) {
  return (
    <>
      <BotonFlotante href="/agregar" etiqueta="Agregar" icono={Plus} ocultarEn={["/ajustes", "/asesor", "/entre-cuentas", "/pagar", "/correos"]} />
      <BarraInferior
        secciones={[
          { ruta: "/", nombre: "Inicio", icono: Home },
          { ruta: "/movimientos", nombre: "Movimientos", icono: List },
          { ruta: "/pagos", nombre: "Pagos", icono: CalendarClock },
          { ruta: "/asesor", nombre: "Tao", icono: Sparkles },
          { ruta: "/mas", nombre: "Más", icono: Ellipsis, insignia: porRevisar, tambien: ["/revisar", "/ajustes", "/presupuesto", "/agregar", "/metas", "/entre-cuentas", "/correos", "/prestamos"] },
        ]}
      />
    </>
  );
}
