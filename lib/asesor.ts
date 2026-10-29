// Asesor por chat, sin IA: entiende la pregunta con reglas y contesta con tus propios datos.
// No da recomendaciones de inversión; solo gasto, pagos, tarjetas, presupuesto y metas.
import { diasDelMes, diasEntre, dinero, dineroCorto, fechaCorta, mesDe, nombreMes, normalizar, rangoDelMes, sumarDias, sumarMeses } from "./formato";
import { analizarMeta } from "./metas";
import { pagosDeTarjeta, pagosProximos } from "./pagos";
import { resumenPorCategoria } from "./presupuesto";
import { cuentasMencionadas } from "./transferencias";
import { detectarRecurrentes } from "./recurrentes";
import { ganaRendimiento, interesDelDia, proyectar } from "./rendimientos";
import { estadoTarjeta } from "./tarjetas";
import { abiertos, pendiente } from "./envios";
import type { Aportacion, Categoria, Cuenta, Meta, Movimiento, PagoProgramado, Prestamo, Transferencia } from "./tipos";

export type DatosAsesor = {
  hoy: string;
  cuentas: Cuenta[];
  categorias: Categoria[];
  movimientos: Movimiento[]; // al menos los últimos 6 meses
  pagos: PagoProgramado[];
  metas: Meta[];
  aportaciones: Aportacion[];
  transferencias?: Transferencia[]; // pagos a tarjetas: para separar lo del corte de las compras nuevas
  prestamos?: Prestamo[]; // dinero que te deben
};

const ctx = (d: DatosAsesor) => ({ movimientos: d.movimientos, transferencias: d.transferencias ?? [] });
const estado = (c: Cuenta, d: DatosAsesor) => estadoTarjeta(c, d.movimientos, d.transferencias ?? [], d.hoy);
const masNuevas = (n: number) => (n > 0.5 ? ` (+${dineroCorto(n)} de compras nuevas)` : "");

export const PREGUNTAS_EJEMPLO = [
  "¿Cuánto dinero tengo en mis cuentas?",
  "¿En qué gasto más?",
  "¿Qué tarjeta debo pagar pronto?",
  "Voy a comprar algo de $3,000, ¿qué tarjeta uso?",
  "¿Cuánto me queda de presupuesto?",
];

type Periodo = { inicio: string; fin: string; nombre: string };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "hoy", "ayer", "esta semana", "la semana pasada", "últimos 15 días", "este mes" (por defecto), "mes pasado",
// "en septiembre", "este año", "el año pasado", "en total"
export function periodoDe(p: string, hoy: string): Periodo {
  const mes = mesDe(hoy);
  const anio = Number(hoy.slice(0, 4));
  if (/\b(antier|anteayer)\b/.test(p)) return { inicio: sumarDias(hoy, -2), fin: sumarDias(hoy, -2), nombre: "antier" };
  if (/\bayer\b/.test(p)) return { inicio: sumarDias(hoy, -1), fin: sumarDias(hoy, -1), nombre: "ayer" };
  if (/\bhoy\b/.test(p)) return { inicio: hoy, fin: hoy, nombre: "hoy" };
  const ultimos = p.match(/\bultimos? (\d+) dias\b/);
  if (ultimos) return { inicio: sumarDias(hoy, -(Number(ultimos[1]) - 1)), fin: hoy, nombre: `los últimos ${ultimos[1]} días` };
  if (/semana pasada|semana anterior/.test(p)) return { inicio: sumarDias(hoy, -13), fin: sumarDias(hoy, -7), nombre: "la semana pasada" };
  if (/semana/.test(p)) return { inicio: sumarDias(hoy, -6), fin: hoy, nombre: "los últimos 7 días" };
  if (/mes pasado|ultimo mes|mes anterior/.test(p)) {
    const m = sumarMeses(mes, -1);
    return { ...rangoDelMes(m), nombre: nombreMes(m) };
  }
  if (/ano pasado|ano anterior/.test(p)) return { inicio: `${anio - 1}-01-01`, fin: `${anio - 1}-12-31`, nombre: String(anio - 1) };
  if (/este ano|en el ano|anual|lo que va del ano/.test(p)) return { inicio: `${anio}-01-01`, fin: hoy, nombre: `lo que va de ${anio}` };
  if (/en total|desde siempre|historico|todo el tiempo/.test(p)) return { inicio: sumarDias(hoy, -365), fin: hoy, nombre: "los últimos 12 meses" };
  const i = MESES.findIndex((n) => new RegExp(`\\b${n}\\b`).test(p));
  if (i >= 0) {
    let m = `${anio}-${String(i + 1).padStart(2, "0")}`;
    if (m > mes) m = sumarMeses(m, -12);
    return { ...rangoDelMes(m), nombre: nombreMes(m) };
  }
  return { ...rangoDelMes(mes), nombre: "este mes" };
}

// Primer monto que aparezca en la pregunta: "$3,000", "3000 pesos", "3 mil"
export function montoDe(p: string): number | null {
  const mil = p.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (mil) return Number(mil[1].replace(",", ".")) * 1000;
  const m = p.match(/\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/);
  return m ? Number(m[0].replace(/[$,\s]/g, "")) : null;
}

const gastosEn = (movs: Movimiento[], per: Periodo) => movs.filter((m) => m.tipo === "gasto" && m.fecha >= per.inicio && m.fecha <= per.fin);
const suma = (movs: Movimiento[]) => movs.reduce((t, m) => t + m.monto, 0);
const nombreComercio = (m: Movimiento) => m.comercio || m.descripcion_original;

// ---------- Tarjeta recomendada para una compra de hoy ----------

function fechaEn(anio: number, mes: number, dia: number): string {
  const total = diasDelMes(anio, mes);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, total)).padStart(2, "0")}`;
}

function mesSiguiente(anio: number, mes: number): [number, number] {
  return mes === 12 ? [anio + 1, 1] : [anio, mes + 1];
}

// Una compra de hoy entra al próximo corte (si hoy ya es día de corte, al del mes que sigue) y se paga en el límite posterior a ese corte
export function plazoDeCompra(cuenta: Cuenta, hoy: string): { corte: string; limite: string; dias: number } | null {
  if (cuenta.tipo !== "credito" || !cuenta.dia_corte || !cuenta.dia_limite_pago) return null;
  let [a, m] = hoy.split("-").map(Number);
  let corte = fechaEn(a, m, cuenta.dia_corte);
  if (corte <= hoy) {
    [a, m] = mesSiguiente(a, m);
    corte = fechaEn(a, m, cuenta.dia_corte);
  }
  let limite = fechaEn(a, m, cuenta.dia_limite_pago);
  if (limite <= corte) {
    const [a2, m2] = mesSiguiente(a, m);
    limite = fechaEn(a2, m2, cuenta.dia_limite_pago);
  }
  return { corte, limite, dias: diasEntre(hoy, limite) };
}

function recomendarTarjeta(original: string, d: DatosAsesor): string {
  const opciones = d.cuentas
    .map((c) => ({ c, plazo: plazoDeCompra(c, d.hoy) }))
    .filter((x): x is { c: Cuenta; plazo: NonNullable<ReturnType<typeof plazoDeCompra>> } => !!x.plazo)
    .sort((x, y) => y.plazo.dias - x.plazo.dias);
  if (!opciones.length) return "No tengo los días de corte y de pago de tus tarjetas. Agrégalos en **Más › Ajustes › Cuentas** y te digo cuál conviene.";

  const monto = montoDe(original);
  const [mejor, segunda] = opciones;
  const efectivo = d.cuentas.filter((c) => c.tipo !== "credito").reduce((t, c) => t + c.saldo_actual, 0);
  const lineas = [
    `**Usa tu ${mejor.c.nombre}.** Si compras hoy, entra al corte del ${fechaCorta(mejor.plazo.corte)} y la pagas hasta el **${fechaCorta(mejor.plazo.limite)}**: tienes **${mejor.plazo.dias} días** para pagarla.`,
  ];
  if (segunda) lineas.push(`La que le sigue es tu ${segunda.c.nombre}: ${segunda.plazo.dias} días (paga el ${fechaCorta(segunda.plazo.limite)}).`);
  const peores = opciones.slice(-1).filter((x) => x !== mejor && x !== segunda);
  if (peores.length) lineas.push(`Evita hoy tu ${peores[0].c.nombre}: corta muy pronto y solo tendrías ${peores[0].plazo.dias} días.`);
  if (monto) {
    lineas.push(
      `\nPara tus ${dinero(monto)}: ${
        monto <= efectivo
          ? `tienes ${dineroCorto(efectivo)} en débito y efectivo, así que podrías pagarla completa el ${fechaCorta(mejor.plazo.limite)} sin problema.`
          : `ojo, hoy tienes ${dineroCorto(efectivo)} en débito y efectivo, menos que la compra. Si es grande, búscala a meses sin intereses.`
      }`,
    );
  }
  lineas.push("\nPaga siempre el **total** antes de la fecha límite: si dejas saldo, los intereses van de 50% a 100% anual.");
  return lineas.join("\n");
}

// ---------- Respuestas ----------

function enQueGasto(p: string, d: DatosAsesor): string {
  const per = periodoDe(p, d.hoy);
  const gastos = gastosEn(d.movimientos, per);
  if (!gastos.length) return `No tengo gastos registrados en ${per.nombre}.`;
  const total = suma(gastos);
  const porCat = new Map<string, number>();
  for (const g of gastos) {
    const nombre = d.categorias.find((c) => c.id === g.category_id)?.nombre ?? "Sin categoría";
    porCat.set(nombre, (porCat.get(nombre) ?? 0) + g.monto);
  }
  const top = [...porCat].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const porComercio = new Map<string, number>();
  for (const g of gastos) porComercio.set(nombreComercio(g), (porComercio.get(nombreComercio(g)) ?? 0) + g.monto);
  const comercios = [...porComercio].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return [
    `${per.nombre === "este mes" ? "Este mes" : `En ${per.nombre}`} gastaste **${dinero(total)}**. Donde más se te va el dinero es **${top[0][0]}** (${Math.round((top[0][1] / total) * 100)}%).`,
    "",
    top.map(([n, v]) => `- **${n}:** ${dinero(v)} · ${Math.round((v / total) * 100)}%`).join("\n"),
    "",
    `Los comercios donde más gastas: ${comercios.map(([n, v]) => `${n} (${dineroCorto(v)})`).join(", ")}.`,
  ].join("\n");
}

function cuantoGasteEn(p: string, d: DatosAsesor): string | null {
  const per = periodoDe(p, d.hoy);
  const cat = d.categorias.find((c) => {
    const n = normalizar(c.nombre);
    return p.includes(n) || n.split(" ").some((w) => w.length >= 4 && p.includes(w));
  });
  const gastos = gastosEn(d.movimientos, per);
  if (cat) {
    const propios = gastos.filter((g) => g.category_id === cat.id);
    const r = resumenPorCategoria(mesDe(d.hoy), d.hoy, [cat], d.movimientos)[0];
    const presupuesto = per.nombre === "este mes" && cat.presupuesto_mensual > 0 ? ` de ${dineroCorto(cat.presupuesto_mensual)} presupuestados (${Math.round(r.porcentajeGastado)}%)` : "";
    return `En **${cat.nombre}** llevas **${dinero(suma(propios))}** en ${per.nombre}${presupuesto}, en ${propios.length} movimientos.`;
  }
  // Si no es categoría, busca un comercio: "¿cuánto gasté en Oxxo?"
  const palabra = p.match(/(?:en|de)\s+([a-z0-9ñ ]{3,})$/)?.[1]?.replace(new RegExp(`\\b(este|el|la|mes|pasado|semana|ano|en|${MESES.join("|")})\\b`, "g"), "").replace(/\s+/g, " ").trim();
  if (!palabra) return null;
  const propios = gastos.filter((g) => normalizar(nombreComercio(g)).includes(palabra));
  if (!propios.length) return `No encontré gastos en "${palabra}" en ${per.nombre}.`;
  return `En **${palabra}** llevas **${dinero(suma(propios))}** en ${per.nombre}, en ${propios.length} compras.`;
}

function quePagar(d: DatosAsesor): string {
  const tarjetas = pagosDeTarjeta(d.cuentas, d.hoy, 31, ctx(d)).filter((x) => x.deuda > 0.5 || x.total > 0.5);
  const pagos = pagosProximos(d.pagos, d.hoy, 31);
  if (!tarjetas.length && !pagos.length) return "No tienes pagos en los próximos 30 días. 🎉";
  const lineas: string[] = [];
  if (tarjetas.length) {
    const t = tarjetas[0];
    const cuando = t.vencido ? `**venció el ${fechaCorta(t.vence)}**` : t.dias === 0 ? "**vence hoy**" : `vence el **${fechaCorta(t.vence)}** (en ${t.dias} días)`;
    lineas.push(
      t.yaCorto
        ? `La que tienes que pagar primero es tu **${t.cuenta.nombre}**: ${cuando}. Para no generar intereses paga **${dinero(t.deuda)}**.${t.nuevas > 0.5 ? ` Las compras que hiciste después del corte (${dinero(t.nuevas)}) van a tu siguiente estado de cuenta.` : ""}`
        : `Tu siguiente pago es tu **${t.cuenta.nombre}** el **${fechaCorta(t.vence)}**: todavía no corta y llevas ${dinero(t.deuda)} en compras.`,
      "",
      tarjetas
        .map((x) => `- [${x.cuenta.nombre}](/pagar/${x.cuenta.id}): ${fechaCorta(x.vence)} · ${x.yaCorto ? `al corte **${dineroCorto(x.deuda)}**${masNuevas(x.nuevas)}` : `aún no corta, llevas ${dineroCorto(x.deuda)}`}`)
        .join("\n"),
    );
  }
  if (pagos.length) lineas.push("", "Otros pagos programados:", pagos.map((x) => `- **${x.nombre}:** ${fechaCorta(x.proximo_vencimiento)} · ${dinero(x.monto)}`).join("\n"));
  if (tarjetas.some((x) => x.yaCorto && !estado(x.cuenta, d).confirmado))
    lineas.push("", "Lo del corte lo calculo con tus compras registradas. Si no coincide con tu app del banco, tócala y escribe el \"pago para no generar intereses\".");
  return lineas.join("\n");
}

function presupuesto(d: DatosAsesor): string {
  const mes = mesDe(d.hoy);
  const r = resumenPorCategoria(mes, d.hoy, d.categorias, d.movimientos).filter((x) => x.presupuesto > 0);
  if (!r.length) return "Todavía no tienes presupuestos. Ponlos en **Más › Ajustes › Categorías**.";
  const total = r.reduce((t, x) => t + x.presupuesto, 0);
  const gastado = r.reduce((t, x) => t + x.gastado, 0);
  const excedidas = r.filter((x) => x.estado === "excedido");
  const riesgo = r.filter((x) => x.estado === "en_riesgo");
  const diasRestantes = diasEntre(d.hoy, rangoDelMes(mes).fin) + 1;
  const queda = total - gastado;
  return [
    queda >= 0
      ? `Te quedan **${dinero(queda)}** de ${dineroCorto(total)} para los ${diasRestantes} días que faltan del mes: unos **${dineroCorto(queda / diasRestantes)} al día**.`
      : `Ya te pasaste del presupuesto del mes por **${dinero(-queda)}**.`,
    excedidas.length ? `\nExcedidas: ${excedidas.map((x) => `**${x.categoria.nombre}** (+${dineroCorto(-x.diferencia)})`).join(", ")}.` : "",
    riesgo.length ? `En riesgo: ${riesgo.map((x) => x.categoria.nombre).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Una cuenta en particular: "¿cuánto le debo a la HSBC?", "¿cuándo vence Nu?", "¿cuánto tengo en Revolut?"
function deUnaCuenta(cuentas: Cuenta[], d: DatosAsesor): string {
  return cuentas
    .map((c) => {
      if (c.tipo !== "credito")
        return `En **${c.nombre}** tienes **${dinero(c.saldo_actual)}**.${ganaRendimiento(c) ? ` Te da ${c.tasa_anual}% anual: unos **${dinero(interesDelDia(c))} al día** (${dineroCorto(proyectar(c, 30))} al mes).` : ""}`;
      const e = estado(c, d);
      if (e.total < 0.5) return `Tu **${c.nombre}** no tiene deuda registrada. 🎉`;
      const lineas: string[] = [];
      if (e.alCorte > 0.5 && e.limite)
        lineas.push(`Para no generar intereses en tu **${c.nombre}** paga **${dinero(e.alCorte)}** ${e.vencido ? `(**venció el ${fechaCorta(e.limite)}**)` : `antes del **${fechaCorta(e.limite)}**`}. Es lo de tu corte del ${fechaCorta(e.corte!)}.`);
      if (e.nuevas > 0.5)
        lineas.push(`${e.alCorte > 0.5 ? "Aparte, llevas" : `Lo de tu último corte ya está cubierto. Llevas`} **${dinero(e.nuevas)}** en compras después del corte: van a tu siguiente estado de cuenta${e.siguienteLimite ? ` y se pagan hasta el ${fechaCorta(e.siguienteLimite)}` : ""}.`);
      if (!e.corte) lineas.push(`Debes **${dinero(e.total)}** en tu **${c.nombre}**. Agrega su día de corte y de pago en Ajustes para separar lo del corte de las compras nuevas.`);
      lineas.push(`En total, para dejarla en ceros: **${dinero(e.total)}**.`, "", `[Registrar un pago a ${c.nombre}](/pagar/${c.id})`);
      if (e.corte && !e.confirmado) lineas.push("", "Lo del corte lo calculo con tus compras registradas; si tu app del banco dice otra cosa, corrígelo al registrar el pago.");
      return lineas.join("\n");
    })
    .join("\n\n");
}

function metas(d: DatosAsesor): string {
  if (!d.metas.length) return "Todavía no tienes metas de ahorro. Créalas en **Más › Metas**.";
  return d.metas
    .map((m) => analizarMeta(m, d.aportaciones, d.hoy))
    .map(
      (a) =>
        `- **${a.meta.nombre}:** ${Math.round(a.porcentaje)}% (${dineroCorto(a.meta.monto_actual)} de ${dineroCorto(a.meta.monto_objetivo)}). ${
          a.llegaATiempo ? "Vas a tiempo." : `Para llegar a tiempo ahorra ${dineroCorto(a.porMes)} al mes.`
        }`,
    )
    .join("\n");
}

function suscripciones(d: DatosAsesor): string {
  const ids = detectarRecurrentes(d.movimientos.filter((m) => m.fecha >= sumarDias(d.hoy, -95)));
  const porComercio = new Map<string, number>();
  for (const m of d.movimientos) if (ids.has(m.id)) porComercio.set(nombreComercio(m), m.monto);
  if (!porComercio.size) return "No encontré cargos que se repitan cada mes.";
  const lista = [...porComercio].sort((a, b) => b[1] - a[1]);
  const total = lista.reduce((t, [, v]) => t + v, 0);
  return [`Estos cargos se repiten cada mes, unos **${dinero(total)}** en total:`, "", lista.map(([n, v]) => `- **${n}:** ${dinero(v)}`).join("\n"), "", "Revisa si todos los sigues usando."].join("\n");
}

function ingresos(p: string, d: DatosAsesor): string {
  const per = periodoDe(p, d.hoy);
  const entradas = d.movimientos.filter((m) => m.tipo === "ingreso" && m.fecha >= per.inicio && m.fecha <= per.fin);
  const gastado = suma(gastosEn(d.movimientos, per));
  const total = suma(entradas);
  return `En ${per.nombre} te entraron **${dinero(total)}** y gastaste ${dinero(gastado)}: ${total - gastado >= 0 ? `te quedaron **${dinero(total - gastado)}**` : `gastaste **${dinero(gastado - total)}** más de lo que entró`}.`;
}

// ---------- Más respuestas ----------

const conLiga = (c: Cuenta) => `[${c.nombre}](/pagar/${c.id})`;

function resumen(d: DatosAsesor, saludo = ""): string {
  const tengo = d.cuentas.filter((c) => c.tipo !== "credito").reduce((t, c) => t + c.saldo_actual, 0);
  const debo = d.cuentas.filter((c) => c.tipo === "credito" && c.saldo_actual < 0).reduce((t, c) => t - c.saldo_actual, 0);
  const mes = mesDe(d.hoy);
  const gastado = suma(gastosEn(d.movimientos, { ...rangoDelMes(mes), nombre: "" }));
  const dia = Number(d.hoy.slice(8, 10));
  const pasado = rangoDelMes(sumarMeses(mes, -1));
  const mismoDiaPasado = suma(gastosEn(d.movimientos, { inicio: pasado.inicio, fin: sumarDias(pasado.inicio, dia - 1), nombre: "" }));
  const pago = pagosDeTarjeta(d.cuentas, d.hoy, 31, ctx(d)).find((x) => x.deuda > 0.5);
  const pendientes = d.movimientos.filter((m) => m.requiere_revision).length;
  const lineas = [
    `${saludo}Así vas hoy:`,
    "",
    `- **Dinero:** tienes ${dinero(tengo)} y debes ${dinero(debo)} en tarjetas → ${tengo - debo >= 0 ? `**${dinero(tengo - debo)} libres**` : `**te faltan ${dinero(debo - tengo)}**`}.`,
    `- **Gasto del mes:** ${dinero(gastado)}${mismoDiaPasado > 0 ? ` (${gastado <= mismoDiaPasado ? "menos" : "más"} que los ${dineroCorto(mismoDiaPasado)} que llevabas a estas alturas el mes pasado)` : ""}.`,
  ];
  if (pago) lineas.push(`- **Próximo pago:** ${conLiga(pago.cuenta)} el ${fechaCorta(pago.vence)}${pago.deuda ? ` (${dinero(pago.deuda)})` : ""}.`);
  const teDeben = abiertos(d.prestamos ?? []).reduce((t, p) => t + pendiente(p), 0);
  if (teDeben > 0) lineas.push(`- **Te deben:** ${dinero(teDeben)} en préstamos.`);
  if (pendientes) lineas.push(`- **Por revisar:** ${pendientes === 1 ? "1 movimiento" : `${pendientes} movimientos`}. [Revisarlos](/revisar)`);
  return lineas.join("\n");
}

function saldos(d: DatosAsesor): string {
  const propias = d.cuentas.filter((c) => c.tipo !== "credito").sort((a, b) => b.saldo_actual - a.saldo_actual);
  const tarjetas = d.cuentas.filter((c) => c.tipo === "credito" && c.saldo_actual < 0).sort((a, b) => a.saldo_actual - b.saldo_actual);
  const tengo = propias.reduce((t, c) => t + c.saldo_actual, 0);
  const debo = tarjetas.reduce((t, c) => t - c.saldo_actual, 0);
  if (!propias.length && !tarjetas.length) return "Todavía no tienes cuentas. Agrégalas en **Más › Ajustes › Cuentas**.";
  const lineas = [`Tienes **${dinero(tengo)}** en tus cuentas:`, "", propias.map((c) => `- **${c.nombre}:** ${dinero(c.saldo_actual)}`).join("\n")];
  if (tarjetas.length) lineas.push("", `En tarjetas debes **${dinero(debo)}**:`, "", tarjetas.map((c) => `- ${conLiga(c)}: **${dinero(-c.saldo_actual)}**`).join("\n"));
  lineas.push(
    "",
    tengo - debo >= 0 ? `Si pagaras todas tus tarjetas te quedarían **${dinero(tengo - debo)} libres**.` : `Te faltan **${dinero(debo - tengo)}** para cubrir todas tus tarjetas.`,
  );
  return lineas.join("\n");
}

function deudas(d: DatosAsesor): string {
  const tarjetas = d.cuentas.filter((c) => c.tipo === "credito");
  if (!tarjetas.length) return "No tienes tarjetas de crédito registradas. Agrégalas en **Más › Ajustes › Cuentas**.";
  const conDeuda = tarjetas.filter((c) => c.saldo_actual < 0).sort((a, b) => a.saldo_actual - b.saldo_actual);
  if (!conDeuda.length) return "No debes nada en tus tarjetas. 🎉";
  const total = conDeuda.reduce((t, c) => t - c.saldo_actual, 0);
  const estados = conDeuda.map((c) => estado(c, d));
  const alCorte = estados.reduce((t, e) => t + e.alCorte, 0);
  return [
    `Debes **${dinero(total)}** en ${conDeuda.length === 1 ? "1 tarjeta" : `${conDeuda.length} tarjetas`}. De eso, **${dinero(alCorte)}** es lo de tus cortes (lo que hay que pagar para no generar intereses) y ${dinero(total - alCorte)} son compras nuevas que van a tu siguiente estado de cuenta.`,
    "",
    estados
      .map((e) => `- ${conLiga(e.cuenta)}: ${e.alCorte > 0.5 && e.limite ? `al corte **${dinero(e.alCorte)}** (antes del ${fechaCorta(e.limite)})` : `total **${dinero(e.total)}**`}${e.alCorte > 0.5 ? masNuevas(e.nuevas) : ""}`)
      .join("\n"),
    "",
    "Toca una tarjeta para registrar su pago.",
  ].join("\n");
}

function tarjetas(d: DatosAsesor): string {
  const lista = d.cuentas.filter((c) => c.tipo === "credito");
  if (!lista.length) return "No tienes tarjetas de crédito registradas. Agrégalas en **Más › Ajustes › Cuentas**.";
  return [
    `Tus ${lista.length} tarjetas de crédito:`,
    "",
    lista
      .map((c) => {
        const fechas = c.dia_corte && c.dia_limite_pago ? `corta el día ${c.dia_corte}, pagas el día ${c.dia_limite_pago}` : "sin fechas de corte (agrégalas en Ajustes)";
        return `- **${c.nombre}:** ${fechas} · ${c.saldo_actual < 0 ? `debes ${dinero(-c.saldo_actual)}` : "sin deuda"}`;
      })
      .join("\n"),
  ].join("\n");
}

function linea(m: Movimiento, d: DatosAsesor) {
  const cuenta = d.cuentas.find((c) => c.id === m.account_id)?.nombre;
  return `- ${fechaCorta(m.fecha)} · **${nombreComercio(m)}** · ${m.tipo === "ingreso" ? "+" : ""}${dinero(m.monto)}${cuenta ? ` (${cuenta})` : ""}`;
}

type Filtro = { cuentas?: Cuenta[]; categoria?: Categoria; comercio?: string };

function filtrar(movs: Movimiento[], f: Filtro) {
  return movs.filter(
    (m) =>
      (!f.cuentas?.length || f.cuentas.some((c) => c.id === m.account_id)) &&
      (!f.categoria || m.category_id === f.categoria.id) &&
      (!f.comercio || normalizar(nombreComercio(m)).includes(f.comercio)),
  );
}

const queFiltro = (f: Filtro) =>
  [f.categoria && `en ${f.categoria.nombre}`, f.comercio && `en ${f.comercio.toUpperCase()}`, f.cuentas?.length && `con ${f.cuentas.map((c) => c.nombre).join(" y ")}`]
    .filter(Boolean)
    .join(" ");

// Último periodo con datos: si no dijiste cuándo, "últimos movimientos" son los más recientes sin importar el mes
function ultimos(p: string, d: DatosAsesor, f: Filtro): string {
  const explicito = periodoDe(p, d.hoy);
  const dijoCuando = explicito.nombre !== "este mes" || /este mes/.test(p);
  const base = filtrar(d.movimientos, f).filter((m) => !dijoCuando || (m.fecha >= explicito.inicio && m.fecha <= explicito.fin));
  const soloGastos = /gast|compr|pague|cargo/.test(p) ? base.filter((m) => m.tipo === "gasto") : base;
  const lista = [...soloGastos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  const donde = queFiltro(f);
  if (!lista.length) return `No encontré movimientos${donde ? ` ${donde}` : ""}${dijoCuando ? ` en ${explicito.nombre}` : ""}.`;
  return [
    `${dijoCuando ? `Tus movimientos de ${explicito.nombre}` : "Tus últimos movimientos"}${donde ? ` ${donde}` : ""}:`,
    "",
    lista.map((m) => linea(m, d)).join("\n"),
    "",
    "[Ver todos](/movimientos)",
  ].join("\n");
}

function mayores(p: string, d: DatosAsesor, f: Filtro): string {
  const per = periodoDe(p, d.hoy);
  const lista = filtrar(gastosEn(d.movimientos, per), f)
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);
  if (!lista.length) return `No tengo gastos en ${per.nombre}.`;
  return [`Tus compras más grandes de ${per.nombre}${queFiltro(f) ? ` ${queFiltro(f)}` : ""}:`, "", lista.map((m) => linea(m, d)).join("\n")].join("\n");
}

function comparar(d: DatosAsesor): string {
  const mes = mesDe(d.hoy);
  const dia = Number(d.hoy.slice(8, 10));
  const pasado = rangoDelMes(sumarMeses(mes, -1));
  const actual = gastosEn(d.movimientos, { inicio: rangoDelMes(mes).inicio, fin: d.hoy, nombre: "" });
  const antes = gastosEn(d.movimientos, { inicio: pasado.inicio, fin: sumarDias(pasado.inicio, dia - 1), nombre: "" });
  const completo = gastosEn(d.movimientos, { ...pasado, nombre: "" });
  const a = suma(actual);
  const b = suma(antes);
  const porCat = (movs: Movimiento[]) => {
    const m = new Map<string, number>();
    for (const g of movs) {
      const n = d.categorias.find((c) => c.id === g.category_id)?.nombre ?? "Sin categoría";
      m.set(n, (m.get(n) ?? 0) + g.monto);
    }
    return m;
  };
  const ca = porCat(actual);
  const cb = porCat(antes);
  const cambios = [...new Set([...ca.keys(), ...cb.keys()])]
    .map((n) => ({ n, dif: (ca.get(n) ?? 0) - (cb.get(n) ?? 0) }))
    .filter((x) => Math.abs(x.dif) >= 1)
    .sort((x, y) => Math.abs(y.dif) - Math.abs(x.dif))
    .slice(0, 3);
  return [
    `Al día ${dia}, este mes llevas **${dinero(a)}** y el mes pasado llevabas **${dinero(b)}**: ${
      a <= b ? `vas **${dinero(b - a)} abajo** 👍` : `vas **${dinero(a - b)} arriba**`
    }. (El mes pasado completo cerró en ${dineroCorto(suma(completo))}.)`,
    cambios.length ? `\nLo que más cambió:\n\n${cambios.map((x) => `- **${x.n}:** ${x.dif > 0 ? "+" : "−"}${dineroCorto(Math.abs(x.dif))}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function proyeccion(d: DatosAsesor): string {
  const mes = mesDe(d.hoy);
  const { inicio, fin } = rangoDelMes(mes);
  const dias = diasEntre(inicio, fin) + 1;
  const transcurridos = diasEntre(inicio, d.hoy) + 1;
  const gastado = suma(gastosEn(d.movimientos, { inicio, fin: d.hoy, nombre: "" }));
  const estimado = (gastado / transcurridos) * dias;
  const presupuesto = d.categorias.reduce((t, c) => t + c.presupuesto_mensual, 0);
  const entradas = suma(d.movimientos.filter((m) => m.tipo === "ingreso" && m.fecha >= inicio && m.fecha <= d.hoy));
  return [
    `Llevas **${dinero(gastado)}** en ${transcurridos} días (${dineroCorto(gastado / transcurridos)} al día). A este ritmo cerrarías el mes en **${dinero(estimado)}**.`,
    presupuesto > 0 ? `Tu presupuesto es ${dineroCorto(presupuesto)}: ${estimado <= presupuesto ? "vas bien, te alcanzaría. 👍" : `te pasarías por unos ${dineroCorto(estimado - presupuesto)}.`}` : "",
    entradas > 0 ? `Este mes te han entrado ${dineroCorto(entradas)}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function ahorrar(d: DatosAsesor): string {
  const mes = mesDe(d.hoy);
  const r = resumenPorCategoria(mes, d.hoy, d.categorias, d.movimientos);
  const excedidas = r.filter((x) => x.presupuesto > 0 && x.gastado > x.presupuesto).sort((a, b) => b.gastado - b.presupuesto - (a.gastado - a.presupuesto));
  const tresMeses = gastosEn(d.movimientos, { inicio: rangoDelMes(sumarMeses(mes, -3)).inicio, fin: rangoDelMes(sumarMeses(mes, -1)).fin, nombre: "" });
  const porCat = new Map<string, number>();
  for (const g of tresMeses) {
    const n = d.categorias.find((c) => c.id === g.category_id)?.nombre ?? "Sin categoría";
    porCat.set(n, (porCat.get(n) ?? 0) + g.monto / 3);
  }
  const top = [...porCat].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const ids = detectarRecurrentes(d.movimientos.filter((m) => m.fecha >= sumarDias(d.hoy, -95)));
  const fijos = new Map<string, number>();
  for (const m of d.movimientos) if (ids.has(m.id)) fijos.set(nombreComercio(m), m.monto);
  const totalFijos = [...fijos.values()].reduce((t, v) => t + v, 0);
  const lineas = ["Ideas para ahorrar con tus números:", ""];
  if (top.length) lineas.push(`- Donde más gastas al mes (promedio de 3 meses): ${top.map(([n, v]) => `**${n}** ${dineroCorto(v)}`).join(", ")}. Si bajas 15% en ${top[0][0]}, ahorras unos **${dineroCorto(top[0][1] * 0.15)} al mes**.`);
  if (excedidas.length) lineas.push(`- Este mes ya te pasaste en ${excedidas.map((x) => `**${x.categoria.nombre}**`).join(", ")}: frena ahí lo que queda del mes.`);
  if (totalFijos > 0) lineas.push(`- Pagas unos **${dineroCorto(totalFijos)} al mes** en cargos fijos (${[...fijos.keys()].slice(0, 4).join(", ")}). Cancela los que no uses.`);
  lineas.push("- Paga tus tarjetas completas antes de la fecha límite para no pagar intereses.");
  return lineas.join("\n");
}

function prestamos(d: DatosAsesor): string {
  const lista = abiertos(d.prestamos ?? []).sort((a, b) => (a.fecha_pago ?? "9").localeCompare(b.fecha_pago ?? "9"));
  if (!lista.length) return "Nadie te debe dinero. Cuando prestes, dime por ejemplo: \"Le presté 5 mil a Juan, me paga el 15 de noviembre\".";
  const total = lista.reduce((t, p) => t + pendiente(p), 0);
  return [
    `Te deben **${dinero(total)}**:`,
    "",
    lista
      .map((p) => {
        const cuando = p.fecha_pago ? (p.fecha_pago < d.hoy ? ` · **se pasó del ${fechaCorta(p.fecha_pago)}**` : ` · te paga el ${fechaCorta(p.fecha_pago)}`) : "";
        return `- **${p.persona}:** ${dinero(pendiente(p))}${p.abonado > 0 ? ` (de ${dineroCorto(p.monto)})` : ""}${cuando}${p.nota ? ` · ${p.nota}` : ""}`;
      })
      .join("\n"),
    "",
    "Cuando te paguen, dime por ejemplo: \"María me pagó\".",
  ].join("\n");
}

function rendimientos(d: DatosAsesor): string {
  const cuentas = d.cuentas.filter(ganaRendimiento);
  if (!cuentas.length) return "Ninguna de tus cuentas tiene rendimiento registrado. En **Más › Ajustes › Cuentas** ponle el % anual a tus cajitas (p. ej. Cajita Turbo: 13% hasta 25,000) y lo sumo solo cada día.";
  const mes = mesDe(d.hoy);
  const esteMes = d.movimientos.filter((m) => m.tipo === "ingreso" && m.hash_unico.startsWith("rend:") && mesDe(m.fecha) === mes).reduce((t, m) => t + m.monto, 0);
  const dia = cuentas.reduce((t, c) => t + interesDelDia(c), 0);
  return [
    `Tus cuentas con rendimiento te dan unos **${dinero(dia)} al día** (${dineroCorto(cuentas.reduce((t, c) => t + proyectar(c, 30), 0))} al mes si no mueves el dinero):`,
    "",
    cuentas
      .map((c) => `- **${c.nombre}:** ${dinero(c.saldo_actual)} al ${c.tasa_anual}%${c.tope_tasa ? ` (hasta ${dineroCorto(c.tope_tasa)}${c.tasa_excedente ? `; arriba, ${c.tasa_excedente}%` : ""})` : ""} → ${dinero(interesDelDia(c))} al día`)
      .join("\n"),
    esteMes > 0 ? `\nEn ${nombreMes(mes)} llevas **${dinero(esteMes)}** de rendimientos.` : "",
    "\nSon antes de impuestos; tu app del banco puede variar unos centavos.",
  ]
    .filter(Boolean)
    .join("\n");
}

function porRevisar(d: DatosAsesor): string {
  const n = d.movimientos.filter((m) => m.requiere_revision).length;
  return n ? `Tienes **${n === 1 ? "1 movimiento" : `${n} movimientos`} por revisar** (sin categoría o dudosos). [Revisarlos ahora](/revisar)` : "No tienes nada por revisar. 🎉";
}

function gastosConFiltro(p: string, d: DatosAsesor, f: Filtro): string {
  const per = periodoDe(p, d.hoy);
  if (f.categoria && !f.cuentas?.length && !f.comercio) return cuantoGasteEn(normalizar(f.categoria.nombre) + " " + p, d) ?? "";
  const propios = filtrar(gastosEn(d.movimientos, per), f);
  const donde = queFiltro(f);
  if (!propios.length) return `No encontré gastos ${donde} en ${per.nombre}.`;
  const comercios = new Map<string, number>();
  for (const g of propios) comercios.set(nombreComercio(g), (comercios.get(nombreComercio(g)) ?? 0) + g.monto);
  const top = [...comercios].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return [
    `${per.nombre === "este mes" ? "Este mes" : `En ${per.nombre}`} llevas **${dinero(suma(propios))}** ${donde}, en ${propios.length} ${propios.length === 1 ? "movimiento" : "movimientos"}.`,
    top.length > 1 ? `\nDonde más: ${top.map(([n, v]) => `${n} (${dineroCorto(v)})`).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const AYUDA = `Puedo contestarte casi todo sobre tu dinero. Por ejemplo:\n\n${[
  "¿Cuánto dinero tengo en mis cuentas?",
  "¿Cuánto debo en tarjetas?",
  "¿Qué tarjeta debo pagar pronto?",
  "Voy a comprar algo de $3,000, ¿qué tarjeta uso?",
  "¿En qué gasto más?",
  "¿Cuánto gasté en Oxxo el mes pasado?",
  "¿Cuáles fueron mis últimos gastos?",
  "¿Voy gastando más que el mes pasado?",
  "¿Cómo puedo ahorrar más?",
  "Pagué Nu con Revolut (y lo registro)",
]
  .map((x) => `- ${x}`)
  .join("\n")}`;

// ---------- Entender la pregunta ----------

export type Intencion =
  | "inversion"
  | "ayuda"
  | "recomendar"
  | "saldos"
  | "deudas"
  | "pagos"
  | "tarjetas"
  | "gastoTotal"
  | "enQueGasto"
  | "ultimos"
  | "mayores"
  | "comparar"
  | "presupuesto"
  | "ingresos"
  | "metas"
  | "suscripciones"
  | "revisar"
  | "resumen"
  | "proyeccion"
  | "ahorrar"
  | "rendimientos"
  | "prestamos";

// Cada regla suma puntos a una intención; gana la de más puntos (empate: la que va primero)
const REGLAS: [Intencion, RegExp, number][] = [
  ["inversion", /\b(invert\w*|inviert\w*|invier\w*|inversion\w*|acciones|cripto\w*|bitcoin|cetes|bolsa de valores|fondos? de inversion|acciones de)\b/, 10],
  ["ayuda", /\b(que (puedes|sabes) hacer|en que me (puedes )?ayudas|ayuda|que te puedo preguntar|como funcionas|que haces)\b/, 5],
  ["recomendar", /\b(que|cual|con que|con cual) tarjeta\b.*\b(us\w*|compr\w*|conviene|recomiend\w*|meto|saco)\b/, 6],
  ["recomendar", /\b(voy a|quiero|pienso|planeo) (comprar|hacer una compra|gastar|pagar algo|sacar a meses)\b|\brecomiendas\b|\bme conviene\b|\btarjeta (me )?conviene\b|\bcon (que|cual) (le )?(pago|compro)\b/, 6],
  ["recomendar", /\b(pagar pronto|debo pagar|toca pagar|tengo que pagar)\b/, -12],
  ["saldos", /\bcuanto (dinero )?(tengo|hay|me queda en|traigo)\b|\bmis cuentas\b|\bsaldos?\b|\bdinero (disponible|libre)\b|\bdisponible\b|\blibres?\b|\bmi dinero\b|\bbalance\b|\befectivo\b|\bcuanto dinero\b/, 4],
  ["saldos", /\bdinero\b/, 1],
  ["deudas", /\b(debo|deuda\w*|adeud\w*|liquidar|le debo|endeudado)\b/, 4],
  ["deudas", /\btarjetas?\b/, 1],
  ["pagos", /\b(pagar|pago|pagos|vence|vencen|vencimiento|fecha limite|corte|toca pagar|proximo pago|cuando (le )?pago|que pago|pendiente de pago)\b/, 3],
  ["tarjetas", /\b(mis tarjetas|fechas? de corte|cuando corta|dias? de corte|que tarjetas tengo|cuantas tarjetas)\b/, 6],
  ["tarjetas", /\b(debo|deuda|pagar)\b/, -6],
  ["gastoTotal", /\bcuanto (he |ya )?(gaste|gastado|llevo|gasto|gastamos|se me fue|me gaste|consumi|pague|me costo)\b|\btotal (de|en) gastos\b|\bcuanto (fue|salio|se fue)\b/, 4],
  ["gastoTotal", /\b(gaste|gastado|gastos?|gastando)\b/, 1],
  ["enQueGasto", /\ben (que|donde) (gasto|gaste|se me va|me gasto|se va|se fue)\b|\bdonde (gasto|gaste)\b|\b(mayor|principal|mas grande) (gasto|categoria)\b|\bcategorias?\b|\bdonde se (me )?va\b|\bque es lo que mas\b|\ben que mas\b/, 5],
  ["ultimos", /\bultim(o|os|as|a) (gastos?|movimientos?|compras?|cargos?|pagos?|ingresos?)\b|\bmovimientos\b|\bque (compre|gaste|pague)\b|\bmis compras\b|\bhistorial\b|\brecientes?\b|\bque hice\b/, 4],
  ["mayores", /\bmas (cara|caro|caras|caros|grande|grandes|fuerte)\b|\bmayor(es)? (compra|gasto)s?\b|\bcompras? grandes?\b|\bgastos? grandes?\b/, 7],
  ["comparar", /\bcompar\w*\b|\bvs\b|\bcontra el mes\b|\bque el mes pasado\b|\b(mas|menos) que (el|la|antes)\b|\bdiferencia\b|\bvoy (mejor|peor)\b/, 6],
  ["presupuesto", /\bpresupuesto\w*\b|\bcuanto puedo gastar\b|\bme alcanza\b|\balcanza\b|\blimite de gasto\b|\bme pase\b|\bexcedi\w*\b|\bsobrepas\w*\b|\bcuanto me queda\b/, 5],
  ["ingresos", /\b(ingres\w*|gane|ganado|me entro|me entraron|entraron|cobre|me pagaron|recibi|nomina|sueldo|salario|ventas|vendi|depositaron)\b/, 5],
  ["metas", /\b(metas?|ahorrar para|objetivos?|llevo ahorrado|mi ahorro|ahorros)\b/, 5],
  ["suscripciones", /\b(suscrip\w*|recurrent\w*|cada mes me cobran|cargos? (fijos|automaticos|recurrentes)|me cobran|domiciliad\w*|que pago cada mes|gastos fijos|pagos fijos|plataformas)\b/, 7],
  ["revisar", /\b(por revisar|pendientes|sin categoria|sin clasificar|revisar)\b/, 6],
  ["resumen", /\b(resumen|como (voy|estoy|ando|vamos|van mis finanzas)|situacion|panorama|estado (financiero|de mis finanzas)|mis finanzas|reporte|repaso|que tal voy)\b/, 5],
  ["proyeccion", /\b(a este ritmo|fin de mes|voy a gastar|proyeccion|terminare el mes|cerrare el mes|cuanto gastare)\b/, 7],
  ["prestamos", /\b(quien(es)? me debe\w*|me deben|cuanto me deben|prestamos?|preste|por cobrar|a quien le preste|me tienen que pagar)\b/, 9],
  ["rendimientos", /\b(rendimientos?|cuanto (me dan|me da|gano|genero|me pagan|me generan|me rinde|rinde|rinden)|cuanto (he )?ganado|intereses (que )?(gano|me dan|genero|ganados))\b/, 8],
  ["ahorrar", /\b(cuanto (puedo|podria) ahorrar|como (puedo )?ahorrar|consejos?|tips?|recortar|reducir|gastar menos|ahorrar mas)\b/, 7],
];

export function entenderPregunta(p: string): Intencion | null {
  const puntos = new Map<Intencion, number>();
  for (const [intencion, regla, peso] of REGLAS) if (regla.test(p)) puntos.set(intencion, (puntos.get(intencion) ?? 0) + peso);
  let mejor: Intencion | null = null;
  let max = 1; // con 1 punto (una palabra suelta como "dinero") no alcanza
  for (const [intencion] of REGLAS) {
    const v = puntos.get(intencion) ?? 0;
    if (v > max) {
      mejor = intencion;
      max = v;
    }
  }
  return mejor;
}

// Palabras que nunca son nombre de comercio
const COMUNES = new Set(
  "cuanto cuanta cuantos cuantas gaste gasto gastos gastado gastando llevo tengo tienes debo pague pago pagos pagar compre compra compras mes meses semana este esta estos estas ultimo ultimos ultima ultimas pasado pasada dinero cuenta cuentas tarjeta tarjetas credito debito todo toda total cual cuales donde cuando como mucho poco mas menos para sobre desde hasta entre algo hice hace hacer movimientos movimiento cargo cargos dame dime quiero puedo saber favor ahora antes despues ayer hoy antier dias ano anos solo cada veces vez".split(
    " ",
  ),
);

// Sinónimos → palabra del nombre de tu categoría
const SINONIMOS_CATEGORIA: [RegExp, string[]][] = [
  [/\b(comida|comer|restaurant\w*|tacos?|tamales?|tortas?|pozole|pizzas?|hamburguesas?|sushi|elotes?|esquites|gorditas|quesadillas|antojitos?|cenas?|desayun\w*|almuerzo|comidas|antojos?|rappi|cafe|starbucks)\b/, ["comida"]],
  [/\b(super|supermercado|despensa|mandado|walmart|soriana|chedraui|costco|bodega)\b/, ["super", "despensa"]],
  [/\b(gasolina|uber|didi|taxis?|transporte|camion|casetas?|estacionamiento|pemex)\b/, ["transporte", "gasolina"]],
  [/\b(luz|agua|internet|telefono|celular|cfe|telmex|izzi|totalplay|servicios?)\b/, ["servicio"]],
  [/\b(doctor|medic\w*|farmacias?|salud|dentista|hospital|consultas?)\b/, ["salud"]],
  [/\b(ropa|zapatos|tenis|liverpool)\b/, ["ropa"]],
  [/\b(cine|netflix|spotify|entreten\w*|diversion|salidas?|fiestas?|bares?|antros?|videojuegos?|playstation|conciertos?)\b/, ["entreten", "diversion", "ocio"]],
  [/\b(casa|remodelacion|hogar|muebles?)\b/, ["casa", "hogar"]],
  [/\b(mascotas?|perros?|gatos?|veterinari\w*|croquetas)\b/, ["mascota"]],
  [/\b(seguros?|polizas?)\b/, ["seguro"]],
  [/\b(escuela|colegiaturas?|cursos?|educacion|libros?|maestria|mess|propedeutico)\b/, ["educa", "escuela"]],
  [/\b(gym|gimnasio|deportes?)\b/, ["gym", "deporte"]],
  [/\b(viajes?|vuelos?|hotel\w*|vacaciones|aeromexico)\b/, ["viaje"]],
];

export function categoriaMencionada(p: string, categorias: Categoria[]): Categoria | undefined {
  const directa = categorias.find((c) =>
    normalizar(c.nombre)
      .split(" ")
      .filter((w) => w.length >= 4 && !COMUNES.has(w) && w !== "fuera" && w !== "otros")
      .some((w) => new RegExp(`\\b${w.slice(0, Math.max(4, w.length - 1))}`).test(p)),
  );
  if (directa) return directa;
  for (const [regla, claves] of SINONIMOS_CATEGORIA) {
    if (!regla.test(p)) continue;
    const c = categorias.find((x) => claves.some((k) => normalizar(x.nombre).includes(k)));
    if (c) return c;
  }
  return undefined;
}

// "¿Cuánto gasté en Oxxo?": una palabra de la pregunta que aparece en el nombre de tus comercios
export function comercioMencionado(p: string, movimientos: Movimiento[]): string | undefined {
  const palabras = p.split(" ").filter((w) => w.length >= 3 && !COMUNES.has(w) && !MESES.includes(w) && !/^\d/.test(w));
  let mejor: { w: string; n: number } | undefined;
  for (const w of palabras) {
    const re = new RegExp(`\\b${w}`);
    const n = movimientos.filter((m) => re.test(normalizar(nombreComercio(m)))).length;
    if (n && (!mejor || n > mejor.n)) mejor = { w, n };
  }
  return mejor?.w;
}

const QUE_PALABRAS_SON_DE_CUENTA = /\b(debo|deuda|liquid\w*|pag\w*|saldo|tengo|traigo|hay|falta|vence|corte|limite|disponible|queda)\b/;

export function responderAsesor(pregunta: string, d: DatosAsesor): string {
  const p = normalizar(pregunta);
  if (!p) return AYUDA;
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|que onda)\b/.test(p) && p.split(" ").length <= 4) return resumen(d, "¡Hola! ");
  if (/^((muchas )?gracias|ok|okay|va|vale|perfecto|genial|excelente|listo|sale)\b/.test(p) && p.split(" ").length <= 4) return "¡Con gusto! Aquí estoy para lo que necesites. 💛";

  const intencion = entenderPregunta(p);
  if (intencion === "inversion") return "No doy recomendaciones de inversión. Con gusto te ayudo con tu presupuesto, tus pagos o a armar una meta de ahorro.";
  if (intencion === "recomendar") return recomendarTarjeta(pregunta, d);

  // Lo que mencionas: una cuenta ("HSBC"), una categoría ("comida") o un comercio ("Oxxo")
  const cuentas = cuentasMencionadas(pregunta, d.cuentas);
  const categoria = categoriaMencionada(p, d.categorias);
  const comercio = !categoria ? comercioMencionado(p, d.movimientos) : undefined;
  const filtro: Filtro = { cuentas, categoria, comercio };
  const hayFiltro = !!(cuentas.length || categoria || comercio);

  switch (intencion) {
    case "ayuda":
      return AYUDA;
    case "ultimos":
      return ultimos(p, d, filtro);
    case "mayores":
      return mayores(p, d, filtro);
    case "comparar":
      return comparar(d);
    case "proyeccion":
      return proyeccion(d);
    case "ahorrar":
      return ahorrar(d);
    case "rendimientos":
      return rendimientos(d);
    case "prestamos":
      return prestamos(d);
    case "revisar":
      return porRevisar(d);
    case "suscripciones":
      return suscripciones(d);
    case "metas":
      if (cuentas.length && !/meta/.test(p)) return deUnaCuenta(cuentas, d);
      return metas(d);
    case "ingresos":
      return ingresos(p, d);
    case "resumen":
      return resumen(d);
    case "tarjetas":
      return tarjetas(d);
  }

  // Preguntas de una cuenta en particular: "¿cuánto le debo a la HSBC?", "¿cuánto tengo en Nu?"
  if (cuentas.length && (intencion === "saldos" || intencion === "deudas" || intencion === "pagos" || QUE_PALABRAS_SON_DE_CUENTA.test(p)) && intencion !== "gastoTotal")
    return deUnaCuenta(cuentas, d);

  switch (intencion) {
    case "presupuesto":
      if (categoria) return cuantoGasteEn(normalizar(categoria.nombre), d) ?? presupuesto(d);
      return presupuesto(d);
    case "deudas":
      return /\bpagar\b|\bvence|\bpronto\b/.test(p) ? quePagar(d) : deudas(d);
    case "pagos":
      return quePagar(d);
    case "saldos":
      return saldos(d);
    case "enQueGasto":
      return hayFiltro ? gastosConFiltro(p, d, filtro) : enQueGasto(p, d);
    case "gastoTotal":
      return hayFiltro ? gastosConFiltro(p, d, filtro) : enQueGasto(p, d);
  }

  // No hubo palabras clave claras, pero mencionaste algo concreto
  if (cuentas.length && /\b(gast\w*|compr\w*|cargos?)\b/.test(p)) return gastosConFiltro(p, d, filtro);
  if (cuentas.length) return deUnaCuenta(cuentas, d);
  if (categoria || comercio) return gastosConFiltro(p, d, filtro);
  return `No estoy seguro de qué me preguntas, pero esto es lo más importante:\n\n${resumen(d)}\n\nTambién puedes preguntarme cosas como "¿cuánto gasté en comida este mes?" o "¿cuánto le debo a Nu?".`;
}
