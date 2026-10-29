"use server";

import { revalidatePath } from "next/cache";
import { interpretarCaptura } from "./captura";
import { categorizarConReglas, patronParaRegla } from "./categorizar";
import { proponerRecortes, type Recorte } from "./consejos";
import { categoriasConPresupuesto, generarEjemplo } from "./ejemplo";
import { confirmarCorreo, deshacerCorreo, ignorarCorreo } from "./correos";
import { deshacerEnvio, registrarCobro } from "./envios";
import { contextoTarjetas, estadoTarjeta, ultimoCorte } from "./tarjetas";
import { aplicarTransferencia, interpretarTransferencia, type TransferenciaInterpretada } from "./transferencias";
import { dinero, hoyLocal, mesDe, normalizar, redondear, sumarDias } from "./formato";
import { categorizarLote, extraerMovimientosDePdf, iaDisponible, interpretarCapturaIA, proponerAhorro } from "./ia";
import { extraerComercio, hashUnico, leerFecha, type MovimientoNuevo } from "./importar";
import { analizarMeta } from "./metas";
import { resumenPorCategoria } from "./presupuesto";
import { detectarRecurrentes } from "./recurrentes";
import { obtenerRepo } from "./sesion";
import { clienteServidor } from "./supabase/servidor";
import type { Cuenta, Frecuencia, Movimiento, TipoCuenta } from "./tipos";

export type Resultado = { ok: true; mensaje: string } | { ok: false; mensaje: string };

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? "").trim();
const numero = (f: FormData, campo: string) => {
  const v = texto(f, campo).replace(/[$,\s]/g, "");
  return v === "" ? null : Number(v);
};
const error = (e: unknown): { ok: false; mensaje: string } => ({ ok: false, mensaje: e instanceof Error ? e.message : String(e) });

function refrescar() {
  revalidatePath("/", "layout");
}

// ---------- Cuentas ----------

export async function guardarCuenta(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const tipo = texto(f, "tipo") as TipoCuenta;
    const datos = {
      nombre: texto(f, "nombre"),
      tipo,
      dia_corte: tipo === "credito" ? numero(f, "dia_corte") : null,
      dia_limite_pago: tipo === "credito" ? numero(f, "dia_limite_pago") : null,
      saldo_actual: numero(f, "saldo_actual") ?? 0,
    };
    if (!datos.nombre) return { ok: false, mensaje: "Ponle un nombre a la cuenta." };
    // Rendimiento (solo si lo escribiste): desde hoy se suma solo cada día
    const tasa = tipo === "credito" ? null : numero(f, "tasa_anual");
    const id = texto(f, "id");
    const anterior = id ? (await repo.cuentas()).find((c) => c.id === id) : undefined;
    const conRendimiento =
      tasa !== null || anterior?.tasa_anual
        ? { tasa_anual: tasa, tope_tasa: tasa ? numero(f, "tope_tasa") : null, tasa_excedente: tasa ? numero(f, "tasa_excedente") : null, rendimiento_desde: tasa ? hoyLocal() : null }
        : {};
    if (id) await repo.editarCuenta(id, { ...datos, ...conRendimiento });
    else await repo.crearCuenta({ ...datos, ...conRendimiento, es_ejemplo: false });
    refrescar();
    return { ok: true, mensaje: "Cuenta guardada." };
  } catch (e) {
    if (/tasa_anual|tope_tasa|rendimiento_desde/.test(String(e))) return { ok: false, mensaje: 'Falta correr en Supabase el SQL de "rendimientos" (0005).' };
    return error(e);
  }
}

export async function borrarCuenta(id: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarCuenta(id);
    refrescar();
    return { ok: true, mensaje: "Cuenta borrada junto con sus movimientos." };
  } catch (e) {
    return error(e);
  }
}

// ---------- Categorías ----------

export async function guardarCategoria(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const nombre = texto(f, "nombre");
    const presupuesto = numero(f, "presupuesto_mensual") ?? 0;
    if (!nombre) return { ok: false, mensaje: "Ponle un nombre a la categoría." };
    if (presupuesto < 0) return { ok: false, mensaje: "El presupuesto no puede ser negativo." };
    const id = texto(f, "id");
    if (id) await repo.editarCategoria(id, { nombre, presupuesto_mensual: presupuesto });
    else await repo.crearCategorias([{ nombre, presupuesto_mensual: presupuesto, color_neutro: "#737373" }]);
    refrescar();
    return { ok: true, mensaje: "Categoría guardada." };
  } catch (e) {
    return error(e);
  }
}

export async function borrarCategoria(id: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarCategoria(id);
    refrescar();
    return { ok: true, mensaje: "Categoría borrada. Sus movimientos quedaron sin categoría." };
  } catch (e) {
    return error(e);
  }
}

// ---------- Categorización ----------

type SinCategorizar = Omit<Movimiento, "id" | "category_id" | "requiere_revision" | "es_recurrente">;

// 1. Reglas propias y comercios conocidos  2. IA por lote (si está activa)  3. Lo demás queda "Por revisar"
async function categorizar(movs: SinCategorizar[]): Promise<Omit<Movimiento, "id">[]> {
  const repo = await obtenerRepo();
  const [reglas, categorias] = await Promise.all([repo.reglas(), repo.categorias()]);
  const resultado = movs.map((m) => {
    if (m.tipo === "ingreso") return { ...m, category_id: null, requiere_revision: false, es_recurrente: false };
    const c = categorizarConReglas(`${m.comercio ?? ""} ${m.descripcion_original}`, reglas, categorias);
    return { ...m, category_id: c?.category_id ?? null, requiere_revision: !c, es_recurrente: false };
  });

  const pendientes = resultado.map((m, i) => ({ m, i })).filter(({ m }) => m.requiere_revision);
  if (pendientes.length && iaDisponible()) {
    try {
      for (let inicio = 0; inicio < pendientes.length; inicio += 100) {
        const lote = pendientes.slice(inicio, inicio + 100);
        const respuesta = await categorizarLote(
          lote.map(({ m, i }) => ({ id: String(i), texto: m.descripcion_original, monto: m.monto })),
          categorias.map((c) => c.nombre),
        );
        for (const r of respuesta) {
          const categoria = categorias.find((c) => c.nombre === r.categoria);
          const fila = resultado[Number(r.id)];
          if (!categoria || !fila) continue;
          fila.category_id = categoria.id;
          // Con confianza baja se sugiere la categoría, pero queda para revisar
          fila.requiere_revision = r.confianza < 0.7;
        }
      }
    } catch (e) {
      console.error("La categorización con IA falló; se usan solo las reglas:", e);
    }
  }
  return resultado;
}

// Marca como recurrentes los cargos que se repiten cada mes con monto parecido (revisa los últimos 4 meses)
async function marcarRecurrentes() {
  const repo = await obtenerRepo();
  const recientes = await repo.movimientos({ desde: sumarDias(hoyLocal(), -125) });
  const recurrentes = detectarRecurrentes(recientes);
  const nuevos = recientes.filter((m) => recurrentes.has(m.id) && !m.es_recurrente).map((m) => m.id);
  if (nuevos.length) await repo.editarMovimientos(nuevos, { es_recurrente: true });
}

// ---------- Movimientos ----------

export async function capturaRapida(frase: string): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const cuentas = await repo.cuentas();
    if (!cuentas.length) return { ok: false, mensaje: "Primero agrega una cuenta en Ajustes." };
    const hoy = hoyLocal();

    // "Pagué la tarjeta Palacio con Revolut": es un movimiento entre tus cuentas, no un gasto
    const transferencia = interpretarTransferencia(frase, cuentas, hoy);
    if (transferencia) return await moverDinero(cuentas, transferencia, null);

    let interpretado = interpretarCaptura(frase, cuentas, hoy);
    if (iaDisponible()) {
      try {
        const ia = await interpretarCapturaIA(frase, cuentas.map((c) => c.nombre), hoy);
        if (ia.entendido && ia.monto > 0) {
          interpretado = {
            monto: redondear(ia.monto),
            tipo: ia.tipo,
            comercio: ia.comercio,
            fecha: leerFecha(ia.fecha) ?? hoy,
            account_id: cuentas.find((c) => c.nombre === ia.cuenta)?.id ?? interpretado?.account_id ?? null,
          };
        }
      } catch (e) {
        console.error("La IA no pudo interpretar la captura; se usan reglas:", e);
      }
    }
    if (!interpretado) return { ok: false, mensaje: 'No encontré un monto. Prueba algo como "350 súper con débito".' };

    const cuenta = cuentas.find((c) => c.id === interpretado!.account_id) ?? cuentas.find((c) => c.tipo === "debito") ?? cuentas[0];
    const base = {
      account_id: cuenta.id,
      fecha: interpretado.fecha,
      descripcion_original: frase,
      comercio: interpretado.comercio,
      monto: interpretado.monto,
      tipo: interpretado.tipo,
      import_id: null,
    };
    // La hora en el hash permite registrar dos veces lo mismo el mismo día (p. ej. dos cafés)
    const hash = await hashUnico({ ...base, descripcion_original: `${frase} ${Date.now()}` });
    const [listo] = await categorizar([{ ...base, hash_unico: hash }]);
    await repo.insertarMovimientos([listo]);
    const categoria = (await repo.categorias()).find((c) => c.id === listo.category_id);
    refrescar();
    return {
      ok: true,
      mensaje: `Guardado: ${listo.tipo === "ingreso" ? "ingreso" : "gasto"} de ${dinero(listo.monto)} en ${listo.comercio}, ${cuenta.nombre}${
        categoria ? ` · ${categoria.nombre}` : " · por revisar"
      }.`,
    };
  } catch (e) {
    return error(e);
  }
}

export async function guardarMovimiento(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const fecha = leerFecha(texto(f, "fecha"));
    const monto = Math.abs(numero(f, "monto") ?? 0);
    const descripcion = texto(f, "descripcion");
    if (!fecha || !monto || !descripcion) return { ok: false, mensaje: "Faltan la fecha, el monto o la descripción." };
    const datos = {
      fecha,
      monto: redondear(monto),
      descripcion_original: descripcion,
      comercio: texto(f, "comercio") || extraerComercio(descripcion),
      tipo: texto(f, "tipo") === "ingreso" ? ("ingreso" as const) : ("gasto" as const),
      account_id: texto(f, "account_id"),
      category_id: texto(f, "category_id") || null,
    };
    const id = texto(f, "id");
    if (id) {
      await repo.editarMovimientos([id], { ...datos, requiere_revision: datos.tipo === "gasto" && !datos.category_id });
    } else {
      await repo.insertarMovimientos([
        {
          ...datos,
          requiere_revision: datos.tipo === "gasto" && !datos.category_id,
          es_recurrente: false,
          import_id: null,
          hash_unico: await hashUnico({ ...datos, descripcion_original: `${descripcion} ${Date.now()}` }),
        },
      ]);
    }
    refrescar();
    return { ok: true, mensaje: "Movimiento guardado." };
  } catch (e) {
    return error(e);
  }
}

export async function borrarMovimiento(id: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarMovimiento(id);
    refrescar();
    return { ok: true, mensaje: "Movimiento borrado." };
  } catch (e) {
    return error(e);
  }
}

// ---------- Importación ----------

export type FilaPrevia = MovimientoNuevo & { duplicado: boolean };

// Marca cuáles filas ya existen, para mostrarlas en la vista previa antes de guardar
export async function revisarDuplicados(movs: MovimientoNuevo[]): Promise<FilaPrevia[]> {
  const repo = await obtenerRepo();
  const hashes = await Promise.all(movs.map((m) => hashUnico(m)));
  const existentes = await repo.hashesExistentes(hashes);
  const vistos = new Set<string>();
  return movs.map((m, i) => {
    const duplicado = existentes.has(hashes[i]) || vistos.has(hashes[i]);
    vistos.add(hashes[i]);
    return { ...m, duplicado };
  });
}

export async function guardarImportacion(datos: {
  account_id: string;
  nombre_archivo: string;
  ruta_storage?: string | null;
  movimientos: MovimientoNuevo[];
}): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    if (!datos.account_id) return { ok: false, mensaje: "Elige la cuenta a la que pertenecen los movimientos." };
    const importacion = await repo.crearImportacion({
      nombre_archivo: datos.nombre_archivo,
      ruta_storage: datos.ruta_storage ?? null,
      estado: "pendiente",
      movimientos_detectados: datos.movimientos.length,
    });
    try {
      // Solo los campos del movimiento: la vista previa trae datos extra (como "duplicado") que no van a la base
      const conHash = await Promise.all(
        datos.movimientos.map(async ({ fecha, descripcion_original, comercio, monto, tipo }) => ({
          fecha,
          descripcion_original,
          comercio,
          monto,
          tipo,
          account_id: datos.account_id,
          import_id: importacion,
          hash_unico: await hashUnico({ fecha, descripcion_original, monto, tipo }),
        })),
      );
      // Quita duplicados dentro del mismo archivo; los que ya existían los ignora la base de datos
      const unicos = [...new Map(conHash.map((m) => [m.hash_unico, m])).values()];
      const listos = await categorizar(unicos);
      const insertados = await repo.insertarMovimientos(listos);
      await marcarRecurrentes();
      await repo.editarImportacion(importacion, { estado: "procesado" });
      const porRevisar = listos.filter((m) => m.requiere_revision).length;
      refrescar();
      return {
        ok: true,
        mensaje: `Se guardaron ${insertados} movimientos (${conHash.length - insertados} duplicados descartados).${
          porRevisar ? ` ${porRevisar} quedaron en "Por revisar".` : ""
        }`,
      };
    } catch (e) {
      await repo.editarImportacion(importacion, { estado: "error" });
      throw e;
    }
  } catch (e) {
    return error(e);
  }
}

export async function moverImportacion(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const id = texto(f, "id");
    const cuenta = (await repo.cuentas()).find((c) => c.id === texto(f, "account_id"));
    if (!cuenta) return { ok: false, mensaje: "Elige una cuenta." };
    const movidos = await repo.moverImportacion(id, cuenta.id);
    refrescar();
    return { ok: true, mensaje: `Se movieron ${movidos} movimientos a ${cuenta.nombre}.` };
  } catch (e) {
    return error(e);
  }
}

export async function deshacerImportacion(id: string): Promise<Resultado> {
  try {
    const borrados = await (await obtenerRepo()).borrarImportacion(id);
    refrescar();
    return { ok: true, mensaje: `Se borró la importación y sus ${borrados} movimientos.` };
  } catch (e) {
    return error(e);
  }
}

// Sube el PDF a Storage (bucket privado) y extrae los movimientos con IA
export async function leerEstadoDeCuenta(f: FormData): Promise<
  { ok: true; movimientos: FilaPrevia[]; ruta: string | null } | { ok: false; mensaje: string }
> {
  try {
    if (!iaDisponible()) {
      return { ok: false, mensaje: "Leer PDF requiere la IA (ANTHROPIC_API_KEY). Mientras tanto, descarga el estado de cuenta en CSV o Excel desde tu banca en línea." };
    }
    const archivo = f.get("archivo");
    if (!(archivo instanceof File) || archivo.type !== "application/pdf") return { ok: false, mensaje: "Elige un archivo PDF." };
    if (archivo.size > 10 * 1024 * 1024) return { ok: false, mensaje: "El PDF pesa más de 10 MB." };
    const bytes = Buffer.from(await archivo.arrayBuffer());

    const repo = await obtenerRepo();
    let ruta: string | null = null;
    if (repo.modo === "supabase") {
      const db = await clienteServidor();
      const { data } = await db.auth.getUser();
      ruta = `${data.user!.id}/${Date.now()}-${archivo.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: errorSubida } = await db.storage
        .from("estados-de-cuenta")
        .upload(ruta, bytes, { contentType: "application/pdf" });
      if (errorSubida) throw new Error(`No se pudo guardar el PDF: ${errorSubida.message}`);
    }

    const extraidos = await extraerMovimientosDePdf(bytes.toString("base64"));
    const movimientos: MovimientoNuevo[] = extraidos
      .map((m) => ({
        fecha: leerFecha(m.fecha) ?? "",
        descripcion_original: m.descripcion,
        comercio: extraerComercio(m.descripcion),
        monto: redondear(Math.abs(m.monto)),
        tipo: m.tipo,
      }))
      .filter((m) => m.fecha && m.monto > 0);
    return { ok: true, movimientos: await revisarDuplicados(movimientos), ruta };
  } catch (e) {
    return error(e);
  }
}

// ---------- Bandeja "Por revisar" ----------

// Asigna la categoría, crea o actualiza una regla y la aplica a los demás pendientes parecidos
export async function corregirCategoria(movimientoId: string, categoryId: string): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const pendientes = await repo.movimientos({ soloPorRevisar: true });
    const mov = pendientes.find((m) => m.id === movimientoId) ?? (await repo.movimientos()).find((m) => m.id === movimientoId);
    if (!mov) return { ok: false, mensaje: "No encontré el movimiento." };
    await repo.editarMovimientos([mov.id], { category_id: categoryId, requiere_revision: false });

    const patron = patronParaRegla(mov.comercio, mov.descripcion_original);
    await repo.guardarRegla(patron, categoryId);
    const parecidos = pendientes
      .filter((m) => m.id !== mov.id)
      .filter((m) => normalizar(`${m.comercio ?? ""} ${m.descripcion_original}`).includes(patron))
      .map((m) => m.id);
    if (parecidos.length) await repo.editarMovimientos(parecidos, { category_id: categoryId, requiere_revision: false });
    refrescar();
    return {
      ok: true,
      mensaje: `Listo. Regla nueva: "${patron}"${parecidos.length ? `, y se aplicó a ${parecidos.length} movimiento(s) más` : ""}.`,
    };
  } catch (e) {
    return error(e);
  }
}

// Vuelve a pasar los pendientes por las reglas y comercios conocidos (útil después de crear categorías nuevas)
export async function recategorizarPendientes(): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const [pendientes, reglas, categorias] = await Promise.all([
      repo.movimientos({ soloPorRevisar: true }),
      repo.reglas(),
      repo.categorias(),
    ]);
    const porCategoria = new Map<string, string[]>();
    for (const m of pendientes) {
      const c = categorizarConReglas(`${m.comercio ?? ""} ${m.descripcion_original}`, reglas, categorias);
      if (c) porCategoria.set(c.category_id, [...(porCategoria.get(c.category_id) ?? []), m.id]);
    }
    for (const [categoria, ids] of porCategoria) {
      await repo.editarMovimientos(ids, { category_id: categoria, requiere_revision: false });
    }
    const total = [...porCategoria.values()].reduce((t, ids) => t + ids.length, 0);
    refrescar();
    return {
      ok: true,
      mensaje: total ? `Se categorizaron ${total} movimientos automáticamente.` : "No encontré nuevos movimientos que pueda categorizar solo.",
    };
  } catch (e) {
    return error(e);
  }
}

export async function confirmarCategoria(movimientoId: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).editarMovimientos([movimientoId], { requiere_revision: false });
    refrescar();
    return { ok: true, mensaje: "Confirmado." };
  } catch (e) {
    return error(e);
  }
}

export async function borrarRegla(id: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarRegla(id);
    refrescar();
    return { ok: true, mensaje: "Regla borrada." };
  } catch (e) {
    return error(e);
  }
}

// ---------- Metas ----------

export async function guardarMeta(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const datos = {
      nombre: texto(f, "nombre"),
      monto_objetivo: numero(f, "monto_objetivo") ?? 0,
      monto_actual: numero(f, "monto_actual") ?? 0,
      fecha_objetivo: leerFecha(texto(f, "fecha_objetivo")) ?? "",
    };
    if (!datos.nombre || datos.monto_objetivo <= 0 || !datos.fecha_objetivo) {
      return { ok: false, mensaje: "Faltan el nombre, el monto objetivo o la fecha." };
    }
    const id = texto(f, "id");
    if (id) await repo.editarMeta(id, datos);
    else await repo.crearMeta({ ...datos, es_ejemplo: false });
    refrescar();
    return { ok: true, mensaje: "Meta guardada." };
  } catch (e) {
    return error(e);
  }
}

export async function borrarMeta(id: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarMeta(id);
    refrescar();
    return { ok: true, mensaje: "Meta borrada." };
  } catch (e) {
    return error(e);
  }
}

export async function aportarAMeta(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const id = texto(f, "id");
    const monto = numero(f, "monto") ?? 0;
    if (!monto) return { ok: false, mensaje: "Escribe un monto." };
    const meta = (await repo.metas()).find((m) => m.id === id);
    if (!meta) return { ok: false, mensaje: "No encontré la meta." };
    await repo.crearAportaciones([{ goal_id: id, fecha: hoyLocal(), monto: redondear(monto) }]);
    await repo.editarMeta(id, { monto_actual: redondear(Math.max(0, meta.monto_actual + monto)) });
    refrescar();
    return { ok: true, mensaje: `${monto > 0 ? "Aportaste" : "Retiraste"} ${dinero(Math.abs(monto))}.` };
  } catch (e) {
    return error(e);
  }
}

export async function deDondeSaco(metaId: string): Promise<
  { ok: true; recortes: Recorte[]; textoIA: string | null; diferencia: number } | { ok: false; mensaje: string }
> {
  try {
    const repo = await obtenerRepo();
    const hoy = hoyLocal();
    const [metas, aportaciones, categorias, movimientos] = await Promise.all([
      repo.metas(),
      repo.aportaciones(),
      repo.categorias(),
      repo.movimientos({ desde: `${mesDe(hoy)}-01` }),
    ]);
    const meta = metas.find((m) => m.id === metaId);
    if (!meta) return { ok: false, mensaje: "No encontré la meta." };
    const analisis = analizarMeta(meta, aportaciones, hoy);
    const diferencia = analisis.diferenciaMensual || analisis.porMes;
    const resumen = resumenPorCategoria(mesDe(hoy), hoy, categorias, movimientos);
    const recortes = proponerRecortes(diferencia, resumen);
    let textoIA: string | null = null;
    if (iaDisponible()) {
      try {
        textoIA = await proponerAhorro({
          meta: meta.nombre,
          falta_al_mes: diferencia,
          categorias: resumen.map((r) => ({
            categoria: r.categoria.nombre,
            gastado_este_mes: r.gastado,
            presupuesto: r.presupuesto,
            proyeccion_al_cierre: r.proyeccion,
            estado: r.estado,
          })),
        });
      } catch (e) {
        console.error("La IA no pudo proponer recortes:", e);
      }
    }
    return { ok: true, recortes, textoIA, diferencia };
  } catch (e) {
    return error(e);
  }
}

// ---------- Pagos programados ----------

export async function guardarPago(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const datos = {
      nombre: texto(f, "nombre"),
      monto: numero(f, "monto") ?? 0,
      frecuencia: (texto(f, "frecuencia") || "mensual") as Frecuencia,
      proximo_vencimiento: leerFecha(texto(f, "proximo_vencimiento")) ?? "",
      account_id: texto(f, "account_id") || null,
    };
    if (!datos.nombre || datos.monto <= 0 || !datos.proximo_vencimiento) {
      return { ok: false, mensaje: "Faltan el nombre, el monto o la fecha." };
    }
    const id = texto(f, "id");
    if (id) await repo.editarPago(id, datos);
    else await repo.crearPago({ ...datos, es_ejemplo: false });
    refrescar();
    return { ok: true, mensaje: "Pago guardado." };
  } catch (e) {
    return error(e);
  }
}

export async function borrarPago(id: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarPago(id);
    refrescar();
    return { ok: true, mensaje: "Pago borrado." };
  } catch (e) {
    return error(e);
  }
}

// ---------- Datos de ejemplo ----------

export async function cargarDatosDeEjemplo(): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    if (repo.modo === "demo") return { ok: true, mensaje: "El modo demostración ya tiene datos de ejemplo." };
    const ejemplo = generarEjemplo();
    await repo.crearCategorias(categoriasConPresupuesto());
    // Pone presupuestos de ejemplo solo en las categorías que no tienen uno
    const categorias = await repo.categorias();
    for (const c of categoriasConPresupuesto()) {
      const existente = categorias.find((x) => x.nombre === c.nombre);
      if (existente && existente.presupuesto_mensual === 0 && c.presupuesto_mensual > 0) {
        await repo.editarCategoria(existente.id, { presupuesto_mensual: c.presupuesto_mensual });
      }
    }
    for (const c of ejemplo.cuentas) await repo.crearCuenta(c);
    const cuentas = await repo.cuentas();
    const idCuenta = (nombre: string | null) => cuentas.find((c) => c.es_ejemplo && c.nombre === nombre)?.id ?? null;
    const idCategoria = (nombre: string | null) => categorias.find((c) => c.nombre === nombre)?.id ?? null;
    await repo.insertarMovimientos(
      ejemplo.movimientos.map(({ cuenta, categoria, ...m }) => ({
        ...m,
        account_id: idCuenta(cuenta)!,
        category_id: idCategoria(categoria),
      })),
    );
    for (const { aportaciones, ...meta } of ejemplo.metas) {
      await repo.crearMeta(meta);
      const creada = (await repo.metas()).find((m) => m.es_ejemplo && m.nombre === meta.nombre);
      if (creada) await repo.crearAportaciones(aportaciones.map((a) => ({ ...a, goal_id: creada.id })));
    }
    for (const { cuenta, ...p } of ejemplo.pagos) await repo.crearPago({ ...p, account_id: idCuenta(cuenta) });
    await marcarRecurrentes();
    refrescar();
    return { ok: true, mensaje: "Se cargaron los datos de ejemplo." };
  } catch (e) {
    return error(e);
  }
}

export async function borrarDatosDeEjemplo(): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarDatosDeEjemplo();
    refrescar();
    return { ok: true, mensaje: "Se borraron los datos de ejemplo." };
  } catch (e) {
    return error(e);
  }
}

// ---------- Correos de prueba ----------

export async function probarReporteSemanal(): Promise<Resultado> {
  try {
    const { enviarCorreo, plantilla, urlDeLaApp } = await import("./correo");
    const { prepararReporteSemanal } = await import("./reportes");
    if (!process.env.RESEND_API_KEY) return { ok: false, mensaje: "Falta RESEND_API_KEY en Vercel (o falta hacer Redeploy)." };
    const { bloques } = await prepararReporteSemanal(await obtenerRepo());
    await enviarCorreo("📊 Tu reporte financiero de la semana (prueba)", plantilla("Reporte semanal", bloques, urlDeLaApp()));
    return { ok: true, mensaje: `Reporte enviado a ${process.env.ALLOWED_EMAIL}. Revisa tu correo (también Spam y Notificaciones).` };
  } catch (e) {
    return error(e);
  }
}

// ---------- Movimientos entre cuentas ----------

async function moverDinero(cuentas: Cuenta[], t: TransferenciaInterpretada, nota: string | null): Promise<Resultado & { id?: string }> {
  const repo = await obtenerRepo();
  const origen = cuentas.find((c) => c.id === t.origen_id);
  const destino = cuentas.find((c) => c.id === t.destino_id);
  if (!origen || !destino) return { ok: false, mensaje: "No encontré una de las cuentas." };
  if (origen.id === destino.id) return { ok: false, mensaje: "Elige dos cuentas distintas." };
  const saldos = aplicarTransferencia(origen, destino, t.monto);
  const id = await repo.crearTransferencia({ fecha: t.fecha, origen_id: origen.id, destino_id: destino.id, monto: t.monto, nota });
  await repo.editarCuenta(origen.id, { saldo_actual: saldos.origen });
  await repo.editarCuenta(destino.id, { saldo_actual: saldos.destino });
  revalidatePath("/", "layout");
  const comoQueda = (c: Cuenta, saldo: number) =>
    c.tipo === "credito" ? (saldo < 0 ? `a ${c.nombre} le debes ${dinero(-saldo)}` : `${c.nombre} queda en ceros`) : `${c.nombre} queda en ${dinero(saldo)}`;
  return {
    ok: true,
    id,
    mensaje: `Listo: ${dinero(t.monto)} de ${origen.nombre} a ${destino.nombre}. ${comoQueda(origen, saldos.origen)} y ${comoQueda(destino, saldos.destino)}.${
      t.montoSupuesto ? " Como no escribiste monto, tomé la deuda completa; si fue otro, deshazlo en Más › Entre cuentas." : ""
    }`,
  };
}

export async function registrarTransferencia(f: FormData): Promise<Resultado & { id?: string }> {
  try {
    const repo = await obtenerRepo();
    const monto = Number(String(f.get("monto") ?? "").replace(/[$,\s]/g, ""));
    if (!(monto > 0)) return { ok: false, mensaje: "Escribe cuánto dinero moviste." };
    const fecha = String(f.get("fecha") || hoyLocal());
    const nota = String(f.get("nota") ?? "").trim() || null;
    return await moverDinero(
      await repo.cuentas(),
      { origen_id: String(f.get("origen_id")), destino_id: String(f.get("destino_id")), monto: redondear(monto), montoSupuesto: false, fecha },
      nota,
    );
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

// Deshace un movimiento entre cuentas y regresa los saldos como estaban
export async function deshacerTransferencia(id: string): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const t = await repo.borrarTransferencia(id);
    if (!t) return { ok: false, mensaje: "Ese movimiento ya no existe." };
    const cuentas = await repo.cuentas();
    const origen = cuentas.find((c) => c.id === t.origen_id);
    const destino = cuentas.find((c) => c.id === t.destino_id);
    if (origen) await repo.editarCuenta(origen.id, { saldo_actual: redondear(origen.saldo_actual + t.monto) });
    if (destino) await repo.editarCuenta(destino.id, { saldo_actual: redondear(destino.saldo_actual - t.monto) });
    revalidatePath("/", "layout");
    return { ok: true, mensaje: "Deshecho: los saldos regresaron a como estaban." };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

// Pagar una tarjeta de crédito desde una cuenta con dinero: completo (toda la deuda) u otra cantidad
export async function pagarTarjeta(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const cuentas = await repo.cuentas();
    const tarjeta = cuentas.find((c) => c.id === String(f.get("tarjeta_id")) && c.tipo === "credito");
    const origen = cuentas.find((c) => c.id === String(f.get("origen_id")));
    if (!tarjeta) return { ok: false, mensaje: "No encontré la tarjeta." };
    if (!origen) return { ok: false, mensaje: "Elige de dónde sale el dinero." };
    const hoy = hoyLocal();
    const { movimientos, transferencias } = await contextoTarjetas(repo, hoy);
    const e = estadoTarjeta(tarjeta, movimientos, transferencias, hoy);
    const deuda = e.total;
    const modo = String(f.get("modo"));
    // "corte": lo que hay que pagar para no generar intereses; "completo": dejarla en ceros
    const monto = modo === "corte" ? e.alCorte : modo === "completo" ? deuda : Number(String(f.get("monto") ?? "").replace(/[$,\s]/g, ""));
    if (!(monto > 0)) return { ok: false, mensaje: deuda ? "Escribe cuánto pagaste." : "Esta tarjeta no tiene deuda registrada." };
    return await moverDinero(
      cuentas,
      { origen_id: origen.id, destino_id: tarjeta.id, monto: redondear(monto), montoSupuesto: false, fecha: String(f.get("fecha") || hoyLocal()) },
      `Pago de ${tarjeta.nombre}`,
    );
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

// El "pago para no generar intereses" que dice tu app del banco: corrige la estimación de lo del corte
export async function guardarSaldoAlCorte(tarjetaId: string, f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const tarjeta = (await repo.cuentas()).find((c) => c.id === tarjetaId && c.tipo === "credito");
    if (!tarjeta) return { ok: false, mensaje: "No encontré la tarjeta." };
    const corte = ultimoCorte(tarjeta, hoyLocal());
    if (!corte) return { ok: false, mensaje: "Primero agrega el día de corte de esta tarjeta en Ajustes." };
    const monto = numero(f, "saldo_al_corte");
    if (monto === null || monto < 0) return { ok: false, mensaje: "Escribe el monto (puede ser 0)." };
    await repo.editarCuenta(tarjeta.id, { saldo_al_corte: redondear(monto), fecha_corte_saldo: corte });
    refrescar();
    return { ok: true, mensaje: `Guardado: al corte debes ${dinero(monto)}.` };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, mensaje: /saldo_al_corte/.test(m) ? "Falta correr en Supabase el SQL de \"saldo al corte\" (0004)." : m };
  }
}

// ---------- Avisos del banco leídos de Gmail ----------

export async function confirmarAvisoCorreo(id: string, f: FormData): Promise<Resultado> {
  try {
    const mensaje = await confirmarCorreo(await obtenerRepo(), id, {
      cuenta_id: texto(f, "cuenta_id"),
      otra_id: texto(f, "otra_id") || null,
      prestamo: f.get("prestamo") === "on",
      fecha_pago: texto(f, "fecha_pago") || null,
      nota: texto(f, "nota") || null,
    });
    refrescar();
    return { ok: true, mensaje: `Listo: ${mensaje}` };
  } catch (e) {
    return error(e);
  }
}

export async function ignorarAvisoCorreo(id: string): Promise<Resultado> {
  try {
    await ignorarCorreo(await obtenerRepo(), id);
    refrescar();
    return { ok: true, mensaje: "Ignorado." };
  } catch (e) {
    return error(e);
  }
}

export async function deshacerAvisoCorreo(id: string): Promise<Resultado> {
  try {
    const mensaje = await deshacerCorreo(await obtenerRepo(), id);
    refrescar();
    return { ok: true, mensaje };
  } catch (e) {
    return error(e);
  }
}

// ---------- Préstamos ----------

export async function cobrarPrestamo(id: string, f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const mensaje = await registrarCobro(repo, id, numero(f, "monto") ?? 0, texto(f, "cuenta_id"));
    refrescar();
    return { ok: true, mensaje };
  } catch (e) {
    return error(e);
  }
}

export async function borrarPrestamoAccion(id: string): Promise<Resultado> {
  try {
    const mensaje = await deshacerEnvio(await obtenerRepo(), `prestamo:${id}`);
    refrescar();
    return { ok: true, mensaje };
  } catch (e) {
    return error(e);
  }
}
