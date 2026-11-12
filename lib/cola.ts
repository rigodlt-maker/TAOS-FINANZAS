// Cola "sin internet": si no hay señal, el gasto se guarda en el celular y se manda solo cuando vuelve la conexión.
// Solo para el navegador (usa localStorage). La usan la captura rápida y los gastos frecuentes.
//
// S15-R6 · Cada borrador tiene DUEÑO: se guarda bajo la clave de la sesión con la que se anotó (el id del usuario que da
// el servidor) y solo esa sesión lo ve y lo manda. Si entra otra persona en el mismo celular, no ve ni manda lo de la
// primera; al volver a entrar la dueña, sus borradores siguen ahí. Sin dueño conocido no se guarda nada.
// La cola vieja (sin dueño, de versiones anteriores) NO se borra ni se manda sola: se APARTA tal cual. La app avisa que
// hay gastos apartados y la persona elige, uno por uno, «Son míos: registrar» (pasan a su cola) o «Descartar».
// revisar = el servidor no lo registró solo (p. ej. es un movimiento entre cuentas, o ya no existe la cuenta): no se
// vuelve a mandar solo; la pantalla te lo muestra para pasárselo a Tao o descartarlo. Nunca se borra sin que elijas.
export type PorEnviar =
  | { id: string; tipo: "frase"; frase: string; creado: string; dueno: string; revisar?: string }
  | { id: string; tipo: "frecuente"; datos: { comercio: string; monto: number; account_id: string; category_id: string | null }; creado: string; dueno: string; revisar?: string };

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
// Escribe (o borra) una clave y CONFIRMA leyéndola de vuelta. false = no quedó escrita (sin espacio, bloqueado…).
function escribir(clave: string, lista: unknown[]): boolean {
  try {
    const texto = JSON.stringify(lista);
    if (lista.length) localStorage.setItem(clave, texto);
    else localStorage.removeItem(clave);
    return lista.length ? localStorage.getItem(clave) === texto : localStorage.getItem(clave) === null;
  } catch {
    return false;
  }
}
function guardarApartados(lista: Apartado[]): boolean {
  const ok = escribir(APARTADA, lista);
  avisar();
  return ok;
}
// «Son míos: registrar»: pasa a la cola de la sesión actual (se manda con su dueño, como cualquier otro).
// S15-R6 (ronda 4): el apartado solo se quita cuando su copia en la cola QUEDÓ ESCRITA. Si no se pudo escribir, sigue
// apartado y se devuelve false (la pantalla lo dice). Si se escribió en la cola pero no se pudo quitar de apartados, se
// deshace la copia para que no quede dos veces. En ningún caso desaparece.
export function recuperarApartado(id: string): boolean {
  if (!dueno) return false;
  const lista = leerApartados();
  const p = lista.find((x) => x.id === id);
  if (!p) return false;
  const { id: _id, creado: _c, ...resto } = p;
  void _id;
  void _c;
  const nuevoId = `apartado-${p.id.replace(/[^\w-]/g, "").slice(0, 60) || Date.now().toString(36)}`;
  const cola = leerCola();
  if (!cola.some((x) => x.id === nuevoId)) {
    if (!guardar([...cola, { ...resto, id: nuevoId, creado: new Date().toISOString(), dueno } as PorEnviar])) return false;
  }
  if (!guardarApartados(lista.filter((x) => x.id !== id))) {
    guardar(leerCola().filter((x) => x.id !== nuevoId));
    return false;
  }
  return true;
}
export function descartarApartado(id: string): boolean {
  if (!dueno) return false;
  const lista = leerApartados();
  if (!lista.some((x) => x.id === id)) return false;
  return guardarApartados(lista.filter((x) => x.id !== id));
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

// true solo si la cola quedó escrita de verdad (se confirma leyéndola de vuelta)
function guardar(lista: PorEnviar[]): boolean {
  if (!dueno) return false;
  const ok = escribir(PREFIJO + dueno, lista);
  avisar();
  return ok;
}

type SinId<T> = T extends unknown ? Omit<T, "id" | "creado" | "dueno"> : never;
// Devuelve false si no quedó guardado (sin sesión conocida, o el celular no dejó escribir): quien llama lo avisa
export function agregarACola(p: SinId<PorEnviar>): boolean {
  if (!dueno) return false;
  return guardar([...leerCola(), { ...p, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, creado: new Date().toISOString(), dueno } as PorEnviar]);
}

export function quitarDeCola(id: string): boolean {
  const ok = guardar(leerCola().filter((p) => p.id !== id));
  if (ok) marcasEnMemoria.delete(id);
  return ok;
}

// Lo que se manda solo al volver la señal (lo marcado «por revisar» espera a que tú decidas)
// S15-R6 (ronda 6) · Si el celular no deja guardar la marca «por revisar», la marca se queda EN MEMORIA y el envío
// automático se PAUSA por completo (para todos los borradores) hasta que tú toques «Reintentar»: así un borrador que el
// servidor rechazó nunca se vuelve a mandar solo. El borrador no se toca: sigue en la cola, tal cual.
// (Si además se recarga la página antes de poder guardar, el rechazado se manda una vez más, el servidor lo vuelve a
// rechazar —o lo reconoce por su id— y se vuelve a pausar: no se duplica ni se pierde.)
const marcasEnMemoria = new Map<string, string>();
let pausado = false;
export const envioPausado = () => pausado;

export const porEnviar = () => (pausado ? [] : leerCola().filter((p) => !p.revisar && !marcasEnMemoria.has(p.id)));
export const porRevisar = () =>
  leerCola()
    .map((p) => (marcasEnMemoria.has(p.id) && !p.revisar ? { ...p, revisar: marcasEnMemoria.get(p.id) } : p))
    .filter((p) => !!p.revisar);
export function marcarRevisar(id: string, motivo: string): boolean {
  const texto = motivo || "Revísalo";
  const ok = guardar(leerCola().map((p) => (p.id === id ? { ...p, revisar: texto } : p)));
  if (ok) {
    marcasEnMemoria.delete(id);
    return true;
  }
  marcasEnMemoria.set(id, texto);
  pausado = true;
  avisar();
  return false;
}
// El envío automático (lo usa components/sin-internet.tsx). mandar = la acción del servidor con dueño e id fijo.
// Registrado o ya estaba → se quita (si no se puede quitar, el servidor lo reconoce por su id: no se duplica).
// No registrado → «por revisar»; si ni la marca se pudo guardar, se pausa TODO y se detiene aquí.
// Sin señal (la petición truena) → se detiene y se intenta en la próxima.
export async function enviarCola(mandar: (p: PorEnviar) => Promise<{ ok: boolean; mensaje: string }>): Promise<"listo" | "pausado" | "sin-senal"> {
  for (const p of porEnviar()) {
    let r: { ok: boolean; mensaje: string };
    try {
      r = await mandar(p);
    } catch {
      return "sin-senal";
    }
    if (r.ok) quitarDeCola(p.id);
    else if (!marcarRevisar(p.id, r.mensaje)) return "pausado";
  }
  return "listo";
}

// «Reintentar»: intenta guardar las marcas pendientes. Solo si TODAS quedaron guardadas se reanuda el envío.
export function reanudarEnvio(): boolean {
  for (const [id, motivo] of [...marcasEnMemoria]) {
    if (!leerCola().some((p) => p.id === id)) {
      marcasEnMemoria.delete(id); // ya no está (se descartó)
      continue;
    }
    if (guardar(leerCola().map((p) => (p.id === id ? { ...p, revisar: motivo } : p)))) marcasEnMemoria.delete(id);
    else return false;
  }
  pausado = false;
  avisar();
  return true;
}

// ¿Falló por falta de internet? (el celular dice que no hay red, o la petición ni siquiera salió)
export const sinInternet = (e?: unknown) => (typeof navigator !== "undefined" && !navigator.onLine) || (e instanceof TypeError && /fetch|network|Failed/i.test(e.message));
