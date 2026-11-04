import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { entenderPregunta, responderAsesor } from "../lib/asesor";
import { SQL_CREDITOS, creditosPorAvisar, cuantoFalta, dividirPago, proyectar, resumenCreditos, respuestaCreditos, siguienteFecha } from "../lib/creditos";
import type { Credito } from "../lib/tipos";

// Datos inventados
const carro: Credito = {
  id: "c1",
  nombre: "Crédito del carro",
  tipo: "auto",
  saldo: 120_000,
  pago: 5_000,
  frecuencia: "mensual",
  tasa_anual: 12,
  proximo_pago: "2026-11-10",
  cuenta_id: null,
  nota: null,
  liquidado_el: null,
};

test("el pago se divide en intereses y capital", () => {
  // 12% anual = 1% al mes → $1,200 de interés sobre $120,000
  assert.deepEqual(dividirPago(carro, 5_000), { interes: 1_200, capital: 3_800 });
  // quincenal: 12% / 24 = 0.5%
  assert.deepEqual(dividirPago({ ...carro, frecuencia: "quincenal" }, 5_000), { interes: 600, capital: 4_400 });
  // sin interés todo es capital
  assert.deepEqual(dividirPago({ ...carro, tasa_anual: 0 }, 5_000), { interes: 0, capital: 5_000 });
  // nunca baja más de lo que debes
  assert.deepEqual(dividirPago({ ...carro, saldo: 1_000, tasa_anual: 0 }, 5_000), { interes: 0, capital: 1_000 });
});

test("siguiente fecha de pago", () => {
  assert.equal(siguienteFecha("2026-11-10", "mensual"), "2026-12-10");
  assert.equal(siguienteFecha("2026-12-10", "mensual"), "2027-01-10");
  assert.equal(siguienteFecha("2027-01-31", "mensual"), "2027-02-28");
  assert.equal(siguienteFecha("2026-11-10", "semanal"), "2026-11-17");
  // quincenal: 5 → 20 → 5 del siguiente; 15 → fin de mes → 15
  assert.equal(siguienteFecha("2026-11-05", "quincenal"), "2026-11-20");
  assert.equal(siguienteFecha("2026-11-20", "quincenal"), "2026-12-05");
  assert.equal(siguienteFecha("2026-11-15", "quincenal"), "2026-11-30");
  assert.equal(siguienteFecha("2026-11-30", "quincenal"), "2026-12-15");
});

test("proyección: cuándo termina y cuánto falta de intereses", () => {
  const p = proyectar(carro);
  assert.ok(!("nuncaTermina" in p));
  if ("nuncaTermina" in p) return;
  // 120 mil al 1% mensual con pagos de 5 mil: 28 pagos (el último más chico) y ≈ $17,900 de intereses
  assert.equal(p.pagos, 28);
  assert.equal(p.termina, "2029-02-10");
  assert.ok(p.intereses > 17_500 && p.intereses < 18_500, String(p.intereses));
  // sin interés: 24 pagos exactos
  const sin = proyectar({ ...carro, tasa_anual: 0 });
  assert.ok(!("nuncaTermina" in sin) && sin.pagos === 24 && sin.intereses === 0);
  // si el pago no cubre los intereses, nunca termina
  const mal = proyectar({ ...carro, pago: 1_000 });
  assert.ok("nuncaTermina" in mal);
  assert.equal(cuantoFalta(29, "mensual"), "2 años y 5 meses");
  assert.equal(cuantoFalta(8, "mensual"), "8 meses");
  assert.equal(cuantoFalta(3, "semanal"), "3 semanas");
  assert.equal(cuantoFalta(24, "quincenal"), "1 año");
});

test("resumen y avisos", () => {
  const personal: Credito = { ...carro, id: "c2", nombre: "Préstamo personal", saldo: 10_000, pago: 1_000, frecuencia: "quincenal", proximo_pago: "2026-11-05" };
  const pagado: Credito = { ...carro, id: "c3", nombre: "Viejo", saldo: 0, liquidado_el: "2026-01-01" };
  const r = resumenCreditos([carro, personal, pagado], "2026-11-08");
  assert.equal(r.total, 130_000);
  assert.equal(r.alMes, 7_000); // 5 mil al mes + 1 mil × 2 quincenas
  assert.equal(r.atrasados.length, 1);
  assert.deepEqual(creditosPorAvisar([carro, personal, pagado], "2026-11-08").map((c) => c.id), ["c1"]); // en 2 días
  assert.deepEqual(creditosPorAvisar([carro, personal], "2026-11-06").map((c) => c.id), ["c2"]); // se pasó ayer
});

test("Tao: preguntas de créditos", () => {
  assert.equal(entenderPregunta("cuanto debo de mis creditos"), "creditos");
  assert.equal(entenderPregunta("cuando termino de pagar el carro"), "creditos");
  assert.equal(entenderPregunta("cuanto pago de hipoteca"), "creditos");
  // "tarjeta de crédito" sigue siendo de tarjetas
  assert.notEqual(entenderPregunta("que tarjeta de credito me toca pagar"), "creditos");
  const r = respuestaCreditos([carro], "2026-11-08", "cuando termino de pagar el carro");
  assert.match(r, /Crédito del carro/);
  assert.match(r, /febrero de 2029/);
  assert.match(respuestaCreditos([], "2026-11-08"), /Mis créditos/);
  const d = { hoy: "2026-11-08", cuentas: [], categorias: [], movimientos: [], pagos: [], metas: [], aportaciones: [], creditos: [carro] };
  assert.match(responderAsesor("¿Cuánto debo en créditos?", d), /120,000/);
  assert.match(responderAsesor("¿cuánto debo?", d), /créditos/);
});

test("el SQL que muestra la app es el mismo que la migración 0009", () => {
  assert.equal(SQL_CREDITOS, readFileSync("supabase/migrations/0009_creditos.sql", "utf8"));
});
