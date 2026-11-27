-- Nube F1 · Claves por usuario para los scripts de Google (Gmail en Administrador Tao, Drive en Segundo Cerebro).
-- En TAOS Nube cada persona tiene su propia clave: el servidor sabe de quién es cada envío por la clave.
-- Solo se guarda la huella (sha256) de la clave, nunca la clave. Tabla compartida entre apps (columna app).
-- Solo agrega y se puede correr dos veces. En la versión propia (1 persona) no se usa, pero no estorba.
create table if not exists public.script_claves (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app text not null check (app in ('correos', 'drive')),
  huella text not null unique,
  creada timestamptz not null default now(),
  primary key (user_id, app)
);

alter table public.script_claves enable row level security;
drop policy if exists "Solo el dueño" on public.script_claves;
create policy "Solo el dueño" on public.script_claves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select, insert, update, delete on public.script_claves to authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant select, insert, update, delete on public.script_claves to service_role; end if;
end $$;
