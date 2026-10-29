import type { TipoMovimiento } from "./importar";

export type TipoCuenta = "debito" | "credito" | "efectivo" | "ahorro";
export type Frecuencia = "mensual" | "anual" | "unica";

export type Cuenta = {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  dia_corte: number | null;
  dia_limite_pago: number | null;
  saldo_actual: number;
  es_ejemplo: boolean;
  // Solo tarjetas de crédito: el "pago para no generar intereses" de tu app del banco y el corte al que corresponde
  saldo_al_corte?: number | null;
  fecha_corte_saldo?: string | null;
  // Solo ahorro/débito: rendimiento anual en % (diario, con interés compuesto)
  tasa_anual?: number | null;
  tope_tasa?: number | null; // la tasa aplica solo hasta este saldo (Cajita Turbo: 25,000)
  tasa_excedente?: number | null; // lo que pasa del tope gana esta tasa
  rendimiento_desde?: string | null; // último día en que ya se sumó el rendimiento
};

export type Categoria = { id: string; nombre: string; presupuesto_mensual: number; color_neutro: string };

export type Movimiento = {
  id: string;
  account_id: string;
  fecha: string;
  descripcion_original: string;
  comercio: string | null;
  monto: number;
  tipo: TipoMovimiento;
  category_id: string | null;
  requiere_revision: boolean;
  es_recurrente: boolean;
  hash_unico: string;
  import_id: string | null;
};

export type Regla = { id: string; patron_texto: string; category_id: string };

export type Meta = {
  id: string;
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  fecha_objetivo: string;
  es_ejemplo: boolean;
};

// Préstamo: le mandaste dinero a alguien y te lo va a regresar (saldo a favor)
export type Prestamo = {
  id: string;
  persona: string;
  monto: number;
  abonado: number; // lo que ya te han pagado
  cuenta_id: string | null; // de dónde salió
  fecha: string;
  fecha_pago: string | null; // cuándo te dijeron que te pagan
  nota: string | null;
  liquidado_el: string | null;
  created_at?: string;
};

// Un celular o navegador donde activaste las notificaciones push
export type SuscripcionPush = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  dispositivo: string | null;
  created_at?: string;
};

// Dinero que pasa de una cuenta tuya a otra (p. ej. pagar la tarjeta desde el débito). No es gasto ni ingreso.
export type Transferencia = {
  id: string;
  fecha: string;
  origen_id: string;
  destino_id: string;
  monto: number;
  nota: string | null;
  created_at?: string;
};

// Aviso de tu banco leído de tu correo
export type ClaseCorreo = "salida" | "entrada" | "pago_tarjeta" | "compra";
export type EstadoCorreo = "pendiente" | "aplicado" | "ignorado" | "duplicado";
export type CorreoBanco = {
  id: string;
  gmail_id: string;
  recibido: string; // ISO
  banco: string;
  asunto: string;
  clase: ClaseCorreo;
  monto: number;
  cuenta_id: string | null;
  contraparte: string | null;
  entidad: string | null; // banco al que se mandó (si el correo lo dice)
  propio: boolean; // el dinero fue entre tus propias cuentas
  estado: EstadoCorreo;
  resultado: string | null;
  transferencia_id: string | null;
  movimiento_hash: string | null;
  created_at?: string;
};

export type Aportacion = { id: string; goal_id: string; fecha: string; monto: number };

export type PagoProgramado = {
  id: string;
  nombre: string;
  monto: number;
  frecuencia: Frecuencia;
  proximo_vencimiento: string;
  account_id: string | null;
  es_ejemplo: boolean;
};

export type Importacion = {
  id: string;
  nombre_archivo: string;
  ruta_storage: string | null;
  estado: "pendiente" | "procesado" | "error";
  movimientos_detectados: number;
  created_at: string;
};

export const NOMBRES_TIPO_CUENTA: Record<TipoCuenta, string> = {
  debito: "Débito",
  credito: "Crédito",
  efectivo: "Efectivo",
  ahorro: "Ahorro",
};
