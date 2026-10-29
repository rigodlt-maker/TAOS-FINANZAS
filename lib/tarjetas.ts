// Tarjetas de crédito: separar lo que debes AL CORTE (lo que hay que pagar antes de la fecha límite para no generar
// intereses) de las COMPRAS NUEVAS (las que hiciste después del corte y entran al siguiente estado de cuenta).
import type { Repo } from "./datos/repo";
import { diasDelMes, dineroCorto, fechaCorta, sumarDias } from "./formato";
import type { Cuenta, Movimiento, Transferencia } from "./tipos";

const dosDigitos = (n: number) => String(n).padStart(2, "0");
const enMes = (anio: number, mes: number, dia: number) => `${anio}-${dosDigitos(mes)}-${dosDigitos(Math.min(dia, diasDelMes(anio, mes)))}`;
const mesSiguiente = (a: number, m: number): [number, number] => (m === 12 ? [a + 1, 1] : [a, m + 1]);
const mesAnterior = (a: number, m: number): [number, number] => (m === 1 ? [a - 1, 12] : [a, m - 1]);

// El último día de corte que ya pasó (o es hoy)
export function ultimoCorte(cuenta: Cuenta, hoy: string): string | null {
  if (cuenta.tipo !== "credito" || !cuenta.dia_corte) return null;
  const [a, m] = hoy.split("-").map(Number);
  const este = enMes(a, m, cuenta.dia_corte);
  return este <= hoy ? este : enMes(...mesAnterior(a, m), cuenta.dia_corte);
}

// El próximo corte (después de hoy)
export function siguienteCorte(cuenta: Cuenta, hoy: string): string | null {
  if (cuenta.tipo !== "credito" || !cuenta.dia_corte) return null;
  const [a, m] = hoy.split("-").map(Number);
  const este = enMes(a, m, cuenta.dia_corte);
  return este > hoy ? este : enMes(...mesSiguiente(a, m), cuenta.dia_corte);
}

// La fecha límite para pagar lo de un corte: el primer día de pago después de ese corte
export function limiteDelCorte(cuenta: Cuenta, corte: string | null): string | null {
  if (!corte || !cuenta.dia_limite_pago) return null;
  const [a, m] = corte.split("-").map(Number);
  const mismo = enMes(a, m, cuenta.dia_limite_pago);
  return mismo > corte ? mismo : enMes(...mesSiguiente(a, m), cuenta.dia_limite_pago);
}

export type EstadoTarjeta = {
  cuenta: Cuenta;
  total: number; // todo lo que debes hoy
  alCorte: number; // lo que falta pagar del último corte ("pago para no generar intereses")
  nuevas: number; // compras después del corte: van al siguiente estado de cuenta
  corte: string | null; // fecha del último corte
  limite: string | null; // fecha límite para pagar lo del corte
  siguienteCorte: string | null;
  siguienteLimite: string | null;
  confirmado: boolean; // true si escribiste el monto al corte de tu app del banco
  vencido: boolean; // ya pasó la fecha límite y según la app quedó algo sin pagar
};

export function estadoTarjeta(cuenta: Cuenta, movimientos: Movimiento[], transferencias: Transferencia[], hoy: string): EstadoTarjeta {
  const total = Math.max(0, -cuenta.saldo_actual);
  const corte = ultimoCorte(cuenta, hoy);
  const siguiente = siguienteCorte(cuenta, hoy);
  const base = { cuenta, total, corte, siguienteCorte: siguiente, siguienteLimite: limiteDelCorte(cuenta, siguiente) };
  if (!corte) return { ...base, alCorte: total, nuevas: 0, limite: null, confirmado: false, vencido: false };

  const desdeCorte = (fecha: string) => fecha > corte && fecha <= hoy;
  const compras = movimientos
    .filter((m) => m.account_id === cuenta.id && desdeCorte(m.fecha))
    .reduce((t, m) => t + (m.tipo === "gasto" ? m.monto : -m.monto), 0);
  const pagos = transferencias.filter((t) => t.destino_id === cuenta.id && desdeCorte(t.fecha)).reduce((s, t) => s + t.monto, 0);

  // Si escribiste el monto al corte de tu app, manda ese; si no, se estima: lo que debes menos lo que compraste después del corte
  const confirmado = cuenta.saldo_al_corte != null && cuenta.fecha_corte_saldo === corte;
  const limite = limiteDelCorte(cuenta, corte);
  // Si ya pasó la fecha límite y no escribiste el monto al corte, se asume que lo pagaste: todo va al siguiente corte
  const yaVencio = !!limite && limite < hoy;
  const pendiente = confirmado ? cuenta.saldo_al_corte! - pagos : yaVencio ? 0 : total - compras;
  const alCorte = Math.round(Math.min(total, Math.max(0, pendiente)) * 100) / 100;
  return { ...base, alCorte, nuevas: Math.round((total - alCorte) * 100) / 100, limite, confirmado, vencido: confirmado && yaVencio && alCorte > 0.5 };
}

// Lo próximo que hay que pagar de una tarjeta: lo del corte (si aún no vence) o, si ya pasó, lo que llevas para el siguiente
export function proximoPago(e: EstadoTarjeta, hoy: string): { vence: string; monto: number; yaCorto: boolean } | null {
  if (e.limite && e.limite >= hoy && e.alCorte > 0.5) return { vence: e.limite, monto: e.alCorte, yaCorto: true };
  if (e.vencido && e.limite) return { vence: e.limite, monto: e.alCorte, yaCorto: true };
  const vence = e.limite && e.limite >= hoy ? e.limite : e.siguienteLimite;
  return vence ? { vence, monto: e.limite && e.limite >= hoy ? e.alCorte : e.nuevas, yaCorto: vence === e.limite } : null;
}

// Lo que se necesita para calcular lo del corte: compras de las últimas semanas y pagos a tarjetas
export async function contextoTarjetas(repo: Repo, hoy: string) {
  const [movimientos, transferencias] = await Promise.all([repo.movimientos({ desde: sumarDias(hoy, -70) }), repo.transferencias(300)]);
  return { movimientos, transferencias };
}

// Una línea para listas: "Al corte $12,080 (antes del jue 5 de nov) · +$259 nuevas"
export function lineaTarjeta(e: EstadoTarjeta): string {
  if (e.total < 0.5) return "Sin deuda";
  if (!e.corte) return `Debes ${dineroCorto(e.total)}`;
  const nuevas = e.nuevas > 0.5 ? ` · +${dineroCorto(e.nuevas)} nuevas` : "";
  if (e.alCorte > 0.5) return `Al corte ${dineroCorto(e.alCorte)}${e.limite ? ` (${e.vencido ? "venció" : "antes del"} ${fechaCorta(e.limite)})` : ""}${nuevas}`;
  return `Corte cubierto${nuevas}`;
}
