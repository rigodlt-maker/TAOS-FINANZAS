// Nube F3 · En TAOS Nube cualquiera puede entrar con su cuenta (sin ALLOWED_EMAIL ni código de compra);
// en tu versión propia todo sigue igual
import assert from "node:assert/strict";
import { test } from "node:test";
import { revisarLicencia } from "../lib/licencia";
import { revisarVariables } from "../lib/instalacion";
import { correoPermitido } from "../lib/supabase/config";

async function enModo<T>(modo: string | undefined, f: () => Promise<T> | T): Promise<T> {
  const antes = { m: process.env.TAOS_MODO, c: process.env.ALLOWED_EMAIL };
  if (modo) process.env.TAOS_MODO = modo;
  else delete process.env.TAOS_MODO;
  process.env.ALLOWED_EMAIL = "duena@demo.mx";
  try {
    return await f();
  } finally {
    if (antes.m === undefined) delete process.env.TAOS_MODO;
    else process.env.TAOS_MODO = antes.m;
    if (antes.c === undefined) delete process.env.ALLOWED_EMAIL;
    else process.env.ALLOWED_EMAIL = antes.c;
  }
}

test("propia: solo el correo de ALLOWED_EMAIL; nube: cualquier correo", async () => {
  await enModo(undefined, () => {
    assert.equal(correoPermitido("duena@demo.mx"), true);
    assert.equal(correoPermitido("otra@demo.mx"), false);
  });
  await enModo("nube", () => {
    assert.equal(correoPermitido("otra@demo.mx"), true);
    assert.equal(correoPermitido(""), false);
    assert.equal(correoPermitido(null), false);
  });
});

test("nube: no pide código de compra ni ALLOWED_EMAIL; propia sí", async () => {
  const sinNada = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x", SUPABASE_SECRET_KEY: "sb_secret_x" };
  await enModo("nube", async () => {
    assert.deepEqual(await revisarLicencia({}), { ok: true });
    assert.ok(!revisarVariables(sinNada).some((p) => /ALLOWED_EMAIL/.test(p)));
  });
  await enModo(undefined, async () => {
    assert.equal((await revisarLicencia({})).ok, false);
    assert.ok(revisarVariables(sinNada).some((p) => /ALLOWED_EMAIL/.test(p)));
  });
});
