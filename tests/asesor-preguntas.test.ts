// Batería de preguntas reales, escritas de muchas formas: cada una debe recibir el tipo de respuesta correcto
import assert from "node:assert/strict";
import { test } from "node:test";
import { responderAsesor, type DatosAsesor } from "../lib/asesor";
import type { Cuenta, Movimiento } from "../lib/tipos";

const cuenta = (id: string, nombre: string, tipo: Cuenta["tipo"], saldo: number, corte: number | null = null, limite: number | null = null): Cuenta => ({
  id, nombre, tipo, saldo_actual: saldo, dia_corte: corte, dia_limite_pago: limite, es_ejemplo: false,
});
let n = 0;
const mov = (fecha: string, monto: number, category_id: string | null, comercio: string, account_id = "deb", tipo: "gasto" | "ingreso" = "gasto", revisar = false): Movimiento => ({
  id: `m${n++}`, account_id, fecha, descripcion_original: comercio, comercio, monto, tipo, category_id,
  requiere_revision: revisar, es_recurrente: false, hash_unico: `h${n}`, import_id: null,
});

const datos: DatosAsesor = {
  hoy: "2026-10-27",
  cuentas: [
    cuenta("deb", "BBVA Débito", "debito", 8000),
    cuenta("rev", "Revolut", "ahorro", 25170.31),
    cuenta("caj", "NU CAJITAS", "ahorro", 5000),
    cuenta("efe", "EFECTIVO", "efectivo", 3000),
    cuenta("amex", "Amex", "credito", -21416, 16, 5),
    cuenta("aero", "Amex Aeroméxico", "credito", -3500, 20, 9),
    cuenta("nu", "Nu crédito", "credito", -928.71, 8, 18),
    cuenta("ph", "Palacio de Hierro", "credito", -15497.87, 10, 10),
    cuenta("hsbc", "HSBC Viva", "credito", -4310.5, 20, 9),
  ],
  categorias: [
    { id: "sup", nombre: "Súper y despensa", presupuesto_mensual: 4000, color_neutro: "" },
    { id: "com", nombre: "Comida fuera", presupuesto_mensual: 1500, color_neutro: "" },
    { id: "tra", nombre: "Transporte", presupuesto_mensual: 1600, color_neutro: "" },
    { id: "ser", nombre: "Servicios", presupuesto_mensual: 1200, color_neutro: "" },
    { id: "sal", nombre: "Salud", presupuesto_mensual: 1500, color_neutro: "" },
    { id: "mas", nombre: "Mascotas", presupuesto_mensual: 800, color_neutro: "" },
    { id: "ent", nombre: "Entretenimiento", presupuesto_mensual: 600, color_neutro: "" },
  ],
  movimientos: [
    mov("2026-10-03", 1500, "sup", "Walmart"),
    mov("2026-10-10", 900, "com", "Tacos El Güero", "nu"),
    mov("2026-10-12", 400, "tra", "Pemex", "amex"),
    mov("2026-10-20", 300, "sup", "Oxxo"),
    mov("2026-10-26", 85, "com", "Starbucks", "nu"),
    mov("2026-10-26", 120, "sup", "Oxxo", "efe"),
    mov("2026-10-27", 640, "mas", "Veterinaria San Roque", "amex"),
    mov("2026-09-12", 199, "ent", "Netflix", "amex"),
    mov("2026-10-12", 199, "ent", "Netflix", "amex"),
    mov("2026-08-12", 199, "ent", "Netflix", "amex"),
    mov("2026-09-20", 2500, "com", "Restaurante La Fonda", "amex"),
    mov("2026-09-05", 1300, "sup", "Walmart"),
    mov("2026-09-15", 260, "sup", "Oxxo"),
    mov("2026-09-18", 698, "ser", "CFE"),
    mov("2026-10-18", 3100, "sal", "Immunotec", "ph"),
    mov("2026-10-22", 210, null, "ODM Centro", "deb", "gasto", true),
    mov("2026-10-01", 9000, null, "Venta tarjetas TAOS", "deb", "ingreso"),
    mov("2026-10-15", 12000, null, "Nómina", "deb", "ingreso"),
  ],
  pagos: [],
  metas: [],
  aportaciones: [],
};

const R = {
  saldos: /Tienes \*\*.+\*\* en tus cuentas/,
  deudas: /Debes \*\*.+\*\* en \d tarjetas/,
  pagar: /La que tienes que pagar primero/,
  cuenta: /Para no generar intereses|para dejarla en ceros|En \*\*.+\*\* tienes \*\*/,
  enQue: /Donde más se te va/,
  filtro: /llevas \*\*/,
  ultimos: /Tus (últimos )?movimientos/,
  mayores: /compras más grandes/,
  comparar: /el mes pasado llevabas/,
  presupuesto: /Te quedan \*\*|te pasaste del presupuesto/,
  ingresos: /te entraron/,
  metas: /metas de ahorro/,
  suscripciones: /se repiten cada mes/,
  revisar: /por revisar\*\*/,
  resumen: /Así vas hoy/,
  proyeccion: /A este ritmo/,
  ahorrar: /Ideas para ahorrar/,
  tarjetas: /tarjetas de crédito:/,
  recomendar: /\*\*Usa tu /,
  inversion: /No doy recomendaciones de inversión/,
  ayuda: /Puedo contestarte/,
  gracias: /Con gusto/,
};

const PREGUNTAS: [string, RegExp][] = [
  // Dinero en cuentas
  ["cuanto dinero tengo en mis cuentas?", R.saldos],
  ["¿Cuánto dinero tengo?", R.saldos],
  ["cuanto tengo", R.saldos],
  ["mis saldos", R.saldos],
  ["dame mis saldos", R.saldos],
  ["cuánto dinero tengo disponible", R.saldos],
  ["cuanto dinero libre me queda?", R.saldos],
  ["¿cuánto hay en mis cuentas?", R.saldos],
  ["cuanto traigo en total", R.saldos],
  ["balance de mis cuentas", R.saldos],
  ["¿Cuánto tengo y cuánto debo?", R.saldos],
  // Una cuenta
  ["cuanto le debo a la hsbc?", R.cuenta],
  ["¿Cuánto me falta para liquidar la tarjeta HSBC viva?", R.cuenta],
  ["cuánto tengo en revolut", R.cuenta],
  ["saldo de nu cajitas", R.cuenta],
  ["cuanto efectivo tengo?", R.cuenta],
  ["cuando vence palacio", R.cuenta],
  ["cuánto debo de amex", R.cuenta],
  ["y la de palacio de hierro?", R.cuenta],
  ["revolut", R.cuenta],
  // Deudas
  ["¿cuánto debo en tarjetas?", R.deudas],
  ["cuanto debo", R.deudas],
  ["cuál es mi deuda total", R.deudas],
  ["cuanto le debo a mis tarjetas", R.deudas],
  ["estoy muy endeudado?", R.deudas],
  // Qué pagar
  ["¿Qué tarjeta debo pagar pronto?", R.pagar],
  ["que tengo que pagar", R.pagar],
  ["cuándo es mi próximo pago", R.pagar],
  ["qué vence esta semana", R.pagar],
  ["que me toca pagar", R.pagar],
  ["fechas límite de pago", R.pagar],
  // Tarjetas
  ["cuales son mis tarjetas", R.tarjetas],
  ["fechas de corte", R.tarjetas],
  ["que tarjetas tengo", R.tarjetas],
  // Recomendar
  ["Voy a comprar algo de $3,000, ¿qué tarjeta uso?", R.recomendar],
  ["con que tarjeta compro una tele de 12 mil", R.recomendar],
  ["que tarjeta me conviene usar hoy", R.recomendar],
  ["quiero comprar unos tenis", R.recomendar],
  ["con cual pago la cena de hoy?", R.recomendar],
  ["me recomiendas alguna tarjeta para comprar", R.recomendar],
  // En qué gasto
  ["¿En qué gasto más?", R.enQue],
  ["en que se me va el dinero", R.enQue],
  ["donde gasto mas", R.enQue],
  ["en qué gasté el mes pasado", R.enQue],
  ["cuál es mi mayor gasto", R.mayores],
  ["gastos por categoria", R.enQue],
  ["cuanto he gastado este mes", R.enQue],
  ["cuanto gaste", R.enQue],
  ["cuánto llevo gastado", R.enQue],
  // Gasto filtrado
  ["¿Cuánto gasté en comida fuera el mes pasado?", R.filtro],
  ["cuanto gaste en comida", R.filtro],
  ["cuánto llevo en el súper", R.filtro],
  ["cuanto gaste en oxxo", R.filtro],
  ["cuanto he gastado en starbucks", R.filtro],
  ["cuanto gasté con amex este mes", R.filtro],
  ["gastos con nu", R.filtro],
  ["cuanto en gasolina", R.filtro],
  ["cuanto gasto en mi perro", R.filtro],
  ["cuanto he pagado de netflix", R.filtro],
  ["cuanto gaste en tacos", R.filtro],
  ["walmart", R.filtro],
  ["cuanto me costo el veterinario", R.filtro],
  // Últimos
  ["mis últimos gastos", R.ultimos],
  ["cuales fueron mis ultimos movimientos", R.ultimos],
  ["¿qué compré ayer?", R.ultimos],
  ["que gaste hoy", R.ultimos],
  ["movimientos de la semana", R.ultimos],
  ["historial de compras", R.ultimos],
  ["ultimos movimientos de amex", R.ultimos],
  ["mis compras recientes", R.ultimos],
  // Mayores
  ["cuál fue mi compra más cara", R.mayores],
  ["mis gastos más grandes del mes", R.mayores],
  ["compras grandes de septiembre", R.mayores],
  // Comparar
  ["¿gasto más que el mes pasado?", R.comparar],
  ["compara este mes con el anterior", R.comparar],
  ["voy mejor o peor que el mes pasado", R.comparar],
  // Presupuesto
  ["¿Cuánto me queda de presupuesto?", R.presupuesto],
  ["cuanto puedo gastar", R.presupuesto],
  ["me alcanza para lo que resta del mes", R.presupuesto],
  ["como voy con mi presupuesto", R.presupuesto],
  ["ya me pase del presupuesto?", R.presupuesto],
  // Ingresos
  ["cuánto me entró este mes", R.ingresos],
  ["cuanto gane", R.ingresos],
  ["mis ingresos", R.ingresos],
  ["cuanto vendi de tarjetas taos", R.ingresos],
  // Metas
  ["¿Cómo voy con mis metas?", R.metas],
  ["mis metas de ahorro", R.metas],
  // Suscripciones
  ["¿Qué suscripciones pago?", R.suscripciones],
  ["cuales son mis cargos fijos", R.suscripciones],
  ["que me cobran cada mes", R.suscripciones],
  ["gastos fijos", R.suscripciones],
  // Por revisar
  ["que tengo por revisar", R.revisar],
  ["movimientos sin categoria", R.revisar],
  // Resumen
  ["hola", R.resumen],
  ["buenos dias", R.resumen],
  ["como voy", R.resumen],
  ["dame un resumen", R.resumen],
  ["como estan mis finanzas", R.resumen],
  ["qué tal voy este mes", R.resumen],
  // Proyección
  ["a este ritmo cuanto voy a gastar", R.proyeccion],
  ["como cerraré el mes", R.proyeccion],
  // Ahorro
  ["¿cómo puedo ahorrar más?", R.ahorrar],
  ["dame consejos para gastar menos", R.ahorrar],
  ["en que puedo recortar", R.ahorrar],
  // Otros
  ["debería invertir en cetes?", R.inversion],
  ["¿qué puedes hacer?", R.ayuda],
  ["ayuda", R.ayuda],
  ["gracias!", R.gracias],
];

for (const [pregunta, esperado] of PREGUNTAS) {
  test(`entiende: "${pregunta}"`, () => {
    const r = responderAsesor(pregunta, datos);
    assert.match(r, esperado, `Respuesta:\n${r}`);
  });
}

test("ninguna pregunta se queda sin datos", () => {
  for (const q of ["asdf", "y eso?", "no entiendo nada", "platícame"]) {
    const r = responderAsesor(q, datos);
    assert.match(r, /Así vas hoy/, q);
  }
});
