import { CATEGORIAS_INICIALES } from "./categorizar";
import { diasDelMes, hoyLocal, mesDe, redondear, sumarDias, sumarMeses } from "./formato";
import type { Aportacion, Categoria, Cuenta, Meta, Movimiento, PagoProgramado } from "./tipos";

// Datos de ejemplo para probar la app sin información real. Todo lo creado aquí lleva es_ejemplo = true.

export const PRESUPUESTOS_EJEMPLO: Record<string, number> = {
  "Súper y despensa": 5000,
  "Comida fuera": 2500,
  Transporte: 3000,
  Servicios: 1500,
  "Casa y remodelación": 3000,
  Salud: 800,
  Suscripciones: 400,
  "Ropa y personal": 1000,
  Entretenimiento: 800,
  Educación: 0,
  Otros: 500,
};

export type DatosEjemplo = {
  cuentas: Omit<Cuenta, "id">[];
  // Movimientos con la cuenta y la categoría por nombre; se resuelven a ids al guardarlos
  movimientos: (Omit<Movimiento, "id" | "account_id" | "category_id"> & { cuenta: string; categoria: string | null })[];
  metas: (Omit<Meta, "id"> & { aportaciones: Omit<Aportacion, "id" | "goal_id">[] })[];
  pagos: (Omit<PagoProgramado, "id" | "account_id"> & { cuenta: string | null })[];
};

// Números pseudoaleatorios repetibles, para que el ejemplo siempre se vea igual
function generador(semilla: number) {
  return () => {
    semilla = (semilla * 1664525 + 1013904223) % 4294967296;
    return semilla / 4294967296;
  };
}

export function generarEjemplo(hoy = hoyLocal()): DatosEjemplo {
  const azar = generador(42);
  const entre = (min: number, max: number) => redondear(min + azar() * (max - min));
  const movimientos: DatosEjemplo["movimientos"] = [];
  let n = 0;
  const agregar = (
    fecha: string,
    descripcion: string,
    comercio: string,
    monto: number,
    categoria: string | null,
    cuenta: string,
    tipo: "gasto" | "ingreso" = "gasto",
  ) => {
    if (fecha > hoy) return;
    movimientos.push({
      fecha,
      descripcion_original: descripcion,
      comercio,
      monto,
      tipo,
      cuenta,
      categoria,
      requiere_revision: tipo === "gasto" && categoria === null,
      es_recurrente: false,
      hash_unico: `ejemplo-${fecha}-${n++}`,
      import_id: null,
    });
  };

  const mesActual = mesDe(hoy);
  for (let i = -5; i <= 0; i++) {
    const mes = sumarMeses(mesActual, i);
    const [a, m] = mes.split("-").map(Number);
    const ultimo = diasDelMes(a, m);
    const dia = (d: number) => `${mes}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
    const esActual = i === 0;

    agregar(dia(15), "SPEI RECIBIDO NOMINA QUINCENA", "Nómina", 9000, null, "BBVA Débito", "ingreso");
    agregar(dia(ultimo), "SPEI RECIBIDO NOMINA QUINCENA", "Nómina", 9000, null, "BBVA Débito", "ingreso");
    agregar(dia(5), "NETFLIX.COM", "Netflix", 219, "Suscripciones", "Nu Crédito");
    agregar(dia(12), "SPOTIFY MEXICO", "Spotify", 129, "Suscripciones", "Nu Crédito");
    agregar(dia(8), "TELMEX PAGO SERVICIO", "Telmex", 499, "Servicios", "BBVA Débito");
    if (m % 2 === 0) agregar(dia(18), "CFE SUMINISTRADOR", "CFE", entre(560, 720), "Servicios", "BBVA Débito");

    for (const d of [3, 10, 17, 24]) {
      agregar(dia(d), "WALMART CENTRO 1234", "Walmart", entre(850, 1400), "Súper y despensa", "BBVA Débito");
      agregar(dia(d + 1), "PEMEX GASOLINERA SUR 7", "Pemex", entre(650, 900), "Transporte", "Nu Crédito");
    }
    for (const d of [2, 6, 9, 13, 16, 20, 23, 27]) {
      agregar(dia(d), "TAQUERIA EL PASTOR", "Taquería El Pastor", entre(120, esActual ? 520 : 330), "Comida fuera", azar() > 0.5 ? "Efectivo" : "BBVA Débito");
    }
    // La remodelación pesa más este mes (para ver una categoría excedida)
    agregar(dia(7), "HOME DEPOT CENTRO", "Home Depot", entre(esActual ? 2600 : 900, esActual ? 3200 : 1800), "Casa y remodelación", "Nu Crédito");
    if (esActual) agregar(dia(9), "COMEX PINTURAS", "Comex", 1380, "Casa y remodelación", "Nu Crédito");
    if (azar() > 0.4) agregar(dia(14), "FARMACIA GUADALAJARA", "Farmacia Guadalajara", entre(150, 480), "Salud", "BBVA Débito");
    if (azar() > 0.5) agregar(dia(21), "CINEPOLIS CENTRO", "Cinépolis", entre(240, 420), "Entretenimiento", "Nu Crédito");
    agregar(dia(28), "TRASPASO A AHORRO", "Ahorro", 3000, "Otros", "BBVA Débito");
  }

  // Movimientos sin categoría, para probar la bandeja "Por revisar"
  agregar(sumarDias(hoy, -1), "MERPAGO*ABARROTESLUPITA", "Abarrotes Lupita", 186.5, null, "BBVA Débito");
  agregar(sumarDias(hoy, -2), "CLIP *TALLER MECANICO REYES", "Taller Mecánico Reyes", 1450, null, "Nu Crédito");
  agregar(sumarDias(hoy, -3), "TIENDA DON PEPE", "Tienda Don Pepe", 92, null, "Efectivo");

  const aportes = (monto: number) =>
    [-75, -45, -15].map((d) => ({ fecha: sumarDias(hoy, d), monto }));

  return {
    cuentas: [
      { nombre: "BBVA Débito", tipo: "debito", dia_corte: null, dia_limite_pago: null, saldo_actual: 12500, es_ejemplo: true },
      { nombre: "Nu Crédito", tipo: "credito", dia_corte: 5, dia_limite_pago: 25, saldo_actual: -4300, es_ejemplo: true },
      { nombre: "Efectivo", tipo: "efectivo", dia_corte: null, dia_limite_pago: null, saldo_actual: 800, es_ejemplo: true },
      { nombre: "Ahorro", tipo: "ahorro", dia_corte: null, dia_limite_pago: null, saldo_actual: 27000, es_ejemplo: true },
    ],
    movimientos,
    metas: [
      { nombre: "Fondo de emergencia", monto_objetivo: 30000, monto_actual: 9000, fecha_objetivo: sumarDias(hoy, 300), es_ejemplo: true, aportaciones: aportes(1500) },
      { nombre: "Remodelación de la cocina", monto_objetivo: 60000, monto_actual: 18000, fecha_objetivo: sumarDias(hoy, 365), es_ejemplo: true, aportaciones: aportes(3000) },
    ],
    pagos: [
      { nombre: "Pago tarjeta Nu", monto: 4300, frecuencia: "mensual", proximo_vencimiento: `${mesActual}-25` < hoy ? `${sumarMeses(mesActual, 1)}-25` : `${mesActual}-25`, cuenta: "BBVA Débito", es_ejemplo: true },
      { nombre: "Internet Telmex", monto: 499, frecuencia: "mensual", proximo_vencimiento: sumarDias(hoy, 7), cuenta: "BBVA Débito", es_ejemplo: true },
      { nombre: "Mensualidad azulejo", monto: 1500, frecuencia: "mensual", proximo_vencimiento: sumarDias(hoy, 2), cuenta: "Efectivo", es_ejemplo: true },
      { nombre: "Seguro del auto", monto: 7800, frecuencia: "anual", proximo_vencimiento: sumarDias(hoy, 40), cuenta: "BBVA Débito", es_ejemplo: true },
    ],
  };
}

export function categoriasConPresupuesto(): Omit<Categoria, "id">[] {
  return CATEGORIAS_INICIALES.map((c) => ({
    nombre: c.nombre,
    presupuesto_mensual: PRESUPUESTOS_EJEMPLO[c.nombre] ?? 0,
    color_neutro: "#737373",
  }));
}
