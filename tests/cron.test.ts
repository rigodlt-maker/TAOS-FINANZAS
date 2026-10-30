// Claves de los crons y de los scripts: comparación en tiempo constante (claves inventadas)
import assert from "node:assert/strict";
import { test } from "node:test";
import { cronAutorizado, mismaClave } from "../lib/cron";

const pedido = (auth?: string) => new Request("https://ejemplo.vercel.app/api/cron", { headers: auth ? { authorization: auth } : {} });

test("mismaClave solo acepta la clave exacta", () => {
  assert.ok(mismaClave("Bearer abc123", "Bearer abc123"));
  assert.equal(mismaClave("Bearer abc12", "Bearer abc123"), false);
  assert.equal(mismaClave(null, "Bearer abc123"), false);
});

test("el cron exige CRON_SECRET", () => {
  delete process.env.CRON_SECRET;
  assert.equal(cronAutorizado(pedido("Bearer ")), false);
  process.env.CRON_SECRET = "secreto-inventado-de-prueba";
  assert.ok(cronAutorizado(pedido("Bearer secreto-inventado-de-prueba")));
  assert.equal(cronAutorizado(pedido("Bearer otro")), false);
  assert.equal(cronAutorizado(pedido()), false);
});
