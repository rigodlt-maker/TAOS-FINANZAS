// Nube F4 · Suscripción con Google Play: reglas, aviso de Google, firma y ligar la compra a SU cuenta (Google simulado)
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { constanciaFirmada, consultarSuscripcion, olvidarPermiso } from "../lib/google-play";
import { estadoDeGoogle, filaDeCompra, huellaToken, leerAviso, mensajeDeEstado, PRODUCTOS, puedeEscribir, type CompraGoogle } from "../lib/suscripcion";
import { actualizarPorAviso, verificarCompra, type Google } from "../lib/suscripcion-servidor";

const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const AHORA = Date.parse("2026-11-28T12:00:00Z");

test("estados de Google → los nuestros; quién puede guardar cambios", () => {
  assert.equal(estadoDeGoogle("SUBSCRIPTION_STATE_ACTIVE"), "activa");
  assert.equal(estadoDeGoogle("SUBSCRIPTION_STATE_IN_GRACE_PERIOD"), "gracia");
  assert.equal(estadoDeGoogle("SUBSCRIPTION_STATE_ON_HOLD"), "retenida");
  assert.equal(estadoDeGoogle("SUBSCRIPTION_STATE_EXPIRED"), "vencida");
  assert.equal(estadoDeGoogle("ALGO_NUEVO"), "pendiente");
  assert.equal(puedeEscribir(null, AHORA), false);
  assert.equal(puedeEscribir({ estado: "activa", vence: null }, AHORA), true);
  assert.equal(puedeEscribir({ estado: "gracia", vence: null }, AHORA), true);
  assert.equal(puedeEscribir({ estado: "cancelada", vence: "2026-12-05T00:00:00Z" }, AHORA), true); // ya pagó hasta esa fecha
  assert.equal(puedeEscribir({ estado: "cancelada", vence: "2026-11-01T00:00:00Z" }, AHORA), false);
  for (const e of ["retenida", "pausada", "vencida", "pendiente"] as const) assert.equal(puedeEscribir({ estado: e, vence: "2027-01-01T00:00:00Z" }, AHORA), false, e);
  assert.match(mensajeDeEstado(null, AHORA)!, /7 días gratis/);
  assert.match(mensajeDeEstado({ estado: "vencida", vence: null }, AHORA)!, /siguen aquí/);
  assert.equal(mensajeDeEstado({ estado: "activa", vence: null }, AHORA), null);
});

test("aviso de Google: solo de nuestro paquete; el de prueba se reconoce; lo raro se ignora", () => {
  const aviso = (o: object) => ({ message: { data: Buffer.from(JSON.stringify(o)).toString("base64") } });
  assert.deepEqual(leerAviso(aviso({ packageName: "mx.taos.app", subscriptionNotification: { purchaseToken: "tok-1", subscriptionId: "taos_mensual" } }), "mx.taos.app"), { token: "tok-1", producto: "taos_mensual" });
  assert.equal(leerAviso(aviso({ packageName: "otra.app", subscriptionNotification: { purchaseToken: "tok-1" } }), "mx.taos.app"), null);
  assert.deepEqual(leerAviso(aviso({ packageName: "mx.taos.app", testNotification: {} }), "mx.taos.app"), { prueba: true });
  assert.equal(leerAviso({ message: { data: "no-es-json" } }, "mx.taos.app"), null);
  assert.equal(leerAviso(null, "mx.taos.app"), null);
});

test("la constancia para Google va firmada con la llave de la cuenta de servicio (RS256) y dura 1 hora", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwt = constanciaFirmada({ client_email: "taos@proyecto.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() }, AHORA);
  const [c, cuerpo, firma] = jwt.split(".");
  assert.ok(createVerify("RSA-SHA256").update(`${c}.${cuerpo}`).verify(publicKey, Buffer.from(firma, "base64url")));
  const d = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
  assert.equal(d.scope, "https://www.googleapis.com/auth/androidpublisher");
  assert.equal(d.exp - d.iat, 3600);
});

test("consultar a Google: pide permiso una vez, manda el token en la dirección y 404 = compra que no existe", async () => {
  olvidarPermiso();
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const v = { PLAY_PAQUETE: "mx.taos.app", PLAY_CUENTA_SERVICIO: JSON.stringify({ client_email: "x@y.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() }) };
  const pedidos: string[] = [];
  const buscar = (async (url: string) => {
    pedidos.push(url);
    if (url.includes("oauth2")) return { ok: true, status: 200, json: async () => ({ access_token: "acceso", expires_in: 3600 }) };
    if (url.includes("tok-inventado")) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" }) };
  }) as unknown as typeof fetch;
  assert.deepEqual(await consultarSuscripcion("tok/1", v, buscar, AHORA), { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" });
  assert.equal(await consultarSuscripcion("tok-inventado", v, buscar, AHORA), null);
  assert.equal(pedidos.filter((u) => u.includes("oauth2")).length, 1, "el permiso se reutiliza");
  assert.ok(pedidos[1].includes("/applications/mx.taos.app/purchases/subscriptionsv2/tokens/tok%2F1"));
  olvidarPermiso();
});

// Base falsa de la tabla suscripciones (llave primaria user_id, huella única)
function baseFalsa() {
  const filas: Record<string, unknown>[] = [];
  const db = {
    from: () => ({
      select: () => {
        const f: Record<string, unknown> = {};
        const q = { eq: (c: string, v: unknown) => ((f[c] = v), q), maybeSingle: async () => ({ data: filas.find((x) => Object.entries(f).every(([c, v]) => x[c] === v)) ?? null, error: null }) };
        return q;
      },
      upsert: async (fila: Record<string, unknown>) => {
        if (filas.some((x) => x.token_huella === fila.token_huella && x.user_id !== fila.user_id)) return { error: { message: "duplicate key token_huella" } };
        const i = filas.findIndex((x) => x.user_id === fila.user_id);
        if (i >= 0) filas[i] = fila;
        else filas.push(fila);
        return { error: null };
      },
      update: (cambio: Record<string, unknown>) => {
        const f: Record<string, unknown> = {};
        const q = {
          eq: (c: string, v: unknown) => {
            f[c] = v;
            if (Object.keys(f).length === 2) for (const x of filas) if (Object.entries(f).every(([k, w]) => x[k] === w)) Object.assign(x, cambio);
            return q;
          },
        };
        return q;
      },
    }),
  } as unknown as SupabaseClient;
  return { db, filas };
}

function googleFalso(compras: Record<string, CompraGoogle>) {
  const reconocidas: string[] = [];
  const g: Google = { consultar: async (t) => compras[t] ?? null, reconocer: async (_p, t) => void reconocidas.push(t) };
  return { g, reconocidas };
}
const activa = (producto: string = PRODUCTOS.mensual): CompraGoogle => ({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING", lineItems: [{ productId: producto, expiryTime: "2026-12-28T12:00:00Z", autoRenewingPlan: { autoRenewEnabled: true } }] });

test("ligar la compra: se comprueba con Google, se reconoce (para que no la reembolsen) y queda en SU cuenta", async () => {
  const { db, filas } = baseFalsa();
  const { g, reconocidas } = googleFalso({ "tok-a": activa() });
  assert.deepEqual(await verificarCompra(db, A, "tok-a", PRODUCTOS.mensual, g), { ok: true, estado: "activa" });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].user_id, A);
  assert.equal(filas[0].token_huella, huellaToken("tok-a"));
  assert.equal(filas[0].reconocida, true);
  assert.deepEqual(reconocidas, ["tok-a"]);
});

test("dos cuentas: la misma compra NO se puede ligar a otra; un token inventado o de otro producto no sirve", async () => {
  const { db } = baseFalsa();
  const { g } = googleFalso({ "tok-a": activa(), "tok-otro": activa("producto_de_otra_app") });
  await verificarCompra(db, A, "tok-a", PRODUCTOS.mensual, g);
  const deB = await verificarCompra(db, B, "tok-a", PRODUCTOS.mensual, g);
  assert.equal(deB.ok, false);
  assert.match((deB as { mensaje: string }).mensaje, /otra cuenta/);
  assert.equal((await verificarCompra(db, B, "tok-inventado", PRODUCTOS.mensual, g)).ok, false);
  assert.equal((await verificarCompra(db, B, "tok-otro", PRODUCTOS.mensual, g)).ok, false);
  assert.equal((await verificarCompra(db, B, "tok-a", "producto_raro", g)).ok, false);
});

test("aviso de Google: actualiza a la dueña del token con el estado que diga Google (no el aviso); sin dueña, espera", async () => {
  const { db, filas } = baseFalsa();
  const compras = { "tok-a": activa() };
  const { g } = googleFalso(compras);
  await verificarCompra(db, A, "tok-a", PRODUCTOS.mensual, g);
  compras["tok-a"] = { ...activa(), subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" };
  assert.equal(await actualizarPorAviso(db, "tok-a", g), "actualizada");
  assert.equal(filas[0].estado, "vencida");
  assert.equal(await actualizarPorAviso(db, "tok-nadie", g), "sin dueño");
});

test("la fila guarda la prueba gratis, la renovación y el vencimiento", () => {
  const f = filaDeCompra(A, "tok", { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: PRODUCTOS.anual, expiryTime: "2027-01-01T00:00:00Z", autoRenewingPlan: { autoRenewEnabled: false }, offerDetails: { offerId: "prueba-7-dias" } }] });
  assert.equal(f.producto, PRODUCTOS.anual);
  assert.equal(f.prueba_gratis, true);
  assert.equal(f.renovacion_automatica, false);
  assert.equal(f.vence, "2027-01-01T00:00:00Z");
});
