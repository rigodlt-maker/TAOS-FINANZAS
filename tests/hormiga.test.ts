import assert from "node:assert/strict";
import test from "node:test";
import { responderAsesor, type DatosAsesor } from "../lib/asesor";
import { detectarHormiga } from "../lib/hormiga";
import type { Categoria, Movimiento } from "../lib/tipos";

const hoy = "2026-10-30";
const cat = (id: string, nombre: string): Categoria => ({ id, nombre, presupuesto_mensual: 0, color_neutro: "#737373" }) as Categoria;
const categorias = [cat("cf", "Comida fuera"), cat("su", "Súper y despensa")];
let n = 0;
const mov = (fecha: string, comercio: string, monto: number, category_id = "cf", extra: Partial<Movimiento> = {}): Movimiento => ({
  id: `m${n++}`, account_id: "a", fecha, descripcion_original: comercio.toUpperCase(), comercio, monto, tipo: "gasto", category_id,
  requiere_revision: false, es_recurrente: false, hash_unico: `h${n}`, import_id: null, ...extra,
});

const movimientos = [
  // El café de cada mes queda marcado como "recurrente" y aun así es hormiga
  ...["2026-10-02", "2026-10-09", "2026-10-15", "2026-10-22", "2026-10-28"].map((f) => mov(f, "Starbucks", 80, "cf", { es_recurrente: true })),
  ...["2026-10-05", "2026-10-12", "2026-10-20"].map((f) => mov(f, "Oxxo", 60)),
  ...["2026-10-05", "2026-10-12", "2026-10-20", "2026-10-25"].map((f) => mov(f, "Walmart", 180, "su")), // súper: necesario, no es hormiga
  ...["2026-10-05", "2026-10-12", "2026-10-20"].map((f) => mov(f, "Cinépolis", 400)), // más de $250: no es hormiga
  mov("2026-10-10", "Spotify", 129, "cf", { es_recurrente: true }), // suscripción: 1 cobro al mes, va aparte
  mov("2026-09-10", "Spotify", 129, "cf", { es_recurrente: true }),
  mov("2026-09-01", "Starbucks", 80), // hace más de 30 días
];

test("detecta lo chico que se repite y lo calcula al año", () => {
  const h = detectarHormiga(movimientos, categorias, hoy);
  assert.deepEqual(h.grupos.map((g) => g.nombre), ["Starbucks", "Oxxo"]);
  assert.equal(h.grupos[0].veces, 5);
  assert.equal(h.grupos[0].total, 400);
  assert.equal(h.total, 580);
  assert.equal(h.alAnio, Math.round((580 * 365) / 30));
});

test("Tao responde por los gastos hormiga", () => {
  const d: DatosAsesor = { hoy, cuentas: [], categorias, movimientos, pagos: [], metas: [], aportaciones: [] };
  for (const p of ["¿cuáles son mis gastos hormiga?", "en qué gastitos se me va el dinero", "mis antojos"]) assert.match(responderAsesor(p, d), /Starbucks[\s\S]*al año/, p);
});
