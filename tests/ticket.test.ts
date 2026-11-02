// Tickets inventados (como los lee el OCR, con ruido) → gasto propuesto
import assert from "node:assert/strict";
import { test } from "node:test";
import { cuentaDelTicket, leerTicket } from "../lib/ticket";
import type { Cuenta } from "../lib/tipos";

const HOY = "2026-11-02";
const cuenta = (id: string, tipo: Cuenta["tipo"], terminacion?: string): Cuenta =>
  ({ id, nombre: id, tipo, dia_corte: null, dia_limite_pago: null, saldo_actual: 0, es_ejemplo: false, terminacion }) as Cuenta;
const CUENTAS = [cuenta("Débito", "debito", "4321"), cuenta("Crédito", "credito", "9876"), cuenta("Efectivo", "efectivo")];

test("súper con tarjeta: total (no subtotal), fecha, comercio y terminación", () => {
  const t = leerTicket(
    `SUPERMERCADO LA ESQUINA
R.F.C. XAXX010101000
AV. SIEMPRE VIVA 123 COL. CENTRO
FECHA: 28/10/2026 18:42
LECHE 1L        27.50
PAN             45.00
SUBTOTAL       62.50
IVA             10.00
TOTAL $       1,072.50
VISA ************9876
GRACIAS POR SU COMPRA`,
    HOY,
  );
  assert.equal(t.total, 1072.5);
  assert.equal(t.fecha, "2026-10-28");
  assert.equal(t.comercio, "SUPERMERCADO LA ESQUINA");
  assert.equal(t.terminacion, "9876");
  assert.equal(cuentaDelTicket(t, CUENTAS)?.id, "Crédito");
});

test("tienda en efectivo y fecha con mes en letras", () => {
  const t = leerTicket(`Ticket #123\nCAFE DEL BARRIO\n1 NOV 2026\nCAPUCHINO 55.00\nTOTAL 55.00\nEFECTIVO 100.00\nCAMBIO 45.00`, HOY);
  assert.equal(t.total, 55);
  assert.equal(t.fecha, "2026-11-01");
  assert.equal(t.comercio, "CAFE DEL BARRIO");
  assert.equal(t.efectivo, true);
  assert.equal(cuentaDelTicket(t, CUENTAS)?.id, "Efectivo");
});

test("terminación con 'TERMINACION' y tarjeta que no está registrada", () => {
  const t = leerTicket(`FARMACIA SALUD\nIMPORTE A PAGAR 230,00\nTERMINACION: 1111\n05-10-26`, HOY);
  assert.equal(t.total, 230);
  assert.equal(t.terminacion, "1111");
  assert.equal(t.fecha, "2026-10-05");
  assert.equal(cuentaDelTicket(t, CUENTAS), null);
});

test("sin palabra TOTAL usa el monto más grande; fechas futuras se ignoran", () => {
  const t = leerTicket(`TACOS EL GÜERO\n3 TACOS 60.00\n1 REFRESCO 25.00\n85.00\n15/12/2026`, HOY);
  assert.equal(t.total, 85);
  assert.equal(t.fecha, null);
});
