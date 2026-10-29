// Ajustes de saldo escritos en el chat
import assert from "node:assert/strict";
import { test } from "node:test";
import { leerAjusteSaldo } from "../lib/ajuste-chat";
import { leerGastoDeChat } from "../lib/gasto-chat";
import { leerTransferencia } from "../lib/transferencias";
import type { Cuenta } from "../lib/tipos";

const c = (id: string, nombre: string, tipo: Cuenta["tipo"], saldo: number): Cuenta => ({ id, nombre, tipo, saldo_actual: saldo, dia_corte: null, dia_limite_pago: null, es_ejemplo: false });
const cuentas = [c("efe", "EFECTIVO", "efectivo", 1900), c("rev", "Revolut", "ahorro", 0), c("tur", "Nu Cajita Turbo", "ahorro", 21500.40), c("pla", "Plata", "credito", -9850.40), c("nuc", "Nu crédito", "credito", -900)];

test("entiende ajustes de saldo", () => {
  const casos: [string, string, number][] = [
    ["Modifica mi efectivo disponible a $3200", "efe", 3200],
    ["cambia el saldo de revolut a 1,500", "rev", 1500],
    ["ajusta mi cajita turbo a 25,800.50", "tur", 25800.5],
    ["ahora tengo 4 mil en efectivo", "efe", 4000],
    ["mi deuda de Plata es 9591.40", "pla", -9591.40],
    ["pon el saldo de plata en 9,591.40", "pla", -9591.40],
  ];
  for (const [frase, cuenta, nuevo] of casos) {
    const a = leerAjusteSaldo(frase, cuentas);
    assert.ok(a, frase);
    assert.deepEqual([a.cuenta_id, a.nuevo], [cuenta, nuevo], frase);
  }
});

test("no confunde ajustes con preguntas, gastos o transferencias", () => {
  for (const f of ["¿cuánto tengo en efectivo?", "cuanto tengo en revolut", "Pagué $30 de tamales con efectivo", "moví 500 de revolut a efectivo", "gasté 200 en efectivo"])
    assert.equal(leerAjusteSaldo(f, cuentas), null, f);
  assert.equal(leerGastoDeChat("Modifica mi efectivo disponible a $3200", cuentas, [], []), null);
  assert.equal(leerTransferencia("Modifica mi efectivo disponible a $3200", cuentas), null);
});
