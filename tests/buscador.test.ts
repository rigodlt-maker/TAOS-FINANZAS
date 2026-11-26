// Buscador 🔍: lo que escribe la gente → la pantalla correcta
import assert from "node:assert/strict";
import { test } from "node:test";
import { buscarDestinos } from "../components/taos/buscador";
import { DESTINOS } from "../lib/destinos";

const primero = (q: string) => buscarDestinos(q, DESTINOS)[0]?.ruta;
const entre3 = (q: string) => buscarDestinos(q, DESTINOS).slice(0, 3).map((d) => d.ruta);

test("lleva a la pantalla correcta", () => {
  assert.equal(primero("categorías"), "/ajustes#categorias");
  assert.equal(primero("editar categorias"), "/ajustes#categorias");
  assert.equal(primero("antojos"), "/presupuesto");
  assert.equal(primero("netflix"), "/suscripciones");
  assert.equal(primero("ticket"), "/agregar#foto");
  assert.equal(primero("letra grande"), "/ajustes#pantalla");
  assert.equal(primero("mis créditos"), "/creditos");
  assert.equal(primero("quien me debe"), "/prestamos");
  assert.equal(primero("metas"), "/metas");
  assert.ok(entre3("tarjeta").includes("/ajustes#cuentas"));
  assert.ok(entre3("fecha limite").includes("/pagos"));
  assert.ok(entre3("oxxo").includes("/movimientos"));
});

test("aguanta faltas de ortografía y mayúsculas", () => {
  assert.equal(primero("CATGORIAS"), "/ajustes#categorias");
  assert.equal(primero("suscripsiones"), "/suscripciones");
  assert.equal(primero("notificasiones"), "/ajustes#avisos");
});

test("lo que no es pantalla no inventa resultados", () => {
  assert.deepEqual(buscarDestinos("", DESTINOS), []);
  assert.deepEqual(buscarDestinos("de la", DESTINOS), []);
  assert.deepEqual(buscarDestinos("zzzz qwerty", DESTINOS), []);
});

test("cada pantalla del buscador existe y no se repite", async () => {
  const { existsSync } = await import("node:fs");
  const rutas = DESTINOS.map((d) => d.ruta);
  assert.equal(new Set(rutas).size, rutas.length);
  for (const r of rutas) {
    const base = r.split("#")[0];
    assert.ok(existsSync(`app/(app)${base === "/" ? "" : base}/page.tsx`), r);
  }
});
