// Gastos hormiga: compras pequeñas que se repiten (cafés, antojos, Oxxo, apps, Uber…) y que juntas pesan mucho.
// Regla: en los últimos 30 días, el mismo comercio con 3 o más compras de hasta $250 que suman al menos $150.
import { normalizar, sumarDias } from "./formato";
import type { Categoria, Movimiento } from "./tipos";

export const TOPE_HORMIGA = 250;
const MINIMO_VECES = 3;
const MINIMO_TOTAL = 150;
// Lo necesario (súper, servicios, salud, renta…) no se cuenta como hormiga aunque sea chico y frecuente
const NECESARIAS = /super|despensa|servicio|salud|medic|farmac|renta|hipoteca|hogar|educa|escuela|colegiatura|transferencia/;

export type Hormiga = { nombre: string; veces: number; total: number; promedio: number; alAnio: number; ids: string[] };

export function detectarHormiga(movimientos: Movimiento[], categorias: Categoria[], hoy: string): { grupos: Hormiga[]; total: number; alAnio: number } {
  const desde = sumarDias(hoy, -30);
  const nombreCategoria = new Map(categorias.map((c) => [c.id, normalizar(c.nombre)]));
  const grupos = new Map<string, { nombre: string; movs: Movimiento[] }>();
  for (const m of movimientos) {
    // No se excluyen los "recurrentes": el café de cada mes se marca así. Las suscripciones (1 cobro al mes) no llegan a 3 veces en 30 días
    if (m.tipo !== "gasto" || m.fecha < desde || m.fecha > hoy || m.monto > TOPE_HORMIGA) continue;
    if (m.category_id && NECESARIAS.test(nombreCategoria.get(m.category_id) ?? "")) continue;
    const nombre = (m.comercio || m.descripcion_original.split(/\s+/).slice(0, 2).join(" ")).trim();
    const clave = normalizar(nombre);
    if (!clave) continue;
    const g = grupos.get(clave) ?? { nombre, movs: [] };
    g.movs.push(m);
    grupos.set(clave, g);
  }
  const lista: Hormiga[] = [...grupos.values()]
    .map(({ nombre, movs }) => {
      const total = movs.reduce((t, m) => t + m.monto, 0);
      return { nombre, veces: movs.length, total, promedio: total / movs.length, alAnio: Math.round((total * 365) / 30), ids: movs.map((m) => m.id) };
    })
    .filter((g) => g.veces >= MINIMO_VECES && g.total >= MINIMO_TOTAL)
    .sort((a, b) => b.total - a.total);
  const total = lista.reduce((t, g) => t + g.total, 0);
  return { grupos: lista, total, alAnio: Math.round((total * 365) / 30) };
}
