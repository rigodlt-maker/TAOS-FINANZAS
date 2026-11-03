// Naturaleza del gasto: ¿lo DEBO pagar, lo NECESITO o lo QUIERO? Se deduce sola del nombre de la categoría (sin SQL).
// Debo = compromisos fijos (renta, servicios, seguros, créditos, colegiaturas). Necesito = lo básico para vivir.
// Quiero = gustos (comida fuera, entretenimiento, ropa, suscripciones). Lo que no se reconoce cuenta como "Quiero".
import { normalizar } from "./formato";
import type { Categoria, Movimiento } from "./tipos";

export type Naturaleza = "debo" | "necesito" | "quiero";
export const NATURALEZAS: { id: Naturaleza; nombre: string; emoji: string; que: string }[] = [
  { id: "debo", nombre: "Debo", emoji: "📌", que: "Renta, servicios, seguros, créditos" },
  { id: "necesito", nombre: "Necesito", emoji: "🛒", que: "Súper, transporte, salud, casa" },
  { id: "quiero", nombre: "Quiero", emoji: "🎉", que: "Comida fuera, salidas, ropa, gustos" },
];

const DEBO = /servicio|renta|hipoteca|seguro|credito|prestamo|colegiatura|educacion|escuela|impuesto|predial|mantenimiento|luz|agua|internet|telefono|gas\b|deuda|pension|guarderia/;
const NECESITO = /super|despensa|transporte|gasolina|salud|farmacia|medic|casa|hogar|remodelacion|mascota|limpieza|bebe|trabajo/;

export function naturalezaDe(nombreCategoria: string | null | undefined): Naturaleza {
  const n = normalizar(nombreCategoria ?? "");
  if (DEBO.test(n)) return "debo";
  if (NECESITO.test(n)) return "necesito";
  return "quiero";
}

export function resumenNaturaleza(movimientos: Pick<Movimiento, "tipo" | "monto" | "category_id">[], categorias: Pick<Categoria, "id" | "nombre">[]) {
  const nombre = new Map(categorias.map((c) => [c.id, c.nombre]));
  const montos: Record<Naturaleza, number> = { debo: 0, necesito: 0, quiero: 0 };
  let sinCategoria = 0; // lo que no tiene categoría no se adivina: se avisa aparte
  for (const m of movimientos) {
    if (m.tipo !== "gasto") continue;
    const cat = m.category_id ? nombre.get(m.category_id) : undefined;
    if (cat) montos[naturalezaDe(cat)] += m.monto;
    else sinCategoria += m.monto;
  }
  const total = montos.debo + montos.necesito + montos.quiero;
  return { total, sinCategoria, partes: NATURALEZAS.map((n) => ({ ...n, monto: montos[n.id], porcentaje: total ? (montos[n.id] / total) * 100 : 0 })) };
}

// Gasto por categoría (para la dona), de mayor a menor; lo pequeño se junta en "Lo demás"
export function gastoPorCategoria(movimientos: Pick<Movimiento, "tipo" | "monto" | "category_id">[], categorias: Pick<Categoria, "id" | "nombre">[], maximo = 5) {
  const nombre = new Map(categorias.map((c) => [c.id, c.nombre]));
  const suma = new Map<string, number>();
  for (const m of movimientos) if (m.tipo === "gasto") {
    const k = (m.category_id && nombre.get(m.category_id)) || "Sin categoría";
    suma.set(k, (suma.get(k) ?? 0) + m.monto);
  }
  const lista = [...suma].map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto);
  const total = lista.reduce((t, x) => t + x.monto, 0);
  const top = lista.slice(0, maximo);
  const resto = lista.slice(maximo).reduce((t, x) => t + x.monto, 0);
  if (resto > 0) top.push({ nombre: "Lo demás", monto: resto });
  return { total, partes: top.map((x) => ({ ...x, porcentaje: total ? (x.monto / total) * 100 : 0 })) };
}

// Saldo total día por día hacia atrás: saldo de ayer = saldo de hoy − ingresos de hoy + gastos de hoy
export function tendenciaSaldo(saldoHoy: number, movimientos: Pick<Movimiento, "tipo" | "monto" | "fecha">[], hoy: string, dias = 30) {
  const neto = new Map<string, number>();
  for (const m of movimientos) neto.set(m.fecha, (neto.get(m.fecha) ?? 0) + (m.tipo === "ingreso" ? m.monto : -m.monto));
  const puntos: { fecha: string; saldo: number }[] = [];
  let saldo = saldoHoy;
  const d = new Date(`${hoy}T12:00:00Z`);
  for (let i = 0; i <= dias; i++) {
    const f = d.toISOString().slice(0, 10);
    puntos.unshift({ fecha: f, saldo: Math.round(saldo * 100) / 100 });
    saldo -= neto.get(f) ?? 0;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return puntos;
}
