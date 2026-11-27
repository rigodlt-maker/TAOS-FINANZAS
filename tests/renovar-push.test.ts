// Al abrir la app: si la suscripción se hizo con una llave vieja, se renueva sola (con un celular simulado)
import assert from "node:assert/strict";
import { test } from "node:test";
import { bytesDeLlave, renovarPushSiHaceFalta } from "../lib/renovar-push";

const VIEJA = "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const NUEVA = "BAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ";

function celular({ llaveActual = VIEJA, ruta = "/", permiso = "granted", guarda = true, sinSuscripcion = false } = {}) {
  const registro = { quitadas: [] as string[], suscritas: 0, posts: [] as Record<string, unknown>[] };
  const sub = (endpoint: string, llave: string) => ({
    endpoint,
    options: { applicationServerKey: bytesDeLlave(llave).buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: async () => (registro.quitadas.push(endpoint), true),
  });
  const g = globalThis as Record<string, unknown>;
  const guardado = new Map<string, string>();
  g.window = { PushManager: function () {}, Notification: function () {} };
  g.Notification = { permission: permiso };
  g.location = { pathname: ruta };
  g.sessionStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v) };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "Android Chrome/130",
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: async () => (sinSuscripcion ? null : sub("https://push.example/vieja", llaveActual)),
            subscribe: async () => (registro.suscritas++, sub("https://push.example/nueva", NUEVA)),
          },
        }),
      },
    },
  });
  g.fetch = async (_url: string, init?: { method?: string; body?: string }) => ({
    json: async () => {
      if (!init?.method) return { ok: true, llave: NUEVA };
      registro.posts.push(JSON.parse(init.body!));
      return { ok: guarda };
    },
  });
  return registro;
}

test("con la llave vieja: quita la suscripción, se suscribe con la nueva y le dice al servidor cuál borrar", async () => {
  const r = celular();
  assert.equal(await renovarPushSiHaceFalta(), true);
  assert.deepEqual(r.quitadas, ["https://push.example/vieja"]);
  assert.equal(r.suscritas, 1);
  assert.equal(r.posts[0].anterior, "https://push.example/vieja");
});

test("con la llave correcta, sin permiso, sin suscripción o en la entrada: no toca nada", async () => {
  for (const caso of [{ llaveActual: NUEVA }, { permiso: "default" }, { sinSuscripcion: true }, { ruta: "/login" }]) {
    const r = celular(caso);
    assert.equal(await renovarPushSiHaceFalta(), false, JSON.stringify(caso));
    assert.equal(r.suscritas, 0, JSON.stringify(caso));
  }
});

test("si el servidor no guarda la nueva, también se quita del celular (para que salga «Activar», no un «activo» falso)", async () => {
  const r = celular({ guarda: false });
  assert.equal(await renovarPushSiHaceFalta(), false);
  assert.deepEqual(r.quitadas, ["https://push.example/vieja", "https://push.example/nueva"]);
});

test("solo revisa una vez por sesión", async () => {
  celular();
  assert.equal(await renovarPushSiHaceFalta(), true);
  assert.equal(await renovarPushSiHaceFalta(), false);
});
