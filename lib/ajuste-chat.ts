// Ajustar un saldo desde el chat: "Modifica mi efectivo a $3,200", "ahora tengo 5 mil en Nu", "mi deuda de Plata es 9,591"
import type { Repo } from "./datos/repo";
import { dinero, hoyLocal, normalizar, redondear } from "./formato";
import { ganaRendimiento } from "./rendimientos";
import { cuentasMencionadas } from "./transferencias";
import type { Cuenta } from "./tipos";

export type PropuestaAjuste = { cuenta_id: string; nombre: string; credito: boolean; actual: number; nuevo: number };

const VERBO = /\b(modifica\w*|cambia\w*|ajusta\w*|actualiza\w*|corrige\w*|pon|ponle|ponme|deja\w*|establece\w*|registra\w*)\b/;
const QUE = /\b(saldo|efectivo|dinero|disponible|monto|cuenta|deuda|tarjeta|cajita|ahorro)\b/;

export function leerAjusteSaldo(frase: string, cuentas: Cuenta[]): PropuestaAjuste | null {
  if (/[?¿]/.test(frase)) return null;
  const t = normalizar(frase);
  if (/^(cuanto|cuando|que|cual|como|donde)\b/.test(t)) return null;
  const ordena = VERBO.test(t) && QUE.test(t);
  // "Ahora tengo 3,200 en efectivo", "en Nu tengo 5 mil", "mi saldo de Revolut es 300", "mi deuda de Plata es 9591"
  const afirma = /\b(ahora tengo|ya tengo|tengo|traigo)\b.*\b(en|de)\b|\bmi (saldo|deuda|efectivo)\b.*\b(es|son|esta en|quedo en|queda en)\b/.test(t) && !/\b(gaste|pague|compre|movi|pase)\b/.test(t);
  if (!ordena && !afirma) return null;

  const crudo = frase.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  const m = crudo.match(/(-?\d+(?:\.\d{1,2})?)\s*(k|mil)?\b/);
  if (!m) return null;
  const monto = Number(m[1]) * (m[2] ? 1000 : 1);
  if (!Number.isFinite(monto)) return null;

  const mencionadas = cuentasMencionadas(frase, cuentas);
  const cuenta = mencionadas[0] ?? (/\befectivo\b/.test(t) ? cuentas.find((c) => c.tipo === "efectivo") : undefined);
  if (!cuenta || mencionadas.length > 1) return null;
  const credito = cuenta.tipo === "credito";
  // En tarjetas, el número que dices es lo que debes: se guarda en negativo
  const nuevo = redondear(credito ? -Math.abs(monto) : monto);
  return { cuenta_id: cuenta.id, nombre: cuenta.nombre, credito, actual: cuenta.saldo_actual, nuevo };
}

export function textoAjuste(a: PropuestaAjuste): string {
  const como = (v: number) => (a.credito ? (v < 0 ? `debes ${dinero(-v)}` : "sin deuda") : dinero(v));
  const diferencia = redondear(a.nuevo - a.actual);
  return [
    `Entendí que quieres **ajustar el saldo** de **${a.nombre}**:`,
    "",
    `- **Ahora:** ${como(a.actual)}`,
    `- **Nuevo:** ${como(a.nuevo)}`,
    diferencia ? `- **Diferencia:** ${diferencia > 0 ? "+" : "−"}${dinero(Math.abs(diferencia))}` : "",
    "",
    "Es solo un ajuste del saldo (no cuenta como gasto ni ingreso). ¿Lo cambio?",
  ]
    .filter((x, i, l) => x !== "" || l[i - 1] !== "")
    .join("\n");
}

export async function aplicarAjuste(repo: Repo, cuentaId: string, nuevo: number): Promise<{ mensaje: string; anterior: number }> {
  const cuenta = (await repo.cuentas()).find((c) => c.id === cuentaId);
  if (!cuenta) throw new Error("No encontré esa cuenta.");
  if (!Number.isFinite(nuevo)) throw new Error("Escribe el nuevo saldo.");
  const saldo = redondear(nuevo);
  // Si la cuenta da rendimiento, se empieza a contar desde hoy con el saldo nuevo
  await repo.editarCuenta(cuenta.id, { saldo_actual: saldo, ...(ganaRendimiento(cuenta) ? { rendimiento_desde: hoyLocal() } : {}) });
  return {
    anterior: cuenta.saldo_actual,
    mensaje: `Listo: ${cuenta.nombre} ${cuenta.tipo === "credito" ? (saldo < 0 ? `ahora dice que debes ${dinero(-saldo)}` : "queda sin deuda") : `queda en ${dinero(saldo)}`}.`,
  };
}
