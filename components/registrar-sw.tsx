"use client";

import { useEffect } from "react";

// En la pantalla de entrada no hay sesión: se pide al celular borrar las pantallas guardadas sin internet
const ENTRADAS = ["/login", "/acceso-denegado"];

export function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (ENTRADAS.some((e) => location.pathname.startsWith(e)))
      navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ tipo: "taos-sin-sesion" })).catch(() => {});
  }, []);
  return null;
}
