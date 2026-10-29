import { categoriasConPresupuesto, generarEjemplo } from "../ejemplo";
import { detectarRecurrentes } from "../recurrentes";
import type { Aportacion, Categoria, CorreoBanco, Cuenta, Importacion, Meta, Movimiento, PagoProgramado, Prestamo, Regla, SuscripcionPush, Transferencia } from "../tipos";
import type { Repo } from "./repo";

// Modo demostración: los datos viven en memoria del servidor y se reinician de vez en cuando.
// Sirve para ver la app funcionando antes de conectar Supabase.

type Almacen = {
  cuentas: Cuenta[];
  categorias: Categoria[];
  movimientos: Movimiento[];
  reglas: Regla[];
  metas: Meta[];
  aportaciones: Aportacion[];
  pagos: PagoProgramado[];
  importaciones: Importacion[];
  transferencias: Transferencia[];
  correos: CorreoBanco[];
  prestamos: Prestamo[];
  suscripcionesPush: SuscripcionPush[];
};

const id = () => crypto.randomUUID();

function crearAlmacen(): Almacen {
  const ejemplo = generarEjemplo();
  const categorias = categoriasConPresupuesto().map((c) => ({ ...c, id: id() }));
  const cuentas = ejemplo.cuentas.map((c) => ({ ...c, id: id() }));
  const idCuenta = (nombre: string | null) => cuentas.find((c) => c.nombre === nombre)?.id ?? null;
  const idCategoria = (nombre: string | null) => categorias.find((c) => c.nombre === nombre)?.id ?? null;
  const movimientos: Movimiento[] = ejemplo.movimientos.map(({ cuenta, categoria, ...m }) => ({
    ...m,
    id: id(),
    account_id: idCuenta(cuenta)!,
    category_id: idCategoria(categoria),
  }));
  const recurrentes = detectarRecurrentes(movimientos);
  movimientos.forEach((m) => (m.es_recurrente = recurrentes.has(m.id)));
  const metas: Meta[] = [];
  const aportaciones: Aportacion[] = [];
  for (const { aportaciones: aportes, ...meta } of ejemplo.metas) {
    const nueva = { ...meta, id: id() };
    metas.push(nueva);
    aportes.forEach((a) => aportaciones.push({ ...a, id: id(), goal_id: nueva.id }));
  }
  return {
    cuentas,
    categorias,
    movimientos,
    reglas: [],
    metas,
    aportaciones,
    pagos: ejemplo.pagos.map(({ cuenta, ...p }) => ({ ...p, id: id(), account_id: idCuenta(cuenta) })),
    importaciones: [],
    transferencias: [],
    correos: [],
    prestamos: [],
    suscripcionesPush: [],
  };
}

const global = globalThis as unknown as { __almacenDemo?: Almacen; __almacenDemoCreado?: number };

function almacen(): Almacen {
  // Se reinicia cada 6 horas para que la demostración no acumule cambios
  if (!global.__almacenDemo || Date.now() - (global.__almacenDemoCreado ?? 0) > 6 * 3600_000) {
    global.__almacenDemo = crearAlmacen();
    global.__almacenDemoCreado = Date.now();
  }
  return global.__almacenDemo;
}

function editar<T extends { id: string }>(lista: T[], ids: string[], cambios: Partial<NoInfer<T>>) {
  for (const fila of lista) if (ids.includes(fila.id)) Object.assign(fila, cambios);
}

export function repoMemoria(): Repo {
  const a = almacen();
  return {
    modo: "demo",
    async cuentas() {
      return [...a.cuentas];
    },
    async crearCuenta(c) {
      a.cuentas.push({ ...c, id: id() });
    },
    async editarCuenta(i, c) {
      editar(a.cuentas, [i], c);
    },
    async borrarCuenta(i) {
      a.cuentas = a.cuentas.filter((c) => c.id !== i);
      a.movimientos = a.movimientos.filter((m) => m.account_id !== i);
    },
    async correos(filtro = {}) {
      return a.correos
        .filter((c) => !filtro.estado || c.estado === filtro.estado)
        .sort((x, y) => y.recibido.localeCompare(x.recibido))
        .slice(0, filtro.limite ?? 100);
    },
    async correo(i) {
      return a.correos.find((c) => c.id === i) ?? null;
    },
    async correosExistentes(ids) {
      return new Set(a.correos.filter((c) => ids.includes(c.gmail_id)).map((c) => c.gmail_id));
    },
    async crearCorreo(c) {
      const nuevo = id();
      a.correos.push({ ...c, id: nuevo, created_at: new Date().toISOString() });
      return nuevo;
    },
    async editarCorreo(i, c) {
      editar(a.correos, [i], c);
    },
    async prestamos() {
      return [...(a.prestamos ??= [])].sort((x, y) => y.fecha.localeCompare(x.fecha));
    },
    async crearPrestamo(p) {
      const nuevo = id();
      (a.prestamos ??= []).push({ ...p, id: nuevo, created_at: new Date().toISOString() });
      return nuevo;
    },
    async editarPrestamo(i, p) {
      editar((a.prestamos ??= []), [i], p);
    },
    async borrarPrestamo(i) {
      const p = (a.prestamos ??= []).find((x) => x.id === i) ?? null;
      a.prestamos = a.prestamos.filter((x) => x.id !== i);
      return p;
    },

    async transferencias(limite = 50) {
      return [...a.transferencias].sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, limite);
    },
    async crearTransferencia(t) {
      const nuevo = id();
      a.transferencias.push({ ...t, id: nuevo, created_at: new Date().toISOString() });
      return nuevo;
    },
    async borrarTransferencia(i) {
      const t = a.transferencias.find((x) => x.id === i) ?? null;
      a.transferencias = a.transferencias.filter((x) => x.id !== i);
      return t;
    },
    async categorias() {
      return [...a.categorias].sort((x, y) => x.nombre.localeCompare(y.nombre));
    },
    async crearCategorias(c) {
      for (const nueva of c) if (!a.categorias.some((x) => x.nombre === nueva.nombre)) a.categorias.push({ ...nueva, id: id() });
    },
    async editarCategoria(i, c) {
      editar(a.categorias, [i], c);
    },
    async borrarCategoria(i) {
      a.categorias = a.categorias.filter((c) => c.id !== i);
      a.movimientos.forEach((m) => m.category_id === i && (m.category_id = null));
      a.reglas = a.reglas.filter((r) => r.category_id !== i);
    },
    async movimientos(f = {}) {
      return a.movimientos
        .filter(
          (m) =>
            (!f.desde || m.fecha >= f.desde) &&
            (!f.hasta || m.fecha <= f.hasta) &&
            (!f.categoria || (f.categoria === "sin" ? m.category_id === null : m.category_id === f.categoria)) &&
            (!f.cuenta || m.account_id === f.cuenta) &&
            (!f.soloPorRevisar || m.requiere_revision),
        )
        .sort((x, y) => y.fecha.localeCompare(x.fecha))
        .slice(0, f.limite ?? 5000);
    },
    async contarPorRevisar() {
      return a.movimientos.filter((m) => m.requiere_revision).length;
    },
    async hashesExistentes(hashes) {
      const existentes = new Set(a.movimientos.map((m) => m.hash_unico));
      return new Set(hashes.filter((h) => existentes.has(h)));
    },
    async insertarMovimientos(nuevos) {
      const existentes = new Set(a.movimientos.map((m) => m.hash_unico));
      const validos = nuevos.filter((m) => !existentes.has(m.hash_unico));
      a.movimientos.push(...validos.map((m) => ({ ...m, id: id() })));
      return validos.length;
    },
    async editarMovimientos(ids, cambios) {
      editar(a.movimientos, ids, cambios);
    },
    async borrarMovimiento(i) {
      a.movimientos = a.movimientos.filter((m) => m.id !== i);
    },
    async borrarMovimientoPorHash(hash) {
      const m = a.movimientos.find((x) => x.hash_unico === hash) ?? null;
      a.movimientos = a.movimientos.filter((x) => x.hash_unico !== hash);
      return m;
    },
    async reglas() {
      return [...a.reglas];
    },
    async guardarRegla(patron_texto, category_id) {
      const existente = a.reglas.find((r) => r.patron_texto === patron_texto);
      if (existente) existente.category_id = category_id;
      else a.reglas.push({ id: id(), patron_texto, category_id });
    },
    async borrarRegla(i) {
      a.reglas = a.reglas.filter((r) => r.id !== i);
    },
    async metas() {
      return [...a.metas];
    },
    async crearMeta(m) {
      a.metas.push({ ...m, id: id() });
    },
    async editarMeta(i, m) {
      editar(a.metas, [i], m);
    },
    async borrarMeta(i) {
      a.metas = a.metas.filter((m) => m.id !== i);
      a.aportaciones = a.aportaciones.filter((x) => x.goal_id !== i);
    },
    async aportaciones() {
      return [...a.aportaciones];
    },
    async crearAportaciones(nuevas) {
      a.aportaciones.push(...nuevas.map((x) => ({ ...x, id: id() })));
    },
    async pagos() {
      return [...a.pagos];
    },
    async crearPago(p) {
      a.pagos.push({ ...p, id: id() });
    },
    async editarPago(i, p) {
      editar(a.pagos, [i], p);
    },
    async borrarPago(i) {
      a.pagos = a.pagos.filter((p) => p.id !== i);
    },
    async importaciones() {
      return [...a.importaciones].reverse();
    },
    async crearImportacion(i) {
      const nueva = { ...i, id: id(), created_at: new Date().toISOString() };
      a.importaciones.push(nueva);
      return nueva.id;
    },
    async editarImportacion(i, cambios) {
      editar(a.importaciones, [i], cambios);
    },
    async moverImportacion(i, accountId) {
      const propios = a.movimientos.filter((m) => m.import_id === i);
      propios.forEach((m) => (m.account_id = accountId));
      return propios.length;
    },
    async borrarImportacion(i) {
      const antes = a.movimientos.length;
      a.movimientos = a.movimientos.filter((m) => m.import_id !== i);
      a.importaciones = a.importaciones.filter((x) => x.id !== i);
      return antes - a.movimientos.length;
    },
    async suscripcionesPush() {
      return [...(a.suscripcionesPush ??= [])];
    },
    async guardarSuscripcionPush(s) {
      a.suscripcionesPush = (a.suscripcionesPush ?? []).filter((x) => x.endpoint !== s.endpoint);
      a.suscripcionesPush.push({ ...s, id: id(), created_at: new Date().toISOString() });
    },
    async borrarSuscripcionPush(endpoint) {
      a.suscripcionesPush = (a.suscripcionesPush ?? []).filter((x) => x.endpoint !== endpoint);
    },
    async borrarDatosDeEjemplo() {
      global.__almacenDemo = crearAlmacen();
    },
  };
}
