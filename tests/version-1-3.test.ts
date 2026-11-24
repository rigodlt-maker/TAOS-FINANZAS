// A1 (1.3.0): el botón flotante es siempre solo el ícono (su nombre va en aria-label y title)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("A1 (1.3.0): el botón flotante es siempre solo el ícono", () => {
  const s = readFileSync("components/taos/shell.tsx", "utf8");
  const boton = s.slice(s.indexOf("export function BotonFlotante"));
  assert.doesNotMatch(boton, /\{arriba && etiqueta\}/);
  assert.doesNotMatch(boton, /usarArriba/);
  assert.match(boton, /aria-label=\{etiqueta\}/);
  assert.match(boton, /title=\{etiqueta\}/);
  assert.match(boton, /"w-14"/);
});
