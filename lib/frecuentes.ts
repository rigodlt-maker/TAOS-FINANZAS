// Gastos frecuentes en un toque: los que repites (mismo lugar, mismo monto aproximado, misma cuenta) en los últimos 60 días.
// No se guardan aparte: se calculan de tus movimientos, así se actualizan solos.
import { normalizar, sumarDias } from "./formato";
import type { Movimiento } from "./tipos";

export type Frecuente = { clave: string; comercio: string; monto: number; account_id: string; category_id: string | null; veces: number };

export function gastosFrecuentes(movimientos: Movimiento[], hoy: string, maximo = 4): Frecuente[] {
  const desde = sumarDias(hoy, -60);
  const grupos = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    if (m.tipo !== "gasto" || m.fecha < desde || m.fecha > hoy || !m.comercio) continue;
    const clave = `${normalizar(m.comercio)}|${m.account_id}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), m]);
  }
  const lista: Frecuente[] = [];
  for (const [clave, movs] of grupos) {
    // Montos parecidos (±15% del último) cuentan como el mismo gasto: un café de $74 y uno de $78 son "el café"
    const ultimo = [...movs].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const veces = movs.filter((m) => Math.abs(m.monto - ultimo.monto) <= ultimo.monto * 0.15).length;
    if (veces >= 3) lista.push({ clave, comercio: ultimo.comercio!, monto: ultimo.monto, account_id: ultimo.account_id, category_id: ultimo.category_id, veces });
  }
  return lista.sort((a, b) => b.veces - a.veces).slice(0, maximo);
}
