// Nube F4 · Sin suscripción vigente: solo lectura (ver, descargar y borrar la cuenta sí; guardar cambios no)
import assert from "node:assert/strict";
import { test } from "node:test";
import { conCandado, escribe } from "../lib/candado";
import type { Suscripcion } from "../lib/suscripcion";

const AHORA = Date.parse("2026-11-28T12:00:00Z");

function repoFalso() {
  const llamadas: string[] = [];
  const repo = {
    modo: "supabase" as const,
    async cuentas() {
      llamadas.push("cuentas");
      return [1, 2];
    },
    async crearCuenta() {
      llamadas.push("crearCuenta");
    },
    async borrarMovimiento() {
      llamadas.push("borrarMovimiento");
    },
    async guardarSuscripcionPush() {
      llamadas.push("guardarSuscripcionPush");
    },
  };
  return { repo, llamadas };
}

test("qué cuenta como «guardar cambios»", () => {
  for (const m of ["crearCuenta", "editarMeta", "borrarMovimiento", "insertarMovimientos", "guardarPerfil", "marcarHormiga", "moverImportacion"]) assert.equal(escribe(m), true, m);
  for (const m of ["cuentas", "movimientos", "perfil", "contarPorRevisar", "guardarSuscripcionPush", "borrarSuscripcionPush"]) assert.equal(escribe(m), false, m);
});

test("sin suscripción: leer sí, guardar no (con el mensaje para empezar los 7 días gratis); con suscripción activa, todo", async () => {
  const sin = repoFalso();
  const r = conCandado(sin.repo, async () => null, () => AHORA);
  assert.deepEqual(await r.cuentas(), [1, 2]);
  assert.equal(r.modo, "supabase");
  await assert.rejects(r.crearCuenta(), /7 días gratis/);
  await assert.rejects(r.borrarMovimiento(), /7 días gratis/);
  await r.guardarSuscripcionPush(); // las notificaciones siempre se pueden activar
  assert.deepEqual(sin.llamadas, ["cuentas", "guardarSuscripcionPush"]);

  const con = repoFalso();
  let consultas = 0;
  const activa: Suscripcion = { estado: "activa", vence: "2026-12-28T00:00:00Z" };
  const r2 = conCandado(con.repo, async () => (consultas++, activa), () => AHORA);
  await r2.crearCuenta();
  await r2.borrarMovimiento();
  assert.deepEqual(con.llamadas, ["crearCuenta", "borrarMovimiento"]);
  assert.equal(consultas, 1, "una sola consulta por petición");
});

test("suscripción vencida o pausada: solo lectura, con su mensaje", async () => {
  const v = repoFalso();
  await assert.rejects(conCandado(v.repo, async () => ({ estado: "vencida", vence: null }), () => AHORA).crearCuenta(), /terminó/);
  await assert.rejects(conCandado(v.repo, async () => ({ estado: "pausada", vence: null }), () => AHORA).crearCuenta(), /pausa/);
  assert.deepEqual(v.llamadas, []);
});
