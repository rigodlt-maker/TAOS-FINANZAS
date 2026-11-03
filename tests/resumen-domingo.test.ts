import { test } from "node:test";
import assert from "node:assert/strict";
import { armarResumenDomingo } from "../lib/resumen-domingo";

test("resumen del domingo con las 4 apps", () => {
  const a = armarResumenDomingo({
    gasto: 3200,
    gastoAntes: 4000,
    entrenos: { hechos: 4, meta: 4 },
    porVencer: [{ nombre: "Seguro del auto", fecha: "2026-11-20" }, { nombre: "Pasaporte", fecha: "2026-11-30" }],
    habitos: { hechos: 21, posibles: 28 },
  });
  assert.equal(a.titulo, "📊 Tu semana TAOS");
  assert.match(a.cuerpo, /Gastaste \$3,200 \(20% menos/);
  assert.match(a.cuerpo, /Entrenaste 4 de 4 días ✅/);
  assert.match(a.cuerpo, /75% de tus hábitos/);
  assert.match(a.cuerpo, /Seguro del auto vence el .* \(y 1 más\)/);
});

test("solo con Administrador Tao: sin las partes de las otras apps", () => {
  const a = armarResumenDomingo({ gasto: 500, gastoAntes: 0, entrenos: null, porVencer: null, habitos: null });
  assert.equal(a.cuerpo, "💸 Gastaste $500.");
});
