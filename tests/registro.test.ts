// Nube F3 · Registro abierto de cuentas en TAOS Nube
import assert from "node:assert/strict";
import { test } from "node:test";
import { mensajeDeRegistro, pasaTurnstile, turnstileActivo, validarRegistro } from "../lib/registro";

const bien = { correo: "ana@demo.mx", contrasena: "una-clave-larga", confirmar: "una-clave-larga", acepta: true };

test("validar: correo, mínimo 8, máximo 72, que coincidan y que acepte el aviso", () => {
  assert.equal(validarRegistro(bien), null);
  assert.match(validarRegistro({ ...bien, correo: "ana" })!, /correo válido/);
  assert.match(validarRegistro({ ...bien, contrasena: "corta", confirmar: "corta" })!, /8 caracteres/);
  assert.match(validarRegistro({ ...bien, contrasena: "x".repeat(73), confirmar: "x".repeat(73) })!, /72/);
  assert.match(validarRegistro({ ...bien, confirmar: "otra-clave-larga" })!, /no coinciden/);
  assert.match(validarRegistro({ ...bien, acepta: false })!, /acepta/);
});

test("mensajes: el mismo «revisa tu correo» aunque el correo ya tuviera cuenta (nadie averigua quién está registrado)", () => {
  const nuevo = mensajeDeRegistro(null);
  const repetido = mensajeDeRegistro({ message: "User already registered" });
  assert.equal(nuevo.ok, true);
  assert.deepEqual(repetido, nuevo);
  assert.match(mensajeDeRegistro({ message: "Password is known to be weak and easy to guess" }).mensaje, /fácil de adivinar/);
  assert.match(mensajeDeRegistro({ message: "email rate limit exceeded" }).mensaje, /Espera/);
  assert.equal(mensajeDeRegistro({ message: "algo raro" }).ok, false);
});

test("anti-bots (Turnstile): sin llaves no se revisa; con llaves, sin respuesta o con «no» no pasa; si Cloudflare falla, no pasa", async () => {
  const llaves = { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "sitio", TURNSTILE_SECRET_KEY: "secreto" };
  assert.equal(turnstileActivo({}), false);
  assert.equal(await pasaTurnstile(null, null, {}), true);
  const responde = (success: boolean) => (async () => ({ json: async () => ({ success }) })) as unknown as typeof fetch;
  assert.equal(await pasaTurnstile(null, null, llaves, responde(true)), false);
  assert.equal(await pasaTurnstile("token", "1.2.3.4", llaves, responde(true)), true);
  assert.equal(await pasaTurnstile("token", null, llaves, responde(false)), false);
  const falla = (async () => {
    throw new Error("sin red");
  }) as unknown as typeof fetch;
  assert.equal(await pasaTurnstile("token", null, llaves, falla), false);
});
