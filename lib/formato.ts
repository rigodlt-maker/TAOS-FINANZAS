export const ZONA = "America/Mexico_City";
export const MONEDA = "MXN";

const formatoDinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: MONEDA });
const formatoDineroCorto = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: MONEDA,
  maximumFractionDigits: 0,
});

// $1,234.56
export function dinero(monto: number): string {
  return formatoDinero.format(monto);
}

// $1,235
export function dineroCorto(monto: number): string {
  return formatoDineroCorto.format(monto);
}

export function redondear(monto: number): number {
  return Math.round(monto * 100) / 100;
}

// Fecha local de hoy en formato AAAA-MM-DD
export function hoyLocal(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(ahora);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// "2026-10" → { inicio: "2026-10-01", fin: "2026-10-31" }
export function rangoDelMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return { inicio: `${mes}-01`, fin: `${mes}-${String(diasDelMes(a, m)).padStart(2, "0")}` };
}

export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

// "octubre 2026"
export function nombreMes(mes: string, corto = false): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    month: corto ? "short" : "long",
    year: corto ? undefined : "numeric",
  })
    .format(new Date(`${mes}-15T12:00:00Z`))
    .replace(".", "");
}

// "jue 22 oct"
export function fechaCorta(fecha: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${fecha}T12:00:00Z`))
    .replace(/\./g, "");
}

// Minúsculas, sin acentos, sin signos: para comparar descripciones de movimientos
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
