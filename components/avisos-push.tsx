"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { Resultado } from "@/lib/acciones";
import { Mensaje } from "./formulario";
import { Button } from "./ui/button";

type Estado = "cargando" | "no-soportado" | "instalar" | "bloqueado" | "inactivo" | "activo";

// La llave pública llega en base64url; el navegador la quiere en bytes
function bytesDeLlave(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function nombreDispositivo() {
  const ua = navigator.userAgent;
  const sistema = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Otro";
  const navegador = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `${sistema}${navegador ? ` · ${navegador}` : ""}`;
}

async function llamar(metodo: "POST" | "DELETE", cuerpo: object): Promise<Resultado> {
  const r = await fetch("/api/push", { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  return r.json().catch(() => ({ ok: false, mensaje: "No hubo respuesta del servidor" }));
}

// Activa o desactiva las notificaciones push en este celular o navegador
export function AvisosPush() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
        return setEstado(ios && !instalada ? "instalar" : "no-soportado");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const registro = await navigator.serviceWorker.ready;
      setEstado((await registro.pushManager.getSubscription()) ? "activo" : "inactivo");
    })().catch(() => setEstado("no-soportado"));
  }, []);

  const activar = () =>
    iniciar(async () => {
      try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          setEstado(permiso === "denied" ? "bloqueado" : "inactivo");
          return setResultado({ ok: false, mensaje: "Necesitas tocar «Permitir» para recibir avisos." });
        }
        const { ok, llave, mensaje } = (await (await fetch("/api/push")).json()) as { ok: boolean; llave?: string; mensaje?: string };
        if (!ok || !llave) return setResultado({ ok: false, mensaje: mensaje ?? "Falta configurar las notificaciones." });
        const registro = await navigator.serviceWorker.ready;
        const suscripcion = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeLlave(llave) });
        const r = await llamar("POST", { suscripcion: suscripcion.toJSON(), dispositivo: nombreDispositivo() });
        setResultado(r);
        if (r.ok) setEstado("activo");
      } catch (e) {
        setResultado({ ok: false, mensaje: `No se pudieron activar: ${(e as Error).message}` });
      }
    });

  const desactivar = () =>
    iniciar(async () => {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        await llamar("DELETE", { endpoint: suscripcion.endpoint });
        await suscripcion.unsubscribe();
      }
      setEstado("inactivo");
      setResultado({ ok: true, mensaje: "Notificaciones desactivadas en este dispositivo." });
    });

  const probar = () => iniciar(async () => setResultado(await llamar("POST", { prueba: true })));

  if (estado === "cargando") return <p className="text-sm text-muted-foreground">Revisando este dispositivo…</p>;
  if (estado === "no-soportado") return <p className="text-sm text-muted-foreground">Este navegador no permite notificaciones. Abre la app en Chrome (Android) o instálala en tu iPhone.</p>;
  if (estado === "instalar")
    return (
      <p className="text-sm text-muted-foreground">
        En iPhone primero instala la app: en Safari toca <strong className="text-foreground">Compartir → Agregar a pantalla de inicio</strong>, ábrela desde ese
        ícono y vuelve aquí.
      </p>
    );
  if (estado === "bloqueado")
    return (
      <p className="text-sm text-muted-foreground">
        Bloqueaste las notificaciones para esta app. Actívalas en los ajustes del celular (Notificaciones → Finanzas) o en el candado junto a la dirección, y
        recarga la página.
      </p>
    );

  return (
    <div className="grid gap-3">
      {estado === "activo" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pendiente} onClick={probar}>
            <Bell className="size-4" /> Enviarme una de prueba
          </Button>
          <Button type="button" variant="ghost" disabled={pendiente} onClick={desactivar}>
            <BellOff className="size-4" /> Desactivar aquí
          </Button>
        </div>
      ) : (
        <Button type="button" disabled={pendiente} onClick={activar}>
          <Bell className="size-4" /> Activar notificaciones en este dispositivo
        </Button>
      )}
      {resultado && <Mensaje resultado={resultado} />}
    </div>
  );
}
