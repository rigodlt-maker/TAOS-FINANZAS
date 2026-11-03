// "¿Cuánto puedo gastar hoy?": reparte lo que te queda del mes entre los días que faltan.
// Usa dos bases y toma la más prudente:
//   - presupuesto: lo que queda de tu presupuesto del mes
//   - dinero: tu dinero libre (ya descuenta tarjetas) menos los pagos programados que faltan este mes
import { diasEntre, mesDe, rangoDelMes } from "./formato";
import type { Movimiento } from "./tipos";

export type GastoDeHoy = {
  puedes: number; // lo que todavía puedes gastar hoy
  diario: number; // lo que te toca por día
  gastadoHoy: number;
  dias: number; // días que faltan del mes, contando hoy
  base: "presupuesto" | "dinero";
};

const redondear = (n: number) => Math.round(n * 100) / 100;

export function cuantoPuedoGastarHoy(e: {
  hoy: string;
  movimientosDelMes: Pick<Movimiento, "fecha" | "tipo" | "monto">[];
  presupuestoTotal: number;
  libre: number | null; // null si no hay cuentas
  pagosPendientes: number; // pagos programados que faltan este mes (sin contar tarjetas)
}): GastoDeHoy | null {
  const fin = rangoDelMes(mesDe(e.hoy)).fin;
  const dias = diasEntre(e.hoy, fin) + 1;
  const gastos = e.movimientosDelMes.filter((m) => m.tipo === "gasto" && mesDe(m.fecha) === mesDe(e.hoy));
  const gastadoHoy = redondear(gastos.filter((m) => m.fecha === e.hoy).reduce((t, m) => t + m.monto, 0));
  const gastadoAntes = gastos.filter((m) => m.fecha < e.hoy).reduce((t, m) => t + m.monto, 0);

  const opciones: { diario: number; base: GastoDeHoy["base"] }[] = [];
  if (e.presupuestoTotal > 0) opciones.push({ diario: (e.presupuestoTotal - gastadoAntes) / dias, base: "presupuesto" });
  // El saldo ya trae lo gastado hoy: se suma para saber con cuánto amaneciste
  if (e.libre !== null) opciones.push({ diario: (e.libre + gastadoHoy - e.pagosPendientes) / dias, base: "dinero" });
  if (!opciones.length) return null;

  const elegida = opciones.reduce((a, b) => (b.diario < a.diario ? b : a));
  const diario = redondear(Math.max(0, elegida.diario));
  return { puedes: redondear(Math.max(0, diario - gastadoHoy)), diario, gastadoHoy, dias, base: elegida.base };
}
