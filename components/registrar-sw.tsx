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
    if (!("serviceWorker" in navigator) || !ENTRADAS.some((e) => ruta?.startsWith(e))) return;
    navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ tipo: "taos-sin-sesion" })).catch(() => {});
  }, [ruta]);
  return null;
}
