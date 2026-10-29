// Gastos e ingresos escritos en el chat: "Pagué $30 de tamales con efectivo", "gasté 150 en uber con Nu", "me pagaron 5 mil"
import { categoriaMencionada } from "./asesor";
import { interpretarCaptura } from "./captura";
import { categorizarConReglas } from "./categorizar";
import type { Repo } from "./datos/repo";
import { dinero, fechaCorta, hoyLocal, normalizar, redondear, sumarDias } from "./formato";
import type { TipoMovimiento } from "./importar";
import { cuentasMencionadas } from "./transferencias";
import type { Categoria, Cuenta, Regla } from "./tipos";

export type PropuestaGasto = {
  tipo: TipoMovimiento;
  monto: number;
  comercio: string;
  fecha: string;
  account_id: string | null;
  category_id: string | null;
  cuentas: { id: string; nombre: string }[];
  categorias: { id: string; nombre: string }[];
};

const VERBO_GASTO = /\b(pague|gaste|compre|me cobraron|cobraron|me costo|costo|salio|di|deje|preste|invite|cargue|puse)\b/;
const VERBO_INGRESO = /\b(cobre|me pagaron|me depositaron|depositaron|recibi|vendi|gane|me entro|me entraron|ingreso|me dieron|me regalaron)\b/;
const PREGUNTA = /^(cuanto|cuanta|cuando|que|cual|como|donde|por que|en que|con que|con cual|debo|deberia|puedo|me conviene)\b/;
const FUTURO = /\b(voy a|vamos a|quiero|pienso|planeo|tengo que|necesito|me gustaria)\b/;

export function leerGastoDeChat(frase: string, cuentas: Cuenta[], categorias: Categoria[], reglas: Regla[], hoy = hoyLocal()): PropuestaGasto | null {
  const t = normalizar(frase);
  if (/[?¿]/.test(frase) || PREGUNTA.test(t) || FUTURO.test(t)) return null;
  const ingreso = VERBO_INGRESO.test(t);
  if (!ingreso && !VERBO_GASTO.test(t) && !/^\$?\s?\d/.test(frase.trim())) return null;
  const c = interpretarCaptura(frase, cuentas, hoy);
  if (!c) return null;
  const tipo: TipoMovimiento = ingreso ? "ingreso" : "gasto";
  const mencionadas = cuentasMencionadas(frase, cuentas);
  const cuenta = c.account_id ?? mencionadas[0]?.id ?? null;
  // "vendí 3 tarjetas por 900": el monto es el que lleva $, "por" o "mil"; si no, el número más grande
  const crudo = frase.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  const marcado = crudo.match(/(?:\$\s?|\bpor\s+\$?\s?)(\d+(?:\.\d{1,2})?)\s*(k|mil)?\b/) ?? crudo.match(/(\d+(?:\.\d{1,2})?)\s*(k|mil)\b/);
  const numeros = [...crudo.matchAll(/(?<![\d.])(\d+(?:\.\d{1,2})?)(?![\d.])/g)].map((x) => Number(x[1]));
  const monto = marcado ? Number(marcado[1]) * (marcado[2] ? 1000 : 1) : Math.max(c.monto, ...numeros);
  // El nombre de la cuenta no es parte del comercio ("Uber nu" → "Uber")
  const delaCuenta = new Set(
    mencionadas.concat(cuentas.filter((x) => x.id === cuenta)).flatMap((x) => normalizar(x.nombre).split(" ")).filter((w) => !["de", "la", "el"].includes(w)),
  );
  const comercio = c.comercio
    .split(" ")
    .filter((w) => !delaCuenta.has(normalizar(w)) && !/^\d+$/.test(w))
    .join(" ");
  const nombre = comercio ? comercio.charAt(0).toUpperCase() + comercio.slice(1) : tipo === "ingreso" ? "Ingreso" : "Gasto";
  const categoria =
    tipo === "ingreso"
      ? null
      : (categorizarConReglas(`${nombre} ${frase}`, reglas, categorias)?.category_id ?? categoriaMencionada(normalizar(nombre), categorias)?.id ?? categoriaMencionada(t, categorias)?.id ?? null);
  return {
    tipo,
    monto: redondear(monto),
    comercio: nombre,
    fecha: c.fecha,
    account_id: cuenta,
    category_id: categoria,
    cuentas: cuentas.map((x) => ({ id: x.id, nombre: x.nombre })),
    categorias: categorias.map((x) => ({ id: x.id, nombre: x.nombre })),
  };
}

export function textoPropuestaGasto(g: PropuestaGasto, hoy = hoyLocal()): string {
  const cuenta = g.cuentas.find((c) => c.id === g.account_id)?.nombre;
  const categoria = g.categorias.find((c) => c.id === g.category_id)?.nombre;
  const cuando = g.fecha === hoy ? "hoy" : g.fecha === sumarDias(hoy, -1) ? "ayer" : fechaCorta(g.fecha);
  return [
    `Entendí ${g.tipo === "ingreso" ? "un **ingreso**" : "un **gasto**"}:`,
    "",
    `- **${g.tipo === "ingreso" ? "Concepto" : "En"}:** ${g.comercio}`,
    `- **Monto:** ${dinero(g.monto)}`,
    `- **${g.tipo === "ingreso" ? "Entró a" : "Pagaste con"}:** ${cuenta ?? "elige la cuenta abajo"}`,
    g.tipo === "gasto" ? `- **Categoría:** ${categoria ?? "elige una abajo"}` : "",
    `- **Cuándo:** ${cuando}`,
    "",
    "¿Lo registro? Puedes cambiar cualquier dato antes de confirmar.",
  ]
    .filter((x, i, a) => x !== "" || a[i - 1] !== "")
    .join("\n");
}

export type DatosGasto = { tipo: TipoMovimiento; monto: number; comercio: string; fecha: string; account_id: string; category_id: string | null };

// Guarda el gasto o ingreso y mueve el saldo de la cuenta (efectivo baja $30, etc.)
export async function registrarGastoChat(repo: Repo, g: DatosGasto): Promise<{ mensaje: string; id: string }> {
  const cuentas = await repo.cuentas();
  const cuenta = cuentas.find((c) => c.id === g.account_id);
  if (!cuenta) throw new Error("Elige la cuenta.");
  if (!(g.monto > 0)) throw new Error("Escribe el monto.");
  const monto = redondear(g.monto);
  const id = `chat:${crypto.randomUUID()}`;
  await repo.insertarMovimientos([
    {
      account_id: cuenta.id,
      fecha: g.fecha,
      descripcion_original: g.comercio,
      comercio: g.comercio,
      monto,
      tipo: g.tipo,
      category_id: g.tipo === "ingreso" ? null : g.category_id,
      requiere_revision: g.tipo === "gasto" && !g.category_id,
      es_recurrente: false,
      hash_unico: id,
      import_id: null,
    },
  ]);
  const saldo = redondear(cuenta.saldo_actual + (g.tipo === "ingreso" ? monto : -monto));
  await repo.editarCuenta(cuenta.id, { saldo_actual: saldo });
  const categoria = (await repo.categorias()).find((c) => c.id === g.category_id)?.nombre;
  const queda = cuenta.tipo === "credito" ? (saldo < 0 ? `a ${cuenta.nombre} le debes ${dinero(-saldo)}` : `${cuenta.nombre} queda en ceros`) : `${cuenta.nombre} queda en ${dinero(saldo)}`;
  return {
    id,
    mensaje: `Listo: ${g.tipo === "ingreso" ? "ingreso" : "gasto"} de ${dinero(monto)} en ${g.comercio}${categoria ? ` · ${categoria}` : ""}. ${queda.charAt(0).toUpperCase()}${queda.slice(1)}.`,
  };
}

export async function deshacerGastoChat(repo: Repo, id: string): Promise<string> {
  if (!id.startsWith("chat:")) throw new Error("No encontré ese movimiento.");
  const m = await repo.borrarMovimientoPorHash(id);
  if (!m) throw new Error("Ese movimiento ya no existe.");
  const cuenta = (await repo.cuentas()).find((c) => c.id === m.account_id);
  if (cuenta) await repo.editarCuenta(cuenta.id, { saldo_actual: redondear(cuenta.saldo_actual + (m.tipo === "ingreso" ? -m.monto : m.monto)) });
  return "Deshecho: lo borré y el saldo regresó a como estaba.";
}
