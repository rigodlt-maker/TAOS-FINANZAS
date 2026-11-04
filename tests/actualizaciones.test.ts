// Candado de las actualizaciones: lo que se publica a los compradores nunca debe borrar sus datos,
// y la app siempre debe poder ponerse al día sola.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { esMasNueva } from "../components/taos/actualizacion";

const REPO = "taos-finanzas";
const DIR = "supabase/migrations";
const archivosSql = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort().map((f) => `${DIR}/${f}`) : ["supabase/instalar.sql"];

// Instrucciones que pueden borrar o cambiar datos de un comprador
const PELIGROSAS = [
  /\bdrop\s+(table|column|schema|view|materialized\s+view|type|index\s+(?!if\s+exists))/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\balter\s+column\s+\S+\s+(set\s+data\s+)?type\b/i,
  /\brename\s+(column\s+|to\s+)/i,
];

test("ninguna migración borra ni cambia datos (solo se agregan tablas y columnas)", () => {
  for (const archivo of archivosSql) {
    // sin comentarios, para no confundir una explicación con una instrucción
    const sql = readFileSync(archivo, "utf8").replace(/--.*$/gm, "");
    for (const regla of PELIGROSAS) assert.doesNotMatch(sql, regla, `${archivo} tiene una instrucción que podría borrar datos: ${regla}`);
  }
});

test("taos-version.json: versión y novedades", () => {
  const v = JSON.parse(readFileSync("taos-version.json", "utf8"));
  assert.match(v.version, /^\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(v.novedades) && v.novedades.length > 0 && v.novedades.every((n: unknown) => typeof n === "string" && n.length > 5));
});

test("el botón Actualizar TAOS trae esta app, cada noche, sin tocar el propio botón", () => {
  const wf = readFileSync(".github/workflows/actualizar.yml", "utf8");
  assert.match(wf, new RegExp(`github\\.com/rigodlt-maker/${REPO}\\.git`));
  assert.match(wf, /schedule:/);
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /--exclude \.github\/workflows/);
  assert.match(wf, /repository_owner != 'rigodlt-maker'/);
});

test("comparar versiones", () => {
  assert.ok(esMasNueva("1.1.0", "1.0.9"));
  assert.ok(esMasNueva("1.10.0", "1.9.2"));
  assert.ok(esMasNueva("2.0.0", "1.99.99"));
  assert.ok(!esMasNueva("1.1.0", "1.1.0"));
  assert.ok(!esMasNueva("1.0.0", "1.2.0"));
});

// ---------- Base de datos: pedir solo lo que falta ----------
import { PGlite } from "@electric-sql/pglite";
import { PRUEBAS_MIGRACIONES, sqlPendiente } from "../lib/configuracion";

const SIMULACION_SUPABASE = `
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  alter table storage.objects enable row level security;
`;
// Desde esta migración, todas se deben poder correr dos veces (por si el comprador pega el código otra vez)
const DESDE = "0009";

test("cada migración tiene su prueba en lib/configuracion.ts", () => {
  assert.deepEqual(Object.keys(PRUEBAS_MIGRACIONES).sort(), readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort());
});

test("después de una actualización se pide solo lo nuevo", () => {
  const ultima = Object.keys(PRUEBAS_MIGRACIONES).sort().at(-1)!;
  const sql = sqlPendiente({ primeraVez: false, pendientes: [ultima] });
  assert.match(sql, new RegExp(ultima.replace(".", "\\.")));
  assert.doesNotMatch(sql, /0001_/);
  assert.match(sqlPendiente({ primeraVez: true, pendientes: [] }), /0001_/);
});

test("las migraciones nuevas se pueden correr dos veces sin error", async () => {
  const db = new PGlite();
  await db.exec(SIMULACION_SUPABASE);
  const archivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const a of archivos) await db.exec(readFileSync(`${DIR}/${a}`, "utf8"));
  for (const a of archivos.filter((f) => f >= DESDE)) await db.exec(readFileSync(`${DIR}/${a}`, "utf8"));
});
