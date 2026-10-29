import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretarCaptura } from "../lib/captura";
import { aplicarTransferencia, interpretarTransferencia, resumenDinero } from "../lib/transferencias";
import type { Cuenta } from "../lib/tipos";

const c = (id: string, nombre: string, tipo: Cuenta["tipo"], saldo: number): Cuenta => ({
  id, nombre, tipo, saldo_actual: saldo, dia_corte: null, dia_limite_pago: null, es_ejemplo: false,
});
const cuentas = [
  c("efe", "Efectivo", "efectivo", 3000),
  c("rev", "Revolut", "debito", 10000),
  c("nud", "Nu cuenta", "debito", 20000),
  c("nuc", "Nu crédito", "credito", -12000),
  c("ph", "Palacio de Hierro", "credito", -18000),
];

test("dinero libre = lo que tengo menos lo que debo en tarjetas", () => {
  const r = resumenDinero(cuentas);
  assert.equal(r.tengo, 33000);
  assert.equal(r.debo, 30000);
  assert.equal(r.libre, 3000);
});

test("pagar una tarjeta baja la deuda y resta a la cuenta que paga", () => {
  assert.deepEqual(aplicarTransferencia(cuentas[1], cuentas[4], 5000), { origen: 5000, destino: -13000 });
});

test("entiende 'pagué la tarjeta Palacio de Hierro con la tarjeta Revolut' (sin monto: toma la deuda completa)", () => {
  const t = interpretarTransferencia("Pagué la tarjeta palacio de hierro con la tarjeta Revolut", cuentas, "2026-10-27")!;
  assert.equal(t.origen_id, "rev");
  assert.equal(t.destino_id, "ph");
  assert.equal(t.monto, 18000);
  assert.equal(t.montoSupuesto, true);
});

test("entiende otras formas de decirlo", () => {
  const a = interpretarTransferencia("saqué 5 mil de revolut para pagar palacio", cuentas)!;
  assert.deepEqual([a.origen_id, a.destino_id, a.monto], ["rev", "ph", 5000]);
  const b = interpretarTransferencia("pasé 2,000 de nu cuenta a efectivo ayer", cuentas, "2026-10-27")!;
  assert.deepEqual([b.origen_id, b.destino_id, b.monto, b.fecha], ["nud", "efe", 2000, "2026-10-26"]);
  const d = interpretarTransferencia("con revolut pagué 3000 de la tarjeta nu crédito", cuentas)!;
  assert.deepEqual([d.origen_id, d.destino_id], ["rev", "nuc"]);
});

test("un gasto normal no se confunde con transferencia", () => {
  assert.equal(interpretarTransferencia("350 súper con revolut", cuentas), null);
  assert.equal(interpretarTransferencia("pagué 500 de luz con nu crédito", cuentas), null);
  assert.equal(interpretarCaptura("350 súper con revolut", cuentas)?.account_id, "rev");
});

test("frases del chat: 'moví el dinero de Revolut a Cajita de nu' y 'pagué Nu con Revolut'", async () => {
  const { leerTransferencia, proponerMovimiento } = await import("../lib/transferencias");
  const mias = [
    c("rev", "Revolut", "ahorro", 25170.31),
    c("caj", "NU CAJITAS", "ahorro", 5000),
    c("nuc", "Nu crédito", "credito", -928.71),
    c("efe", "EFECTIVO", "efectivo", 3000),
  ];
  const a = leerTransferencia("Movi el dinero de Revolut a Cajita de nu. Realiza el movimiento", mias, "2026-10-27")!;
  assert.deepEqual([a.origen_id, a.destino_id, a.monto], ["rev", "caj", 25170.31]);
  assert.match(proponerMovimiento(a, mias, "2026-10-27").respuesta, /todo el saldo/);
  const b = leerTransferencia("Pagué Nu con Revolut", mias, "2026-10-27")!;
  assert.deepEqual([b.origen_id, b.destino_id, b.monto], ["rev", "nuc", 928.71]);
  // Sin monto ni "todo": pregunta cuánto
  const s = leerTransferencia("pasé dinero de cajitas a efectivo", mias, "2026-10-27")!;
  assert.equal(s.monto, 0);
  assert.match(proponerMovimiento(s, mias, "2026-10-27").respuesta, /¿Cuánto fue\?/);
  // Las preguntas no se registran
  assert.equal(leerTransferencia("¿cuánto debo pagar de Nu con Revolut?", mias), null);
});
