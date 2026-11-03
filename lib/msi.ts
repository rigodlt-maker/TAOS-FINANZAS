// Compras a meses sin intereses (MSI): una compra que se paga en mensualidades. Se repite cada mes como una suscripción,
// pero NO lo es: tiene fin y no se puede "cancelar". En el estado de cuenta suelen venir como
// "MENSUALIDAD 3 DE 12", "MENS 03/12", "MSI", "PARCIALIDAD", "DIFERIDO"…
import { normalizar } from "./formato";

const PALABRAS = /\bmsi\b|meses sin intereses|\bmensualidad|\bmens\b|parcialidad|diferid|plan de pagos|compra a meses|\bmeses\b/;
// "3 DE 12" siempre; "03/12" solo junto a una de las palabras de arriba (sola podría ser una fecha)
const N_DE_M = /(?<![\d/])(\d{1,2}) ?de ?(\d{1,2})(?![\d/])/;
const N_DIAGONAL_M = /(?<![\d/])(\d{1,2}) ?\/ ?(\d{1,2})(?![\d/])/;

const valido = (va: number, de: number) => de >= 2 && de <= 48 && va >= 1 && va <= de;

// "MENSUALIDAD 3 DE 12" → { va: 3, de: 12 }
export function mensualidad(texto: string): { va: number; de: number } | null {
  const t = texto.toLowerCase();
  const m = t.match(N_DE_M) ?? (PALABRAS.test(normalizar(texto)) ? t.match(N_DIAGONAL_M) : null);
  return m && valido(Number(m[1]), Number(m[2])) ? { va: Number(m[1]), de: Number(m[2]) } : null;
}

export function esMSI(texto: string): boolean {
  return PALABRAS.test(normalizar(texto)) || mensualidad(texto) !== null;
}

// Tus compras a meses que siguen activas (con cargo en los últimos 45 días): cuánto pagas al mes y, si el estado de cuenta
// dice "N de M", cuántas mensualidades te faltan y cuánto suman
export type CompraAMeses = { nombre: string; monto: number; va: number | null; de: number | null; faltan: number | null; resta: number | null; ultimo: string };

export function comprasAMeses(movimientos: { tipo: string; fecha: string; monto: number; comercio: string | null; descripcion_original: string }[], hoy: string): CompraAMeses[] {
  const hace45 = new Date(Date.parse(`${hoy}T12:00:00Z`) - 45 * 86_400_000).toISOString().slice(0, 10);
  const grupos = new Map<string, CompraAMeses>();
  for (const m of [...movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const texto = `${m.comercio ?? ""} ${m.descripcion_original}`;
    if (m.tipo !== "gasto" || m.fecha < hace45 || m.fecha > hoy || !esMSI(texto)) continue;
    const nombre = (m.comercio || m.descripcion_original).replace(/\b(mensualidad|mens|msi|parcialidad)\b.*$/i, "").trim() || m.descripcion_original;
    const clave = normalizar(nombre).replace(/\d+/g, "").trim();
    const n = mensualidad(texto);
    const faltan = n ? n.de - n.va : null;
    grupos.set(clave, { nombre, monto: m.monto, va: n?.va ?? null, de: n?.de ?? null, faltan, resta: faltan === null ? null : faltan * m.monto, ultimo: m.fecha });
  }
  return [...grupos.values()].sort((a, b) => b.monto - a.monto);
}
