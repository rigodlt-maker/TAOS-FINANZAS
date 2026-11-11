"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// En la pantalla de entrada no hay sesión: se le pide al celular borrar lo que pudiera tener algo tuyo (S15).
// Depende de la ruta, así también funciona cuando llegas a la entrada sin recargar la página.
const ENTRADAS = ["/login", "/acceso-denegado"];

export function RegistrarSW() {
  const ruta = usePathname();
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !ruta) return;
    // Fuera de la entrada solo se llega con sesión (proxy.ts manda a /login si no hay): ahí los avisos vuelven a guardarse
    const tipo = ENTRADAS.some((e) => ruta.startsWith(e)) ? "taos-sin-sesion" : "taos-con-sesion";
    navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ tipo })).catch(() => {});
  }, [ruta]);
  return null;
}
