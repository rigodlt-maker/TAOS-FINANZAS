// Envíos a otras personas, préstamos y depósitos escritos en el chat
import assert from "node:assert/strict";
import { test } from "node:test";
import { responderAsesor } from "../lib/asesor";
import { repoMemoria } from "../lib/datos/memoria";
import { fechaFutura, leerCobro, leerDeposito, leerEnvio, registrarCobro, registrarEnvio, deshacerEnvio } from "../lib/envios";
import { leerGastoDeChat } from "../lib/gasto-chat";
import type { Cuenta } from "../lib/tipos";

const c = (id: string, nombre: string, tipo: Cuenta["tipo"], saldo: number): Cuenta => ({ id, nombre, tipo, saldo_actual: saldo, dia_corte: null, dia_limite_pago: null, es_ejemplo: false });
const cuentas = [c("efe", "EFECTIVO", "efectivo", 3200), c("rev", "Revolut", "ahorro", 0), c("tur", "Nu Cajita Turbo", "ahorro", 21500.40), c("aho", "Cajita Ahorro", "ahorro", 15200.50), c("nuc", "Nu crédito", "credito", -900)];
const hoy = "2026-10-28";

test("envíos a otras personas: gasto o préstamo, con cuenta y fecha de pago", () => {
  const casos: [string, string, number, string | null, boolean, string | null][] = [
    ["Le deposite $7300 a mi esposa desde Ahorro Plus", "Mi esposa", 7300, "aho", false, null],
    ["Mandé $5000 a María", "María", 5000, null, false, null],
    ["Le presté 5 mil a Juan, me paga el 15 de noviembre", "Juan", 5000, null, true, "2026-11-15"],
    ["transferí 2000 a Pedro con Revolut", "Pedro", 2000, "rev", false, null],
    ["envié 300 a mi hermano en efectivo, me lo regresa en 2 semanas", "Mi hermano", 300, "efe", true, "2026-11-11"],
  ];
  for (const [frase, persona, monto, cuenta, prestamo, fechaPago] of casos) {
    const e = leerEnvio(frase, cuentas, hoy);
    assert.ok(e, frase);
    assert.deepEqual([e.persona, e.monto, e.cuenta_id, e.prestamo, e.fecha_pago], [persona, monto, cuenta, prestamo, fechaPago], frase);
  }
  for (const f of ["Pagué $30 de tamales con efectivo", "moví 500 de revolut a efectivo", "¿cuánto le mandé a María?", "Agrega 7300 a cajita turbo"]) assert.equal(leerEnvio(f, cuentas, hoy), null, f);
  assert.equal(leerGastoDeChat("Le deposite $7300 a mi esposa desde Ahorro Plus", cuentas, [], [], hoy)?.tipo ?? "gasto", "gasto");
});

test("fechas en que te pagan", () => {
  assert.equal(fechaFutura("me paga el 15 de noviembre", hoy), "2026-11-15");
  assert.equal(fechaFutura("me paga el 3 de enero", hoy), "2027-01-03");
  assert.equal(fechaFutura("me lo regresa el 15/11", hoy), "2026-11-15");
  assert.equal(fechaFutura("en 10 dias", hoy), "2026-11-07");
  assert.equal(fechaFutura("a fin de mes", hoy), "2026-10-31");
  assert.equal(fechaFutura("el viernes", hoy), "2026-10-30");
});

test("depósito a una cuenta tuya: pregunta de dónde salió", () => {
  assert.equal(leerDeposito("Agrega 7300 a cajita turbo", cuentas, hoy)?.destino_id, "tur");
  assert.equal(leerDeposito("Deposite $7300 a cajita turbo", cuentas, hoy)?.monto, 7300);
  assert.equal(leerDeposito("¿cuánto tengo en cajita turbo?", cuentas, hoy), null);
});

test("préstamo de punta a punta: sale de la cuenta, te deben, te pagan en partes", async () => {
  (globalThis as { __almacenDemo?: unknown }).__almacenDemo = undefined;
  const repo = repoMemoria();
  const efectivo = (await repo.cuentas()).find((x) => x.tipo === "efectivo")!;
  const antes = efectivo.saldo_actual;
  const r = await registrarEnvio(repo, { persona: "Juan", monto: 500, cuenta_id: efectivo.id, fecha: hoy, prestamo: true, fecha_pago: "2026-11-15", nota: null });
  assert.match(r.calendario!, /calendar\.google\.com/);
  assert.equal((await repo.cuentas()).find((x) => x.id === efectivo.id)!.saldo_actual, antes - 500);
  const datos = { hoy, cuentas: await repo.cuentas(), categorias: [], movimientos: [], pagos: [], metas: [], aportaciones: [], prestamos: await repo.prestamos() };
  assert.match(responderAsesor("¿quién me debe?", datos), /Te deben \*\*\$500\.00\*\*[\s\S]*Juan/);
  assert.match(responderAsesor("hola", datos), /Te deben:\*\* \$500\.00/);
  const cobro = leerCobro("Juan me pagó 200", await repo.prestamos(), await repo.cuentas())!;
  assert.equal(cobro.monto, 200);
  assert.match(await registrarCobro(repo, cobro.prestamo_id, 200, efectivo.id), /todavía te debe \$300/i);
  assert.match(await registrarCobro(repo, cobro.prestamo_id, 300, efectivo.id), /ya te pagó todo/);
  assert.equal((await repo.cuentas()).find((x) => x.id === efectivo.id)!.saldo_actual, antes);
  // Deshacer un préstamo nuevo regresa el dinero
  const otro = await registrarEnvio(repo, { persona: "Ana", monto: 100, cuenta_id: efectivo.id, fecha: hoy, prestamo: true, fecha_pago: null, nota: null });
  await deshacerEnvio(repo, otro.id);
  assert.equal((await repo.cuentas()).find((x) => x.id === efectivo.id)!.saldo_actual, antes);
});
