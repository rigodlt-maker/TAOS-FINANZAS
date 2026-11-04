// Sugerencias: cada dato va a su pregunta del Google Form "Sugerencias TAOS"
import assert from "node:assert/strict";
import { test } from "node:test";
import { CAMPOS, FORMULARIO, datosSugerencia } from "../components/taos/sugerencias";

test("la sugerencia llena las preguntas del formulario", () => {
  assert.match(FORMULARIO, /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/);
  const p = datosSugerencia({ app: "App de prueba", tipo: "💡 Idea", mensaje: "  Quiero ver mis gastos por semana  ", calificacion: 4, contacto: "", version: "1.2.0" });
  assert.equal(p.get(CAMPOS.app), "App de prueba");
  assert.equal(p.get(CAMPOS.tipo), "💡 Idea");
  assert.equal(p.get(CAMPOS.mensaje), "Quiero ver mis gastos por semana");
  assert.equal(p.get(CAMPOS.calificacion), "4");
  assert.equal(p.get(CAMPOS.version), "1.2.0");
  assert.equal(p.has(CAMPOS.contacto), false); // sin contacto no se manda nada
  assert.equal(new Set(Object.values(CAMPOS)).size, 6);
});
