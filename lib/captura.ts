import { hoyLocal, normalizar, redondear, sumarDias } from "./formato";
import { extraerComercio, leerFecha, type TipoMovimiento } from "./importar";
import type { Cuenta, TipoCuenta } from "./tipos";

export type CapturaInterpretada = {
  monto: number;
  tipo: TipoMovimiento;
  comercio: string;
  fecha: string;
  account_id: string | null;
};

const PALABRAS_INGRESO = /\b(ingreso|cobre|me pagaron|me depositaron|sueldo|nomina|quincena|deposito|recibi|venta|vendi)\b/;
const PALABRAS_CUENTA: [RegExp, TipoCuenta][] = [
  [/\b(debito|tdd|tarjeta de debito)\b/, "debito"],
  [/\b(credito|tdc|tarjeta de credito)\b/, "credito"],
  [/\b(efectivo|cash|billete)\b/, "efectivo"],
  [/\b(ahorro|ahorros)\b/, "ahorro"],
];
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const RELLENO = /\b(con|en|de|del|el|la|los|las|un|una|por|para|pague|gaste|compre|me|cobre|mi|tarjeta|hoy|ayer|antier|anteayer|pesos|mxn)\b/g;

// Interpreta frases como "350 súper con débito", "ayer 1,200 gasolina tdc", "cobré 8000 quincena"
export function interpretarCaptura(frase: string, cuentas: Cuenta[], hoy = hoyLocal()): CapturaInterpretada | null {
  // El monto y la fecha se buscan antes de normalizar, porque normalizar quita puntos y diagonales
  const crudo = frase.toLowerCase().replace(/(\d),(\d{3})/g, "$1$2");
  const fechaEscrita = crudo.match(/(?<![\d.])(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)(?![\d.])/);
  const sinFecha = fechaEscrita ? crudo.replace(fechaEscrita[0], " ") : crudo;
  const numero = sinFecha.match(/(?<![\d.])(\d+(?:\.\d{1,2})?)\s*(k|mil)?(?![\d.])/);
  if (!numero) return null;
  const t = normalizar(sinFecha.replace(numero[0], " "));
  let monto = Number(numero[1]);
  if (numero[2]) monto *= 1000;
  if (!monto) return null;

  const tipo: TipoMovimiento = PALABRAS_INGRESO.test(t) ? "ingreso" : "gasto";

  // Cuenta: primero por nombre, luego por tipo
  let account_id: string | null = null;
  const porNombre = cuentas.find((c) => {
    const nombre = normalizar(c.nombre);
    return nombre.length >= 2 && new RegExp(`\\b${nombre}\\b`).test(t);
  });
  if (porNombre) account_id = porNombre.id;
  else {
    for (const [patron, tipoCuenta] of PALABRAS_CUENTA) {
      if (patron.test(t)) {
        account_id = cuentas.find((c) => c.tipo === tipoCuenta)?.id ?? null;
        break;
      }
    }
  }

  // Fecha
  let fecha = hoy;
  if (/\b(antier|anteayer)\b/.test(t)) fecha = sumarDias(hoy, -2);
  else if (/\bayer\b/.test(t)) fecha = sumarDias(hoy, -1);
  else {
    if (fechaEscrita) {
      const partes = fechaEscrita[1].split(/[/-]/);
      const conAnio = partes.length === 3 ? fechaEscrita[1] : `${fechaEscrita[1]}/${hoy.slice(0, 4)}`;
      fecha = leerFecha(conAnio.replace(/-/g, "/")) ?? hoy;
    } else {
      const dia = DIAS_SEMANA.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
      if (dia >= 0) {
        const hoyDia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
        fecha = sumarDias(hoy, -((hoyDia - dia + 7) % 7));
      }
    }
  }

  // Comercio: lo que queda sin el monto, la fecha, la cuenta y las palabras de relleno
  let resto = t
    .replace(PALABRAS_INGRESO, " ")
    .replace(RELLENO, " ");
  for (const [patron] of PALABRAS_CUENTA) resto = resto.replace(patron, " ");
  for (const d of DIAS_SEMANA) resto = resto.replace(new RegExp(`\\b${d}\\b`), " ");
  if (porNombre) resto = resto.replace(normalizar(porNombre.nombre), " ");
  resto = resto.replace(/\s+/g, " ").trim();
  const comercio = resto ? extraerComercio(resto) : tipo === "ingreso" ? "Ingreso" : "Gasto";

  return { monto: redondear(monto), tipo, comercio, fecha, account_id };
}
