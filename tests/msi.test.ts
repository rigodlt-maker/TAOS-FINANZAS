import { test } from "node:test";
import assert from "node:assert/strict";
import { comprasAMeses, esMSI, mensualidad } from "../lib/msi";

test("reconoce compras a meses sin intereses", () => {
  for (const t of ["LEANSIXSIGMA CURSO MENSUALIDAD 05 DE 12", "Leansixsigma curso mens", "BOLETOS EVENTO MENS 03/06", "LIVERPOOL MSI 6", "PALACIO 2 DE 9", "COMPRA A MESES SIN INTERESES", "PARCIALIDAD 4/18"]) assert.ok(esMSI(t), t);
  for (const t of ["NETFLIX.COM", "SPOTIFY MEXICO", "OXXO 12/10/2026", "STARBUCKS 12/10", "Club de Lectura MX", "Gimnasio Mensual"]) assert.ok(!esMSI(t), t);
});

test("cuántas mensualidades llevas", () => {
  assert.deepEqual(mensualidad("CURSO MENSUALIDAD 05 DE 12"), { va: 5, de: 12 });
  assert.deepEqual(mensualidad("EVENTO MENS 03/06"), { va: 3, de: 6 });
  assert.equal(mensualidad("OXXO 12/10"), null);
  assert.equal(mensualidad("Leansixsigma curso mens"), null);
});

test("compras a meses activas: cuánto pagas y cuánto te falta", () => {
  const m = (fecha: string, descripcion_original: string, monto: number) => ({ tipo: "gasto", fecha, monto, comercio: null, descripcion_original });
  const c = comprasAMeses(
    [m("2026-09-17", "CURSO MENSUALIDAD 4 DE 12", 1358.34), m("2026-10-17", "CURSO MENSUALIDAD 5 DE 12", 1358.34), m("2026-06-01", "TELE MSI 6 DE 6", 900), m("2026-10-20", "NETFLIX", 219)],
    "2026-11-03",
  );
  assert.equal(c.length, 1);
  assert.deepEqual([c[0].va, c[0].de, c[0].faltan], [5, 12, 7]);
  assert.equal(Math.round(c[0].resta!), 9508);
});

