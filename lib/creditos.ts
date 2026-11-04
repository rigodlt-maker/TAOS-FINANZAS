// Mis créditos: lo que TÚ debes (carro, personal, hipoteca…) con pago fijo e interés.
// Todo con reglas (sin IA): cuánto de cada pago es interés, cuándo terminas y cuánto te falta de intereses.
import { diasEntre, dinero, dineroCorto, fechaCorta, nombreMes, normalizar, redondear, sumarDias } from "./formato";
import type { Credito, FrecuenciaCredito, TipoCredito } from "./tipos";

export const NOMBRES_TIPO_CREDITO: Record<TipoCredito, string> = {
  auto: "Carro",
  personal: "Personal",
  hipoteca: "Hipoteca / casa",
  nomina: "De nómina",
  otro: "Otro",
};

export const NOMBRES_FRECUENCIA: Record<FrecuenciaCredito, string> = { mensual: "al mes", quincenal: "a la quincena", semanal: "a la semana" };
export const NOMBRES_FRECUENCIA_LARGO: Record<FrecuenciaCredito, string> = { mensual: "Mensual", quincenal: "Quincenal", semanal: "Semanal" };

const PAGOS_AL_ANIO: Record<FrecuenciaCredito, number> = { mensual: 12, quincenal: 24, semanal: 52 };

export const activos = (cs: Credito[]) => cs.filter((c) => !c.liquidado_el && c.saldo > 0.5);

// Interés de un periodo: tasa anual repartida entre los pagos del año
export const tasaPorPago = (c: Pick<Credito, "tasa_anual" | "frecuencia">) => c.tasa_anual / 100 / PAGOS_AL_ANIO[c.frecuencia];

// De un pago, cuánto se va a intereses y cuánto baja tu deuda
export function dividirPago(c: Pick<Credito, "saldo" | "tasa_anual" | "frecuencia">, monto: number): { interes: number; capital: number } {
  const interes = redondear(Math.min(monto, c.saldo * tasaPorPago(c)));
  const capital = redondear(Math.min(c.saldo, Math.max(0, monto - interes)));
  return { interes, capital };
}

function ultimoDia(anio: number, mes: number) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// La fecha del siguiente pago. Mensual: mismo día del mes siguiente (o el último si no existe).
// Quincenal: cada medio mes (5 → 20 → 5…). Semanal: 7 días.
export function siguienteFecha(fecha: string, frecuencia: FrecuenciaCredito): string {
  if (frecuencia === "semanal") return sumarDias(fecha, 7);
  const [a, m, d] = fecha.split("-").map(Number);
  const fmt = (y: number, mm: number, dd: number) => `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const mesSig = m === 12 ? [a + 1, 1] : [a, m + 1];
  if (frecuencia === "mensual") return fmt(mesSig[0], mesSig[1], Math.min(d, ultimoDia(mesSig[0], mesSig[1])));
  // quincenal
  if (d <= 15) {
    const dd = d + 15;
    return dd > ultimoDia(a, m) || d === 15 ? fmt(a, m, ultimoDia(a, m)) : fmt(a, m, dd);
  }
  return d >= ultimoDia(a, m) ? fmt(mesSig[0], mesSig[1], 15) : fmt(mesSig[0], mesSig[1], Math.max(1, d - 15));
}

export type Proyeccion = { pagos: number; termina: string; intereses: number } | { nuncaTermina: true; interesPorPago: number };

// Simula los pagos que faltan con el pago y la tasa actuales
export function proyectar(c: Credito): Proyeccion {
  const r = tasaPorPago(c);
  if (c.saldo <= 0.5) return { pagos: 0, termina: c.proximo_pago, intereses: 0 };
  if (c.pago <= c.saldo * r + 0.005) return { nuncaTermina: true, interesPorPago: redondear(c.saldo * r) };
  let saldo = c.saldo;
  let fecha = c.proximo_pago;
  let intereses = 0;
  let pagos = 0;
  while (saldo > 0.005 && pagos < 1200) {
    const interes = saldo * r;
    intereses += interes;
    saldo = saldo + interes - Math.min(c.pago, saldo + interes);
    pagos++;
    if (saldo > 0.005) fecha = siguienteFecha(fecha, c.frecuencia);
  }
  return { pagos, termina: fecha, intereses: redondear(intereses) };
}

// "1 año y 3 meses", "8 meses", "3 semanas"
export function cuantoFalta(pagos: number, f: FrecuenciaCredito): string {
  if (f === "semanal" && pagos < 9) return pagos === 1 ? "1 semana" : `${pagos} semanas`;
  const meses = Math.ceil(pagos / (PAGOS_AL_ANIO[f] / 12));
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const txtM = (n: number) => (n === 1 ? "1 mes" : `${n} meses`);
  if (!anios) return txtM(meses);
  return `${anios === 1 ? "1 año" : `${anios} años`}${resto ? ` y ${txtM(resto)}` : ""}`;
}

export const mesYAnio = (fecha: string) => nombreMes(fecha.slice(0, 7)); // "marzo de 2029"

// Lo que pagas de créditos en un mes, aprox. (para el presupuesto y el resumen)
export const pagoMensual = (c: Credito) => redondear((c.pago * PAGOS_AL_ANIO[c.frecuencia]) / 12);

export function resumenCreditos(cs: Credito[], hoy: string) {
  const lista = activos(cs);
  const total = redondear(lista.reduce((t, c) => t + c.saldo, 0));
  const alMes = redondear(lista.reduce((t, c) => t + pagoMensual(c), 0));
  const proximo = [...lista].sort((a, b) => a.proximo_pago.localeCompare(b.proximo_pago))[0] ?? null;
  const atrasados = lista.filter((c) => c.proximo_pago < hoy);
  return { lista, total, alMes, proximo, atrasados };
}

// Pagos de crédito que tocan hoy o en 2 días, o que se pasaron ayer (para avisos)
export const creditosPorAvisar = (cs: Credito[], hoy: string) => activos(cs).filter((c) => [2, 0, -1].includes(diasEntre(hoy, c.proximo_pago)));

// Respuesta de Tao a "¿cuánto debo en créditos?", "¿cuándo termino de pagar el carro?"
export function respuestaCreditos(cs: Credito[], hoy: string, pregunta = ""): string {
  const { lista, total, alMes } = resumenCreditos(cs, hoy);
  if (!lista.length)
    return "No tienes créditos registrados. Si pagas un crédito de carro, personal o de casa, agrégalo en **Menú › Mis créditos** y te digo cuándo terminas y cuánto pagas de intereses.";
  const mencionado = lista.find((c) => pregunta && pregunta.includes(normalizar(c.nombre).split(" ").filter((p) => p.length > 3).find((p) => !["credito", "prestamo"].includes(p)) ?? "@@"));
  const uno = (c: Credito) => {
    const p = proyectar(c);
    const fin =
      "nuncaTermina" in p
        ? `⚠️ con ${dinero(c.pago)} ${NOMBRES_FRECUENCIA[c.frecuencia]} solo cubres intereses (${dinero(p.interesPorPago)}): así nunca baja la deuda`
        : `terminas en **${mesYAnio(p.termina)}** (faltan ${cuantoFalta(p.pagos, c.frecuencia)})${p.intereses > 1 ? ` y te faltan ${dineroCorto(p.intereses)} de intereses` : ""}`;
    return `- **${c.nombre}:** debes ${dinero(c.saldo)} · pagas ${dinero(c.pago)} ${NOMBRES_FRECUENCIA[c.frecuencia]} · próximo pago ${c.proximo_pago < hoy ? `**atrasado** (${fechaCorta(c.proximo_pago)})` : fechaCorta(c.proximo_pago)} · ${fin}.`;
  };
  if (mencionado) return uno(mencionado).slice(2) + "\n\n[Ver Mis créditos](/creditos)";
  return [`En créditos debes **${dinero(total)}** y pagas unos **${dinero(alMes)} al mes**:`, "", ...lista.map(uno), "", "[Ver Mis créditos](/creditos)"].join("\n");
}

// El mismo SQL de supabase/migrations/0009_creditos.sql (hay una prueba que los compara): se muestra si falta correrlo
export const SQL_CREDITOS = "-- Mis créditos: lo que TÚ le debes a un banco o financiera (carro, personal, hipoteca…), con pagos fijos e interés.\n-- (Lo que te deben a ti va en \"loans\" / Me deben.) Se puede correr dos veces sin error.\ncreate table if not exists public.debts (\n  id uuid primary key default gen_random_uuid(),\n  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,\n  nombre text not null,\n  tipo text not null default 'personal' check (tipo in ('auto', 'personal', 'hipoteca', 'nomina', 'otro')),\n  saldo numeric(14, 2) not null check (saldo >= 0),\n  pago numeric(14, 2) not null check (pago > 0),\n  frecuencia text not null default 'mensual' check (frecuencia in ('mensual', 'quincenal', 'semanal')),\n  tasa_anual numeric(6, 3) not null default 0 check (tasa_anual >= 0),\n  proximo_pago date not null,\n  cuenta_id uuid references public.accounts (id) on delete set null,\n  nota text,\n  liquidado_el date,\n  created_at timestamptz not null default now()\n);\n\ncreate index if not exists debts_usuario on public.debts (user_id, liquidado_el);\n\nalter table public.debts enable row level security;\ndrop policy if exists \"Solo el dueño\" on public.debts;\ncreate policy \"Solo el dueño\" on public.debts for all to authenticated\n  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));\n\ngrant select, insert, update, delete on public.debts to authenticated, service_role;\n";
