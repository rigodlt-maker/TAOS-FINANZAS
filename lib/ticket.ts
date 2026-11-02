// Lee el texto de la foto de un ticket (lo saca el celular con OCR, sin internet de por medio ni IA)
// y propone el gasto: total, fecha, comercio y con qué tarjeta se pagó (por sus últimos 4 dígitos).
// Reglas puras: todo lo que propone se puede corregir antes de guardar.
import type { Cuenta } from "./tipos";

export type Ticket = {
  total: number | null;
  fecha: string | null; // AAAA-MM-DD
  comercio: string | null;
  terminacion: string | null; // últimos 4 dígitos de la tarjeta, si aparecen
  efectivo: boolean;
};

const MESES: Record<string, number> = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12, JAN: 1, APR: 4, AUG: 8, DEC: 12 };

// "1,234.50" · "1234,50" · "$ 89.00" → número
function monto(t: string): number | null {
  const limpio = t.replace(/[$\s]/g, "");
  let n: number;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(limpio)) n = Number(limpio.replace(/,/g, ""));
  else if (/^\d+,\d{2}$/.test(limpio)) n = Number(limpio.replace(",", "."));
  else n = Number(limpio);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null;
}

const MONTO = /\$?\s?\d{1,3}(?:,\d{3})*(?:[.,]\d{2})|\$?\s?\d+[.,]\d{2}/g;
const montosDe = (linea: string) => (linea.match(MONTO) ?? []).map(monto).filter((n): n is number => n !== null);

function leerTotal(lineas: string[]): number | null {
  // 1) Renglones que dicen TOTAL (no SUBTOTAL ni "total de artículos"); el último suele ser el bueno
  const conTotal = lineas.filter((l) => /\bTOTAL\b/i.test(l) && !/SUB\s*-?\s*TOTAL|ART[IÍ]CULOS|PIEZAS|PZAS|AHORRO|DESCUENTO/i.test(l));
  for (const l of conTotal.reverse()) {
    const m = montosDe(l);
    if (m.length) return m[m.length - 1];
  }
  // 2) "IMPORTE", "A PAGAR", "VENTA"
  for (const l of [...lineas].reverse()) {
    if (/IMPORTE|A PAGAR|VENTA|PAGO/i.test(l)) {
      const m = montosDe(l);
      if (m.length) return m[m.length - 1];
    }
  }
  // 3) El monto más grande del ticket
  const todos = lineas.flatMap(montosDe);
  return todos.length ? Math.max(...todos) : null;
}

function leerFechaTicket(texto: string, hoy: string): string | null {
  const anioHoy = Number(hoy.slice(0, 4));
  const valida = (a: number, m: number, d: number) => {
    if (a < 100) a += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || a < anioHoy - 2 || a > anioHoy + 1) return null;
    const f = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return f > hoy ? null : f; // un ticket no puede ser del futuro
  };
  for (const [, a, m, d] of texto.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const f = valida(+a, +m, +d);
    if (f) return f;
  }
  for (const [, d, m, a] of texto.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    const f = valida(+a, +m, +d);
    if (f) return f;
  }
  for (const [, d, mes, a] of texto.toUpperCase().matchAll(/\b(\d{1,2})[\s/-]*([A-Z]{3})[A-Z]*[\s/-]*(\d{2,4})\b/g)) {
    const m = MESES[mes];
    const f = m ? valida(+a, m, +d) : null;
    if (f) return f;
  }
  return null;
}

// El comercio suele ser el primer renglón con letras de verdad (no RFC, dirección, fecha ni "ticket")
function leerComercio(lineas: string[]): string | null {
  for (const l of lineas.slice(0, 8)) {
    const t = l.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9&.' -]/g, " ").replace(/\s+/g, " ").trim();
    const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "").length;
    if (letras < 3 || letras < t.length * 0.5) continue;
    if (/R\.?F\.?C|^C\.?P\b|CALLE|AV\.|AVENIDA|COL\.|COLONIA|TICKET|FACTURA|BIENVENID|TEL|S\.?A\.? DE C\.?V/i.test(t)) continue;
    return t.length > 40 ? t.slice(0, 40).trim() : t;
  }
  return null;
}

function leerTerminacion(texto: string): string | null {
  const patrones = [
    /(?:\*|X|x|•|#){2,}[\s*Xx•#-]*(\d{4})\b/, // ************1234 · XXXX XXXX 1234
    /TERMINACI[OÓ]N\s*:?\s*(\d{4})\b/i,
    /(?:TARJETA|TARJ|CARD|NO\.?\s*DE\s*CUENTA|CTA)\D{0,20}(\d{4})\b/i,
  ];
  for (const p of patrones) {
    const m = texto.match(p);
    if (m) return m[1];
  }
  return null;
}

export function leerTicket(texto: string, hoy: string): Ticket {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const terminacion = leerTerminacion(texto);
  return {
    total: leerTotal(lineas),
    fecha: leerFechaTicket(texto, hoy),
    comercio: leerComercio(lineas),
    terminacion,
    efectivo: !terminacion && /EFECTIVO|CAMBIO\b/i.test(texto) && !/TARJETA|VISA|MASTER|AMEX|AMERICAN EXPRESS/i.test(texto),
  };
}

// Con qué cuenta pagaste: la tarjeta con esa terminación; si fue en efectivo, tu cuenta de efectivo
export function cuentaDelTicket(t: Ticket, cuentas: Cuenta[]): Cuenta | null {
  if (t.terminacion) {
    const tarjeta = cuentas.find((c) => c.terminacion === t.terminacion);
    if (tarjeta) return tarjeta;
  }
  if (t.efectivo) return cuentas.find((c) => c.tipo === "efectivo") ?? null;
  return null;
}
