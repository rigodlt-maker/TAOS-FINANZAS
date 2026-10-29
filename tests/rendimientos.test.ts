// Rendimiento diario de las cajitas, con interés compuesto y tope
import assert from "node:assert/strict";
import { test } from "node:test";
import { repoMemoria } from "../lib/datos/memoria";
import { aplicarRendimientos, interesDelDia, proyectar } from "../lib/rendimientos";
import type { Cuenta } from "../lib/tipos";

const turbo: Cuenta = { id: "t", nombre: "Cajita Turbo", tipo: "ahorro", saldo_actual: 26500.40, dia_corte: null, dia_limite_pago: null, es_ejemplo: false, tasa_anual: 13, tope_tasa: 25000, tasa_excedente: 6.5 };
const ahorro: Cuenta = { ...turbo, id: "a", nombre: "Ahorro Plus", saldo_actual: 15200.50, tasa_anual: 6.5, tope_tasa: null, tasa_excedente: null };

test("13% solo hasta 25 mil, lo demás al 6.5%", () => {
  // 25,000 × 13% / 365 + 1,500.40 × 6.5% / 365
  assert.equal(interesDelDia(turbo).toFixed(4), ((25000 * 0.13 + 1500.4 * 0.065) / 365).toFixed(4));
  assert.equal(interesDelDia(ahorro).toFixed(4), ((15200.50 * 0.065) / 365).toFixed(4));
  assert.equal(interesDelDia({ ...turbo, tipo: "credito" }), 0);
});

test("interés compuesto: 30 días da un poco más que 30 × el de hoy", () => {
  const mes = proyectar(ahorro, 30);
  assert.ok(mes > interesDelDia(ahorro) * 30);
  assert.ok(mes < interesDelDia(ahorro) * 30 + 1);
});

test("el cron suma los días que faltan y deja un solo ingreso por mes", async () => {
  (globalThis as { __almacenDemo?: unknown }).__almacenDemo = undefined;
  const repo = repoMemoria();
  await repo.crearCuenta({ ...ahorro, rendimiento_desde: null });
  const id = () => repo.cuentas().then((x) => x.find((c) => c.nombre === "Ahorro Plus")!);
  await aplicarRendimientos(repo, "2026-10-27"); // primera vez: solo marca el día
  assert.equal((await id()).saldo_actual, 15200.50);
  await aplicarRendimientos(repo, "2026-10-28");
  await aplicarRendimientos(repo, "2026-10-30");
  const c = await id();
  assert.ok(c.saldo_actual > 15200.50 + 3 * 2.70 && c.saldo_actual < 15200.50 + 3 * 2.72, String(c.saldo_actual));
  const rend = (await repo.movimientos()).filter((m) => m.hash_unico === `rend:${c.id}:2026-10`);
  assert.equal(rend.length, 1);
  assert.equal(rend[0].monto, Math.round((c.saldo_actual - 15200.50) * 100) / 100);
});
