import { test } from "node:test";
import assert from "node:assert/strict";
import { retoHormiga } from "../lib/hormiga";
import type { Movimiento } from "../lib/tipos";

const mov = (fecha: string, comercio: string, monto: number): Movimiento => ({
  id: `${fecha}${comercio}${monto}`, account_id: "a", fecha, descripcion_original: comercio, comercio, monto, tipo: "gasto",
  category_id: null, requiere_revision: false, es_recurrente: false, hash_unico: `${fecha}${comercio}${monto}`, import_id: null,
});

test("reto cero hormiga: meta con el mes anterior, lo que llevas y días seguidos sin caer", () => {
  const movs = [
    mov("2026-10-05", "Starbucks", 80), mov("2026-10-12", "Starbucks", 80), mov("2026-10-20", "Starbucks", 80), mov("2026-10-28", "Starbucks", 80),
    mov("2026-10-10", "Liverpool", 2000),
    mov("2026-11-02", "Starbucks", 80),
    mov("2026-11-03", "Súper", 600),
  ];
  const r = retoHormiga(movs, [], "2026-11-06")!;
  assert.deepEqual(r.lugares, ["Starbucks"]);
  assert.equal(r.meta, 320);
  assert.equal(r.llevas, 80);
  assert.equal(r.ahorrado, 240);
  assert.equal(r.diasSin, 4);
});

test("sin gastos hormiga el mes pasado no hay reto", () => {
  assert.equal(retoHormiga([mov("2026-10-10", "Liverpool", 2000)], [], "2026-11-06"), null);
});

test("si no has caído en el mes, los días cuentan desde el día 1", () => {
  const movs = [mov("2026-10-05", "Oxxo", 60), mov("2026-10-12", "Oxxo", 60), mov("2026-10-20", "Oxxo", 60)];
  assert.equal(retoHormiga(movs, [], "2026-11-03")!.diasSin, 3);
});
