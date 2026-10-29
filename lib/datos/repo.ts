import type { Aportacion, Categoria, CorreoBanco, Cuenta, EstadoCorreo, Importacion, Meta, Movimiento, PagoProgramado, Prestamo, Regla, SuscripcionPush, Transferencia } from "../tipos";

export type FiltroMovimientos = {
  desde?: string;
  hasta?: string;
  categoria?: string;
  cuenta?: string;
  soloPorRevisar?: boolean;
  limite?: number;
};

type Nuevo<T> = Omit<T, "id">;
type Editable<T> = Partial<Omit<T, "id">>;

// Todas las operaciones de datos de la app. Hay dos versiones: Supabase (real) y memoria (modo demostración).
export interface Repo {
  modo: "supabase" | "demo";

  cuentas(): Promise<Cuenta[]>;
  crearCuenta(c: Nuevo<Cuenta>): Promise<void>;
  editarCuenta(id: string, c: Editable<Cuenta>): Promise<void>;
  borrarCuenta(id: string): Promise<void>;

  categorias(): Promise<Categoria[]>;
  crearCategorias(c: Nuevo<Categoria>[]): Promise<void>;
  editarCategoria(id: string, c: Editable<Categoria>): Promise<void>;
  borrarCategoria(id: string): Promise<void>;

  movimientos(filtro?: FiltroMovimientos): Promise<Movimiento[]>;
  contarPorRevisar(): Promise<number>;
  hashesExistentes(hashes: string[]): Promise<Set<string>>;
  insertarMovimientos(m: Nuevo<Movimiento>[]): Promise<number>;
  editarMovimientos(ids: string[], cambios: Editable<Movimiento>): Promise<void>;
  borrarMovimiento(id: string): Promise<void>;
  borrarMovimientoPorHash(hash: string): Promise<Movimiento | null>;

  reglas(): Promise<Regla[]>;
  guardarRegla(patron_texto: string, category_id: string): Promise<void>;
  borrarRegla(id: string): Promise<void>;

  metas(): Promise<Meta[]>;
  crearMeta(m: Nuevo<Meta>): Promise<void>;
  editarMeta(id: string, m: Editable<Meta>): Promise<void>;
  borrarMeta(id: string): Promise<void>;
  aportaciones(): Promise<Aportacion[]>;
  crearAportaciones(a: Nuevo<Aportacion>[]): Promise<void>;

  prestamos(): Promise<Prestamo[]>;
  crearPrestamo(p: Nuevo<Prestamo>): Promise<string>;
  editarPrestamo(id: string, p: Editable<Prestamo>): Promise<void>;
  borrarPrestamo(id: string): Promise<Prestamo | null>;

  transferencias(limite?: number): Promise<Transferencia[]>;
  crearTransferencia(t: Nuevo<Transferencia>): Promise<string>; // regresa el id
  borrarTransferencia(id: string): Promise<Transferencia | null>;

  correos(filtro?: { estado?: EstadoCorreo; limite?: number }): Promise<CorreoBanco[]>;
  correo(id: string): Promise<CorreoBanco | null>;
  correosExistentes(gmailIds: string[]): Promise<Set<string>>;
  crearCorreo(c: Nuevo<CorreoBanco>): Promise<string>;
  editarCorreo(id: string, c: Editable<CorreoBanco>): Promise<void>;

  pagos(): Promise<PagoProgramado[]>;
  crearPago(p: Nuevo<PagoProgramado>): Promise<void>;
  editarPago(id: string, p: Editable<PagoProgramado>): Promise<void>;
  borrarPago(id: string): Promise<void>;

  importaciones(): Promise<Importacion[]>;
  crearImportacion(i: Omit<Importacion, "id" | "created_at">): Promise<string>;
  editarImportacion(id: string, i: Editable<Importacion>): Promise<void>;
  // Corrige la cuenta de todos los movimientos de una importación, o la deshace por completo
  moverImportacion(id: string, accountId: string): Promise<number>;
  borrarImportacion(id: string): Promise<number>;

  // Notificaciones push de esta app (la tabla es compartida con las otras apps TAOS)
  suscripcionesPush(): Promise<SuscripcionPush[]>;
  guardarSuscripcionPush(s: Omit<SuscripcionPush, "id" | "created_at">): Promise<void>;
  borrarSuscripcionPush(endpoint: string): Promise<void>;

  borrarDatosDeEjemplo(): Promise<void>;
}
