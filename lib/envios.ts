// Dinero que le mandas a otra persona ("Mandé $5000 a María", "Le deposité 7300 a mi esposa desde Ahorro Plus")
// y préstamos ("Le presté 5 mil a Juan, me paga el 15 de noviembre"): el préstamo no es gasto, es dinero a tu favor.
import type { Repo } from "./datos/repo";
import { dinero, fechaCorta, hoyLocal, normalizar, redondear, sumarDias } from "./formato";
import { cuentasMencionadas } from "./transferencias";
import type { Cuenta, Prestamo } from "./tipos";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const VERBO_ENVIO = /\b(transferi|envie|mande|le mande|deposite|le deposite|le transferi|le envie|le pase|pase|preste|le preste|le di|di|le gire|gire)\b/;
const ES_PRESTAMO = /\b(preste|prestamo|prestado|me (lo |la )?(paga|pagara|regresa|regresara|devuelve|devolvera)|me (va a|van a) (pagar|regresar|devolver)|me debe|a pagar)\b/;

export type PropuestaEnvio = {
  persona: string;
  monto: number;
  cuenta_id: string | null;
  fecha: string;
  prestamo: boolean;
  fecha_pago: string | null;
  nota: string | null;
  cuentas: { id: string; nombre: string }[];
};

// "el 15 de noviembre", "el 15/11", "en 2 semanas", "en 10 días", "el viernes", "a fin de mes", "la próxima quincena"
export function fechaFutura(t: string, hoy = hoyLocal()): string | null {
  const [a, m, d] = hoy.split("-").map(Number);
  const iso = (anio: number, mes: number, dia: number) => `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const conMes = t.match(new RegExp(`\\b(\\d{1,2}) de (${MESES.join("|")})\\b`));
  if (conMes) {
    const mes = MESES.indexOf(conMes[2]) + 1;
    const f = iso(a, mes, Number(conMes[1]));
    return f >= hoy ? f : iso(a + 1, mes, Number(conMes[1]));
  }
  const barra = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (barra) {
    const anio = barra[3] ? (barra[3].length === 2 ? 2000 + Number(barra[3]) : Number(barra[3])) : a;
    const f = iso(anio, Number(barra[2]), Number(barra[1]));
    return barra[3] || f >= hoy ? f : iso(a + 1, Number(barra[2]), Number(barra[1]));
  }
  const en = t.match(/\ben (\d+|un|una|dos|tres) (dias?|semanas?|mes|meses)\b/);
  if (en) {
    const n = { un: 1, una: 1, dos: 2, tres: 3 }[en[1] as "un"] ?? Number(en[1]);
    return sumarDias(hoy, n * (en[2].startsWith("semana") ? 7 : en[2].startsWith("mes") ? 30 : 1));
  }
  if (/\bfin de mes\b/.test(t)) return iso(a, m, new Date(Date.UTC(a, m, 0)).getUTCDate());
  if (/\bquincena\b/.test(t)) return d < 15 ? iso(a, m, 15) : iso(a, m, new Date(Date.UTC(a, m, 0)).getUTCDate());
  if (/\bmanana\b/.test(t)) return sumarDias(hoy, 1);
  const dia = DIAS.findIndex((x) => new RegExp(`\\b(el |este |el proximo )${x}\\b`).test(t));
  if (dia >= 0) {
    const hoyDia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
    return sumarDias(hoy, ((dia - hoyDia + 7) % 7) || 7);
  }
  return null;
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Recupera cómo lo escribiste (con acentos): "maria" → "María"
function comoLoEscribiste(frase: string, normal: string): string {
  const letras: Record<string, string> = { a: "[aáà]", e: "[eéè]", i: "[iíì]", o: "[oóò]", u: "[uúüù]", n: "[nñ]" };
  const patron = normal
    .split(" ")
    .map((w) => [...w].map((ch) => letras[ch] ?? ch).join(""))
    .join("\\s+");
  return frase.match(new RegExp(patron, "i"))?.[0] ?? normal;
}

export function leerEnvio(frase: string, cuentas: Cuenta[], hoy = hoyLocal()): PropuestaEnvio | null {
  if (/[?¿]/.test(frase)) return null;
  const t = normalizar(frase);
  if (/^(cuanto|cuando|que|cual|como|donde|quien)\b/.test(t) || /\b(voy a|quiero|tengo que|necesito)\b/.test(t)) return null;
  if (!VERBO_ENVIO.test(t)) return null;
  const crudo = frase.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  const m = crudo.match(/\$?\s?(\d+(?:\.\d{1,2})?)\s*(k|mil)?\b/);
  if (!m || !(Number(m[1]) > 0)) return null;
  const monto = redondear(Number(m[1]) * (m[2] ? 1000 : 1));

  // A quién: lo que va después de "a" (y antes de "desde", "con", "de", la fecha o el final)
  const sinMonto = t.replace(normalizar(m[0]), " ");
  const quien = sinMonto.match(/\ba (mi |la |el |los |las )?([a-zñ]+(?: [a-zñ]+){0,2}?)(?= desde\b| con\b| de (mi|la|el)\b| por\b| para\b| me\b| y\b| el \d| en\b|$)/);
  if (!quien) return null;
  const mencionadas = cuentasMencionadas(frase, cuentas);
  const persona = `${quien[1] === "mi " ? "mi " : ""}${quien[2]}`.trim();
  // Si "a quién" es una de tus cuentas, es un movimiento entre cuentas, no un envío a otra persona
  if (mencionadas.some((c) => normalizar(c.nombre).split(" ").some((w) => w.length >= 3 && persona.includes(w)))) return null;
  if (/^(la |el )?(cuenta|tarjeta|cajita)\b/.test(persona)) return null;

  const cuenta = mencionadas.find((c) => c.tipo !== "credito") ?? mencionadas[0] ?? null;
  const prestamo = ES_PRESTAMO.test(t);
  const nota = frase.match(/(?:nota|,)\s*(.+)$/i)?.[1]?.trim() ?? null;
  return {
    persona: mayuscula(comoLoEscribiste(frase, persona)),
    monto,
    cuenta_id: cuenta?.id ?? null,
    fecha: /\bayer\b/.test(t) ? sumarDias(hoy, -1) : hoy,
    prestamo,
    fecha_pago: prestamo ? fechaFutura(t.split(/\bme\b/).slice(1).join(" me ") || t, hoy) : null,
    nota: prestamo && nota && nota.length < 140 ? nota : null,
    cuentas: cuentas.map((c) => ({ id: c.id, nombre: c.nombre })),
  };
}

export function textoEnvio(e: PropuestaEnvio): string {
  const cuenta = e.cuentas.find((c) => c.id === e.cuenta_id)?.nombre;
  return [
    `Entendí que le mandaste **${dinero(e.monto)}** a **${e.persona}**${cuenta ? ` desde **${cuenta}**` : ""}.`,
    "",
    e.prestamo
      ? `Lo registro como **préstamo** (dinero a tu favor, no es gasto)${e.fecha_pago ? ` que te pagan el **${fechaCorta(e.fecha_pago)}**` : ""}. Si no te lo van a regresar, quita la palomita.`
      : "Lo registro como **gasto**. Si es un préstamo y te lo van a regresar, marca la palomita.",
  ].join("\n");
}

// Enlace para agregar el recordatorio a Google Calendar (aparece también en Panel de Vida)
export function enlaceCalendario(p: Pick<Prestamo, "persona" | "monto" | "fecha_pago" | "nota">): string | null {
  if (!p.fecha_pago) return null;
  const dia = p.fecha_pago.replace(/-/g, "");
  const siguiente = sumarDias(p.fecha_pago, 1).replace(/-/g, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `Cobrar ${dinero(p.monto)} a ${p.persona}`,
    dates: `${dia}/${siguiente}`,
    details: `Préstamo registrado en tu app Administrador Tao.${p.nota ? ` Nota: ${p.nota}` : ""}`,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export type DatosEnvio = { persona: string; monto: number; cuenta_id: string; fecha: string; prestamo: boolean; fecha_pago: string | null; nota: string | null };

// Guarda el envío: préstamo (dinero a tu favor) o gasto; en ambos casos sale de tu cuenta
export async function registrarEnvio(repo: Repo, e: DatosEnvio): Promise<{ id: string; mensaje: string; calendario: string | null }> {
  const cuenta = (await repo.cuentas()).find((c) => c.id === e.cuenta_id);
  if (!cuenta) throw new Error("Elige de qué cuenta salió.");
  if (!(e.monto > 0)) throw new Error("Escribe el monto.");
  const monto = redondear(e.monto);
  let id: string;
  if (e.prestamo) {
    id = `prestamo:${await repo.crearPrestamo({ persona: e.persona, monto, abonado: 0, cuenta_id: cuenta.id, fecha: e.fecha, fecha_pago: e.fecha_pago, nota: e.nota, liquidado_el: null })}`;
  } else {
    id = `chat:${crypto.randomUUID()}`;
    await repo.insertarMovimientos([
      {
        account_id: cuenta.id,
        fecha: e.fecha,
        descripcion_original: `Transferencia a ${e.persona}`,
        comercio: e.persona,
        monto,
        tipo: "gasto",
        category_id: null,
        requiere_revision: true,
        es_recurrente: false,
        hash_unico: id,
        import_id: null,
      },
    ]);
  }
  const saldo = redondear(cuenta.saldo_actual - monto);
  await repo.editarCuenta(cuenta.id, { saldo_actual: saldo });
  const calendario = e.prestamo ? enlaceCalendario({ ...e, monto }) : null;
  return {
    id,
    calendario,
    mensaje: e.prestamo
      ? `Listo: préstamo de ${dinero(monto)} a ${e.persona}${e.fecha_pago ? `, te paga el ${fechaCorta(e.fecha_pago)}` : ""}. ${cuenta.nombre} queda en ${dinero(saldo)}.`
      : `Listo: gasto de ${dinero(monto)} (transferencia a ${e.persona}). ${cuenta.nombre} queda en ${dinero(saldo)}. Ponle categoría en Por revisar.`,
  };
}

export async function deshacerEnvio(repo: Repo, id: string): Promise<string> {
  const cuentas = await repo.cuentas();
  const regresar = async (cuentaId: string | null, monto: number) => {
    const c = cuentas.find((x) => x.id === cuentaId);
    if (c) await repo.editarCuenta(c.id, { saldo_actual: redondear(c.saldo_actual + monto) });
  };
  if (id.startsWith("prestamo:")) {
    const p = await repo.borrarPrestamo(id.slice(9));
    if (!p) throw new Error("Ese préstamo ya no existe.");
    await regresar(p.cuenta_id, p.monto - p.abonado);
  } else {
    const m = await repo.borrarMovimientoPorHash(id);
    if (!m) throw new Error("Ese movimiento ya no existe.");
    await regresar(m.account_id, m.monto);
  }
  return "Deshecho: lo borré y el saldo regresó a como estaba.";
}

// ---------- Cobrar un préstamo ----------

export const pendiente = (p: Prestamo) => redondear(p.monto - p.abonado);
export const abiertos = (ps: Prestamo[]) => ps.filter((p) => !p.liquidado_el && pendiente(p) > 0);

export type PropuestaCobro = { prestamo_id: string; persona: string; pendiente: number; monto: number; cuenta_id: string | null; cuentas: { id: string; nombre: string }[] };

// "María me pagó", "Juan me devolvió 2 mil", "ya me pagó mi hermano"
export function leerCobro(frase: string, prestamos: Prestamo[], cuentas: Cuenta[]): PropuestaCobro | null {
  const t = normalizar(frase);
  if (/[?¿]/.test(frase) || !/\bme (pago|pagaron|devolvio|devolvieron|regreso|regresaron|abono|deposito)\b/.test(t)) return null;
  const lista = abiertos(prestamos);
  const p = lista.find((x) => normalizar(x.persona).split(" ").filter((w) => w.length >= 3 && w !== "mi").some((w) => new RegExp(`\\b${w}\\b`).test(t)));
  if (!p) return null;
  const crudo = frase.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  const m = crudo.match(/\$?\s?(\d+(?:\.\d{1,2})?)\s*(k|mil)?\b/);
  const monto = m ? redondear(Number(m[1]) * (m[2] ? 1000 : 1)) : pendiente(p);
  const cuenta = cuentasMencionadas(frase, cuentas)[0]?.id ?? p.cuenta_id;
  return { prestamo_id: p.id, persona: p.persona, pendiente: pendiente(p), monto: Math.min(monto, pendiente(p)), cuenta_id: cuenta, cuentas: cuentas.map((c) => ({ id: c.id, nombre: c.nombre })) };
}

export async function registrarCobro(repo: Repo, prestamoId: string, monto: number, cuentaId: string, hoy = hoyLocal()): Promise<string> {
  const p = (await repo.prestamos()).find((x) => x.id === prestamoId);
  if (!p) throw new Error("No encontré ese préstamo.");
  const cuenta = (await repo.cuentas()).find((c) => c.id === cuentaId);
  if (!cuenta) throw new Error("Elige a qué cuenta llegó.");
  const cobro = redondear(Math.min(monto, pendiente(p)));
  if (!(cobro > 0)) throw new Error("Escribe cuánto te pagaron.");
  const abonado = redondear(p.abonado + cobro);
  await repo.editarPrestamo(p.id, { abonado, liquidado_el: abonado >= p.monto ? hoy : null });
  await repo.editarCuenta(cuenta.id, { saldo_actual: redondear(cuenta.saldo_actual + cobro) });
  const falta = redondear(p.monto - abonado);
  return falta > 0 ? `Listo: ${p.persona} te abonó ${dinero(cobro)}. Todavía te debe ${dinero(falta)}.` : `Listo: ${p.persona} ya te pagó todo (${dinero(p.monto)}). 🎉`;
}

// ---------- Depositar a una cuenta tuya sin decir de dónde ("Agrega 7300 a cajita turbo") ----------

export type PropuestaDeposito = { destino_id: string; destino: string; monto: number; fecha: string; cuentas: { id: string; nombre: string; credito: boolean }[] };

export function leerDeposito(frase: string, cuentas: Cuenta[], hoy = hoyLocal()): PropuestaDeposito | null {
  const t = normalizar(frase);
  if (/[?¿]/.test(frase) || /^(cuanto|cuando|que|cual|como|donde)\b/.test(t)) return null;
  if (!/\b(agrega|agregale|agregue|anade|suma|sumale|deposite|meti|mete|puse|pon|abone|guarde|ahorre|aparte|entraron|llegaron|me llegaron|recibi)\b/.test(t)) return null;
  const mencionadas = cuentasMencionadas(frase, cuentas);
  if (mencionadas.length !== 1 || mencionadas[0].tipo === "credito") return null;
  const crudo = frase.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  const m = crudo.match(/\$?\s?(\d+(?:\.\d{1,2})?)\s*(k|mil)?\b/);
  if (!m || !(Number(m[1]) > 0)) return null;
  const destino = mencionadas[0];
  return {
    destino_id: destino.id,
    destino: destino.nombre,
    monto: redondear(Number(m[1]) * (m[2] ? 1000 : 1)),
    fecha: /\bayer\b/.test(t) ? sumarDias(hoy, -1) : hoy,
    cuentas: cuentas.filter((c) => c.id !== destino.id).map((c) => ({ id: c.id, nombre: c.nombre, credito: c.tipo === "credito" })),
  };
}

export const textoDeposito = (d: PropuestaDeposito) =>
  `Entendí que entraron **${dinero(d.monto)}** a **${d.destino}**.\n\n¿De dónde salió? Si lo pasaste desde otra cuenta tuya, elígela (no cuenta como ingreso). Si es dinero nuevo (te pagaron, vendiste algo), elige "Dinero nuevo".`;
