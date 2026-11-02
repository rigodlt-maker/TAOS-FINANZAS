// Botones de opciones de Tao: se agregan al final de la respuesta y la pantalla los separa del texto
import assert from "node:assert/strict";
import { test } from "node:test";
import { conOpciones, separarOpciones } from "../lib/opciones";

test("agrega y separa las opciones", () => {
  const t = conOpciones("¿Te refieres a…?", ["Mi nombre", "Mi póliza | AXA", "Mi nombre", "", "Tres", "Cuatro", "Cinco"]);
  const r = separarOpciones(t);
  assert.equal(r.texto, "¿Te refieres a…?");
  assert.deepEqual(r.opciones, ["Mi nombre", "Mi póliza AXA", "Tres", "Cuatro"]);
});

test("sin opciones el texto queda igual", () => {
  assert.equal(conOpciones("Hola", []), "Hola");
  assert.deepEqual(separarOpciones("Hola"), { texto: "Hola", opciones: [] });
});

test("mientras se escribe, una marca a medias no se ve", () => {
  assert.equal(separarOpciones("Listo\n\n[[opcio").texto, "Listo");
});
