// Nube F1 · Regla: toda consulta hecha con la llave secreta lleva el user_id del usuario, explícito.
// La llave secreta se salta RLS: si una consulta olvida filtrar por user_id, con dos usuarios en la misma base leería,
// cambiaría o borraría lo del otro. Esta prueba llama TODOS los métodos del repositorio con un cliente falso que anota cada
// consulta, como si fuera la llave secreta de la usuaria B, y revisa:
//   - lectura, cambio y borrado: filtran por user_id = B (y nunca por otro user_id);
//   - altas y upserts: cada fila va con user_id = B.
// Si mañana se agrega un método o una consulta sin user_id, esta prueba falla.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoSupabase } from "../lib/datos/supabase";

const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const ESCRITURAS = ["insert", "upsert", "update", "delete"] as const;
const FILTROS = ["eq", "neq", "in", "is", "gt", "gte", "lt", "lte", "like", "ilike", "match", "or", "not", "filter", "contains"];

type Consulta = { metodo: string; tabla: string; operacion: string; filtros: [string, ...unknown[]][]; filas: Record<string, unknown>[]; enviada?: boolean };

// Cliente falso: cada .from(tabla) empieza una consulta; los métodos se encadenan y al final (await) responde vacío
function clienteFalso(anotar: (c: Consulta) => void, metodo: () => string): SupabaseClient {
  const consulta = (tabla: string) => {
    const c: Consulta = { metodo: metodo(), tabla, operacion: "", filtros: [], filas: [] };
    anotar(c);
    let unica: "single" | "maybeSingle" | null = null;
    const cadena: Record<string, unknown> = new Proxy(
      {},
      {
        get(_, prop: string) {
          if (prop === "then")
            return (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) =>
              (c.enviada = true) &&
              Promise.resolve({ data: unica === "single" ? { id: "nuevo-id" } : unica ? null : [], error: null, count: 0 }).then(ok, mal);
          return (...args: unknown[]) => {
            if ((ESCRITURAS as readonly string[]).includes(prop) && !c.operacion) {
              c.operacion = prop;
              if (prop !== "delete" && args[0]) c.filas = (Array.isArray(args[0]) ? args[0] : [args[0]]) as Record<string, unknown>[];
            } else if (prop === "select" && !c.operacion) c.operacion = "select";
            else if (FILTROS.includes(prop)) c.filtros.push([prop, ...args]);
            else if (prop === "single" || prop === "maybeSingle") unica = prop;
            return cadena;
          };
        },
      },
    );
    return cadena;
  };
  return {
    from: consulta,
    rpc: (nombre: string, params: Record<string, unknown>) => {
      anotar({ metodo: metodo(), tabla: `rpc:${nombre}`, operacion: "rpc", filtros: [], filas: [params ?? {}], enviada: true });
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
}

// Argumentos de ejemplo según el nombre del método (lo que no aplica se ignora dentro del método)
const fila = { nombre: "Prueba", monto: 10, fecha: "2026-11-27", tipo: "debito", user_id: A, account_id: "cuenta-1", category_id: "cat-1" };
function argumentos(nombre: string): unknown[] {
  if (/^(hashesExistentes|correosExistentes)$/.test(nombre)) return [["x1", "x2"]];
  if (nombre === "insertarMovimientos" || nombre === "crearCategorias" || nombre === "crearAportaciones") return [[{ ...fila }]];
  if (nombre === "editarMovimientos") return [["id-1", "id-2"], { nota: "x" }];
  if (nombre === "guardarRegla") return ["oxxo", "cat-1"];
  if (nombre === "moverImportacion") return ["imp-1", "cuenta-2"];
  if (nombre === "guardarSuscripcionPush") return [{ endpoint: "https://push.example/x", p256dh: "p", auth: "a", dispositivo: "Android" }];
  if (/^editar/.test(nombre)) return ["id-1", { nombre: "Cambio" }];
  if (/^crear/.test(nombre)) return [{ ...fila }];
  if (/^(borrar|correo$|borrarSuscripcionPush)/.test(nombre)) return ["id-1"];
  if (nombre === "movimientos") return [{ desde: "2026-11-01", hasta: "2026-11-30" }];
  if (nombre === "transferencias") return [10];
  if (nombre === "correos") return [{ estado: "pendiente", limite: 5 }];
  return [];
}

test("Nube F1 · con la llave secreta, cada consulta del repositorio lleva el user_id de la usuaria (y solo el suyo)", async () => {
  const consultas: Consulta[] = [];
  let actual = "";
  const repo = repoSupabase(clienteFalso((c) => consultas.push(c), () => actual), B) as unknown as Record<string, unknown>;
  const metodos = Object.keys(repo).filter((k) => typeof repo[k] === "function");
  assert.ok(metodos.length >= 15, `muy pocos métodos (${metodos.length})`);
  const fallaron: string[] = [];
  for (const m of metodos) {
    actual = m;
    try {
      await (repo[m] as (...a: unknown[]) => Promise<unknown>)(...argumentos(m));
    } catch (e) {
      // Un error del propio método (por los datos de ejemplo) no importa: lo que se revisa son las consultas que alcanzó a hacer
      if (!/user_id|dueño/i.test((e as Error).message)) continue;
      fallaron.push(`${m}: ${(e as Error).message}`);
    }
  }
  assert.deepEqual(fallaron, []);
  const enviadas = consultas.filter((x) => x.enviada).length;
  assert.ok(enviadas >= metodos.length / 2, `solo ${enviadas} consultas enviadas para ${metodos.length} métodos`);

  const sinDueno: string[] = [];
  // Solo cuentan las consultas que de verdad se mandan (un método puede tronar con los datos de ejemplo antes de enviarla)
  for (const c of consultas.filter((x) => x.enviada)) {
    const ids = c.filtros.filter((f) => f[0] === "eq" && f[1] === "user_id").map((f) => f[2]);
    const otros = c.filtros.filter((f) => f[1] === "user_id" && !(f[0] === "eq" && f[2] === B));
    if (otros.length) sinDueno.push(`${c.metodo} → ${c.tabla}: filtra user_id distinto de B (${JSON.stringify(otros)})`);
    if (c.operacion === "insert" || c.operacion === "upsert") {
      if (!c.filas.length || c.filas.some((f) => f.user_id !== B)) sinDueno.push(`${c.metodo} → ${c.tabla}: ${c.operacion} sin user_id de B`);
    } else if (c.operacion === "rpc") {
      if (!Object.values(c.filas[0]).includes(B)) sinDueno.push(`${c.metodo} → ${c.tabla}: sin el user_id de B`);
    } else if (!ids.includes(B)) sinDueno.push(`${c.metodo} → ${c.tabla}: ${c.operacion || "consulta"} sin filtrar por user_id`);
  }
  assert.deepEqual(sinDueno, []);
});

test("Nube F1 · el resumen del domingo (lee Fit, Cerebro y Optimizador con la llave secreta) filtra por el user_id de la usuaria", async () => {
  const { semanaDeLasOtrasApps } = await import("../lib/resumen-domingo");
  const consultas: Consulta[] = [];
  await semanaDeLasOtrasApps(clienteFalso((c) => consultas.push(c), () => "semanaDeLasOtrasApps"), B, "2026-11-29");
  assert.ok(consultas.length >= 4, `solo ${consultas.length} consultas`);
  const sinDueno = consultas.filter((c) => !c.filtros.some((f) => f[0] === "eq" && f[1] === "user_id" && f[2] === B)).map((c) => c.tabla);
  assert.deepEqual(sinDueno, []);
});

test("Nube F4 · todo método del repositorio que escribe en la base queda detrás del candado de la suscripción", async () => {
  const { escribe } = await import("../lib/candado");
  // Funciones de la base que solo leen (si se agrega una que escribe, debe ir detrás del candado)
  const RPC_DE_LECTURA = ["rpc:buscar"];
  const consultas: Consulta[] = [];
  let actual = "";
  const repo = repoSupabase(clienteFalso((c) => consultas.push(c), () => actual), B) as unknown as Record<string, unknown>;
  for (const m of Object.keys(repo).filter((k) => typeof repo[k] === "function")) {
    actual = m;
    await (repo[m] as (...a: unknown[]) => Promise<unknown>)(...argumentos(m)).catch(() => {});
  }
  const escriben = [...new Set(consultas.filter((c) => c.enviada && (["insert", "upsert", "update", "delete"].includes(c.operacion) || (c.operacion === "rpc" && !RPC_DE_LECTURA.includes(c.tabla)))).map((c) => c.metodo))];
  const sinCandado = escriben.filter((m) => !escribe(m) && !["guardarSuscripcionPush", "borrarSuscripcionPush"].includes(m));
  assert.ok(escriben.length > 3, `solo ${escriben.length} métodos escriben`);
  assert.deepEqual(sinCandado, []);
});
