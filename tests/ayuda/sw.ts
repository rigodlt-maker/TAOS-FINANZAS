// Corre public/sw.js en una máquina virtual de Node con un celular de mentira: cachés, ventanas y notificaciones.
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function swDePrueba(archivo = "public/sw.js") {
  const almacen = new Map<string, Map<string, string>>();
  const caches = {
    open: async (n: string) => {
      if (!almacen.has(n)) almacen.set(n, new Map());
      const m = almacen.get(n)!;
      return {
        match: async (k: string) => (m.has(k) ? new Response(m.get(k)) : undefined),
        put: async (k: string, r: Response) => void m.set(k, await r.text()),
        add: async () => {},
      };
    },
    keys: async () => [...almacen.keys()],
    delete: async (n: string) => almacen.delete(n),
    match: async () => undefined,
  };
  const oyentes: Record<string, (e: unknown) => void> = {};
  const mostradas: { titulo: string; opciones: { body?: string } ; cerrada: boolean }[] = [];
  const self = {
    addEventListener: (t: string, f: (e: unknown) => void) => (oyentes[t] = f),
    skipWaiting: () => {},
    clients: { matchAll: async () => [], claim: async () => {} },
    location: { origin: "https://app.example" },
    registration: {
      showNotification: async (titulo: string, opciones: { body?: string }) => void mostradas.push({ titulo, opciones, cerrada: false }),
      getNotifications: async () => mostradas.filter((n) => !n.cerrada).map((n) => ({ close: () => (n.cerrada = true) })),
    },
  };
  vm.runInNewContext(readFileSync(archivo, "utf8"), { self, caches, Response, Request, URL, fetch, console, JSON, Date, Promise });
  const disparar = async (tipo: string, datos: unknown) => {
    const esperas: Promise<unknown>[] = [];
    oyentes[tipo]({ data: datos, waitUntil: (p: Promise<unknown>) => esperas.push(p) });
    await Promise.all(esperas);
  };
  return {
    almacen,
    mostradas,
    push: (aviso: object) => disparar("push", { json: () => aviso, text: () => JSON.stringify(aviso) }),
    mensaje: (tipo: string) => disparar("message", { tipo }),
    bandeja: () => {
      const v = almacen.get("bandeja-avisos")?.get("/__avisos");
      return v ? (JSON.parse(v) as { titulo: string; cuerpo: string }[]) : [];
    },
  };
}
