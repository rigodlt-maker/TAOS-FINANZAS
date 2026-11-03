import assert from "node:assert/strict";
import { test } from "node:test";
import { cuantoPuedoGastarHoy } from "../lib/gastar-hoy";

const g = (fecha: string, monto: number) => ({ fecha, monto, tipo: "gasto" as const });

test("reparte el presupuesto que queda entre los días que faltan", () => {
  // 21 de noviembre: faltan 10 días contando hoy; quedan 10,000 - 6,000 = 4,000 → 400 al día
  const r = cuantoPuedoGastarHoy({ hoy: "2026-11-21", movimientosDelMes: [g("2026-11-05", 6000), g("2026-11-21", 150)], presupuestoTotal: 10000, libre: null, pagosPendientes: 0 });
  assert.equal(r?.dias, 10);
  assert.equal(r?.diario, 400);
  assert.equal(r?.gastadoHoy, 150);
  assert.equal(r?.puedes, 250);
  assert.equal(r?.base, "presupuesto");
});

test("si el dinero libre alcanza menos que el presupuesto, manda el dinero", () => {
  // libre 1,850 después de gastar 150 hoy → amaneciste con 2,000; menos 1,000 de pagos = 1,000 / 10 días = 100
  const r = cuantoPuedoGastarHoy({ hoy: "2026-11-21", movimientosDelMes: [g("2026-11-21", 150)], presupuestoTotal: 10000, libre: 1850, pagosPendientes: 1000 });
  assert.equal(r?.base, "dinero");
  assert.equal(r?.diario, 100);
  assert.equal(r?.puedes, 0);
});

test("nunca da negativo y sin datos no muestra nada", () => {
  const r = cuantoPuedoGastarHoy({ hoy: "2026-11-30", movimientosDelMes: [g("2026-11-02", 20000)], presupuestoTotal: 10000, libre: null, pagosPendientes: 0 });
  assert.equal(r?.puedes, 0);
  assert.equal(cuantoPuedoGastarHoy({ hoy: "2026-11-30", movimientosDelMes: [], presupuestoTotal: 0, libre: null, pagosPendientes: 0 }), null);
});

test("ignora gastos de otro mes e ingresos", () => {
  const r = cuantoPuedoGastarHoy({ hoy: "2026-11-30", movimientosDelMes: [g("2026-10-30", 999), { fecha: "2026-11-30", monto: 500, tipo: "ingreso" }], presupuestoTotal: 300, libre: null, pagosPendientes: 0 });
  assert.equal(r?.puedes, 300);
});
