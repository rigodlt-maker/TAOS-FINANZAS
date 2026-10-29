import { diasDelMes, diasEntre, rangoDelMes } from "./formato";
import { estadoTarjeta, proximoPago } from "./tarjetas";
import type { Cuenta, Movimiento, PagoProgramado, Transferencia } from "./tipos";

// Siguiente fecha de un pago recurrente (respeta el día del mes, p. ej. 31 → último día en meses cortos)
export function siguienteVencimiento(fecha: string, frecuencia: PagoProgramado["frecuencia"], diaOriginal?: number) {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = diaOriginal ?? d;
  const [anio, mes] = frecuencia === "anual" ? [a + 1, m] : m === 12 ? [a + 1, 1] : [a, m + 1];
  const diaFinal = Math.min(dia, diasDelMes(anio, mes));
  return `${anio}-${String(mes).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

// Adelanta los pagos recurrentes que ya vencieron hasta su próxima fecha futura (los únicos se quedan)
export function actualizarVencimiento(pago: PagoProgramado, hoy: string): string {
  if (pago.frecuencia === "unica") return pago.proximo_vencimiento;
  const dia = Number(pago.proximo_vencimiento.slice(8, 10));
  let fecha = pago.proximo_vencimiento;
  while (fecha < hoy) fecha = siguienteVencimiento(fecha, pago.frecuencia, dia);
  return fecha;
}

export type AlertaPago = {
  pago: PagoProgramado;
  dias: number;
  cuenta: Cuenta | null;
  alcanza: boolean | null; // null si no hay cuenta asociada
};

// Pagos a los que les faltan exactamente 7 o 2 días
export function alertasDePago(pagos: PagoProgramado[], cuentas: Cuenta[], hoy: string, avisos = [7, 2]): AlertaPago[] {
  return pagos
    .map((pago) => {
      const vence = actualizarVencimiento(pago, hoy);
      const cuenta = cuentas.find((c) => c.id === pago.account_id) ?? null;
      return {
        pago: { ...pago, proximo_vencimiento: vence },
        dias: diasEntre(hoy, vence),
        cuenta,
        alcanza: cuenta ? saldoDisponible(cuenta) >= pago.monto : null,
      };
    })
    .filter((a) => avisos.includes(a.dias));
}

// En tarjetas de crédito el saldo representa lo que se debe, así que no "alcanza" para pagar otra cosa
export function saldoDisponible(cuenta: Cuenta): number {
  return cuenta.tipo === "credito" ? 0 : cuenta.saldo_actual;
}

export type EventoCalendario = {
  fecha: string;
  tipo: "pago" | "corte" | "limite";
  titulo: string;
  monto?: number;
};

// Eventos de un mes: pagos programados (con sus repeticiones), fechas de corte y límites de pago de tarjetas
export function eventosDelMes(mes: string, pagos: PagoProgramado[], cuentas: Cuenta[]): EventoCalendario[] {
  const { inicio, fin } = rangoDelMes(mes);
  const [a, m] = mes.split("-").map(Number);
  const ultimo = diasDelMes(a, m);
  const eventos: EventoCalendario[] = [];

  for (const pago of pagos) {
    const dia = Number(pago.proximo_vencimiento.slice(8, 10));
    let fecha = pago.proximo_vencimiento;
    let vueltas = 0;
    while (fecha <= fin && vueltas++ < 400) {
      if (fecha >= inicio) eventos.push({ fecha, tipo: "pago", titulo: pago.nombre, monto: pago.monto });
      if (pago.frecuencia === "unica") break;
      fecha = siguienteVencimiento(fecha, pago.frecuencia, dia);
    }
  }
  const diaDelMes = (d: number) => `${mes}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
  for (const c of cuentas) {
    if (c.dia_corte) eventos.push({ fecha: diaDelMes(c.dia_corte), tipo: "corte", titulo: `Corte ${c.nombre}` });
    if (c.dia_limite_pago) eventos.push({ fecha: diaDelMes(c.dia_limite_pago), tipo: "limite", titulo: `Pagar ${c.nombre}` });
  }
  return eventos.sort((x, y) => x.fecha.localeCompare(y.fecha));
}

// Pagos de los próximos N días (incluye repeticiones)
export function pagosProximos(pagos: PagoProgramado[], hoy: string, dias = 14) {
  return pagos
    .map((p) => ({ ...p, proximo_vencimiento: actualizarVencimiento(p, hoy) }))
    .filter((p) => diasEntre(hoy, p.proximo_vencimiento) >= 0 && diasEntre(hoy, p.proximo_vencimiento) <= dias)
    .sort((a, b) => a.proximo_vencimiento.localeCompare(b.proximo_vencimiento));
}

// ---------- Tarjetas de crédito ----------

export type PagoTarjeta = {
  cuenta: Cuenta;
  vence: string;
  dias: number;
  deuda: number; // lo que hay que pagar en esa fecha (lo del corte), no lo que debes en total
  total: number;
  nuevas: number; // compras después del corte (van al siguiente estado de cuenta)
  yaCorto: boolean; // false: la fecha es del siguiente corte y el monto aún puede crecer
  vencido: boolean;
};

export type ContextoTarjetas = { movimientos: Movimiento[]; transferencias: Transferencia[] };

// Próxima fecha límite de pago de una tarjeta (este mes o el siguiente)
export function proximoLimiteTarjeta(cuenta: Cuenta, hoy: string): string | null {
  if (cuenta.tipo !== "credito" || !cuenta.dia_limite_pago) return null;
  const [a, m] = hoy.split("-").map(Number);
  const enMes = (anio: number, mes: number) =>
    `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(cuenta.dia_limite_pago!, diasDelMes(anio, mes))).padStart(2, "0")}`;
  const esteMes = enMes(a, m);
  return esteMes >= hoy ? esteMes : m === 12 ? enMes(a + 1, 1) : enMes(a, m + 1);
}

// Tarjetas cuya fecha límite está dentro de los próximos N días, con lo que hay que pagar AL CORTE.
// Sin movimientos ni transferencias (ctx), lo del corte se toma igual al total.
export function pagosDeTarjeta(cuentas: Cuenta[], hoy: string, dias = 14, ctx: ContextoTarjetas = { movimientos: [], transferencias: [] }): PagoTarjeta[] {
  return cuentas
    .filter((c) => c.tipo === "credito")
    .map((cuenta) => {
      const e = estadoTarjeta(cuenta, ctx.movimientos, ctx.transferencias, hoy);
      const p = proximoPago(e, hoy);
      const vence = p?.vence ?? proximoLimiteTarjeta(cuenta, hoy);
      if (!vence) return null;
      return { cuenta, vence, dias: diasEntre(hoy, vence), deuda: p?.monto ?? e.total, total: e.total, nuevas: e.nuevas, yaCorto: p?.yaCorto ?? true, vencido: e.vencido };
    })
    .filter((p): p is PagoTarjeta => p !== null && p.dias <= dias)
    .sort((x, y) => x.vence.localeCompare(y.vence));
}

// Tarjetas a las que les faltan exactamente 7 o 2 días para la fecha límite
export function alertasDeTarjeta(cuentas: Cuenta[], hoy: string, avisos = [7, 2], ctx?: ContextoTarjetas): PagoTarjeta[] {
  return pagosDeTarjeta(cuentas, hoy, 31, ctx).filter((p) => avisos.includes(p.dias) && p.yaCorto);
}
