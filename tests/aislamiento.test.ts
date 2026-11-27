// Nube v1 · Fase 0: «nadie ve lo de otro», contra Postgres REAL con el SQL de instalación tal cual.
// Dos usuarias (A y B) en la misma base. Para CADA tabla de public:
//   1. Revisión del catálogo: RLS encendido; si la tabla tiene user_id, o tiene la regla «Solo el dueño» (user_id = auth.uid()
//      al leer Y al escribir) o los roles públicos (anon/authenticated) no tienen ningún permiso sobre ella.
//   2. Prueba de conducta: se siembra una fila de A y, conectada como B (rol authenticated), B no la ve, no la cambia, no la
//      borra y no puede crear filas a nombre de A. A sí ve la suya (prueba de que la siembra sirvió).
//   3. Informe (todo, no falla): llaves foráneas por las que B podría apuntar a una fila de A. Para Nube hay que cerrarlas.
// Las tablas se descubren solas: si mañana se agrega una tabla, entra a la prueba sin tocar este archivo.
// Se activa con TAOS_PG_URL=postgres://usuario:clave@localhost/postgres (sin la variable, se salta).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";

const PG = process.env.TAOS_PG_URL;
const SQL = readFileSync("supabase/instalar.sql", "utf8");
const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const BASE = `create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('role', true) $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema auth to anon, authenticated, service_role;
-- Como Supabase: todo lo nuevo en public queda con permisos para anon, authenticated y service_role
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id serial primary key, bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
insert into auth.users (id, email) values ('${A}', 'a@demo.mx'), ('${B}', 'b@demo.mx');`;

const t = (nombre: string, f: () => Promise<void>, extra: { todo?: boolean } = {}) => test(nombre, { skip: PG ? false : "sin TAOS_PG_URL", ...extra }, f);

async function base() {
  const admin = new Client({ connectionString: PG });
  await admin.connect();
  const nombre = `taos_aislamiento_${process.pid}_${Date.now()}`;
  await admin.query(`create database ${nombre}`);
  await admin.end();
  const url = PG!.replace(/\/[^/]*$/, `/${nombre}`);
  const dueno = new Client({ connectionString: url });
  await dueno.connect();
  await dueno.query(BASE);
  await dueno.query(SQL);
  const abiertas: Client[] = [dueno];
  const como = async (usuario: string, rol = "authenticated") => {
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query(`set role ${rol}`);
    await c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [usuario]);
    abiertas.push(c);
    return c;
  };
  const cerrar = async () => {
    for (const c of abiertas) await c.end().catch(() => {});
    const a = new Client({ connectionString: PG });
    await a.connect();
    await a.query(`drop database if exists ${nombre} with (force)`);
    await a.end();
  };
  return { dueno, como, cerrar };
}

type Columna = { nombre: string; tipo: string; udt: string; nulo: boolean; defecto: boolean; generada: boolean };
type Foranea = { columnas: string[]; tabla: string; refs: string[] };

async function tablas(c: Client): Promise<string[]> {
  return (await c.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') order by 1`)).rows.map((r) => r.relname);
}
async function columnas(c: Client, tabla: string): Promise<Columna[]> {
  return (
    await c.query(
      `select column_name, data_type, udt_name, is_nullable = 'YES' nulo, column_default is not null or is_identity = 'YES' defecto, is_generated = 'ALWAYS' generada
         from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`,
      [tabla],
    )
  ).rows.map((r) => ({ nombre: r.column_name, tipo: r.data_type, udt: r.udt_name, nulo: r.nulo, defecto: r.defecto, generada: r.generada }));
}
async function foraneas(c: Client, tabla: string): Promise<Foranea[]> {
  return (
    await c.query(
      `select array(select a.attname from unnest(k.conkey) with ordinality u(n, o) join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.n order by u.o)::text[] columnas,
              r.relname tabla, rn.nspname esquema,
              array(select a.attname from unnest(k.confkey) with ordinality u(n, o) join pg_attribute a on a.attrelid = k.confrelid and a.attnum = u.n order by u.o)::text[] refs
         from pg_constraint k join pg_class r on r.oid = k.confrelid join pg_namespace rn on rn.oid = r.relnamespace
        where k.contype = 'f' and k.conrelid = ('public.' || quote_ident($1))::regclass`,
      [tabla],
    )
  ).rows
    .filter((r) => r.esquema === "public")
    .map((r) => ({ columnas: r.columnas, tabla: r.tabla, refs: r.refs }));
}

// Valor de ejemplo para una columna obligatoria. Los CHECK con lista de valores se aprenden al primer rechazo.
function valorPara(col: Columna, aprendidos: Map<string, string>): string {
  if (aprendidos.has(col.nombre)) return aprendidos.get(col.nombre)!;
  if (col.tipo === "ARRAY") return "'{}'";
  switch (col.udt) {
    case "uuid":
      return "gen_random_uuid()";
    case "text": case "varchar": case "bpchar": case "citext":
      return "'prueba'";
    case "int2": case "int4": case "int8": case "numeric": case "float4": case "float8":
      return "1";
    case "bool":
      return "false";
    case "date":
      return "'2026-11-01'";
    case "timestamptz": case "timestamp":
      return "now()";
    case "time": case "timetz":
      return "'08:00'";
    case "jsonb": case "json":
      return "'{}'";
    case "bytea":
      return "'\\x00'";
    default:
      return `(select enumlabel::${col.udt} from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = '${col.udt}' order by enumsortorder limit 1)`;
  }
}

// Siembra UNA fila de `usuario` en cada tabla que se pueda, resolviendo las llaves foráneas con filas del mismo usuario.
const NUMEROS = ["1", "3", "50", "100", "170", "1000", "0"];
async function sembrar(c: Client, usuario: string, nombres: string[]) {
  const todas = new Map<string, Record<string, unknown>[]>();
  // Dos rondas: la segunda fila de cada tabla deja que un CHECK como «origen <> destino» tenga dos filas distintas
  await sembrarRonda(c, usuario, nombres, todas);
  const ultima = await sembrarRonda(c, usuario, nombres, todas);
  const sembradas = new Map([...todas].filter(([, v]) => v.length).map(([k, v]) => [k, v[0]]));
  const fallas = new Map([...ultima.fallas].filter(([k]) => !sembradas.has(k)));
  return { sembradas, fallas };
}

async function sembrarRonda(c: Client, usuario: string, nombres: string[], previas: Map<string, Record<string, unknown>[]>) {
  const todas = previas;
  const sembradas = new Map<string, Record<string, unknown>>();
  const fallas = new Map<string, string>();
  let pendientes = [...nombres];
  for (let vuelta = 0; vuelta < 6 && pendientes.length; vuelta++) {
    const siguen: string[] = [];
    for (const tabla of pendientes) {
      const cols = await columnas(c, tabla);
      const fks = await foraneas(c, tabla);
      const aprendidos = new Map<string, string>();
      let hecho = false;
      for (let intento = 0; intento < 40 && !hecho; intento++) {
        const valores = new Map<string, string>();
        let esperar = false;
        const usadas = new Map<string, number>();
        for (const fk of fks) {
          const obligatoria = fk.columnas.some((x) => cols.find((k) => k.nombre === x && !k.nulo && !k.defecto));
          if (!obligatoria) continue;
          const lista = todas.get(fk.tabla) ?? [];
          const i = usadas.get(fk.tabla) ?? 0;
          usadas.set(fk.tabla, i + 1);
          const padre = lista[i % Math.max(1, lista.length)];
          if (!padre) {
            esperar = true;
            break;
          }
          fk.columnas.forEach((x, i) => valores.set(x, `'${String(padre[fk.refs[i]])}'`));
        }
        if (esperar) break;
        for (const col of cols) {
          if (valores.has(col.nombre) || col.generada) continue;
          if (col.nombre === "user_id") valores.set(col.nombre, `'${usuario}'`);
          else if (!col.nulo && !col.defecto) valores.set(col.nombre, valorPara(col, aprendidos));
          else if (aprendidos.has(col.nombre)) valores.set(col.nombre, aprendidos.get(col.nombre)!);
        }
        const k = [...valores.keys()];
        const q = k.length ? `insert into public.${tabla} (${k.join(", ")}) values (${k.map((x) => valores.get(x)).join(", ")}) returning *` : `insert into public.${tabla} default values returning *`;
        try {
          await c.query("savepoint s");
          const fila = (await c.query(q)).rows[0];
          await c.query("release savepoint s");
          if (!sembradas.has(tabla)) sembradas.set(tabla, fila);
          todas.set(tabla, [...(todas.get(tabla) ?? []), fila]);
          hecho = true;
        } catch (e) {
          await c.query("rollback to savepoint s");
          const err = e as { code?: string; constraint?: string; column?: string; message: string };
          fallas.set(tabla, err.message);
          if (err.code === "23514" && err.constraint) {
            const def = (await c.query(`select pg_get_constraintdef(oid) d from pg_constraint where conname = $1 and conrelid = ('public.' || quote_ident($2))::regclass`, [err.constraint, tabla])).rows[0]?.d ?? "";
            const enDef = cols.filter((x) => new RegExp(`\\b${x.nombre}\\b`).test(def));
            const numerica = enDef.find((x) => /^(int|numeric|float)/.test(x.udt));
            const lit = def.match(/'([^']*)'/);
            const rango = numerica && (def.match(/>=?\s*\(?(\d+(?:\.\d+)?)/) ?? def.match(/BETWEEN\s+\(?(\d+(?:\.\d+)?)/i));
            if (numerica && rango && aprendidos.get(numerica.nombre) !== String(Math.ceil(Number(rango[1])) + 1)) {
              aprendidos.set(numerica.nombre, String(Math.ceil(Number(rango[1])) + 1));
            } else if (numerica) {
              const i = NUMEROS.indexOf(aprendidos.get(numerica.nombre) ?? "1");
              if (i + 1 >= NUMEROS.length) break;
              aprendidos.set(numerica.nombre, NUMEROS[i + 1]);
            } else if (enDef[0] && lit && !aprendidos.has(enDef[0].nombre)) aprendidos.set(enDef[0].nombre, `'${lit[1]}'`);
            else break;
          } else if (err.code === "23502" && err.column) {
            const col = cols.find((x) => x.nombre === err.column);
            if (col) aprendidos.set(col.nombre, valorPara({ ...col, defecto: false }, new Map()));
            else break;
          } else break;
        }
      }
      if (!hecho) siguen.push(tabla);
    }
    if (siguen.length === pendientes.length) break;
    pendientes = siguen;
  }
  for (const t of sembradas.keys()) fallas.delete(t);
  return { sembradas, fallas, todas };
}

// La regla exacta «user_id = auth.uid()» (en cualquier orden, con o sin «select … as uid»), y nada más
const DUENO = /^\(*\s*(?:user_id\s*=\s*\(*\s*(?:select\s+)?auth\.uid\(\)(?:\s+as\s+uid)?\s*\)*|\(*\s*(?:select\s+)?auth\.uid\(\)(?:\s+as\s+uid)?\s*\)*\s*=\s*user_id)\s*\)*$/i;
const esDelDueno = (expr: string | null) => !!expr && DUENO.test(expr.trim());

const conUsuario = async (c: Client, nombres: string[]) => {
  const r: string[] = [];
  for (const t of nombres) if ((await columnas(c, t)).some((x) => x.nombre === "user_id")) r.push(t);
  return r;
};

t("Nube · catálogo: toda tabla con RLS; con user_id → «Solo el dueño» al leer y al escribir, o cerrada a los roles públicos", async () => {
  const { dueno, cerrar } = await base();
  try {
    const nombres = await tablas(dueno);
    assert.ok(nombres.length > 0, "no hay tablas");
    const problemas: string[] = [];
    for (const tabla of nombres) {
      const rls = (await dueno.query(`select relrowsecurity r from pg_class where oid = ('public.' || quote_ident($1))::regclass`, [tabla])).rows[0].r;
      if (!rls) problemas.push(`${tabla}: sin RLS`);
      const politicas = (await dueno.query(`select policyname, roles::text[] roles, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = $1`, [tabla])).rows;
      for (const p of politicas) {
        if ((p.roles as string[]).some((r) => r === "anon" || r === "public")) problemas.push(`${tabla}: regla «${p.policyname}» abierta a ${p.roles}`);
        if (/^\s*true\s*$/i.test(p.qual ?? "") || /^\s*true\s*$/i.test(p.with_check ?? "")) problemas.push(`${tabla}: regla «${p.policyname}» deja pasar todo`);
      }
      const publicos = (await dueno.query(`select count(*)::int n from information_schema.role_table_grants where table_schema = 'public' and table_name = $1 and grantee in ('anon', 'authenticated', 'PUBLIC')`, [tabla])).rows[0].n;
      const tieneUsuario = (await columnas(dueno, tabla)).some((x) => x.nombre === "user_id");
      const delDueno = politicas.filter((p) => (p.roles as string[]).includes("authenticated") && p.cmd === "ALL" && esDelDueno(p.qual) && esDelDueno(p.with_check));
      if (tieneUsuario && publicos > 0 && delDueno.length === 0) problemas.push(`${tabla}: tiene user_id y permisos públicos, pero no la regla «Solo el dueño» completa`);
      if (!tieneUsuario && publicos > 0 && politicas.length > 0) problemas.push(`${tabla}: sin user_id, con permisos públicos y reglas (revisar a mano)`);
    }
    assert.deepEqual(problemas, []);
  } finally {
    await cerrar();
  }
});

t("Nube · conducta: B no ve, no cambia, no borra ni crea a nombre de A en ninguna tabla con user_id; A sí ve lo suyo", async () => {
  const { dueno, como, cerrar } = await base();
  try {
    const nombres = await conUsuario(dueno, await tablas(dueno));
    await dueno.query("begin");
    const { sembradas, fallas } = await sembrar(dueno, A, nombres);
    await dueno.query("commit");
    assert.deepEqual([...fallas.entries()], [], "no se pudo sembrar una fila de A en estas tablas");
    const a = await como(A);
    const b = await como(B);
    const anon = await como(A, "anon");
    const problemas: string[] = [];
    // Permiso negado = no lo ve: también es aislamiento (tablas solo del servidor)
    const contar = async (c: Client, tabla: string) => {
      try {
        return (await c.query(`select count(*)::int n from public.${tabla}`)).rows[0].n as number;
      } catch (e) {
        if ((e as { code?: string }).code === "42501") return -1;
        throw e;
      }
    };
    for (const tabla of nombres) {
      const deA = await contar(a, tabla);
      if (deA === 0) problemas.push(`${tabla}: A no ve su propia fila`);
      if ((await contar(b, tabla)) > 0) problemas.push(`${tabla}: B VE la fila de A`);
      if ((await contar(anon, tabla)) > 0) problemas.push(`${tabla}: anon VE filas`);
      for (const [que, q] of [
        ["cambia", `update public.${tabla} set user_id = user_id`],
        ["borra", `delete from public.${tabla}`],
      ] as const) {
        try {
          const r = await b.query(q);
          if ((r.rowCount ?? 0) > 0) problemas.push(`${tabla}: B ${que} la fila de A`);
        } catch (e) {
          if ((e as { code?: string }).code !== "42501") problemas.push(`${tabla}: error raro al ${que}: ${(e as Error).message}`);
        }
      }
      // Crear a nombre de A: se copia la fila sembrada (con id nuevo si lo tiene) y se intenta como B
      const fila = { ...sembradas.get(tabla)! };
      const cols = await columnas(dueno, tabla);
      for (const col of cols) if (col.generada || (col.defecto && col.nombre !== "user_id")) delete fila[col.nombre];
      const k = Object.keys(fila);
      try {
        await b.query(`insert into public.${tabla} (${k.join(", ")}) values (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => (fila[x] !== null && typeof fila[x] === "object" && !(fila[x] instanceof Date) && !Array.isArray(fila[x]) ? JSON.stringify(fila[x]) : fila[x])));
        problemas.push(`${tabla}: B CREÓ una fila a nombre de A`);
      } catch (e) {
        const code = (e as { code?: string }).code;
        // 42501 = RLS o sin permiso; 23505 = choca con la de A (tablas de una fila por usuario): en ambos casos no entra
        if (code !== "42501" && code !== "23505") problemas.push(`${tabla}: error raro al crear: ${(e as Error).message}`);
      }
    }
    assert.ok(sembradas.size === nombres.length);
    assert.deepEqual(problemas, []);
  } finally {
    await cerrar();
  }
});

t(
  "Nube · informe: llaves foráneas por las que B puede apuntar a una fila de A (cerrar antes de Nube)",
  async () => {
    const { dueno, como, cerrar } = await base();
    try {
      const nombres = await conUsuario(dueno, await tablas(dueno));
      await dueno.query("begin");
      const deA = (await sembrar(dueno, A, nombres)).sembradas;
      const deB = (await sembrar(dueno, B, nombres)).sembradas;
      await dueno.query("commit");
      const b = await como(B);
      const abiertas: string[] = [];
      for (const tabla of nombres) {
        for (const fk of await foraneas(dueno, tabla)) {
          const padreA = deA.get(fk.tabla), filaB = deB.get(tabla);
          if (!padreA || !filaB || !fk.refs.every((r) => r in padreA)) continue;
          const sets = fk.columnas.map((x, i) => `${x} = '${String(padreA[fk.refs[i]])}'`).join(", ");
          const llave = Object.keys(filaB).includes("id") ? `id = '${filaB.id}'` : `user_id = '${B}'`;
          try {
            await b.query("begin");
            const r = await b.query(`update public.${tabla} set ${sets} where ${llave}`);
            if ((r.rowCount ?? 0) > 0) abiertas.push(`${tabla}.${fk.columnas.join("+")} → ${fk.tabla} de A`);
          } catch {
            /* cerrada: bien */
          } finally {
            await b.query("rollback");
          }
        }
      }
      console.log("# FK cruzadas abiertas:", abiertas.length ? abiertas.join(" · ") : "ninguna");
      assert.deepEqual(abiertas, []);
    } finally {
      await cerrar();
    }
  },
  { todo: true },
);
