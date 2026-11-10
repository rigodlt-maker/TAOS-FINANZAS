// Service worker: permite instalar la app en el celular, recibe las notificaciones push y avisa cuando no hay internet.
// Seguridad (S15): NUNCA se guardan pantallas con tus datos (saldos, movimientos). Solo los archivos públicos de la app
// (código, íconos, letras) y una pantalla neutra "Sin internet" que no muestra nada tuyo y deja anotar un gasto,
// que se manda solo cuando vuelve la señal.
const CACHE = "taos-sin-internet-v3";
const SIN_INTERNET = "/sin-internet.html";
self.addEventListener("install", (evento) => {
  self.skipWaiting();
  evento.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(SIN_INTERNET, { cache: "reload" }))).catch(() => {}));
});
// Al activarse se borran las cachés viejas (v1/v2 sí guardaban pantallas privadas)
self.addEventListener("activate", (evento) =>
  evento.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("taos-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
const esPublico = (url) => url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname) || url.pathname === SIN_INTERNET;
self.addEventListener("fetch", (evento) => {
  const r = evento.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Archivos públicos de la app (no cambian): del celular primero
  if (esPublico(url)) {
    evento.respondWith(
      caches.open(CACHE).then(async (c) => {
        const guardado = await c.match(r);
        if (guardado) return guardado;
        const res = await fetch(r);
        if (res.ok) c.put(r, res.clone());
        return res;
      }),
    );
    return;
  }
  // Pantallas: siempre de internet y sin guardarlas; sin señal, la pantalla neutra
  if (r.mode === "navigate") {
    evento.respondWith(fetch(r).catch(async () => (await caches.match(SIN_INTERNET)) || Response.error()));
  }
});

// Sin sesión (pantalla de entrada o cierre de sesión): se borra lo que pudiera tener algo tuyo en este celular
// (la bandeja de avisos de la campana) y cualquier caché vieja con pantallas
async function limpiarSinSesion() {
  for (const k of await caches.keys()) if (k === BANDEJA || (k.startsWith("taos-") && k !== CACHE)) await caches.delete(k);
  for (const v of await self.clients.matchAll({ type: "window" })) v.postMessage({ tipo: "taos-aviso" });
}
self.addEventListener("message", (evento) => {
  if (evento.data && evento.data.tipo === "taos-sin-sesion") evento.waitUntil(limpiarSinSesion());
});

// Bandeja de avisos (la campana 🔔 de la app): se guardan los últimos 30 en este celular, sin servidor
const BANDEJA = "bandeja-avisos";
async function guardarAviso(aviso) {
  try {
    const c = await caches.open(BANDEJA);
    const r = await c.match("/__avisos");
    const lista = r ? await r.json() : [];
    lista.unshift({ titulo: aviso.titulo || "", cuerpo: aviso.cuerpo || "", url: aviso.url || "/", fecha: Date.now() });
    await c.put("/__avisos", new Response(JSON.stringify(lista.slice(0, 30)), { headers: { "Content-Type": "application/json" } }));
    for (const v of await self.clients.matchAll({ type: "window" })) v.postMessage({ tipo: "taos-aviso" });
  } catch {}
}

// Llega un aviso del servidor: { titulo, cuerpo, url, etiqueta }
self.addEventListener("push", (evento) => {
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch {
    aviso = { cuerpo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(guardarAviso(aviso));
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo || "Administrador Tao", {
      body: aviso.cuerpo || "",
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      tag: aviso.etiqueta || undefined,
      renotify: !!aviso.etiqueta,
      data: { url: aviso.url || "/" },
    }),
  );
});

// Al tocar la notificación se abre la app en la pantalla del aviso (o se reutiliza la ventana abierta)
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || "/", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => v.url.startsWith(self.location.origin));
      if (abierta) return abierta.focus().then((v) => v.navigate(destino)).catch(() => self.clients.openWindow(destino));
      return self.clients.openWindow(destino);
    }),
  );
});

// El navegador renovó la suscripción por su cuenta: se avisa al servidor para no perder los avisos
self.addEventListener("pushsubscriptionchange", (evento) => {
  const anterior = evento.oldSubscription;
  evento.waitUntil(
    (evento.newSubscription
      ? Promise.resolve(evento.newSubscription)
      : self.registration.pushManager.subscribe(anterior.options)
    ).then((nueva) =>
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anterior: anterior && anterior.endpoint, suscripcion: nueva.toJSON() }),
      }),
    ),
  );
});
