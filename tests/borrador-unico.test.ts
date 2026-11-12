// S15-R6 · ronda 5 de Codex: un borrador sin internet que llega dos veces (porque el celular no dejó quitarlo de la
// cola, o desde dos pestañas a la vez) se registra UNA sola vez por dueño. El cliente manda el id fijo del borrador; el
// servidor guarda el movimiento con hash_unico «borrador:<id>» y el índice único (user_id, hash_unico) decide.
// (Las acciones del servidor fuera de Next no pueden refrescar la pantalla; por eso se revisan los datos.)
import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { capturaRapida, registrarFrecuente } from "../lib/acciones";
import { repoMemoria } from "../lib/datos/memoria";

async function nuevo() {
  (globalThis as { __almacenDemo?: unknown }).__almacenDemo = undefined;
  const repo = repoMemoria();
  const c = (await repo.cuentas()).find((x) => x.tipo === "debito")!;
  const cuantos = async (texto: string) => (await repo.movimientos()).filter((m) => m.comercio === texto || m.descripcion_original === texto).length;
  return { repo, c, cuantos };
}

test("S15-R6 (ronda 5): el mismo borrador de un gasto frecuente mandado dos veces queda UNA vez", async () => {
  const { c, cuantos } = await nuevo();
  const d = { comercio: "Cafetería Prueba", monto: 45, account_id: c.id, category_id: null };
  const r1 = await registrarFrecuente(d, "demo", "1731-abc12");
  const r2 = await registrarFrecuente(d, "demo", "1731-abc12");
  assert.equal(r1.repetido, undefined); // el primero se guarda (fuera de Next, refrescar la pantalla falla: no se revisa su ok)
  assert.equal(r2.ok, true); // ok: el cliente lo puede quitar de la cola
  assert.equal(r2.repetido, true);
  assert.equal(await cuantos("Cafetería Prueba"), 1);
  // Otro borrador distinto con lo mismo sí es otro gasto (dos cafés el mismo día)
  await registrarFrecuente(d, "demo", "1731-zzz99");
  assert.equal(await cuantos("Cafetería Prueba"), 2);
});

test("S15-R6 (ronda 5): el mismo borrador de captura rápida mandado dos veces (y dos a la vez) queda UNA vez", async () => {
  const { cuantos } = await nuevo();
  const frase = "350 súper prueba con débito";
  const [a, b] = await Promise.all([capturaRapida(frase, "demo", "b-1"), capturaRapida(frase, "demo", "b-1")]);
  assert.equal([a, b].filter((r) => r.ok && r.repetido).length, 1);
  await capturaRapida(frase, "demo", "b-1");
  assert.equal(await cuantos(frase), 1);
});

test("S15-R6 (ronda 5): sin id de borrador (uso normal en línea) se comporta como antes: dos veces = dos gastos", async () => {
  const { c, cuantos } = await nuevo();
  const d = { comercio: "Tacos Prueba", monto: 80, account_id: c.id, category_id: null };
  await registrarFrecuente(d);
  await registrarFrecuente(d);
  assert.equal(await cuantos("Tacos Prueba"), 2);
});

test("S15-R6 (ronda 5): un borrador que es movimiento entre cuentas no se hace solo; un id raro no se acepta", async () => {
  const { repo } = await nuevo();
  const antes = (await repo.transferencias()).length;
  const saldos = (await repo.cuentas()).map((c) => c.saldo_actual);
  const t = await capturaRapida("pagué la tarjeta Nu Crédito con BBVA Débito 500", "demo", "b-2");
  assert.equal(t.ok, false);
  assert.equal(t.revisar, true);
  assert.match(t.mensaje, /movimiento entre tus cuentas: confírmalo con Tao/);
  assert.equal((await repo.transferencias()).length, antes);
  assert.deepEqual((await repo.cuentas()).map((c) => c.saldo_actual), saldos);
  const raro = await capturaRapida("45 café", "demo", "no válido; drop");
  assert.equal(raro.ok, false);
  assert.equal(raro.revisar, true);
});

// La base de verdad decide de forma atómica: el mismo upsert que usa Supabase (onConflict user_id,hash_unico,
// ignoreDuplicates) contra el esquema real, con dos usuarias y dos intentos al mismo tiempo.
test("S15-R6 (ronda 5): en la base (PGlite + migraciones reales), «borrador:<id>» entra una vez por dueño", async () => {
  const db = new PGlite();
  await db.exec(`
    create role authenticated nologin; create role service_role nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id serial primary key, bucket_id text, name text);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;`);
  for (const f of readdirSync("supabase/migrations").sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');
    insert into public.accounts (id, user_id, nombre, tipo) values ('10000000-0000-0000-0000-00000000000a', '${A}', 'Débito', 'debito'), ('10000000-0000-0000-0000-00000000000b', '${B}', 'Débito', 'debito');`);
  const insertar = (u: string, cuenta: string) =>
    db.query(
      `insert into public.transactions (user_id, account_id, fecha, descripcion_original, comercio, monto, tipo, hash_unico)
       values ($1, $2, '2026-11-12', 'Café', 'Café', 45, 'gasto', 'borrador:1731-abc12')
       on conflict (user_id, hash_unico) do nothing returning id`,
      [u, cuenta],
    );
  const [x, y] = await Promise.all([insertar(A, "10000000-0000-0000-0000-00000000000a"), insertar(A, "10000000-0000-0000-0000-00000000000a")]);
  assert.equal(x.rows.length + y.rows.length, 1);
  assert.equal((await insertar(A, "10000000-0000-0000-0000-00000000000a")).rows.length, 0);
  // Por dueño: el mismo id de borrador de OTRA persona es otro registro (no choca ni se le niega)
  assert.equal((await insertar(B, "10000000-0000-0000-0000-00000000000b")).rows.length, 1);
  const n = await db.query<{ u: string; n: number }>(`select user_id u, count(*)::int n from public.transactions group by 1 order by 1`);
  assert.deepEqual(n.rows.map((r) => r.n), [1, 1]);
});

test("S15-R6 (ronda 5): el upsert de Supabase usa ese índice (onConflict user_id,hash_unico + ignoreDuplicates)", () => {
  const s = readFileSync("lib/datos/supabase.ts", "utf8");
  assert.match(s, /upsert\(columnas\.map\(conUsuario\), \{ onConflict: "user_id,hash_unico", ignoreDuplicates: true \}\)/);
  assert.match(readFileSync("supabase/instalar.sql", "utf8") + readdirSync("supabase/migrations").map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join(""), /unique \(user_id, hash_unico\)/);
});
