// Notificaciones push: llaves VAPID, textos de los avisos y suscripciones en modo demostración
import assert from "node:assert/strict";
import { test } from "node:test";
import webpush from "web-push";
import { repoMemoria } from "../lib/datos/memoria";
import { avisoDeCorreos, avisosDePago, enviarPush, llavesDesde } from "../lib/push";
import type { Prestamo } from "../lib/tipos";

test("las llaves VAPID se derivan siempre igual y sirven para web-push", () => {
  const a = llavesDesde("sb_secret_inventada_123");
  assert.deepEqual(a, llavesDesde("sb_secret_inventada_123"));
  assert.notDeepEqual(a, llavesDesde("otra_llave"));
  assert.equal(Buffer.from(a.publica, "base64url").length, 65);
  assert.equal(Buffer.from(a.privada, "base64url").length, 32);
  assert.doesNotThrow(() => webpush.setVapidDetails("mailto:prueba@example.com", a.publica, a.privada));
});

test("avisos de pagos, tarjetas y cobros", () => {
  const prestamo: Prestamo = { id: "p1", persona: "Juan", monto: 5000, abonado: 1000, cuenta_id: null, fecha: "2026-10-01", fecha_pago: "2026-10-27", nota: null, liquidado_el: null };
  const avisos = avisosDePago(
    [{ pago: { nombre: "Renta", monto: 8000 }, dias: 2, alcanza: false, cuenta: { nombre: "BBVA Débito" } }],
    [{ cuenta: { id: "amex", nombre: "Amex" }, dias: 7, vence: "2026-11-04", deuda: 3200.5 }],
    [prestamo],
    "2026-10-28",
  );
  assert.equal(avisos.length, 3);
  assert.match(avisos[0].titulo, /Pago de Amex en 7 días/);
  assert.match(avisos[0].cuerpo, /3,200\.50/);
  assert.match(avisos[1].titulo, /Renta: \$8,000(\.00)? en 2 días/);
  assert.match(avisos[1].cuerpo, /no alcanza/);
  assert.match(avisos[2].titulo, /Cobrar a Juan: \$4,000/);
  assert.match(avisos[2].cuerpo, /Se pasó/);
  assert.equal(avisos[2].url, "/prestamos");
});

test("aviso de correos del banco", () => {
  assert.equal(avisoDeCorreos({ recibidos: 3, nuevos: 0, aplicados: 0, pendientes: 4, duplicados: 0 }), null);
  assert.equal(avisoDeCorreos({ recibidos: 2, nuevos: 2, aplicados: 0, pendientes: 0, duplicados: 2 }), null);
  const uno = avisoDeCorreos({ recibidos: 1, nuevos: 1, aplicados: 1, pendientes: 0, duplicados: 0 })!;
  assert.equal(uno.titulo, "🏦 1 aviso nuevo de tu banco");
  assert.equal(uno.url, "/movimientos");
  const varios = avisoDeCorreos({ recibidos: 5, nuevos: 4, aplicados: 2, pendientes: 2, duplicados: 1 })!;
  assert.equal(varios.cuerpo, "2 ya quedaron registrados y 1 por confirmar. Toca para revisarlos.");
  assert.equal(varios.url, "/correos");
});

test("suscripciones en modo demostración y envío sin llaves", async () => {
  const repo = repoMemoria();
  const sub = { endpoint: "https://push.example.com/abc", p256dh: "x", auth: "y", dispositivo: "Android · Chrome" };
  await repo.guardarSuscripcionPush(sub);
  await repo.guardarSuscripcionPush({ ...sub, auth: "z" });
  const lista = await repo.suscripcionesPush();
  assert.equal(lista.filter((s) => s.endpoint === sub.endpoint).length, 1);
  assert.equal(lista.find((s) => s.endpoint === sub.endpoint)!.auth, "z");
  const antes = { ...process.env };
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  assert.deepEqual(await enviarPush(repo, { titulo: "x", cuerpo: "y" }), { enviados: 0, fallidos: 0 });
  Object.assign(process.env, antes);
  await repo.borrarSuscripcionPush(sub.endpoint);
  assert.equal((await repo.suscripcionesPush()).some((s) => s.endpoint === sub.endpoint), false);
});
