// Cola "sin internet": si no hay señal, el gasto se guarda en el celular y se manda solo cuando vuelve la conexión.
// Solo para el navegador (usa localStorage). La usan la captura rápida y los gastos frecuentes.
export type PorEnviar =
  | { id: string; tipo: "frase"; frase: string; creado: string }
  | { id: string; tipo: "frecuente"; datos: { comercio: string; monto: number; account_id: string; category_id: string | null }; creado: string };

const CLAVE = "taos-cola-sin-internet";
export const EVENTO_COLA = "taos-cola";

export function leerCola(): PorEnviar[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function guardar(lista: PorEnviar[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {}
  window.dispatchEvent(new Event(EVENTO_COLA));
}

type SinId<T> = T extends unknown ? Omit<T, "id" | "creado"> : never;
export function agregarACola(p: SinId<PorEnviar>) {
  guardar([...leerCola(), { ...p, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, creado: new Date().toISOString() } as PorEnviar]);
}

export function quitarDeCola(id: string) {
  guardar(leerCola().filter((p) => p.id !== id));
}

// ¿Falló por falta de internet? (el celular dice que no hay red, o la petición ni siquiera salió)
export const sinInternet = (e?: unknown) => (typeof navigator !== "undefined" && !navigator.onLine) || (e instanceof TypeError && /fetch|network|Failed/i.test(e.message));
