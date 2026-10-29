import type { SupabaseClient } from "@supabase/supabase-js";
import type { Aportacion, Categoria, CorreoBanco, Cuenta, Importacion, Meta, Movimiento, PagoProgramado, Prestamo, Regla, SuscripcionPush, Transferencia } from "../tipos";
import type { FiltroMovimientos, Repo } from "./repo";

// Postgres devuelve los montos "numeric" como número o texto según el caso: siempre los convertimos
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

// Nombre de esta app en la tabla compartida de notificaciones push
const APP_PUSH = "finanzas";

function revisar<T>(resultado: { data: T | null; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(`Error de base de datos: ${resultado.error.message}`);
  return resultado.data as T;
}

// Funciona con la sesión del usuario (RLS) o con la llave secreta en los crons; por eso siempre filtra por user_id
export function repoSupabase(db: SupabaseClient, uid: string): Repo {
  const tabla = (nombre: string) => db.from(nombre);
  const deUsuario = (nombre: string) => tabla(nombre).select("*").eq("user_id", uid);
  const conUsuario = <T extends object>(fila: T) => ({ ...fila, user_id: uid });

  const cuenta = (r: Record<string, unknown>): Cuenta => ({
    ...(r as unknown as Cuenta),
    saldo_actual: num(r.saldo_actual),
    saldo_al_corte: r.saldo_al_corte == null ? null : num(r.saldo_al_corte),
    tasa_anual: r.tasa_anual == null ? null : num(r.tasa_anual),
    tope_tasa: r.tope_tasa == null ? null : num(r.tope_tasa),
    tasa_excedente: r.tasa_excedente == null ? null : num(r.tasa_excedente),
  });
  const categoria = (r: Record<string, unknown>): Categoria => ({
    ...(r as unknown as Categoria),
    presupuesto_mensual: num(r.presupuesto_mensual),
  });
  const prestamo = (r: Record<string, unknown>): Prestamo => ({ ...(r as unknown as Prestamo), monto: num(r.monto), abonado: num(r.abonado) });
  const correoBanco = (r: Record<string, unknown>): CorreoBanco => ({ ...(r as unknown as CorreoBanco), monto: num(r.monto) });
  const movimiento = (r: Record<string, unknown>): Movimiento => ({ ...(r as unknown as Movimiento), monto: num(r.monto) });
  const meta = (r: Record<string, unknown>): Meta => ({
    ...(r as unknown as Meta),
    monto_objetivo: num(r.monto_objetivo),
    monto_actual: num(r.monto_actual),
  });

  return {
    modo: "supabase",

    async cuentas() {
      return revisar(await deUsuario("accounts").order("created_at")).map(cuenta);
    },
    async crearCuenta(c) {
      revisar(await tabla("accounts").insert(conUsuario(c)));
    },
    async editarCuenta(id, c) {
      revisar(await tabla("accounts").update(c).eq("id", id).eq("user_id", uid));
    },
    async borrarCuenta(id) {
      revisar(await tabla("accounts").delete().eq("id", id).eq("user_id", uid));
    },

    async correos(filtro = {}) {
      let q = deUsuario("bank_emails").order("recibido", { ascending: false }).limit(filtro.limite ?? 100);
      if (filtro.estado) q = q.eq("estado", filtro.estado);
      return revisar(await q).map(correoBanco);
    },
    async correo(id) {
      const fila = revisar(await deUsuario("bank_emails").eq("id", id).maybeSingle()) as Record<string, unknown> | null;
      return fila ? correoBanco(fila) : null;
    },
    async correosExistentes(gmailIds) {
      if (!gmailIds.length) return new Set();
      const filas = revisar(await tabla("bank_emails").select("gmail_id").eq("user_id", uid).in("gmail_id", gmailIds)) as { gmail_id: string }[];
      return new Set(filas.map((f) => f.gmail_id));
    },
    async crearCorreo(c) {
      const fila = revisar(await tabla("bank_emails").insert(conUsuario(c)).select("id").single()) as { id: string };
      return fila.id;
    },
    async editarCorreo(id, c) {
      revisar(await tabla("bank_emails").update(c).eq("id", id).eq("user_id", uid));
    },

    async prestamos() {
      return revisar(await deUsuario("loans").order("fecha", { ascending: false })).map((r: Record<string, unknown>) => prestamo(r));
    },
    async crearPrestamo(p) {
      const fila = revisar(await tabla("loans").insert(conUsuario(p)).select("id").single()) as { id: string };
      return fila.id;
    },
    async editarPrestamo(id, p) {
      revisar(await tabla("loans").update(p).eq("id", id).eq("user_id", uid));
    },
    async borrarPrestamo(id) {
      const fila = revisar(await tabla("loans").delete().eq("id", id).eq("user_id", uid).select().maybeSingle()) as Record<string, unknown> | null;
      return fila ? prestamo(fila) : null;
    },

    async transferencias(limite = 50) {
      return revisar(await deUsuario("transfers").order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(limite)).map(
        (r: Record<string, unknown>) => ({ ...(r as unknown as Transferencia), monto: num(r.monto) }),
      );
    },
    async crearTransferencia(t) {
      const fila = revisar(await tabla("transfers").insert(conUsuario(t)).select("id").single()) as { id: string };
      return fila.id;
    },
    async borrarTransferencia(id) {
      const fila = revisar(await tabla("transfers").delete().eq("id", id).eq("user_id", uid).select().maybeSingle()) as Record<string, unknown> | null;
      return fila ? { ...(fila as unknown as Transferencia), monto: num(fila.monto) } : null;
    },

    async categorias() {
      return revisar(await deUsuario("categories").order("nombre")).map(categoria);
    },
    async crearCategorias(c) {
      if (c.length) revisar(await tabla("categories").upsert(c.map(conUsuario), { onConflict: "user_id,nombre", ignoreDuplicates: true }));
    },
    async editarCategoria(id, c) {
      revisar(await tabla("categories").update(c).eq("id", id).eq("user_id", uid));
    },
    async borrarCategoria(id) {
      revisar(await tabla("categories").delete().eq("id", id).eq("user_id", uid));
    },

    async movimientos(filtro: FiltroMovimientos = {}) {
      let q = deUsuario("transactions").order("fecha", { ascending: false }).order("created_at", { ascending: false });
      if (filtro.desde) q = q.gte("fecha", filtro.desde);
      if (filtro.hasta) q = q.lte("fecha", filtro.hasta);
      if (filtro.categoria === "sin") q = q.is("category_id", null);
      else if (filtro.categoria) q = q.eq("category_id", filtro.categoria);
      if (filtro.cuenta) q = q.eq("account_id", filtro.cuenta);
      if (filtro.soloPorRevisar) q = q.eq("requiere_revision", true);
      q = q.limit(filtro.limite ?? 5000);
      return revisar(await q).map(movimiento);
    },
    async contarPorRevisar() {
      const r = await tabla("transactions").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("requiere_revision", true);
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    },
    async hashesExistentes(hashes) {
      const encontrados = new Set<string>();
      for (let i = 0; i < hashes.length; i += 200) {
        const parte = hashes.slice(i, i + 200);
        const filas = revisar(await tabla("transactions").select("hash_unico").eq("user_id", uid).in("hash_unico", parte));
        (filas as { hash_unico: string }[]).forEach((f) => encontrados.add(f.hash_unico));
      }
      return encontrados;
    },
    async insertarMovimientos(m) {
      if (!m.length) return 0;
      const columnas = m.map((x) => ({
        account_id: x.account_id,
        fecha: x.fecha,
        descripcion_original: x.descripcion_original,
        comercio: x.comercio,
        monto: x.monto,
        tipo: x.tipo,
        category_id: x.category_id,
        requiere_revision: x.requiere_revision,
        es_recurrente: x.es_recurrente,
        hash_unico: x.hash_unico,
        import_id: x.import_id,
      }));
      const filas = revisar(
        await tabla("transactions")
          .upsert(columnas.map(conUsuario), { onConflict: "user_id,hash_unico", ignoreDuplicates: true })
          .select("id"),
      );
      return (filas as unknown[]).length;
    },
    async editarMovimientos(ids, cambios) {
      for (let i = 0; i < ids.length; i += 200) {
        revisar(await tabla("transactions").update(cambios).in("id", ids.slice(i, i + 200)).eq("user_id", uid));
      }
    },
    async borrarMovimiento(id) {
      revisar(await tabla("transactions").delete().eq("id", id).eq("user_id", uid));
    },
    async borrarMovimientoPorHash(hash) {
      const fila = revisar(await tabla("transactions").delete().eq("hash_unico", hash).eq("user_id", uid).select().maybeSingle()) as Record<string, unknown> | null;
      return fila ? movimiento(fila) : null;
    },

    async reglas() {
      return revisar(await deUsuario("categorization_rules").order("patron_texto")) as Regla[];
    },
    async guardarRegla(patron_texto, category_id) {
      revisar(await tabla("categorization_rules").upsert(conUsuario({ patron_texto, category_id }), { onConflict: "user_id,patron_texto" }));
    },
    async borrarRegla(id) {
      revisar(await tabla("categorization_rules").delete().eq("id", id).eq("user_id", uid));
    },

    async metas() {
      return revisar(await deUsuario("savings_goals").order("fecha_objetivo")).map(meta);
    },
    async crearMeta(m) {
      revisar(await tabla("savings_goals").insert(conUsuario(m)));
    },
    async editarMeta(id, m) {
      revisar(await tabla("savings_goals").update(m).eq("id", id).eq("user_id", uid));
    },
    async borrarMeta(id) {
      revisar(await tabla("savings_goals").delete().eq("id", id).eq("user_id", uid));
    },
    async aportaciones() {
      return (revisar(await deUsuario("goal_contributions").order("fecha")) as Record<string, unknown>[]).map(
        (r) => ({ ...(r as unknown as Aportacion), monto: num(r.monto) }),
      );
    },
    async crearAportaciones(a) {
      if (a.length) revisar(await tabla("goal_contributions").insert(a.map(conUsuario)));
    },

    async pagos() {
      return (revisar(await deUsuario("scheduled_payments").order("proximo_vencimiento")) as Record<string, unknown>[]).map(
        (r) => ({ ...(r as unknown as PagoProgramado), monto: num(r.monto) }),
      );
    },
    async crearPago(p) {
      revisar(await tabla("scheduled_payments").insert(conUsuario(p)));
    },
    async editarPago(id, p) {
      revisar(await tabla("scheduled_payments").update(p).eq("id", id).eq("user_id", uid));
    },
    async borrarPago(id) {
      revisar(await tabla("scheduled_payments").delete().eq("id", id).eq("user_id", uid));
    },

    async importaciones() {
      return revisar(await deUsuario("imports").order("created_at", { ascending: false }).limit(20)) as Importacion[];
    },
    async crearImportacion(i) {
      const fila = revisar(await tabla("imports").insert(conUsuario(i)).select("id").single()) as { id: string };
      return fila.id;
    },
    async editarImportacion(id, i) {
      revisar(await tabla("imports").update(i).eq("id", id).eq("user_id", uid));
    },

    async moverImportacion(id, accountId) {
      const filas = revisar(
        await tabla("transactions").update({ account_id: accountId }).eq("user_id", uid).eq("import_id", id).select("id"),
      );
      return (filas as unknown[]).length;
    },
    async borrarImportacion(id) {
      const filas = revisar(await tabla("transactions").delete().eq("user_id", uid).eq("import_id", id).select("id"));
      revisar(await tabla("imports").delete().eq("id", id).eq("user_id", uid));
      return (filas as unknown[]).length;
    },

    async suscripcionesPush() {
      return revisar(await deUsuario("push_subscriptions").eq("app", APP_PUSH).order("created_at")) as SuscripcionPush[];
    },
    async guardarSuscripcionPush(s) {
      // Si el mismo celular se vuelve a suscribir, se actualizan sus llaves
      revisar(await tabla("push_subscriptions").upsert(conUsuario({ ...s, app: APP_PUSH }), { onConflict: "endpoint" }));
    },
    async borrarSuscripcionPush(endpoint) {
      revisar(await tabla("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", uid));
    },

    async borrarDatosDeEjemplo() {
      // Los movimientos de las cuentas de ejemplo se borran en cascada
      for (const nombre of ["accounts", "savings_goals", "scheduled_payments"]) {
        revisar(await tabla(nombre).delete().eq("user_id", uid).eq("es_ejemplo", true));
      }
    },
  };
}
