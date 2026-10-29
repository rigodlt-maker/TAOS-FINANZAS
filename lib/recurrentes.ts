import { mesDe, normalizar } from "./formato";
import type { Movimiento } from "./tipos";

// Un cargo es recurrente si el mismo comercio aparece en 2 o más meses distintos con montos parecidos (±10%)
export function detectarRecurrentes(movimientos: Pick<Movimiento, "id" | "comercio" | "descripcion_original" | "monto" | "fecha" | "tipo">[]) {
  const grupos = new Map<string, typeof movimientos>();
  for (const m of movimientos) {
    if (m.tipo !== "gasto") continue;
    const clave = normalizar(m.comercio || m.descripcion_original);
    if (!clave) continue;
    grupos.set(clave, [...(grupos.get(clave) ?? []), m]);
  }
  const recurrentes = new Set<string>();
  for (const grupo of grupos.values()) {
    for (const m of grupo) {
      const parecidos = grupo.filter((o) => Math.abs(o.monto - m.monto) <= m.monto * 0.1);
      const meses = new Set(parecidos.map((o) => mesDe(o.fecha)));
      if (meses.size >= 2) parecidos.forEach((o) => recurrentes.add(o.id));
    }
  }
  return recurrentes;
}
