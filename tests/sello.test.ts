import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const { huella, archivos } = createRequire(import.meta.url)("../scripts/integridad.cjs");

test("el sello coincide con el código (si cambiaste algo a propósito, corre `npm run sellar`)", () => {
  const sello = JSON.parse(readFileSync(new URL("../taos-sello.json", import.meta.url), "utf8"));
  assert.equal(sello.huella, huella());
});

test("la huella cubre el código de la app pero no los archivos generados", () => {
  const lista: string[] = archivos();
  assert.ok(lista.includes("app/layout.tsx"));
  assert.ok(lista.includes("package.json"));
  assert.ok(!lista.some((f) => f.includes("node_modules") || f.startsWith(".next") || f === "taos-sello.json"));
});
