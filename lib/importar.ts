import { normalizar, redondear } from "./formato";

export type TipoMovimiento = "gasto" | "ingreso";

export type MovimientoNuevo = {
  fecha: string;
  descripcion_original: string;
  comercio: string;
  monto: number;
  tipo: TipoMovimiento;
};

// ---------- Montos ----------

// Acepta "1,234.56", "-$1,234.56", "(1,234.56)", "1234,56", "$ 350"
export function leerMonto(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  let texto = valor.trim();
  if (!texto) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(texto)) {
    negativo = true;
    texto = texto.slice(1, -1);
  }
  if (/-\s*\$?\s*\d/.test(texto) || /\d\s*-$/.test(texto)) negativo = true;
  texto = texto.replace(/[^\d.,]/g, "");
  if (!/\d/.test(texto)) return null;
  const ultimaComa = texto.lastIndexOf(",");
  const ultimoPunto = texto.lastIndexOf(".");
  if (ultimaComa > ultimoPunto && texto.length - ultimaComa <= 3) {
    // Formato con coma decimal: 1.234,56
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else {
    texto = texto.replace(/,/g, "");
  }
  const numero = Number(texto);
  if (!Number.isFinite(numero)) return null;
  return negativo ? -numero : numero;
}

// ---------- Fechas ----------

const MESES: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

function armarFecha(anio: number, mes: number, dia: number): string | null {
  if (anio < 100) anio += 2000;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return d.toISOString().slice(0, 10);
}

// Acepta 15/10/2026, 15-10-26, 2026-10-15, 15 oct 2026, 15/OCT/26, fechas de Excel (Date o número de serie)
export function leerFecha(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  if (typeof valor === "number" && valor > 20000 && valor < 80000) {
    // Número de serie de Excel (días desde 1899-12-30)
    return new Date(Date.UTC(1899, 11, 30) + valor * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof valor !== "string") return null;
  const texto = valor.trim().toLowerCase();
  let m = texto.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return armarFecha(+m[1], +m[2], +m[3]);
  m = texto.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return armarFecha(+m[3], +m[2], +m[1]);
  m = texto.match(/^(\d{1,2})[-/. ]+([a-zñ]{3})[a-zñ]*\.?[-/. ]+(\d{2,4})/);
  if (m && MESES[m[2]]) return armarFecha(+m[3], MESES[m[2]], +m[1]);
  return null;
}

// ---------- Detección de columnas ----------

export type Mapeo = {
  fecha: number | null;
  descripcion: number | null;
  monto: number | null; // un solo monto con signo
  cargo: number | null; // o columnas separadas de cargo y abono
  abono: number | null;
};

const PATRONES: Record<keyof Mapeo, RegExp> = {
  fecha: /fecha|date|dia|operaci/,
  descripcion: /descrip|concepto|detalle|movimiento|referencia|comercio|description|merchant|narrativ/,
  monto: /^monto$|importe|amount|^valor|^total|cantidad/,
  cargo: /cargo|retiro|debito|debit|salida|egreso|withdraw/,
  abono: /abono|deposito|credito|credit|entrada|ingreso/,
};

export type Tabla = { encabezados: string[]; filas: unknown[][] };

// Busca la fila de encabezados (la primera con texto que parezca nombre de columna)
export function separarEncabezados(filas: unknown[][]): Tabla {
  const limpias = filas.filter((f) => f.some((c) => c !== null && c !== undefined && String(c).trim() !== ""));
  for (let i = 0; i < Math.min(limpias.length, 15); i++) {
    const textos = limpias[i].map((c) => normalizar(String(c ?? "")));
    const aciertos = textos.filter((t) => Object.values(PATRONES).some((p) => p.test(t))).length;
    if (aciertos >= 2) return { encabezados: limpias[i].map((c) => String(c ?? "").trim()), filas: limpias.slice(i + 1) };
  }
  const columnas = Math.max(0, ...limpias.map((f) => f.length));
  return { encabezados: Array.from({ length: columnas }, (_, i) => `Columna ${i + 1}`), filas: limpias };
}

export function detectarColumnas(tabla: Tabla): Mapeo {
  const mapeo: Mapeo = { fecha: null, descripcion: null, monto: null, cargo: null, abono: null };
  const nombres = tabla.encabezados.map(normalizar);
  const usado = new Set<number>();
  for (const campo of ["fecha", "cargo", "abono", "monto", "descripcion"] as (keyof Mapeo)[]) {
    const i = nombres.findIndex((n, idx) => !usado.has(idx) && PATRONES[campo].test(n));
    if (i >= 0) {
      mapeo[campo] = i;
      usado.add(i);
    }
  }

  // Sin encabezados útiles: deducir por el contenido de las primeras filas
  const muestra = tabla.filas.slice(0, 20);
  const proporcion = (col: number, prueba: (v: unknown) => boolean) =>
    muestra.length ? muestra.filter((f) => prueba(f[col])).length / muestra.length : 0;
  const columnas = tabla.encabezados.length;
  if (mapeo.fecha === null) {
    for (let c = 0; c < columnas; c++) {
      if (!usado.has(c) && proporcion(c, (v) => leerFecha(v) !== null) > 0.7) {
        mapeo.fecha = c;
        usado.add(c);
        break;
      }
    }
  }
  if (mapeo.monto === null && mapeo.cargo === null && mapeo.abono === null) {
    for (let c = columnas - 1; c >= 0; c--) {
      if (!usado.has(c) && proporcion(c, (v) => leerMonto(v) !== null && leerFecha(v) === null) > 0.7) {
        mapeo.monto = c;
        usado.add(c);
        break;
      }
    }
  }
  if (mapeo.descripcion === null) {
    let mejor = -1;
    let largo = 0;
    for (let c = 0; c < columnas; c++) {
      if (usado.has(c)) continue;
      const promedio = muestra.reduce((t, f) => t + String(f[c] ?? "").length, 0) / (muestra.length || 1);
      if (promedio > largo) {
        largo = promedio;
        mejor = c;
      }
    }
    if (mejor >= 0) mapeo.descripcion = mejor;
  }
  return mapeo;
}

// Comercio legible a partir de la descripción del banco: quita números de referencia y palabras genéricas
export function extraerComercio(descripcion: string): string {
  const limpio = descripcion
    .replace(/\b(compra|pago|cargo|abono|spei|transf\w*|tdd|tdc|pos|ref\w*|aut\w*|folio|rfc|en|de|a)\b/gi, " ")
    .replace(/[*#]/g, " ")
    .replace(/\b\d[\d\-/:.]*\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const palabras = limpio.split(" ").slice(0, 4).join(" ");
  return palabras ? palabras.charAt(0).toUpperCase() + palabras.slice(1).toLowerCase() : descripcion.slice(0, 40);
}

export type FilaConvertida = { ok: true; movimiento: MovimientoNuevo } | { ok: false; fila: number; motivo: string };

// Convierte las filas de la tabla con el mapeo elegido.
// "gastosNegativos": en los archivos con un solo monto, los gastos vienen en negativo (lo más común).
export function convertirFilas(tabla: Tabla, mapeo: Mapeo, gastosNegativos = true): FilaConvertida[] {
  return tabla.filas.map((f, i) => {
    const fecha = mapeo.fecha !== null ? leerFecha(f[mapeo.fecha]) : null;
    if (!fecha) return { ok: false, fila: i + 1, motivo: "Fecha no reconocida" };
    const descripcion = mapeo.descripcion !== null ? String(f[mapeo.descripcion] ?? "").trim() : "";
    let monto: number | null = null;
    let tipo: TipoMovimiento = "gasto";
    if (mapeo.cargo !== null || mapeo.abono !== null) {
      const cargo = mapeo.cargo !== null ? leerMonto(f[mapeo.cargo]) : null;
      const abono = mapeo.abono !== null ? leerMonto(f[mapeo.abono]) : null;
      if (cargo) {
        monto = Math.abs(cargo);
        tipo = "gasto";
      } else if (abono) {
        monto = Math.abs(abono);
        tipo = "ingreso";
      }
    } else if (mapeo.monto !== null) {
      const valor = leerMonto(f[mapeo.monto]);
      if (valor !== null && valor !== 0) {
        monto = Math.abs(valor);
        tipo = (valor < 0) === gastosNegativos ? "gasto" : "ingreso";
      }
    }
    if (!monto) return { ok: false, fila: i + 1, motivo: "Monto no reconocido" };
    return {
      ok: true,
      movimiento: {
        fecha,
        descripcion_original: descripcion || "(Sin descripción)",
        comercio: extraerComercio(descripcion),
        monto: redondear(monto),
        tipo,
      },
    };
  });
}

// ---------- Duplicados ----------

// Hash único con fecha, monto y descripción (SHA-256, funciona en servidor y navegador)
export async function hashUnico(m: Pick<MovimientoNuevo, "fecha" | "monto" | "descripcion_original" | "tipo">) {
  const texto = `${m.fecha}|${m.monto.toFixed(2)}|${m.tipo}|${normalizar(m.descripcion_original)}`;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

