// Service worker: permite instalar la app en el celular, recibe las notificaciones push y la abre sin internet.
// Siempre pide los datos frescos; solo si no hay señal muestra la última versión guardada de la pantalla
// (así puedes abrir Agregar y anotar un gasto, que se manda solo al volver la conexión).
const CACHE = "taos-sin-internet-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) =>
  evento.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("taos-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (evento) => {
  const r = evento.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Archivos de la app (no cambian): del celular primero
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
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
  // Pantallas: de internet primero; sin señal, la última guardada
  if (r.mode === "navigate") {
    evento.respondWith(
      fetch(r)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(r, copia));
          }
          return res;
        })
        .catch(async () => (await caches.match(r)) || (await caches.match("/agregar")) || (await caches.match("/")) || Response.error()),
    );
  }
});

// Llega un aviso del servidor: { titulo, cuerpo, url, etiqueta }
self.addEventListener("push", (evento) => {
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch {
    aviso = { cuerpo: evento.data ? evento.data.text() : "" };
  }
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
