// Valida las migraciones en un Postgres embebido (PGlite) con un esquema "auth" y "storage" simulado,
// y comprueba que Row Level Security aísla los datos de cada usuario.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const SIMULACION_SUPABASE = `
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  alter table storage.objects enable row level security;
`;

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

test("las migraciones se aplican y RLS separa a los usuarios", async () => {
  const db = new PGlite();
  await db.exec(SIMULACION_SUPABASE);
  for (const archivo of readdirSync("supabase/migrations").sort()) {
    await db.exec(readFileSync(`supabase/migrations/${archivo}`, "utf8"));
  }
  await db.exec(`
    insert into auth.users values ('${A}'), ('${B}');
    grant usage on schema public, auth, storage to authenticated;
    grant all on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `);

  const como = async (usuario: string, sql: string) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${usuario}', false);`);
    try {
      return await db.query<Record<string, unknown>>(sql);
    } finally {
      await db.exec("reset role;");
    }
  };

  await como(A, `insert into accounts (nombre, tipo) values ('Débito A', 'debito')`);
  await como(B, `insert into accounts (nombre, tipo) values ('Débito B', 'debito')`);

  const deA = await como(A, `select nombre from accounts`);
  assert.deepEqual(deA.rows.map((r) => r.nombre), ["Débito A"]);

  // B no puede insertar filas a nombre de A
  await assert.rejects(como(B, `insert into accounts (user_id, nombre, tipo) values ('${A}', 'Intruso', 'debito')`));

  // Los duplicados por hash_unico se rechazan
  const cuenta = (await como(A, `select id from accounts`)).rows[0].id;
  const mov = `insert into transactions (account_id, fecha, descripcion_original, monto, tipo, hash_unico)
               values ('${cuenta}', '2026-10-01', 'OXXO', 50, 'gasto', 'h1')`;
  await como(A, mov);
  await assert.rejects(como(A, mov));

  // Notificaciones push: cada quien ve solo sus celulares y la migración se puede correr dos veces
  await como(A, `insert into push_subscriptions (app, endpoint, p256dh, auth) values ('finanzas', 'https://push/a', 'k', 'x')`);
  assert.equal((await como(B, `select * from push_subscriptions`)).rows.length, 0);
  await db.exec(readFileSync("supabase/migrations/0007_push.sql", "utf8"));

  await db.close();
});
