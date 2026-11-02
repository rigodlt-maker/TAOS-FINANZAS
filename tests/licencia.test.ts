import assert from "node:assert/strict";
import { test } from "node:test";
import { revisarLicencia } from "../lib/licencia";

const respuesta = (datos: unknown, estado = 200) => (async () => new Response(JSON.stringify(datos), { status: estado })) as unknown as typeof fetch;

test("sin código de compra no deja seguir (sin preguntar al servidor)", async () => {
  let pregunto = false;
  const r = await revisarLicencia({}, (async () => ((pregunto = true), new Response("{}"))) as unknown as typeof fetch);
  assert.equal(r.ok, false);
  assert.equal(pregunto, false);
});

test("detecta otro dato pegado en CODIGO_COMPRA", async () => {
  const r = await revisarLicencia({ CODIGO_COMPRA: "sb_secret_abc" }, respuesta({ ok: true }));
  assert.equal(r.ok, false);
});

test("manda el código limpio y la dirección de producción", async () => {
  let pedida = "";
  const buscar = (async (u: string) => ((pedida = u), new Response(JSON.stringify({ ok: true })))) as unknown as typeof fetch;
  const r = await revisarLicencia({ CODIGO_COMPRA: " hp 123 ", VERCEL_PROJECT_PRODUCTION_URL: "mi-app.vercel.app" }, buscar);
  assert.equal(r.ok, true);
  assert.match(pedida, /codigo=HP123/);
  assert.match(pedida, /url=mi-app\.vercel\.app/);
});

test("muestra el problema que dice el servidor", async () => {
  const r = await revisarLicencia({ CODIGO_COMPRA: "HP1" }, respuesta({ ok: false, problema: "Ya se usó 3 veces" }));
  assert.deepEqual(r, { ok: false, problema: "Ya se usó 3 veces" });
});

test("si el servidor falla, la app sigue funcionando", async () => {
  assert.equal((await revisarLicencia({ CODIGO_COMPRA: "HP1" }, respuesta({}, 500))).ok, true);
  const caido = (async () => { throw new Error("fetch failed"); }) as unknown as typeof fetch;
  assert.equal((await revisarLicencia({ CODIGO_COMPRA: "HP1" }, caido)).ok, true);
});
