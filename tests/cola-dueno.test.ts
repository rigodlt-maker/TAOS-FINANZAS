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

test("S15-R6 (ronda 3): la cola vieja sin dueño NO se borra: se aparta, no se manda sola y se recupera o descarta a mano", () => {
  almacen.clear();
  const viejos = [
    { id: "1", tipo: "frase", frase: "350 súper con débito", creado: "2026-11-10T10:00:00Z" },
    { id: "2", tipo: "frecuente", datos: { comercio: "OXXO", monto: 80, account_id: "c1", category_id: null }, creado: "2026-11-10T11:00:00Z" },
  ];
  almacen.set("taos-cola-sin-internet", JSON.stringify(viejos));
  cola.fijarDueno("usuario-c"); // la sonda de Codex: sembrar la cola vieja y fijar dueño
  // Se apartó tal cual (no desapareció) y no entra a la cola que se manda sola
  assert.deepEqual(JSON.parse(almacen.get(cola.APARTADA)!), viejos);
  assert.equal(almacen.has("taos-cola-sin-internet"), false);
  assert.deepEqual(cola.leerCola(), []);
  assert.deepEqual(cola.leerApartados().map((p) => p.id), ["1", "2"]);
  // Sin sesión no se ven ni se pueden tocar
  cola.fijarDueno(null);
  assert.deepEqual(cola.leerApartados(), []);
  assert.equal(cola.recuperarApartado("1"), false);
  assert.equal(cola.descartarApartado("2"), false);
  assert.equal(JSON.parse(almacen.get(cola.APARTADA)!).length, 2);
  // Con sesión: «Son míos: registrar» lo pasa a SU cola con su dueño; «Descartar» lo quita. Nada se pierde sin elegirlo
  cola.fijarDueno("usuario-c");
  assert.equal(cola.recuperarApartado("1"), true);
  assert.deepEqual(cola.leerCola().map((p) => [p.tipo === "frase" ? p.frase : "", p.dueno]), [["350 súper con débito", "usuario-c"]]);
  assert.deepEqual(cola.leerApartados().map((p) => p.id), ["2"]);
  assert.equal(cola.descartarApartado("2"), true);
  assert.deepEqual(cola.leerApartados(), []);
  assert.equal(almacen.has(cola.APARTADA), false);
  // Si llega otra cola vieja (p. ej. una pantalla Sin internet de antes, guardada en el celular), se suma a los apartados
  almacen.set("taos-cola-sin-internet", JSON.stringify([{ id: "3", tipo: "frase", frase: "45 café", creado: "x" }]));
  assert.deepEqual(cola.leerApartados().map((p) => p.id), ["3"]);
});

test("S15-R6 (ronda 3): si no se puede guardar la copia apartada, la cola vieja se queda donde estaba", () => {
  almacen.clear();
  almacen.set("taos-cola-sin-internet", JSON.stringify([{ id: "9", tipo: "frase", frase: "x", creado: "x" }]));
  const ls = (globalThis as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage;
  const original = ls.setItem;
  ls.setItem = (k: string, v: string) => {
    if (k === cola.APARTADA) throw new Error("lleno");
    original(k, v);
  };
  try {
    cola.fijarDueno("usuario-d");
  } finally {
    ls.setItem = original;
  }
  assert.ok(almacen.has("taos-cola-sin-internet"));
});

test("S15-R6: una lista copiada a otra clave no cuenta", () => {
  almacen.clear();
  cola.fijarDueno("usuario-c");
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

// Ronda 4 de Codex: escribir en la cola falla (QuotaExceededError) al recuperar un apartado
function fallarAlEscribir(clave: (k: string) => boolean, f: () => void) {
  const ls = (globalThis as unknown as { localStorage: { setItem: (k: string, v: string) => void; removeItem: (k: string) => void } }).localStorage;
  const set = ls.setItem, rm = ls.removeItem;
  const cuota = () => Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" });
  ls.setItem = (k, v) => {
    if (clave(k)) throw cuota();
    set(k, v);
  };
  ls.removeItem = (k) => {
    if (clave(k)) throw cuota();
    rm(k);
  };
  try {
    f();
  } finally {
    ls.setItem = set;
    ls.removeItem = rm;
  }
}
const sembrarApartado = (duenoId: string) => {
  almacen.clear();
  almacen.set("taos-cola-sin-internet", JSON.stringify([{ id: "legacy", tipo: "frase", frase: "350 súper con débito", creado: "2026-11-10T10:00:00Z" }]));
  cola.fijarDueno(duenoId);
  assert.deepEqual(cola.leerApartados().map((p) => p.id), ["legacy"]);
};

test("S15-R6 (ronda 4): si no se puede escribir en la cola, recuperar devuelve false y el gasto SIGUE apartado", () => {
  sembrarApartado("A");
  let r = true;
  fallarAlEscribir((k) => k === "taos-cola-sin-internet:A", () => (r = cola.recuperarApartado("legacy")));
  assert.equal(r, false);
  assert.deepEqual(cola.leerApartados().map((p) => p.id), ["legacy"]);
  assert.deepEqual(cola.leerCola(), []);
  // Con espacio otra vez, se recupera normal y una sola vez
  assert.equal(cola.recuperarApartado("legacy"), true);
  assert.deepEqual(cola.leerApartados(), []);
  assert.deepEqual(cola.leerCola().map((p) => (p.tipo === "frase" ? p.frase : "")), ["350 súper con débito"]);
});

test("S15-R6 (ronda 4): si se copió a la cola pero no se pudo quitar de apartados, se deshace la copia (no queda doble ni se pierde)", () => {
  sembrarApartado("A");
  let r = true;
  fallarAlEscribir((k) => k === cola.APARTADA, () => (r = cola.recuperarApartado("legacy")));
  assert.equal(r, false);
  assert.deepEqual(cola.leerApartados().map((p) => p.id), ["legacy"]);
  assert.deepEqual(cola.leerCola(), []);
});

test("S15-R6 (ronda 4): agregarACola y descartar dicen la verdad cuando el celular no deja escribir", () => {
  sembrarApartado("A");
  let agregado = true, descartado = true;
  fallarAlEscribir((k) => k.startsWith("taos-cola"), () => {
    agregado = cola.agregarACola({ tipo: "frase", frase: "80 oxxo" });
    descartado = cola.descartarApartado("legacy");
  });
  assert.equal(agregado, false);
  assert.equal(descartado, false);
  assert.deepEqual(cola.leerApartados().map((p) => p.id), ["legacy"]);
  assert.deepEqual(cola.leerCola(), []);
});

test("S15-R6 (ronda 5): lo que el servidor no registró queda «por revisar»: no se manda solo ni se borra", () => {
  almacen.clear();
  cola.fijarDueno("A");
  cola.agregarACola({ tipo: "frase", frase: "pagué la tarjeta con débito 500" });
  const [p] = cola.leerCola();
  assert.equal(cola.marcarRevisar(p.id, "Es un movimiento entre tus cuentas"), true);
  assert.deepEqual(cola.porEnviar(), []);
  assert.deepEqual(cola.porRevisar().map((x) => x.revisar), ["Es un movimiento entre tus cuentas"]);
  assert.equal(cola.leerCola().length, 1);
});
