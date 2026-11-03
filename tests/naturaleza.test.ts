import { test } from "node:test";
import assert from "node:assert/strict";
import { gastoPorCategoria, naturalezaDe, resumenNaturaleza, tendenciaSaldo } from "../lib/naturaleza";

const cats = [
  { id: "s", nombre: "Servicios" },
  { id: "p", nombre: "Súper y despensa" },
  { id: "c", nombre: "Comida fuera" },
];

test("naturaleza por nombre de categoría", () => {
  assert.equal(naturalezaDe("Servicios"), "debo");
  assert.equal(naturalezaDe("Seguros"), "debo");
  assert.equal(naturalezaDe("Súper y despensa"), "necesito");
  assert.equal(naturalezaDe("Transporte"), "necesito");
  assert.equal(naturalezaDe("Comida fuera"), "quiero");
  assert.equal(naturalezaDe(null), "quiero");
});

test("resumen Debo / Necesito / Quiero ignora ingresos", () => {
  const r = resumenNaturaleza(
    [
      { tipo: "gasto", monto: 500, category_id: "s" },
      { tipo: "gasto", monto: 300, category_id: "p" },
      { tipo: "gasto", monto: 200, category_id: "c" },
      { tipo: "ingreso", monto: 9000, category_id: null },
      { tipo: "gasto", monto: 70, category_id: null },
    ],
    cats,
  );
  assert.equal(r.total, 1000);
  assert.equal(r.sinCategoria, 70);
  assert.deepEqual(r.partes.map((p) => p.porcentaje), [50, 30, 20]);
});

test("dona: top de categorías y 'Lo demás'", () => {
  const r = gastoPorCategoria(
    [
      { tipo: "gasto", monto: 100, category_id: "s" },
      { tipo: "gasto", monto: 50, category_id: "p" },
      { tipo: "gasto", monto: 10, category_id: "c" },
      { tipo: "gasto", monto: 40, category_id: null },
    ],
    cats,
    2,
  );
  assert.deepEqual(r.partes.map((p) => p.nombre), ["Servicios", "Súper y despensa", "Lo demás"]);
  assert.equal(r.partes[2].monto, 50);
});

test("tendencia del saldo hacia atrás", () => {
  const p = tendenciaSaldo(1000, [{ tipo: "gasto", monto: 200, fecha: "2026-11-03" }, { tipo: "ingreso", monto: 500, fecha: "2026-11-02" }], "2026-11-03", 3);
  assert.deepEqual(p.map((x) => x.saldo), [700, 700, 1200, 1000]);
  assert.equal(p.at(-1)?.fecha, "2026-11-03");
});
