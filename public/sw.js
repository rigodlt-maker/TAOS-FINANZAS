// Service worker: permite instalar la app en el celular y recibe las notificaciones push.
// No guarda nada sin conexión: cada vez se piden los datos frescos.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Llega un aviso del servidor: { titulo, cuerpo, url, etiqueta }
self.addEventListener("push", (evento) => {
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch {
    aviso = { cuerpo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo || "Finanzas", {
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
