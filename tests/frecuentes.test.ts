import { test } from "node:test";
import assert from "node:assert/strict";
import { gastosFrecuentes } from "../lib/frecuentes";
import type { Movimiento } from "../lib/tipos";

const mov = (fecha: string, comercio: string, monto: number, tipo: "gasto" | "ingreso" = "gasto"): Movimiento => ({
  id: `${fecha}${comercio}${monto}`, account_id: "a1", fecha, descripcion_original: comercio, comercio, monto, tipo,
  category_id: "c1", requiere_revision: false, es_recurrente: false, hash_unico: `${fecha}${comercio}${monto}`, import_id: null,
});

test("frecuentes: 3 o más veces, monto parecido, el más repetido primero", () => {
  const f = gastosFrecuentes(
    [
      mov("2026-10-01", "Starbucks", 75), mov("2026-10-08", "Starbucks", 78), mov("2026-10-20", "Starbucks", 76), mov("2026-10-28", "Starbucks", 74),
      mov("2026-10-02", "Pemex", 500), mov("2026-10-12", "Pemex", 500), mov("2026-10-22", "Pemex", 500),
      mov("2026-10-05", "Liverpool", 1200), mov("2026-10-25", "Liverpool", 1200),
      mov("2026-10-03", "Nómina", 9000, "ingreso"), mov("2026-10-18", "Nómina", 9000, "ingreso"), mov("2026-10-31", "Nómina", 9000, "ingreso"),
      mov("2026-07-01", "Oxxo", 30), mov("2026-07-02", "Oxxo", 30), mov("2026-07-03", "Oxxo", 30),
    ],
    "2026-11-03",
  );
  assert.deepEqual(f.map((x) => [x.comercio, x.monto, x.veces]), [["Starbucks", 74, 4], ["Pemex", 500, 3]]);
});
