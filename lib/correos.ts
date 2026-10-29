// Avisos de tu banco que llegan a Gmail (Nu, Revolut, HSBC, BBVA, Amex…): se leen y se registran solos.
// - Entre tus cuentas ("Enviaste $X a <tu nombre>" + "Recibiste $X"): un movimiento entre cuentas.
// - Pago a tu tarjeta: un movimiento desde la cuenta que pagó (si se sabe; si no, queda para que confirmes).
// - A otra persona / compra: un gasto en "Por revisar". Dinero de otra persona: un ingreso.
// Todo lo que se registra se puede deshacer, y nada se registra dos veces.
import type { Repo } from "./datos/repo";
import { deshacerEnvio, registrarEnvio } from "./envios";
import { dinero, hoyLocal, normalizar, redondear, sumarDias } from "./formato";
import { aplicarTransferencia } from "./transferencias";
import type { ClaseCorreo, CorreoBanco, Cuenta } from "./tipos";

export type CorreoEntrante = { id: string; de: string; asunto: string; fecha: string; texto: string };

export type Lectura = {
  banco: string;
  clase: ClaseCorreo;
  monto: number;
  contraparte: string | null;
  entidad: string | null;
  propio: boolean;
  cuenta_id: string | null;
};

// Remitente → banco, y la palabra con que aparece en el nombre de tus cuentas
const BANCOS: [string, RegExp, RegExp][] = [
  ["Nu", /nu\.com\.mx|nubank/, /\bnu\b/],
  ["Revolut", /revolut/, /\brevolut\b/],
  ["HSBC", /hsbc/, /\bhsbc\b/],
  ["BBVA", /bbva/, /\bbbva\b/],
  ["Amex", /americanexpress|aexp/, /\bamex\b|american express/],
  ["Palacio de Hierro", /palaciodehierro/, /\bpalacio\b/],
  ["Liverpool", /liverpool/, /\bliverpool\b/],
  ["Banamex", /banamex|citi/, /\bbanamex\b|\bciti\b/],
  ["Santander", /santander/, /\bsantander\b/],
  ["Banorte", /banorte/, /\bbanorte\b/],
  ["Mercado Pago", /mercadopago/, /\bmercado ?pago\b/],
  ["Plata", /plata(card)?\.(com|mx)/, /\bplata\b/],
  ["Stori", /stori/, /\bstori\b/],
];

// Correos que no son movimientos (recordatorios, códigos, promociones)
const NO_ES_MOVIMIENTO = /no olvides|recordatorio|se aproxima|fecha limite|codigo|contrasena|verifica|promoci|gana |ganar |invita|opinion|encuesta|estado de cuenta|beneficio|agregaste un contacto|inicio de sesion|nuevo dispositivo/;

const montoEn = (t: string, etiqueta?: RegExp): number | null => {
  const re = etiqueta ? new RegExp(`${etiqueta.source}\\s*(?:MX|MXN)?\\s*\\$\\s?([\\d,]+(?:\\.\\d{1,2})?)`, "i") : /\$\s?([\d,]+(?:\.\d{1,2})?)/;
  const m = t.match(re);
  const n = m ? Number(m[1].replace(/,/g, "")) : NaN;
  return n > 0 ? redondear(n) : null;
};

const sinEmojis = (t: string) => t.replace(/[^\p{L}\p{N}\s.,'-]/gu, "").replace(/\s+/g, " ").trim();

// ¿El nombre es el tuyo? Se compara con el saludo del correo ("Hola, Juan Carlos")
function esPropio(contraparte: string | null, saludo: string | null): boolean {
  if (!contraparte) return false;
  const tuyo = normalizar(`${saludo ?? ""} ${process.env.TITULAR_NOMBRE ?? ""}`).split(" ").filter((w) => w.length >= 4);
  if (!tuyo.length) return false;
  const suyo = new Set(normalizar(contraparte).split(" "));
  const coinciden = new Set(tuyo.filter((w) => suyo.has(w))).size;
  return coinciden >= Math.min(2, new Set(tuyo).size);
}

// La cuenta de ese banco: la tarjeta de crédito o la cuenta con dinero (débito, ahorro)
export function cuentaDelBanco(palabra: RegExp, cuentas: Cuenta[], credito: boolean): Cuenta | null {
  const delBanco = cuentas.filter((c) => palabra.test(normalizar(c.nombre)) && (c.tipo === "credito") === credito);
  if (delBanco.length <= 1) return delBanco[0] ?? null;
  // Varias: se prefiere débito, luego ahorro
  return delBanco.find((c) => c.tipo === "debito") ?? delBanco.find((c) => c.tipo === "ahorro") ?? null;
}

function cuentaPorEntidad(entidad: string, cuentas: Cuenta[], excepto: string | null): Cuenta | null {
  const e = normalizar(entidad);
  const banco = BANCOS.find(([nombre, , palabra]) => palabra.test(e) || e.includes(normalizar(nombre)));
  const candidatas = cuentas.filter((c) => c.id !== excepto && (banco ? banco[2].test(normalizar(c.nombre)) : normalizar(c.nombre).includes(e)));
  return candidatas.length === 1 ? candidatas[0] : null;
}

export function leerCorreo(c: CorreoEntrante, cuentas: Cuenta[]): Lectura | null {
  const de = c.de.toLowerCase();
  const banco = BANCOS.find(([, remitente]) => remitente.test(de));
  if (!banco) return null;
  const [nombreBanco, , palabra] = banco;
  const texto = `${c.asunto}\n${c.texto}`.replace(/[|*•]/g, " ").replace(/\s+/g, " ");
  const t = normalizar(texto);
  const asunto = normalizar(c.asunto);
  const saludo = texto.match(/hola,?\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)?)/i)?.[1] ?? null;

  let clase: ClaseCorreo | null = null;
  let monto: number | null = null;
  let contraparte: string | null = null;
  let entidad: string | null = null;

  // Bonificación por puntos (Amex Membership Rewards): baja tu deuda total, pero NO cuenta como pago de tu corte
  // ("El crédito que recibas no te exime de realizar el pago requerido en tu Estado de Cuenta")
  let bonificacion = false;
  if (/bonificacion (por|de) (tus )?puntos|canje de puntos|uso de puntos|recibiste una bonificacion/.test(t)) {
    clase = "entrada";
    bonificacion = true;
    monto = montoEn(texto, /bonificaci[oó]n:?/) ?? montoEn(texto);
    contraparte = /membership rewards/.test(t) ? "Membership Rewards" : "Bonificación por puntos";
  } else if (/recibimos (tu|el) pago|gracias por tu pago|pago recibido|aplicamos tu pago|recibimos un pago/.test(t)) {
    clase = "pago_tarjeta";
    monto = montoEn(texto);
  } else if (/^enviaste|transferencia fue exitosa|transferencia exitosa|transferencia (enviada|realizada)|enviaste \$/.test(asunto) || /^enviaste/.test(t)) {
    clase = "salida";
    monto = montoEn(texto, /monto:?/) ?? montoEn(texto, /enviaste/) ?? montoEn(texto);
    contraparte =
      texto.match(/Nombre:\s*(.+?)\s+(?:Entidad|CLABE|Cuenta|Estatus|Clave|Banco)\b/)?.[1] ??
      c.asunto.match(/enviaste \$[\d,.]+ a (.+)/i)?.[1] ??
      texto.match(/transferencia para (.+?) se envi/i)?.[1] ??
      null;
    entidad = texto.match(/(?:Entidad|Banco destino|Banco):\s*(.+?)\s+(?:CLABE|Cuenta|Estatus|Tarjeta|Clave|Referencia)\b/)?.[1] ?? null;
  } else if (/recibiste|transferencia recibida|te (depositaron|enviaron)|deposito recibido|abono recibido/.test(asunto) || /hizo una transferencia a tu/.test(t)) {
    clase = "entrada";
    monto = montoEn(texto, /monto:?/) ?? montoEn(texto);
    contraparte =
      texto.match(/([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,60}?) hizo una transferencia/)?.[1] ??
      c.asunto.match(/recibiste \$[\d,.]+ de (.+)/i)?.[1] ??
      texto.match(/(?:De|Ordenante|Remitente):\s*(.+?)\s+(?:Monto|Fecha|Concepto|Cuenta)\b/)?.[1] ??
      null;
  } else if (
    !NO_ES_MOVIMIENTO.test(asunto) &&
    /(compra|cargo|consumo)s? (aprobad|autorizad|realizad|exitos|con tu tarjeta)|realizaste (una|un) (compra|cargo|pago)|se realizo (una|un) (compra|cargo)|^pagaste|cargo a tu (tarjeta|cuenta)|retiro (de efectivo|en cajero)|compra en linea/.test(t)
  ) {
    clase = "compra";
    monto = montoEn(texto, /(?:monto|importe|cantidad|total):?/) ?? montoEn(texto);
    contraparte =
      texto.match(/(?:Comercio|Establecimiento|Negocio):\s*(.+?)\s+(?:Monto|Fecha|Importe|Tarjeta|Hora)\b/)?.[1] ??
      texto.match(/\b(?:en|a)\s+([A-Z0-9][A-Za-z0-9 .*&'-]{2,40}?)\s+(?:por|el|con)\b/)?.[1] ??
      null;
  }
  if (!clase || !monto) return null;
  if (NO_ES_MOVIMIENTO.test(asunto) && clase !== "pago_tarjeta") return null;

  contraparte = contraparte ? sinEmojis(contraparte) : null;
  const propio = !bonificacion && (clase === "salida" || clase === "entrada") && esPropio(contraparte, saludo);
  const credito = bonificacion || clase === "pago_tarjeta" || (clase === "compra" && !/debito|retiro/.test(t) && cuentaDelBanco(palabra, cuentas, true) !== null);
  // Varias tarjetas del mismo banco: por la terminación (si la pusiste en el nombre); los puntos Membership Rewards no son de la Aeroméxico
  const terminacion = texto.match(/terminaci[oó]n(?: de la tarjeta)?:?\s*(\d{4,5})/i)?.[1];
  const delBanco = cuentas.filter((c) => palabra.test(normalizar(c.nombre)) && (c.tipo === "credito") === credito);
  const porTerminacion = terminacion ? delBanco.find((c) => c.nombre.includes(terminacion.slice(-4))) : undefined;
  const sinAeromexico = bonificacion && /membership/.test(t) ? delBanco.filter((c) => !/aeromexico/.test(normalizar(c.nombre))) : [];
  const cuenta =
    porTerminacion ??
    (sinAeromexico.length === 1 ? sinAeromexico[0] : null) ??
    cuentaDelBanco(palabra, cuentas, credito) ??
    (clase === "compra" ? cuentaDelBanco(palabra, cuentas, !credito) : null);
  return { banco: nombreBanco, clase, monto, contraparte, entidad: entidad ? sinEmojis(entidad) : null, propio, cuenta_id: cuenta?.id ?? null };
}

// ---------- Registrar ----------

const VENTANA_MS = 3 * 3600_000; // los dos correos de una misma transferencia llegan con minutos de diferencia
const fechaDe = (iso: string) => hoyLocal(new Date(iso));
const nombre = (cuentas: Cuenta[], id: string | null) => cuentas.find((c) => c.id === id)?.nombre ?? "otra cuenta";

async function transferir(repo: Repo, origenId: string, destinoId: string, monto: number, fecha: string, nota: string) {
  const cuentas = await repo.cuentas();
  const origen = cuentas.find((c) => c.id === origenId);
  const destino = cuentas.find((c) => c.id === destinoId);
  if (!origen || !destino || origen.id === destino.id) return null;
  // ¿Ya lo habías registrado tú (en el chat o en Entre cuentas)?
  const previas = await repo.transferencias(100);
  const repetida = previas.find(
    (t) => t.origen_id === origen.id && t.destino_id === destino.id && Math.abs(t.monto - monto) < 0.01 && Math.abs(Date.parse(t.fecha) - Date.parse(fecha)) <= 2 * 86400_000,
  );
  if (repetida) return { duplicada: true as const, id: repetida.id, texto: `Ya lo tenías registrado: ${dinero(monto)} de ${origen.nombre} a ${destino.nombre}.` };
  const saldos = aplicarTransferencia(origen, destino, monto);
  const id = await repo.crearTransferencia({ fecha, origen_id: origen.id, destino_id: destino.id, monto, nota });
  await repo.editarCuenta(origen.id, { saldo_actual: saldos.origen });
  await repo.editarCuenta(destino.id, { saldo_actual: saldos.destino });
  return { duplicada: false as const, id, texto: `${dinero(monto)} de ${origen.nombre} a ${destino.nombre}${destino.tipo === "credito" ? " (pago de tarjeta)" : ""}.` };
}

async function movimiento(repo: Repo, correo: CorreoBanco, cuentaId: string) {
  const cuentas = await repo.cuentas();
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  if (!cuenta) return null;
  const ingreso = correo.clase === "entrada";
  const puntos = ingreso && /membership|puntos/i.test(correo.contraparte ?? "");
  const descripcion = puntos
    ? `Bonificación por puntos ${correo.contraparte ?? ""}`.trim()
    : correo.clase === "salida"
      ? `Transferencia a ${correo.contraparte ?? "otra persona"}`
      : ingreso
        ? `Transferencia de ${correo.contraparte ?? "otra persona"}`
        : `Compra ${correo.contraparte ?? ""}`.trim();
  const hash = `correo:${correo.gmail_id}`;
  await repo.insertarMovimientos([
    {
      account_id: cuenta.id,
      fecha: fechaDe(correo.recibido),
      descripcion_original: `${descripcion} (aviso de ${correo.banco})`,
      comercio: correo.contraparte ?? correo.banco,
      monto: correo.monto,
      tipo: ingreso ? "ingreso" : "gasto",
      category_id: null,
      requiere_revision: !puntos,
      es_recurrente: false,
      hash_unico: hash,
      import_id: null,
    },
  ]);
  await repo.editarCuenta(cuenta.id, { saldo_actual: redondear(cuenta.saldo_actual + (ingreso ? correo.monto : -correo.monto)) });
  if (puntos)
    return { hash, texto: `${descripcion}: ${dinero(correo.monto)} menos de deuda en ${cuenta.nombre}. No cuenta como pago de tu corte: se refleja en tu siguiente estado de cuenta.` };
  return { hash, texto: `${ingreso ? "Ingreso" : "Gasto"} de ${dinero(correo.monto)} en ${cuenta.nombre}: ${descripcion}. Ponle categoría en Por revisar.` };
}

// Qué te pregunta la app en cada aviso pendiente
export function preguntaDe(correo: CorreoBanco, cuentas: Cuenta[]): string {
  const quien = correo.contraparte ?? "otra persona";
  switch (correo.clase) {
    case "pago_tarjeta":
      return `Pagaste ${dinero(correo.monto)} a tu ${nombre(cuentas, correo.cuenta_id)}. ¿De qué cuenta salió el dinero?`;
    case "salida":
      return correo.propio
        ? `Salieron ${dinero(correo.monto)} de ${correo.banco} a otra cuenta tuya${correo.entidad ? ` (${correo.entidad})` : ""}. ¿De cuál salió y a cuál llegó?`
        : `Le mandaste ${dinero(correo.monto)} a ${quien} (${correo.banco}). ¿De qué cuenta salió? ¿Es un préstamo?`;
    case "entrada":
      return correo.propio
        ? `Llegaron ${dinero(correo.monto)} a ${correo.banco} desde otra cuenta tuya. ¿A cuál llegó y de cuál salió?`
        : `Te llegaron ${dinero(correo.monto)} de ${quien} (${correo.banco}). ¿A qué cuenta?`;
    default:
      return `Compra de ${dinero(correo.monto)}${correo.contraparte ? ` en ${correo.contraparte}` : ""} (${correo.banco}). ¿Con qué cuenta pagaste?`;
  }
}

const cerca = (a: CorreoBanco, b: CorreoBanco) => Math.abs(a.monto - b.monto) < 0.01 && Math.abs(Date.parse(a.recibido) - Date.parse(b.recibido)) <= VENTANA_MS;
// La otra mitad de una transferencia entre tus cuentas ("Enviaste" de Revolut ↔ "Recibiste" de Nu)
const complementa = (a: CorreoBanco, b: CorreoBanco) =>
  a.id !== b.id &&
  cerca(a, b) &&
  ((a.clase === "salida" && a.propio && ((b.clase === "entrada" && b.propio) || b.clase === "pago_tarjeta")) ||
    (b.clase === "salida" && b.propio && ((a.clase === "entrada" && a.propio) || a.clase === "pago_tarjeta")));

// Lo que la app sugiere en cada pendiente (tú confirmas o cambias): la cuenta del aviso y, si aplica, la otra
export function sugerencias(correo: CorreoBanco, pendientes: CorreoBanco[], cuentas: Cuenta[]): { cuenta: string | null; otra: string | null } {
  const pareja = pendientes.find((x) => complementa(correo, x));
  const otra = pareja?.cuenta_id ?? (correo.clase === "salida" && correo.entidad ? (cuentaPorEntidad(correo.entidad, cuentas, correo.cuenta_id)?.id ?? null) : null);
  return { cuenta: correo.cuenta_id, otra: otra && otra !== correo.cuenta_id ? otra : null };
}

const cercaDeFecha = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 2 * 86400_000;

// ¿Ya lo registraste tú (en el chat, en Entre cuentas o como préstamo)?
async function yaRegistrado(repo: Repo, correo: CorreoBanco, fecha: string): Promise<{ texto: string; transferencia_id?: string } | null> {
  const mismo = (monto: number) => Math.abs(monto - correo.monto) < 0.01;
  if (correo.propio || correo.clase === "pago_tarjeta") {
    const t = (await repo.transferencias(100)).find((x) => mismo(x.monto) && cercaDeFecha(x.fecha, fecha) && (correo.clase !== "pago_tarjeta" || x.destino_id === correo.cuenta_id));
    return t ? { texto: `Ya lo tenías registrado: ${dinero(correo.monto)} entre tus cuentas.`, transferencia_id: t.id } : null;
  }
  if (correo.clase === "salida") {
    const p = (await repo.prestamos().catch(() => [])).find((x) => mismo(x.monto) && cercaDeFecha(x.fecha, fecha));
    if (p) return { texto: `Ya lo tenías registrado como préstamo a ${p.persona}.` };
  }
  const tipo = correo.clase === "entrada" ? "ingreso" : "gasto";
  const m = (await repo.movimientos({ desde: sumarDias(fecha, -2), hasta: sumarDias(fecha, 2) })).find(
    (x) => x.tipo === tipo && mismo(x.monto) && x.hash_unico.startsWith("chat:"),
  );
  return m ? { texto: `Ya lo tenías registrado: ${tipo} de ${dinero(correo.monto)} (${m.comercio ?? m.descripcion_original}).` } : null;
}

// Solo se registra solo lo que es seguro: compras y bonificaciones de una tarjeta de crédito.
// Lo demás (de qué cuenta salió el dinero, a dónde llegó) lo confirmas tú; la app solo sugiere.
async function resolver(repo: Repo, correo: CorreoBanco): Promise<"aplicado" | "pendiente" | "duplicado"> {
  const cuentas = await repo.cuentas();
  const fecha = fechaDe(correo.recibido);
  const tarjeta = cuentas.find((c) => c.id === correo.cuenta_id && c.tipo === "credito");
  if (tarjeta && (correo.clase === "compra" || (correo.clase === "entrada" && !correo.propio))) {
    const r = await movimiento(repo, correo, tarjeta.id);
    if (r) {
      await repo.editarCorreo(correo.id, { estado: "aplicado", resultado: r.texto, movimiento_hash: r.hash });
      return "aplicado";
    }
  }
  const ya = await yaRegistrado(repo, correo, fecha);
  if (ya) {
    await repo.editarCorreo(correo.id, { estado: "duplicado", resultado: ya.texto, transferencia_id: ya.transferencia_id ?? null });
    return "duplicado";
  }
  await repo.editarCorreo(correo.id, { resultado: preguntaDe(correo, cuentas) });
  return "pendiente";
}

export type ResumenCorreos = { recibidos: number; nuevos: number; aplicados: number; pendientes: number; duplicados: number };

export async function procesarCorreos(repo: Repo, correos: CorreoEntrante[]): Promise<ResumenCorreos> {
  const resumen: ResumenCorreos = { recibidos: correos.length, nuevos: 0, aplicados: 0, pendientes: 0, duplicados: 0 };
  const yaVistos = await repo.correosExistentes(correos.map((c) => c.id));
  const nuevos = correos.filter((c) => !yaVistos.has(c.id)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const c of nuevos) {
    const lectura = leerCorreo(c, await repo.cuentas());
    if (!lectura) continue;
    resumen.nuevos++;
    const id = await repo.crearCorreo({
      gmail_id: c.id,
      recibido: new Date(c.fecha).toISOString(),
      asunto: c.asunto.slice(0, 200),
      ...lectura,
      estado: "pendiente",
      resultado: null,
      transferencia_id: null,
      movimiento_hash: null,
    });
    const estado = await resolver(repo, (await repo.correo(id))!);
    if (estado === "aplicado") resumen.aplicados++;
    else if (estado === "duplicado") resumen.duplicados++;
  }
  resumen.pendientes = (await repo.correos({ estado: "pendiente" })).length;
  return resumen;
}

// ---------- Lo que haces tú desde la app ----------

export type Confirmacion = { cuenta_id: string; otra_id?: string | null; prestamo?: boolean; fecha_pago?: string | null; nota?: string | null };

// Confirmar un pendiente con las cuentas que tú eliges
export async function confirmarCorreo(repo: Repo, id: string, d: Confirmacion): Promise<string> {
  const correo = await repo.correo(id);
  if (!correo || correo.estado !== "pendiente") throw new Error("Ese aviso ya no está pendiente.");
  const fecha = fechaDe(correo.recibido);
  if (!d.cuenta_id && correo.clase !== "pago_tarjeta") throw new Error("Elige la cuenta.");

  if (correo.propio || correo.clase === "pago_tarjeta") {
    if (!d.otra_id) throw new Error(correo.clase === "salida" ? "Elige a qué cuenta llegó." : "Elige de qué cuenta salió.");
    const [origen, destino] =
      correo.clase === "salida" ? [d.cuenta_id, d.otra_id] : correo.clase === "pago_tarjeta" ? [d.otra_id, correo.cuenta_id ?? d.cuenta_id] : [d.otra_id, d.cuenta_id];
    const r = await transferir(repo, origen, destino, correo.monto, fecha, `Aviso de ${correo.banco}`);
    if (!r) throw new Error("Elige dos cuentas distintas.");
    // La otra mitad de la transferencia (si llegó) también queda lista
    const pareja = (await repo.correos({ estado: "pendiente" })).find((x) => complementa(correo, x));
    await repo.editarCorreo(correo.id, { cuenta_id: correo.clase === "pago_tarjeta" ? correo.cuenta_id : d.cuenta_id });
    for (const x of pareja ? [correo, pareja] : [correo]) await repo.editarCorreo(x.id, { estado: r.duplicada ? "duplicado" : "aplicado", resultado: r.texto, transferencia_id: r.id });
    return r.texto;
  }

  if (correo.clase === "salida" && d.prestamo) {
    const r = await registrarEnvio(repo, {
      persona: correo.contraparte ?? "Otra persona",
      monto: correo.monto,
      cuenta_id: d.cuenta_id,
      fecha,
      prestamo: true,
      fecha_pago: d.fecha_pago || null,
      nota: d.nota || null,
    });
    await repo.editarCorreo(correo.id, { estado: "aplicado", cuenta_id: d.cuenta_id, resultado: r.mensaje, movimiento_hash: r.id });
    return r.mensaje;
  }

  const r = await movimiento(repo, correo, d.cuenta_id);
  if (!r) throw new Error("No encontré esa cuenta.");
  await repo.editarCorreo(correo.id, { estado: "aplicado", cuenta_id: d.cuenta_id, resultado: r.texto, movimiento_hash: r.hash });
  return r.texto;
}

export async function ignorarCorreo(repo: Repo, id: string) {
  await repo.editarCorreo(id, { estado: "ignorado", resultado: "Lo ignoraste." });
}

// Deshacer: regresa los saldos y el aviso vuelve a "pendiente" para que elijas bien las cuentas
export async function deshacerCorreo(repo: Repo, id: string): Promise<string> {
  const correo = await repo.correo(id);
  if (!correo || (correo.estado !== "aplicado" && correo.estado !== "duplicado")) throw new Error("Ese aviso no tiene nada que deshacer.");
  const cuentas = await repo.cuentas();
  const reabrir = async (x: CorreoBanco) =>
    repo.editarCorreo(x.id, { estado: "pendiente", resultado: preguntaDe(x, cuentas), transferencia_id: null, movimiento_hash: null });

  // Un duplicado no movió dinero: solo vuelve a pendiente ("no era el mismo")
  if (correo.estado === "duplicado") {
    await reabrir(correo);
    return "Listo: el aviso volvió a pendientes.";
  }
  if (correo.transferencia_id) {
    const t = await repo.borrarTransferencia(correo.transferencia_id);
    if (t) {
      const origen = cuentas.find((c) => c.id === t.origen_id);
      const destino = cuentas.find((c) => c.id === t.destino_id);
      if (origen) await repo.editarCuenta(origen.id, { saldo_actual: redondear(origen.saldo_actual + t.monto) });
      if (destino) await repo.editarCuenta(destino.id, { saldo_actual: redondear(destino.saldo_actual - t.monto) });
    }
    for (const x of (await repo.correos({ limite: 200 })).filter((x) => x.transferencia_id === correo.transferencia_id && x.estado === "aplicado")) await reabrir(x);
  } else if (correo.movimiento_hash?.startsWith("prestamo:")) {
    await deshacerEnvio(repo, correo.movimiento_hash);
    await reabrir(correo);
  } else if (correo.movimiento_hash) {
    const m = await repo.borrarMovimientoPorHash(correo.movimiento_hash);
    if (m) {
      const cuenta = cuentas.find((c) => c.id === m.account_id);
      if (cuenta) await repo.editarCuenta(cuenta.id, { saldo_actual: redondear(cuenta.saldo_actual + (m.tipo === "ingreso" ? -m.monto : m.monto)) });
    }
    await reabrir(correo);
  }
  return "Deshecho: los saldos regresaron y el aviso volvió a pendientes para que elijas la cuenta correcta.";
}

export const diaDe = (iso: string) => fechaDe(iso);
