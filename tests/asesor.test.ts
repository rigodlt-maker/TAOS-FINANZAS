import assert from "node:assert/strict";
import { test } from "node:test";
import { montoDe, periodoDe, plazoDeCompra, responderAsesor, type DatosAsesor } from "../lib/asesor";
import type { Cuenta, Movimiento } from "../lib/tipos";

const cuenta = (id: string, nombre: string, tipo: Cuenta["tipo"], saldo: number, corte: number | null = null, limite: number | null = null): Cuenta => ({
  id, nombre, tipo, saldo_actual: saldo, dia_corte: corte, dia_limite_pago: limite, es_ejemplo: false,
});
let n = 0;
const mov = (fecha: string, monto: number, category_id: string | null, comercio: string, tipo: "gasto" | "ingreso" = "gasto"): Movimiento => ({
  id: `m${n++}`, account_id: "deb", fecha, descripcion_original: comercio, comercio, monto, tipo, category_id,
  requiere_revision: false, es_recurrente: false, hash_unico: `h${n}`, import_id: null,
});

const datos: DatosAsesor = {
  hoy: "2026-10-27",
  cuentas: [
    cuenta("deb", "BBVA Débito", "debito", 8000),
    cuenta("amex", "Amex", "credito", -21416, 16, 5),
    cuenta("plata", "Plata", "credito", -12079, 15, 15),
    cuenta("nu", "Nu crédito", "credito", -928, 8, 18),
    cuenta("ph", "Palacio de Hierro", "credito", -15497, 10, 10),
    cuenta("hsbc", "HSBC Viva", "credito", -4310.5, 20, 9),
    cuenta("rev", "Revolut", "ahorro", 25170.31),
  ],
  categorias: [
    { id: "sup", nombre: "Súper", presupuesto_mensual: 2000, color_neutro: "" },
    { id: "com", nombre: "Comida fuera", presupuesto_mensual: 700, color_neutro: "" },
    { id: "tra", nombre: "Transporte", presupuesto_mensual: 1600, color_neutro: "" },
  ],
  movimientos: [
    mov("2026-10-03", 1500, "sup", "Walmart"),
    mov("2026-10-10", 900, "com", "Tacos El Güero"),
    mov("2026-10-12", 400, "tra", "Pemex"),
    mov("2026-10-20", 300, "sup", "Oxxo"),
    mov("2026-09-12", 199, "sup", "Netflix"),
    mov("2026-10-12", 199, "sup", "Netflix"),
    mov("2026-09-20", 2500, "com", "Restaurante"),
    mov("2026-10-01", 9000, null, "Venta tarjetas TAOS", "ingreso"),
  ],
  pagos: [],
  metas: [],
  aportaciones: [],
};

test("lee montos y periodos de la pregunta", () => {
  assert.equal(montoDe("voy a comprar algo de $3,000"), 3000);
  assert.equal(montoDe("una tele de 12 mil"), 12000);
  assert.equal(periodoDe("cuanto gaste el mes pasado", "2026-10-27").inicio, "2026-09-01");
  assert.equal(periodoDe("en agosto", "2026-10-27").inicio, "2026-08-01");
});

test("plazo de una compra de hoy según corte y límite", () => {
  // Amex corta el 16 y se paga el 5: compra del 27 oct → corte 16 nov → paga 5 dic
  assert.deepEqual(plazoDeCompra(datos.cuentas[1], "2026-10-27"), { corte: "2026-11-16", limite: "2026-12-05", dias: 39 });
  // Nu corta el 8 y se paga el 18 del mismo mes
  assert.equal(plazoDeCompra(datos.cuentas[3], "2026-10-27")?.limite, "2026-11-18");
});

test("recomienda la tarjeta con más días para pagar", () => {
  const r = responderAsesor("Voy a comprar algo de $3,000, ¿qué tarjeta uso?", datos);
  // Plata corta el 15 y se paga el 15 del mes siguiente: 49 días
  assert.match(r, /^\*\*Usa tu Plata\.\*\*/);
  assert.match(r, /49 días/);
  assert.match(r, /\$3,000/);
});

test("dice en qué gastas más", () => {
  const r = responderAsesor("¿En qué gasto más?", datos);
  assert.match(r, /Súper/);
  assert.match(r, /\$3,299/);
});

test("cuánto gastaste en una categoría o comercio", () => {
  assert.match(responderAsesor("¿Cuánto gasté en comida fuera el mes pasado?", datos), /\$2,500/);
  assert.match(responderAsesor("cuanto gaste en oxxo", datos), /\$300/);
});

test("qué tarjeta pagar primero", () => {
  const r = responderAsesor("¿Qué tarjeta debo pagar pronto?", datos);
  assert.match(r, /primero es tu \*\*Amex\*\*/); // vence el 5 de noviembre
});

test("presupuesto, saldos, suscripciones e inversión", () => {
  assert.match(responderAsesor("¿Cuánto me queda de presupuesto?", datos), /Te quedan|te pasaste/);
  assert.match(responderAsesor("¿cuánto tengo y cuánto debo?", datos), /\$8,000/);
  assert.match(responderAsesor("¿qué suscripciones pago?", datos), /Netflix/);
  assert.match(responderAsesor("¿en qué acciones invierto?", datos), /No doy recomendaciones de inversión/);
  assert.match(responderAsesor("hola", datos), /Así vas hoy/);
});

test("pregunta por una cuenta en particular", () => {
  for (const q of ["cuanto le debo a la hsbc?", "¿Cuánto me falta para liquidar la tarjeta HSBC viva?"]) {
    const r = responderAsesor(q, datos);
    assert.match(r, /HSBC Viva/);
    assert.match(r, /\$4,310\.50/);
    assert.match(r, /\/pagar\/hsbc/);
    assert.match(r, /9 de nov/i);
  }
  assert.match(responderAsesor("¿cuánto tengo en Revolut?", datos), /Revolut\*\* tienes \*\*\$25,170\.31/);
  // Sin cuenta: resumen general
  assert.match(responderAsesor("¿Cuánto le debo a mis tarjetas?", datos), /debes/i);
  // La recomendación de tarjeta sigue funcionando
  assert.doesNotMatch(responderAsesor("Voy a comprar algo de 3 mil, ¿qué tarjeta uso?", datos), /Para liquidar/);
});
