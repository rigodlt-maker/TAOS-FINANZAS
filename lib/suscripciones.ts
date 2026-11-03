// Mis suscripciones: lo que te cobran cada mes o cada año (Netflix, Spotify, gimnasio, apps…), sacado de tus movimientos.
// Regla: el mismo comercio cada ~mes (25–40 días) o cada ~año y todavía activo, con el mismo monto (±3%), o ±20% si es un servicio
// conocido (Netflix, gimnasio…) o está en la categoría Suscripciones. No cuentan ahorro, transferencias, servicios de la casa
// ni compras a meses sin intereses (lib/msi.ts).
// También cuenta un cargo reciente en la categoría "Suscripciones" aunque sea el primero.
// Si la usas o no, lo marcas tú en la pantalla (la app no puede saberlo).
import { normalizar, sumarDias } from "./formato";
import { esMSI } from "./msi";
import type { Categoria, Movimiento } from "./tipos";

export type Suscripcion = {
  clave: string;
  nombre: string;
  monto: number;
  frecuencia: "mensual" | "anual";
  ultimo: string;
  proximo: string;
  account_id: string;
  alMes: number;
  alAnio: number;
  cancelar: { url: string; oficial: boolean };
};

// Dónde se cancela cada servicio (páginas oficiales de cuenta). Lo demás: búsqueda "cómo cancelar …".
const CANCELAR: [RegExp, string][] = [
  [/netflix/, "https://www.netflix.com/cancelplan"],
  [/spotify/, "https://www.spotify.com/mx/account/subscription/"],
  [/disney/, "https://www.disneyplus.com/account"],
  [/youtube/, "https://www.youtube.com/paid_memberships"],
  [/google (one|play|storage)|google\*/, "https://play.google.com/store/account/subscriptions"],
  [/apple|itunes|icloud/, "https://apps.apple.com/account/subscriptions"],
  [/amazon prime|prime video|amzn prime/, "https://www.amazon.com.mx/mc/manage"],
  [/\bmax\b|hbo/, "https://auth.max.com/subscription"],
  [/xbox|microsoft/, "https://account.microsoft.com/services"],
  [/chatgpt|openai/, "https://chatgpt.com/#settings/Subscription"],
  [/claude|anthropic/, "https://claude.ai/settings/billing"],
];

export function comoCancelar(nombre: string): { url: string; oficial: boolean } {
  const n = normalizar(nombre);
  const hit = CANCELAR.find(([r]) => r.test(n));
  return hit ? { url: hit[1], oficial: true } : { url: `https://www.google.com/search?q=${encodeURIComponent(`cómo cancelar ${nombre} México`)}`, oficial: false };
}

// Servicios y apps que se pagan por suscripción (estos aceptan subidas de precio de hasta 20%)
const CONOCIDAS =
  /netflix|spotify|disney|youtube|google (one|play|storage)|apple|itunes|icloud|amazon prime|prime video|amzn prime|\bmax\b|hbo|xbox|playstation|psn|nintendo|chatgpt|openai|claude|anthropic|crunchyroll|paramount|vix|star ?\+|canva|adobe|office 365|microsoft 365|dropbox|duolingo|tinder|bumble|smart ?fit|sport ?city|sports world|gym|gimnasio|membresia|suscripcion|deezer|audible|kindle|uber one|rappi ?pro|didi ?card|meli ?\+|blim|patreon|twitch|onlyfans|calm|headspace|strava|peloton|linkedin|zoom/;
// Lo que se repite pero NO es "algo a lo que te inscribiste": ahorro, pagos de servicios de casa, súper, transferencias…
const NO_ES = /ahorro|cajita|transfer|traspaso|aportacion|meta|prestamo|pago (de )?tarjeta|nomina|renta|hipoteca/;
const CATEGORIA_NO_ES = /servicio|super|despensa|casa|hogar|remodel|salud|renta|hipoteca|colegiatura|transporte|comida/;

const dias = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
function masMeses(fecha: string, n: number) {
  const [a, m, d] = fecha.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

export function detectarSuscripciones(movimientos: Movimiento[], categorias: Categoria[], hoy: string): Suscripcion[] {
  const esSuscripcion = new Set(categorias.filter((c) => /suscrip/.test(normalizar(c.nombre))).map((c) => c.id));
  const nombreCategoria = new Map(categorias.map((c) => [c.id, normalizar(c.nombre)]));
  const grupos = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    if (m.tipo !== "gasto" || m.fecha > hoy || m.fecha < sumarDias(hoy, -400)) continue;
    const nombre = (m.comercio || m.descripcion_original).trim();
    const clave = normalizar(nombre);
    if (clave) grupos.set(clave, [...(grupos.get(clave) ?? []), m]);
  }
  const lista: Suscripcion[] = [];
  for (const [clave, movs] of grupos) {
    const ordenados = [...movs].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ultimo = ordenados.at(-1)!;
    if (NO_ES.test(clave)) continue;
    // Una compra a meses sin intereses se repite cada mes, pero no es suscripción (tiene fin y no se cancela)
    if (ordenados.some((m) => esMSI(`${m.comercio ?? ""} ${m.descripcion_original}`))) continue;
    const conocida = CONOCIDAS.test(clave) || (!!ultimo.category_id && esSuscripcion.has(ultimo.category_id));
    if (!conocida && ultimo.category_id && CATEGORIA_NO_ES.test(nombreCategoria.get(ultimo.category_id) ?? "")) continue;
    // Solo los cobros de monto parecido al último: las conocidas aceptan subidas de precio de hasta 20%;
    // un comercio cualquiera tiene que cobrar casi lo mismo (±3%) para contar como suscripción
    const margen = conocida ? 0.2 : 0.03;
    const parecidos = ordenados.filter((m) => Math.abs(m.monto - ultimo.monto) <= ultimo.monto * margen);
    const huecos = parecidos.slice(1).map((m, i) => dias(parecidos[i].fecha, m.fecha)).sort((a, b) => a - b);
    const hueco = huecos.length ? huecos[Math.floor(huecos.length / 2)] : null;
    let frecuencia: Suscripcion["frecuencia"] | null = null;
    if (hueco !== null && hueco >= 25 && hueco <= 40 && dias(ultimo.fecha, hoy) <= 45) frecuencia = "mensual";
    else if (hueco !== null && hueco >= 330 && hueco <= 400 && dias(ultimo.fecha, hoy) <= 400) frecuencia = "anual";
    else if (parecidos.length === 1 && ultimo.category_id && esSuscripcion.has(ultimo.category_id) && dias(ultimo.fecha, hoy) <= 40) frecuencia = "mensual";
    if (!frecuencia) continue;
    const paso = frecuencia === "mensual" ? 1 : 12;
    let proximo = masMeses(ultimo.fecha, paso);
    while (proximo < hoy) proximo = masMeses(proximo, paso);
    const nombre = (ultimo.comercio || ultimo.descripcion_original).trim();
    const alMes = frecuencia === "mensual" ? ultimo.monto : ultimo.monto / 12;
    lista.push({ clave, nombre, monto: ultimo.monto, frecuencia, ultimo: ultimo.fecha, proximo, account_id: ultimo.account_id, alMes, alAnio: alMes * 12, cancelar: comoCancelar(nombre) });
  }
  return lista.sort((a, b) => b.alMes - a.alMes);
}

// "¿Lo usaste este mes?" (lo marca la persona): 2 meses seguidos en "no" = probablemente no lo usas
export type Usos = Record<string, Record<string, "si" | "no">>; // clave → mes (YYYY-MM) → respuesta
export function sinUsar(usos: Usos, clave: string, mes: string): "nunca" | "este-mes" | null {
  const u = usos[clave] ?? {};
  const [a, m] = mes.split("-").map(Number);
  const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  if (u[mes] === "no" && u[anterior] === "no") return "nunca";
  if (u[mes] === "no") return "este-mes";
  return null;
}
