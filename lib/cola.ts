// Cola "sin internet": si no hay señal, el gasto se guarda en el celular y se manda solo cuando vuelve la conexión.
// Solo para el navegador (usa localStorage). La usan la captura rápida y los gastos frecuentes.
//
// S15-R6 · Cada borrador tiene DUEÑO: se guarda bajo la clave de la sesión con la que se anotó (el id del usuario que da
// el servidor) y solo esa sesión lo ve y lo manda. Si entra otra persona en el mismo celular, no ve ni manda lo de la
// primera; al volver a entrar la dueña, sus borradores siguen ahí. Sin dueño conocido no se guarda nada.
// La cola vieja (sin dueño, de versiones anteriores) NO se borra ni se manda sola: se APARTA tal cual. La app avisa que
// hay gastos apartados y la persona elige, uno por uno, «Son míos: registrar» (pasan a su cola) o «Descartar».
export type PorEnviar =
  | { id: string; tipo: "frase"; frase: string; creado: string; dueno: string }
  | { id: string; tipo: "frecuente"; datos: { comercio: string; monto: number; account_id: string; category_id: string | null }; creado: string; dueno: string };

const VIEJA = "taos-cola-sin-internet";
export const APARTADA = "taos-cola-apartada";
export type Apartado = { id: string; tipo: "frase"; frase: string; creado: string } | { id: string; tipo: "frecuente"; datos: Extract<PorEnviar, { tipo: "frecuente" }>["datos"]; creado: string };
const PREFIJO = "taos-cola-sin-internet:";
export const EVENTO_COLA = "taos-cola";
const DUENO_VALIDO = /^[\w-]{1,64}$/;
// La pantalla «Sin internet» (public/sin-internet.html) no tiene sesión: lee aquí de quién es la última sesión abierta.
// Se borra al llegar a la entrada (cerrar sesión), así sin sesión esa pantalla no guarda nada.
export const CLAVE_DUENO = "taos-cola-dueno";

let dueno: string | null = null;

// Lo llama la app con el id de la sesión actual (lo da el servidor). null = sin sesión: la cola queda vacía.
export function fijarDueno(id: string | null) {
  const nuevo = id && DUENO_VALIDO.test(id) ? id : null;
  const cambio = nuevo !== dueno;
  dueno = nuevo;
  apartarVieja();
  try {
    if (nuevo) localStorage.setItem(CLAVE_DUENO, nuevo);
    else localStorage.removeItem(CLAVE_DUENO);
  } catch {}
  if (cambio) avisar();
}
export const duenoDeCola = () => dueno;

const leerLista = (clave: string): unknown[] => {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const esApartado = (p: unknown): p is Apartado => {
  const x = p as Apartado;
  return !!x && typeof x.id === "string" && ((x.tipo === "frase" && typeof x.frase === "string") || (x.tipo === "frecuente" && !!x.datos));
};

// Mueve la cola vieja a «apartados»: primero se escribe la copia y solo si quedó escrita se quita la vieja
function apartarVieja() {
  try {
    const crudo = localStorage.getItem(VIEJA);
    if (crudo === null) return;
    const viejos = leerLista(VIEJA).filter(esApartado);
    const ya = leerLista(APARTADA).filter(esApartado);
    const ids = new Set(ya.map((p) => p.id));
    const juntos = [...ya, ...viejos.filter((p) => !ids.has(p.id)).map((p) => ({ ...p, creado: p.creado ?? "" }))];
    if (juntos.length) {
      localStorage.setItem(APARTADA, JSON.stringify(juntos));
      if (localStorage.getItem(APARTADA) === null) return; // no se pudo guardar la copia: la vieja se queda
    }
    localStorage.removeItem(VIEJA);
  } catch {}
}

// Gastos apartados (de antes de que la cola tuviera dueño). Solo se ven con una sesión abierta y nunca se mandan solos.
export function leerApartados(): Apartado[] {
  if (!dueno) return [];
  apartarVieja();
  return leerLista(APARTADA).filter(esApartado);
}
function guardarApartados(lista: Apartado[]) {
  try {
    if (lista.length) localStorage.setItem(APARTADA, JSON.stringify(lista));
    else localStorage.removeItem(APARTADA);
  } catch {}
  avisar();
}
// «Son míos: registrar»: pasa a la cola de la sesión actual (se manda con su dueño, como cualquier otro)
export function recuperarApartado(id: string): boolean {
  if (!dueno) return false;
  const lista = leerApartados();
  const p = lista.find((x) => x.id === id);
  if (!p) return false;
  const { id: _id, creado: _c, ...resto } = p;
  void _id;
  void _c;
  if (!agregarACola(resto as SinId<PorEnviar>)) return false;
  guardarApartados(lista.filter((x) => x.id !== id));
  return true;
}
export function descartarApartado(id: string): boolean {
  if (!dueno) return false;
  const lista = leerApartados();
  if (!lista.some((x) => x.id === id)) return false;
  guardarApartados(lista.filter((x) => x.id !== id));
  return true;
}

function avisar() {
  try {
    window.dispatchEvent(new Event(EVENTO_COLA));
  } catch {}
}

export function leerCola(): PorEnviar[] {
  if (!dueno) return [];
  try {
    const v = JSON.parse(localStorage.getItem(PREFIJO + dueno) ?? "[]");
    // Doble candado: aunque alguien copie la lista a otra clave, solo cuenta lo que dice ser de esta sesión
    return Array.isArray(v) ? v.filter((p) => p && p.dueno === dueno) : [];
  } catch {
    return [];
  }
}

function guardar(lista: PorEnviar[]) {
  if (!dueno) return;
  try {
    if (lista.length) localStorage.setItem(PREFIJO + dueno, JSON.stringify(lista));
    else localStorage.removeItem(PREFIJO + dueno);
  } catch {}
  avisar();
}

type SinId<T> = T extends unknown ? Omit<T, "id" | "creado" | "dueno"> : never;
// Devuelve false si no se pudo guardar (no se sabe de quién es la sesión): quien llama avisa que no quedó guardado
export function agregarACola(p: SinId<PorEnviar>): boolean {
  if (!dueno) return false;
  guardar([...leerCola(), { ...p, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, creado: new Date().toISOString(), dueno } as PorEnviar]);
  return true;
}

export function quitarDeCola(id: string) {
  guardar(leerCola().filter((p) => p.id !== id));
}

// ¿Falló por falta de internet? (el celular dice que no hay red, o la petición ni siquiera salió)
export const sinInternet = (e?: unknown) => (typeof navigator !== "undefined" && !navigator.onLine) || (e instanceof TypeError && /fetch|network|Failed/i.test(e.message));
