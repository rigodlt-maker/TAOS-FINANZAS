// S15-R6: los borradores guardados sin internet tienen dueño. Otra sesión en el mismo celular no los ve ni los manda.
import assert from "node:assert/strict";
import test from "node:test";

// Celular de mentira: localStorage y window
const almacen = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => almacen.get(k) ?? null, setItem: (k: string, v: string) => void almacen.set(k, v), removeItem: (k: string) => void almacen.delete(k) },
  window: { dispatchEvent: () => true },
});
type Cola = typeof import("../lib/cola");
let cola: Cola;
test.before(async () => {
  cola = await import("../lib/cola");
});

test("S15-R6: el borrador de A no aparece ni se manda con la sesión de B; vuelve con A", () => {
  almacen.clear();
  cola.fijarDueno("usuario-a");
  assert.equal(cola.agregarACola({ tipo: "frase", frase: "350 súper con débito" }), true);
  assert.equal(cola.leerCola().length, 1);
  assert.equal(cola.leerCola()[0].dueno, "usuario-a");
  cola.fijarDueno("usuario-b"); // cambia la identidad en el mismo celular
  assert.deepEqual(cola.leerCola(), []);
  cola.agregarACola({ tipo: "frase", frase: "80 oxxo" });
  assert.deepEqual(cola.leerCola().map((p) => (p.tipo === "frase" ? p.frase : "")), ["80 oxxo"]);
  cola.fijarDueno("usuario-a");
  assert.deepEqual(cola.leerCola().map((p) => (p.tipo === "frase" ? p.frase : "")), ["350 súper con débito"]);
});

test("S15-R6: sin sesión conocida no se guarda nada y la cola se ve vacía", () => {
  almacen.clear();
  cola.fijarDueno(null);
  assert.equal(cola.agregarACola({ tipo: "frase", frase: "100 taxi" }), false);
  assert.deepEqual(cola.leerCola(), []);
  assert.equal(almacen.size, 0);
});

test("S15-R6: la cola vieja sin dueño se descarta y una lista copiada a otra clave no cuenta", () => {
  almacen.clear();
  almacen.set("taos-cola-sin-internet", JSON.stringify([{ id: "1", tipo: "frase", frase: "vieja", creado: "x" }]));
  cola.fijarDueno("usuario-c");
  assert.equal(almacen.has("taos-cola-sin-internet"), false);
  assert.deepEqual(cola.leerCola(), []);
  almacen.set("taos-cola-sin-internet:usuario-c", JSON.stringify([{ id: "2", tipo: "frase", frase: "de A", creado: "x", dueno: "usuario-a" }]));
  assert.deepEqual(cola.leerCola(), []);
});

test("S15-R6: el servidor rechaza un borrador de otra sesión (demo = «demo»)", async () => {
  const { capturaRapida } = await import("../lib/acciones");
  const r = await capturaRapida("50 café con efectivo", "otra-sesion");
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /otra sesión/);
});

test("S15-R6: la pantalla «Sin internet» sabe de quién es la sesión y lo olvida al cerrar sesión", () => {
  almacen.clear();
  cola.fijarDueno("usuario-a");
  assert.equal(almacen.get(cola.CLAVE_DUENO), "usuario-a");
  cola.fijarDueno(null);
  assert.equal(almacen.has(cola.CLAVE_DUENO), false);
  // Recién cargada la entrada (sin dueño en memoria), igual se borra el que quedó guardado
  almacen.set(cola.CLAVE_DUENO, "usuario-a");
  cola.fijarDueno(null);
  assert.equal(almacen.has(cola.CLAVE_DUENO), false);
});

test("S15-R6: sin-internet.html guarda con dueño en la clave de esa sesión y sin sesión no guarda", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync("public/sin-internet.html", "utf8");
  assert.match(html, /"taos-cola-sin-internet:" \+ dueno/);
  assert.match(html, /dueno: dueno/);
  assert.match(html, /localStorage\.getItem\("taos-cola-dueno"\)/);
  assert.doesNotMatch(html, /setItem\("taos-cola-sin-internet",/);
});
