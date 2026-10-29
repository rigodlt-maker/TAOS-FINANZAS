// Lo que debes al corte vs. las compras nuevas de cada tarjeta
import assert from "node:assert/strict";
import { test } from "node:test";
import { pagosDeTarjeta } from "../lib/pagos";
import { estadoTarjeta, limiteDelCorte, ultimoCorte } from "../lib/tarjetas";
import type { Cuenta, Movimiento, Transferencia } from "../lib/tipos";

const plata: Cuenta = { id: "plata", nombre: "Plata", tipo: "credito", saldo_actual: -9850.40, dia_corte: 15, dia_limite_pago: 5, es_ejemplo: false };
const compra = (fecha: string, monto: number): Movimiento => ({
  id: fecha + monto, account_id: "plata", fecha, descripcion_original: "x", comercio: "x", monto, tipo: "gasto", category_id: null,
  requiere_revision: false, es_recurrente: false, hash_unico: fecha + monto, import_id: null,
});
const pago = (fecha: string, monto: number): Transferencia => ({ id: "t" + fecha, fecha, origen_id: "rev", destino_id: "plata", monto, nota: null });
const hoy = "2026-10-27";

test("fechas de corte y límite distintas", () => {
  assert.equal(ultimoCorte(plata, hoy), "2026-10-15");
  assert.equal(limiteDelCorte(plata, "2026-10-15"), "2026-11-05");
  assert.equal(limiteDelCorte({ ...plata, dia_corte: 3, dia_limite_pago: 23 }, "2026-10-03"), "2026-10-23");
});

test("separa lo del corte de las compras nuevas", () => {
  const e = estadoTarjeta(plata, [compra("2026-10-20", 259)], [], hoy);
  assert.deepEqual([e.total, e.alCorte, e.nuevas, e.limite], [9850.40, 9591.40, 259, "2026-11-05"]);
});

test("una compra de 5 mil hoy no cambia lo que hay que pagar al corte", () => {
  const conCompra = { ...plata, saldo_actual: plata.saldo_actual - 5000 };
  const e = estadoTarjeta(conCompra, [compra("2026-10-20", 259), compra(hoy, 5000)], [], hoy);
  assert.deepEqual([e.alCorte, e.nuevas, e.total], [9591.40, 5259, 14850.40]);
});

test("un pago baja lo del corte primero", () => {
  const pagada = { ...plata, saldo_actual: plata.saldo_actual + 2000 };
  const e = estadoTarjeta(pagada, [compra("2026-10-20", 259)], [pago("2026-10-26", 2000)], hoy);
  assert.deepEqual([e.alCorte, e.nuevas], [7591.40, 259]);
});

test("el monto de tu app del banco manda sobre la estimación", () => {
  const confirmada = { ...plata, saldo_al_corte: 9591.40, fecha_corte_saldo: "2026-10-15" };
  const e = estadoTarjeta(confirmada, [], [], hoy);
  assert.deepEqual([e.alCorte, e.nuevas, e.confirmado], [9591.40, 259, true]);
  // De un corte anterior ya no aplica
  assert.equal(estadoTarjeta({ ...confirmada, fecha_corte_saldo: "2026-09-15" }, [], [], hoy).confirmado, false);
});

test("lo que hay que pagar en Pagos es lo del corte, no el total", () => {
  const [p] = pagosDeTarjeta([plata], hoy, 31, { movimientos: [compra("2026-10-20", 259)], transferencias: [] });
  assert.deepEqual([p.vence, p.deuda, p.total, p.nuevas], ["2026-11-05", 9591.40, 9850.40, 259]);
});
