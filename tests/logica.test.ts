import { test } from "node:test";
import assert from "node:assert/strict";
import { convertirFilas, detectarColumnas, extraerComercio, hashUnico, leerFecha, leerMonto, separarEncabezados } from "../lib/importar";
import { interpretarCaptura } from "../lib/captura";
import { categorizarConReglas, patronParaRegla } from "../lib/categorizar";
import { detectarRecurrentes } from "../lib/recurrentes";
import { porcentajeDelMes, resumenPorCategoria } from "../lib/presupuesto";
import { analizarMeta } from "../lib/metas";
import { actualizarVencimiento, alertasDePago, eventosDelMes, siguienteVencimiento } from "../lib/pagos";
import type { Categoria, Cuenta, Movimiento } from "../lib/tipos";

test("leerMonto entiende formatos mexicanos y bancarios", () => {
  assert.equal(leerMonto("1,234.56"), 1234.56);
  assert.equal(leerMonto("-$1,234.56"), -1234.56);
  assert.equal(leerMonto("(350.00)"), -350);
  assert.equal(leerMonto("1.234,56"), 1234.56);
  assert.equal(leerMonto("$ 350"), 350);
  assert.equal(leerMonto("abc"), null);
  assert.equal(leerMonto(""), null);
});

test("leerFecha entiende varios formatos", () => {
  assert.equal(leerFecha("15/10/2026"), "2026-10-15");
  assert.equal(leerFecha("15-10-26"), "2026-10-15");
  assert.equal(leerFecha("2026-10-15"), "2026-10-15");
  assert.equal(leerFecha("15 OCT 2026"), "2026-10-15");
  assert.equal(leerFecha("15/oct/26"), "2026-10-15");
  assert.equal(leerFecha(46310), "2026-10-15"); // número de serie de Excel
  assert.equal(leerFecha("31/02/2026"), null);
});

test("detecta columnas con encabezados de banco (cargo/abono)", () => {
  const tabla = separarEncabezados([
    ["Estado de cuenta BBVA"],
    ["Fecha Operación", "Concepto", "Cargo", "Abono", "Saldo"],
    ["01/10/2026", "COMPRA OXXO 1234 REF 99", "45.50", "", "1000"],
    ["02/10/2026", "SPEI RECIBIDO NOMINA", "", "8,000.00", "9000"],
  ]);
  const mapeo = detectarColumnas(tabla);
  assert.equal(mapeo.fecha, 0);
  assert.equal(mapeo.descripcion, 1);
  assert.equal(mapeo.cargo, 2);
  assert.equal(mapeo.abono, 3);
  const filas = convertirFilas(tabla, mapeo);
  assert.deepEqual(
    filas.map((f) => (f.ok ? [f.movimiento.tipo, f.movimiento.monto] : null)),
    [["gasto", 45.5], ["ingreso", 8000]],
  );
});

test("detecta columnas sin encabezados por su contenido", () => {
  const tabla = separarEncabezados([
    ["2026-10-01", "Walmart Centro", "-650.20"],
    ["2026-10-03", "Pago nómina", "9000"],
    ["2026-10-04", "Netflix", "-219"],
  ]);
  const mapeo = detectarColumnas(tabla);
  assert.equal(mapeo.fecha, 0);
  assert.equal(mapeo.descripcion, 1);
  assert.equal(mapeo.monto, 2);
  const filas = convertirFilas(tabla, mapeo);
  assert.equal(filas.filter((f) => f.ok && f.movimiento.tipo === "gasto").length, 2);
});

test("extraerComercio limpia referencias", () => {
  assert.equal(extraerComercio("COMPRA OXXO 1234 REF 99"), "Oxxo");
  assert.equal(extraerComercio("PAGO TDC*NETFLIX.COM 55123"), "Netflix.com");
});

test("hashUnico es igual para el mismo movimiento aunque cambien acentos o espacios", async () => {
  const a = await hashUnico({ fecha: "2026-10-01", monto: 50, tipo: "gasto", descripcion_original: "Café  Centro" });
  const b = await hashUnico({ fecha: "2026-10-01", monto: 50, tipo: "gasto", descripcion_original: "cafe centro" });
  const c = await hashUnico({ fecha: "2026-10-02", monto: 50, tipo: "gasto", descripcion_original: "cafe centro" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

const cuentas: Cuenta[] = [
  { id: "deb", nombre: "BBVA", tipo: "debito", dia_corte: null, dia_limite_pago: null, saldo_actual: 5000, es_ejemplo: false },
  { id: "tdc", nombre: "Nu", tipo: "credito", dia_corte: 5, dia_limite_pago: 25, saldo_actual: -3000, es_ejemplo: false },
  { id: "efe", nombre: "Cartera", tipo: "efectivo", dia_corte: null, dia_limite_pago: null, saldo_actual: 800, es_ejemplo: false },
];

test("captura rápida en una línea", () => {
  const hoy = "2026-10-22"; // jueves
  assert.deepEqual(interpretarCaptura("350 súper con débito", cuentas, hoy), {
    monto: 350, tipo: "gasto", comercio: "Super", fecha: hoy, account_id: "deb",
  });
  const b = interpretarCaptura("ayer 1,200 gasolina con tdc", cuentas, hoy)!;
  assert.equal(b.monto, 1200);
  assert.equal(b.fecha, "2026-10-21");
  assert.equal(b.account_id, "tdc");
  assert.equal(b.comercio, "Gasolina");
  const c = interpretarCaptura("cobré 8000 de la quincena", cuentas, hoy)!;
  assert.equal(c.tipo, "ingreso");
  const d = interpretarCaptura("el lunes 90 tacos en efectivo", cuentas, hoy)!;
  assert.equal(d.fecha, "2026-10-19");
  assert.equal(d.account_id, "efe");
  assert.equal(d.comercio, "Tacos");
  assert.equal(interpretarCaptura("2.5k azulejo Nu", cuentas, hoy)!.monto, 2500);
  assert.equal(interpretarCaptura("2.5k azulejo Nu", cuentas, hoy)!.account_id, "tdc");
  assert.equal(interpretarCaptura("sin número", cuentas, hoy), null);
});

const categorias: Categoria[] = [
  { id: "super", nombre: "Súper y despensa", presupuesto_mensual: 4000, color_neutro: "#000" },
  { id: "transp", nombre: "Transporte", presupuesto_mensual: 2000, color_neutro: "#000" },
  { id: "casa", nombre: "Casa y remodelación", presupuesto_mensual: 0, color_neutro: "#000" },
];

test("categorizar: reglas propias primero, luego comercios conocidos", () => {
  const reglas = [{ id: "r", patron_texto: "oxxo gas", category_id: "transp" }, { id: "r2", patron_texto: "oxxo", category_id: "super" }];
  assert.equal(categorizarConReglas("OXXO GAS 123", reglas, categorias)?.category_id, "transp");
  assert.equal(categorizarConReglas("OXXO CENTRO", reglas, categorias)?.category_id, "super");
  assert.equal(categorizarConReglas("PEMEX CENTRO", [], categorias)?.category_id, "transp");
  assert.equal(categorizarConReglas("Home Depot", [], categorias)?.category_id, "casa");
  assert.equal(categorizarConReglas("XYZ desconocido", [], categorias), null);
  assert.equal(patronParaRegla("Tienda Don Pepe", "COMPRA TIENDA DON PEPE 123"), "tienda don pepe");
});

const mov = (id: string, fecha: string, monto: number, extra: Partial<Movimiento> = {}): Movimiento => ({
  id, account_id: "deb", fecha, descripcion_original: "x", comercio: "x", monto, tipo: "gasto",
  category_id: null, requiere_revision: false, es_recurrente: false, hash_unico: id, import_id: null, ...extra,
});

test("recurrentes: mismo comercio con monto parecido en 2 meses", () => {
  const r = detectarRecurrentes([
    mov("a", "2026-08-05", 219, { comercio: "Netflix" }),
    mov("b", "2026-09-05", 219, { comercio: "Netflix" }),
    mov("c", "2026-09-10", 1500, { comercio: "Walmart" }),
    mov("d", "2026-10-10", 600, { comercio: "Walmart" }),
  ]);
  assert.deepEqual([...r].sort(), ["a", "b"]);
});

test("presupuesto: ritmo, estado y orden por exceso", () => {
  const hoy = "2026-10-10"; // ~32% del mes
  assert.ok(Math.abs(porcentajeDelMes("2026-10", hoy) - 32.26) < 0.1);
  const movs = [
    mov("1", "2026-10-02", 2500, { category_id: "super" }), // 62% gastado → en riesgo
    mov("2", "2026-10-03", 2100, { category_id: "transp" }), // 105% → excedido
    mov("3", "2026-09-30", 999, { category_id: "super" }), // otro mes, no cuenta
  ];
  const r = resumenPorCategoria("2026-10", hoy, categorias, movs);
  assert.deepEqual(r.map((x) => [x.categoria.id, x.estado]), [["transp", "excedido"], ["super", "en_riesgo"], ["casa", "sin_presupuesto"]]);
  assert.equal(r[1].gastado, 2500);
  assert.ok(Math.abs(r[1].proyeccion - 7750) < 1);
});

test("metas: cuánto ahorrar y si se llega a tiempo", () => {
  const meta = { id: "m", nombre: "Remodelación", monto_objetivo: 60000, monto_actual: 12000, fecha_objetivo: "2027-10-22", es_ejemplo: false };
  const aportes = [
    { id: "1", goal_id: "m", fecha: "2026-08-30", monto: 3000 },
    { id: "2", goal_id: "m", fecha: "2026-09-30", monto: 3000 },
    { id: "3", goal_id: "m", fecha: "2026-10-15", monto: 3000 },
  ];
  const a = analizarMeta(meta, aportes, "2026-10-22");
  assert.equal(a.falta, 48000);
  assert.equal(a.porcentaje, 20);
  assert.ok(Math.abs(a.porMes - 4000) < 20);
  assert.equal(a.ritmoMensual, 3000);
  assert.equal(a.llegaATiempo, false);
  assert.equal(a.mesesDeRetraso, 5); // 16 meses al ritmo actual contra 12 disponibles
  const sinRitmo = analizarMeta(meta, [], "2026-10-22");
  assert.equal(sinRitmo.mesesDeRetraso, null);
});

test("pagos: vencimientos, alertas a 7 y 2 días, calendario", () => {
  assert.equal(siguienteVencimiento("2026-01-31", "mensual"), "2026-02-28");
  assert.equal(siguienteVencimiento("2026-02-28", "mensual", 31), "2026-03-31");
  assert.equal(siguienteVencimiento("2026-05-10", "anual"), "2027-05-10");
  const pago = { id: "p", nombre: "Renta", monto: 4000, frecuencia: "mensual" as const, proximo_vencimiento: "2026-08-29", account_id: "deb", es_ejemplo: false };
  assert.equal(actualizarVencimiento(pago, "2026-10-22"), "2026-10-29");
  const alertas = alertasDePago([pago], cuentas, "2026-10-22");
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].dias, 7);
  assert.equal(alertas[0].alcanza, true);
  assert.equal(alertasDePago([pago], cuentas, "2026-10-23").length, 0);
  const eventos = eventosDelMes("2026-11", [pago], cuentas);
  assert.deepEqual(eventos.map((e) => [e.fecha, e.tipo]), [["2026-11-05", "corte"], ["2026-11-25", "limite"], ["2026-11-29", "pago"]]);
});

test("captura rápida con fecha escrita", () => {
  const r = interpretarCaptura("15/10 450.50 farmacia débito", cuentas, "2026-10-22")!;
  assert.equal(r.fecha, "2026-10-15");
  assert.equal(r.monto, 450.5);
  assert.equal(r.comercio, "Farmacia");
});

test("correo permitido: Gmail ignora puntos, mayúsculas, comillas y +etiquetas", async () => {
  const { correoPermitido } = await import("../lib/supabase/config");
  process.env.ALLOWED_EMAIL = ' "Ana.Lopez@gmail.com" ';
  assert.equal(correoPermitido("analopez@gmail.com"), true);
  assert.equal(correoPermitido("ana.lopez+app@googlemail.com"), true);
  assert.equal(correoPermitido("otro@gmail.com"), false);
  assert.equal(correoPermitido(null), false);
  process.env.ALLOWED_EMAIL = "";
  assert.equal(correoPermitido("analopez@gmail.com"), false);
});

test("tarjetas: próxima fecha límite y alertas a 7 y 2 días", async () => {
  const { proximoLimiteTarjeta, alertasDeTarjeta, pagosDeTarjeta } = await import("../lib/pagos");
  const nu = cuentas.find((c) => c.id === "tdc")!; // corte 5, límite 25, debe 3000
  assert.equal(proximoLimiteTarjeta(nu, "2026-10-22"), "2026-10-25");
  assert.equal(proximoLimiteTarjeta(nu, "2026-10-26"), "2026-11-25");
  assert.equal(proximoLimiteTarjeta(nu, "2026-12-30"), "2027-01-25");
  assert.equal(proximoLimiteTarjeta(cuentas[0], "2026-10-22"), null); // débito
  assert.deepEqual(alertasDeTarjeta(cuentas, "2026-10-18").map((p) => [p.cuenta.id, p.dias, p.deuda]), [["tdc", 7, 3000]]);
  assert.equal(alertasDeTarjeta(cuentas, "2026-10-23").length, 1); // 2 días
  assert.equal(alertasDeTarjeta(cuentas, "2026-10-20").length, 0);
  assert.equal(pagosDeTarjeta(cuentas, "2026-10-22").length, 1);
});
