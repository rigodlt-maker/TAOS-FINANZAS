// Nube F5 · Enlaces del correo: token_hash (sin PKCE) y botón antes de canjear
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { destinoConfirmar, mensajeDeEnlace, tipoDeEnlace, tokenValido } from "../lib/enlace-correo";

test("Nube F5 · solo se aceptan tipos de enlace conocidos y tokens con forma válida", () => {
  assert.equal(tipoDeEnlace("email"), "email");
  assert.equal(tipoDeEnlace("recovery"), "recovery");
  assert.equal(tipoDeEnlace("otro"), null);
  assert.equal(tipoDeEnlace(null), null);
  assert.ok(tokenValido("pkce_0123456789abcdef0123456789abcdef"));
  assert.ok(!tokenValido("abc"));
  assert.ok(!tokenValido("x".repeat(20) + "<script>"));
  assert.equal(destinoConfirmar("abc123abc123", "email"), "/auth/confirmar?token_hash=abc123abc123&type=email");
});

test("Nube F5 · el error del enlace sale en español, sin el texto técnico", () => {
  const m = mensajeDeEnlace({ message: "code challenge does not match previously saved code verifier" });
  assert.doesNotMatch(m, /code|verifier|challenge/i);
  assert.match(mensajeDeEnlace({ code: "otp_expired", message: "Email link is invalid or has expired" }), /ya se usó o caducó/);
});

test("Nube F5 · los 4 correos de la cuenta usan token_hash (no el enlace con PKCE, que falla al abrirse en otra pestaña)", () => {
  const dir = "supabase/nube/correos";
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".html"))) {
    const html = readFileSync(`${dir}/${f}`, "utf8");
    assert.doesNotMatch(html, /ConfirmationURL/, f);
    assert.match(html, /token_hash=\{\{ \.TokenHash \}\}&type=(signup|email|recovery|email_change)"/, f);
  }
});
