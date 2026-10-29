import { diasDelMes, mesDe, rangoDelMes, redondear, sumarMeses } from "./formato";
import type { Categoria, Movimiento } from "./tipos";

export type EstadoCategoria = "ok" | "en_riesgo" | "excedido" | "sin_presupuesto";

export type ResumenCategoria = {
  categoria: Categoria;
  gastado: number;
  presupuesto: number;
  diferencia: number; // presupuesto - gastado (negativo = excedido)
  porcentajeGastado: number; // 0-100+
  porcentajeMes: number; // cuánto del mes ha pasado, 0-100
  proyeccion: number; // gasto al cierre del mes al ritmo actual
  estado: EstadoCategoria;
  principales: Movimiento[]; // los 3 movimientos que más empujan el gasto
};

// Qué parte del mes ya pasó (en el mes actual), o 100% si el mes ya terminó
export function porcentajeDelMes(mes: string, hoy: string): number {
  const [a, m] = mes.split("-").map(Number);
  const total = diasDelMes(a, m);
  if (mesDe(hoy) > mes) return 100;
  if (mesDe(hoy) < mes) return 0;
  return (Number(hoy.slice(8, 10)) / total) * 100;
}

export function resumenPorCategoria(
  mes: string,
  hoy: string,
  categorias: Categoria[],
  movimientos: Movimiento[],
): ResumenCategoria[] {
  const { inicio, fin } = rangoDelMes(mes);
  const gastosDelMes = movimientos.filter((m) => m.tipo === "gasto" && m.fecha >= inicio && m.fecha <= fin);
  const pctMes = porcentajeDelMes(mes, hoy);

  const resumen = categorias.map((categoria) => {
    const propios = gastosDelMes.filter((m) => m.category_id === categoria.id);
    const gastado = redondear(propios.reduce((t, m) => t + m.monto, 0));
    const presupuesto = categoria.presupuesto_mensual;
    const porcentajeGastado = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0;
    let estado: EstadoCategoria = "ok";
    if (presupuesto <= 0) estado = "sin_presupuesto";
    else if (gastado > presupuesto) estado = "excedido";
    // Va más de 20 puntos por encima del avance del mes
    else if (porcentajeGastado - pctMes > 20) estado = "en_riesgo";
    return {
      categoria,
      gastado,
      presupuesto,
      diferencia: redondear(presupuesto - gastado),
      porcentajeGastado,
      porcentajeMes: pctMes,
      proyeccion: pctMes > 0 ? redondear((gastado / pctMes) * 100) : gastado,
      estado,
      principales: [...propios].sort((a, b) => b.monto - a.monto).slice(0, 3),
    };
  });

  // De mayor a menor exceso: primero lo excedido, luego lo que va más adelantado respecto al mes
  const exceso = (r: ResumenCategoria) =>
    r.presupuesto > 0 ? r.porcentajeGastado - r.porcentajeMes + (r.estado === "excedido" ? 1000 : 0) : -1000 + r.gastado / 1e6;
  return resumen.sort((a, b) => exceso(b) - exceso(a));
}

export type TotalesMes = { mes: string; ingresos: number; gastos: number };

// Ingresos y gastos de los últimos N meses (incluido el actual)
export function evolucionMensual(movimientos: Movimiento[], mesActual: string, meses = 6): TotalesMes[] {
  return Array.from({ length: meses }, (_, i) => {
    const mes = sumarMeses(mesActual, i - meses + 1);
    const delMes = movimientos.filter((m) => mesDe(m.fecha) === mes);
    return {
      mes,
      ingresos: redondear(delMes.filter((m) => m.tipo === "ingreso").reduce((t, m) => t + m.monto, 0)),
      gastos: redondear(delMes.filter((m) => m.tipo === "gasto").reduce((t, m) => t + m.monto, 0)),
    };
  });
}
