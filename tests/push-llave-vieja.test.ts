// Después de cambiar la llave secreta, el servicio de notificaciones responde 403 a las suscripciones viejas:
// se quitan (igual que 404/410) y el celular se vuelve a suscribir solo al abrir la app
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sinValidez } from "../lib/push";

test("403, 404 y 410 quitan la suscripción; otros errores se reintentan", () => {
  for (const c of [403, 404, 410]) assert.equal(sinValidez(c), true, String(c));
  for (const c of [undefined, 400, 413, 429, 500, 502]) assert.equal(sinValidez(c), false, String(c));
});

test("la pantalla de avisos compara la llave y renueva la suscripción vieja", () => {
  const ruta = ["components/avisos-push.tsx", "app/avisos-push.tsx"].find((f) => { try { readFileSync(f); return true; } catch { return false; } })!;
  const s = readFileSync(ruta, "utf8");
  assert.match(s, /mismaLlave\(actual, llave\)/);
  assert.match(s, /anterior/);
});
