// Gastos e ingresos escritos en el chat
import assert from "node:assert/strict";
import { test } from "node:test";
import { leerGastoDeChat, registrarGastoChat, deshacerGastoChat } from "../lib/gasto-chat";
import { repoMemoria } from "../lib/datos/memoria";
import { leerTransferencia } from "../lib/transferencias";
import type { Categoria, Cuenta } from "../lib/tipos";

const c = (id: string, nombre: string, tipo: Cuenta["tipo"], saldo: number): Cuenta => ({ id, nombre, tipo, saldo_actual: saldo, dia_corte: null, dia_limite_pago: null, es_ejemplo: false });
const cuentas = [c("efe", "EFECTIVO", "efectivo", 3000), c("rev", "Revolut", "ahorro", 25000), c("caj", "NU CAJITAS", "ahorro", 5000), c("nuc", "Nu crédito", "credito", -900), c("deb", "BBVA Débito", "debito", 8000)];
const cat = (id: string, nombre: string): Categoria => ({ id, nombre, presupuesto_mensual: 0, color_neutro: "" });
const categorias = [cat("com", "Comida fuera"), cat("sup", "Súper y despensa"), cat("tra", "Transporte"), cat("mas", "Mascotas"), cat("ser", "Servicios")];
const leer = (f: string) => leerGastoDeChat(f, cuentas, categorias, [], "2026-10-27");

test("entiende gastos e ingresos en frases normales", () => {
  const casos: [string, string, number, string | null, string | null][] = [
    ["Pague $30 de tamales con efectivo", "gasto", 30, "efe", "com"],
    ["gasté 150 en uber con nu", "gasto", 150, "nuc", "tra"],
    ["compré croquetas para el perro 450 con débito", "gasto", 450, "deb", "mas"],
    ["350 súper con débito", "gasto", 350, "deb", "sup"],
    ["ayer pagué 699 de luz con bbva", "gasto", 699, "deb", "ser"],
    ["me pagaron 5 mil en revolut", "ingreso", 5000, "rev", null],
    ["vendí 3 tarjetas taos por 900 en efectivo", "ingreso", 900, "efe", null],
    ["gaste 80 en esquites", "gasto", 80, null, "com"],
  ];
  for (const [frase, tipo, monto, cuenta, categoria] of casos) {
    const g = leer(frase);
    assert.ok(g, frase);
    assert.deepEqual([g.tipo, g.monto, g.account_id, g.category_id], [tipo, monto, cuenta, categoria], frase);
  }
  assert.equal(leer("ayer pagué 699 de luz con bbva")!.fecha, "2026-10-26");
});

test("las preguntas y los planes no se registran", () => {
  for (const f of ["¿cuánto gasté en tamales?", "cuanto pague de luz", "voy a comprar algo de 3000", "quiero gastar 500", "con que tarjeta pago 2000", "cuanto dinero tengo"]) assert.equal(leer(f), null, f);
});

test("los pagos entre tus cuentas siguen siendo transferencias", () => {
  assert.ok(leerTransferencia("Pagué Nu con Revolut", cuentas, "2026-10-27"));
});

test("registrar baja el efectivo y deshacer lo regresa", async () => {
  (globalThis as { __almacenDemo?: unknown }).__almacenDemo = undefined;
  const repo = repoMemoria();
  const efectivo = (await repo.cuentas()).find((x) => x.tipo === "efectivo")!;
  const antes = efectivo.saldo_actual;
  const r = await registrarGastoChat(repo, { tipo: "gasto", monto: 30, comercio: "Tamales", fecha: "2026-10-27", account_id: efectivo.id, category_id: null });
  assert.match(r.mensaje, /queda en/);
  assert.equal((await repo.cuentas()).find((x) => x.id === efectivo.id)!.saldo_actual, antes - 30);
  await deshacerGastoChat(repo, r.id);
  assert.equal((await repo.cuentas()).find((x) => x.id === efectivo.id)!.saldo_actual, antes);
});
