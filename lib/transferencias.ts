// Dinero disponible y movimientos entre tus propias cuentas
import { dinero, hoyLocal, normalizar, redondear, sumarDias } from "./formato";
import type { Cuenta } from "./tipos";

export type ResumenDinero = {
  tengo: number; // débito + efectivo + ahorro
  debo: number; // deuda en tarjetas de crédito
  libre: number; // tengo - debo
  cuentas: Cuenta[]; // las que suman (no crédito)
  tarjetas: Cuenta[]; // tarjetas con deuda
};

// "Tengo 33 mil, pero debo 30 mil en tarjetas: me quedan 3 mil libres"
export function resumenDinero(cuentas: Cuenta[]): ResumenDinero {
  const propias = cuentas.filter((c) => c.tipo !== "credito");
  const tarjetas = cuentas.filter((c) => c.tipo === "credito" && c.saldo_actual < 0);
  const tengo = redondear(propias.reduce((t, c) => t + c.saldo_actual, 0));
  const debo = redondear(tarjetas.reduce((t, c) => t - c.saldo_actual, 0));
  return { tengo, debo, libre: redondear(tengo - debo), cuentas: propias, tarjetas };
}

// Cómo cambian los saldos: sale de una cuenta y llega a otra.
// En una tarjeta de crédito el saldo es negativo (deuda): si le llega dinero, la deuda baja.
export function aplicarTransferencia(origen: Cuenta, destino: Cuenta, monto: number) {
  return {
    origen: redondear(origen.saldo_actual - monto),
    destino: redondear(destino.saldo_actual + monto),
  };
}

const GENERICAS = new Set(["tarjeta", "cuenta", "debito", "credito", "de", "del", "la", "el", "mi", "tdc", "tdd", "y"]);

// Busca qué cuentas menciona el texto (por nombre completo o por una palabra distintiva: "palacio", "revolut", "nu")
function mencionadas(t: string, cuentas: Cuenta[]) {
  const palabras = (c: Cuenta) => normalizar(c.nombre).split(" ").filter((w) => !GENERICAS.has(w) && (w.length >= 3 || w === "nu"));
  // Dónde aparece cada cuenta: por nombre completo o por cada palabra suya ("cajita" encuentra "Cajitas" y al revés)
  let encontradas: { cuenta: Cuenta; pos: number; posiciones: number[] }[] = [];
  for (const c of cuentas) {
    const completo = t.search(new RegExp(`\\b${normalizar(c.nombre)}\\b`));
    const posiciones =
      completo >= 0 ? [completo] : palabras(c).map((w) => t.search(new RegExp(`\\b${w.replace(/s$/, "")}s?\\b`))).filter((p) => p >= 0);
    if (posiciones.length) encontradas.push({ cuenta: c, pos: Math.min(...posiciones), posiciones });
  }
  // "Cajita de Nu" es NU CAJITAS (2 palabras), no también "Nu crédito" (solo "nu")
  encontradas = encontradas.filter(
    (e) => !encontradas.some((o) => o !== e && o.posiciones.length > e.posiciones.length && e.posiciones.every((p) => o.posiciones.includes(p))),
  );
  // Si dos cuentas comparten palabra (p. ej. "Nu crédito" y "Nu débito"), se desempata con "crédito"/"tarjeta" o el nombre completo
  const porPos = new Map<number, typeof encontradas>();
  for (const e of encontradas) porPos.set(e.pos, [...(porPos.get(e.pos) ?? []), e]);
  const resultado: typeof encontradas = [];
  for (const [pos, grupo] of porPos) {
    if (grupo.length === 1) {
      resultado.push(grupo[0]);
      continue;
    }
    const completo = grupo.find((e) => t.includes(normalizar(e.cuenta.nombre)));
    const cerca = t.slice(Math.max(0, pos - 20), pos + 30);
    // "Pagué Nu con Revolut" o "gastos con Nu": se refiere a la tarjeta
    const credito = /credito|tarjeta|tdc/.test(cerca) || (/\b(pague|pagar|liquide|abone|gast\w*|compr\w*)\b/.test(t) && !/cajita|ahorro|debito|cuenta/.test(cerca));
    resultado.push(completo ?? grupo.find((e) => (e.cuenta.tipo === "credito") === credito) ?? grupo[0]);
  }
  return resultado.sort((a, b) => a.pos - b.pos);
}

export type TransferenciaInterpretada = {
  origen_id: string;
  destino_id: string;
  monto: number;
  montoSupuesto: boolean; // true si no escribiste monto y se tomó la deuda completa de la tarjeta
  fecha: string;
};

const VERBOS = /\b(pague|pagar|pagamos|abone|liquide|transferi|transfiere|pase|movi|mande|saque|retire|traspase|deposite|meti|guarde|aparte)\b/;
const PREGUNTA = /^(cuanto|cuando|que|cual|como|donde|por que)\b/;

// Entiende frases como:
//   "Pagué la tarjeta Palacio de Hierro con Revolut"  → sale de Revolut, llega a Palacio
//   "Saqué 5 mil de Revolut para pagar Palacio"        → sale de Revolut, llega a Palacio
//   "Pasé 2000 de Nu a efectivo"                       → sale de Nu, llega a Efectivo
export function interpretarTransferencia(frase: string, cuentas: Cuenta[], hoy = hoyLocal()): TransferenciaInterpretada | null {
  const t = leerTransferencia(frase, cuentas, hoy);
  return t && t.monto > 0 ? t : null;
}

// Igual que interpretarTransferencia, pero si no hay monto regresa monto 0 (para preguntarte cuánto fue)
export function leerTransferencia(frase: string, cuentas: Cuenta[], hoy = hoyLocal()): TransferenciaInterpretada | null {
  const crudo = frase.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  const t = normalizar(crudo);
  if (!VERBOS.test(t) || /[?¿]/.test(frase) || PREGUNTA.test(t)) return null;
  const ctas = mencionadas(t, cuentas);
  if (ctas.length !== 2) return null;
  const [a, b] = ctas;

  // Quién paga: la cuenta que va después de "con" o "desde"; si no, la primera ("de X a Y", "saqué de X para pagar Y")
  const antes = (e: { pos: number }) => t.slice(Math.max(0, e.pos - 25), e.pos);
  let origen = a.cuenta;
  let destino = b.cuenta;
  if (/\b(con|desde|usando)\s+(la |el |mi )?(tarjeta |cuenta )?$/.test(antes(b)) && !/\b(con|desde)\s/.test(antes(a))) {
    origen = b.cuenta;
    destino = a.cuenta;
  }

  const numero = crudo.match(/(?<![\d.])(\d+(?:\.\d{1,2})?)\s*(k|mil)?(?![\d.])/);
  let monto = numero ? Number(numero[1]) * (numero[2] ? 1000 : 1) : 0;
  let montoSupuesto = false;
  if (!monto && destino.tipo === "credito" && destino.saldo_actual < 0) {
    monto = -destino.saldo_actual;
    montoSupuesto = true;
  }
  // "Moví todo el dinero de Revolut a Nu": todo el saldo de la cuenta que paga
  if (!monto && origen.tipo !== "credito" && origen.saldo_actual > 0 && /\b(todo|el dinero|mi dinero|lo que tenia)\b/.test(t)) {
    monto = origen.saldo_actual;
    montoSupuesto = true;
  }

  const fecha = /\b(antier|anteayer)\b/.test(t) ? sumarDias(hoy, -2) : /\bayer\b/.test(t) ? sumarDias(hoy, -1) : hoy;
  return { origen_id: origen.id, destino_id: destino.id, monto: redondear(monto), montoSupuesto, fecha };
}

// Cuentas que menciona una frase, en el orden en que aparecen ("¿cuánto le debo a la HSBC?" → HSBC)
export function cuentasMencionadas(frase: string, cuentas: Cuenta[]): Cuenta[] {
  return mencionadas(normalizar(frase), cuentas).map((e) => e.cuenta);
}

export type PropuestaMovimiento = { origen_id: string; destino_id: string; origen: string; destino: string; monto: number; fecha: string };

// Lo que contesta el asesor cuando le dices "Moví dinero de X a Y": te muestra lo que entendió y te pide confirmar
export function proponerMovimiento(t: TransferenciaInterpretada, cuentas: Cuenta[], hoy = hoyLocal()) {
  const origen = cuentas.find((c) => c.id === t.origen_id)!;
  const destino = cuentas.find((c) => c.id === t.destino_id)!;
  const cuando = t.fecha === hoy ? "hoy" : t.fecha === sumarDias(hoy, -1) ? "ayer" : "antier";
  const propuesta: PropuestaMovimiento = { origen_id: origen.id, destino_id: destino.id, origen: origen.nombre, destino: destino.nombre, monto: t.monto, fecha: t.fecha };
  const lineas = [`- **Sale de:** ${origen.nombre}`, `- **Llega a:** ${destino.nombre}${destino.tipo === "credito" ? " (pago de tarjeta)" : ""}`, `- **Cuándo:** ${cuando}`];
  if (!t.monto) return { respuesta: ["Entendí que moviste dinero:", "", ...lineas, "", "¿Cuánto fue? Escribe la cantidad abajo y toca **Registrar**."].join("\n"), propuesta };
  const nota = !t.montoSupuesto ? "" : destino.tipo === "credito" ? " (toda la deuda, porque no escribiste monto)" : " (todo el saldo, porque no escribiste monto)";
  return { respuesta: ["Entendí esto:", "", ...lineas, `- **Monto:** ${dinero(t.monto)}${nota}`, "", "¿Lo registro? Puedes cambiar el monto antes de confirmar."].join("\n"), propuesta };
}
