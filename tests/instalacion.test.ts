import assert from "node:assert/strict";
import { test } from "node:test";
import { puedeCrearContrasena, revisarVariables } from "../lib/instalacion";

const bien = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz",
  SUPABASE_SECRET_KEY: "sb_secret_xyz",
  ALLOWED_EMAIL: "ana.prueba@gmail.com",
};

test("variables correctas (aunque tengan espacios al final) no marcan problemas", () => {
  assert.deepEqual(revisarVariables(bien), []);
  assert.deepEqual(revisarVariables({ ...bien, SUPABASE_SECRET_KEY: "sb_secret_xyz  ", NEXT_PUBLIC_SUPABASE_URL: " https://abcdefgh.supabase.co/ " }), []);
});

test("detecta llaves pegadas en la casilla equivocada", () => {
  const cruzadas = revisarVariables({ ...bien, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_xyz", SUPABASE_SECRET_KEY: "sb_publishable_xyz" });
  assert.equal(cruzadas.length, 2);
  assert.match(cruzadas[0], /pegaste la llave secreta/);
  assert.match(cruzadas[1], /pegaste la llave pública/);
  assert.match(revisarVariables({ ...bien, NEXT_PUBLIC_SUPABASE_URL: "sb_publishable_xyz" })[0], /pegaste una llave/);
});

test("avisa lo que falta, sin mostrar valores", () => {
  const faltan = revisarVariables({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz" });
  assert.equal(faltan.length, 2);
  assert.match(faltan.join(" "), /SUPABASE_SECRET_KEY/);
  assert.match(faltan.join(" "), /ALLOWED_EMAIL/);
});

test("la contraseña solo se crea sin correo mientras el dueño nunca ha entrado", () => {
  assert.equal(puedeCrearContrasena(null), true);
  assert.equal(puedeCrearContrasena({ last_sign_in_at: undefined } as never), true);
  assert.equal(puedeCrearContrasena({ last_sign_in_at: "2026-11-01T10:00:00Z" } as never), false);
});
