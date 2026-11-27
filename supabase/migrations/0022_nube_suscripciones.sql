-- Nube F4 · Suscripción de Google Play: es la licencia de TAOS Nube (una sola para las 4 apps).
-- Solo el servidor escribe aquí (con la llave secreta, después de preguntarle a Google). Cada persona solo ve la suya.
-- Solo agrega y se puede correr dos veces. En la versión propia no se usa.
create table if not exists public.suscripciones (
  user_id uuid primary key references auth.users (id) on delete cascade,
  estado text not null check (estado in ('activa', 'gracia', 'retenida', 'pausada', 'cancelada', 'vencida', 'pendiente')),
  producto text not null,
  token_huella text not null unique,
  token_compra text not null,
  vence timestamptz,
  renovacion_automatica boolean not null default true,
  prueba_gratis boolean not null default false,
  reconocida boolean not null default false,
  actualizada timestamptz not null default now()
);

alter table public.suscripciones enable row level security;
drop policy if exists "Ver la mía" on public.suscripciones;
create policy "Ver la mía" on public.suscripciones for select to authenticated using (user_id = (select auth.uid()));
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.suscripciones from authenticated;
    grant select on public.suscripciones to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.suscripciones from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant select, insert, update, delete on public.suscripciones to service_role; end if;
end $$;
