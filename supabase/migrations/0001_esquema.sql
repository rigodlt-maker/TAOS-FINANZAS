-- Asesor Financiero: esquema inicial
-- Cada tabla tiene user_id y Row Level Security: cada fila solo es visible para su dueño.


-- ---------- Cuentas ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('debito', 'credito', 'efectivo', 'ahorro')),
  dia_corte smallint check (dia_corte between 1 and 31),
  dia_limite_pago smallint check (dia_limite_pago between 1 and 31),
  saldo_actual numeric(14, 2) not null default 0,
  es_ejemplo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Categorías ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  presupuesto_mensual numeric(14, 2) not null default 0 check (presupuesto_mensual >= 0),
  color_neutro text not null default '#737373',
  created_at timestamptz not null default now(),
  unique (user_id, nombre)
);

-- ---------- Importaciones ----------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'procesado', 'error')),
  movimientos_detectados integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Movimientos ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  fecha date not null,
  descripcion_original text not null,
  comercio text,
  monto numeric(14, 2) not null check (monto > 0),
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  category_id uuid references public.categories (id) on delete set null,
  requiere_revision boolean not null default false,
  es_recurrente boolean not null default false,
  -- Hash de fecha + monto + descripción para descartar duplicados al importar
  hash_unico text not null,
  import_id uuid references public.imports (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, hash_unico)
);

create index transactions_usuario_fecha on public.transactions (user_id, fecha desc);
create index transactions_revision on public.transactions (user_id) where requiere_revision;

-- ---------- Reglas de categorización (se aprenden al corregir) ----------
create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patron_texto text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, patron_texto)
);

-- ---------- Metas de ahorro ----------
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  monto_objetivo numeric(14, 2) not null check (monto_objetivo > 0),
  monto_actual numeric(14, 2) not null default 0 check (monto_actual >= 0),
  fecha_objetivo date not null,
  es_ejemplo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Aportaciones a cada meta: permiten medir el ritmo de los últimos 3 meses
create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  fecha date not null default current_date,
  monto numeric(14, 2) not null check (monto <> 0),
  created_at timestamptz not null default now()
);

-- ---------- Pagos programados ----------
create table public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  monto numeric(14, 2) not null check (monto > 0),
  frecuencia text not null check (frecuencia in ('mensual', 'anual', 'unica')),
  proximo_vencimiento date not null,
  account_id uuid references public.accounts (id) on delete set null,
  es_ejemplo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'accounts', 'categories', 'imports', 'transactions', 'categorization_rules',
    'savings_goals', 'goal_contributions', 'scheduled_payments'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format(
      'create policy "Solo el dueño" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      tabla
    );
  end loop;
end $$;

-- Permisos explícitos para la API (por si "Automatically expose new tables" está apagado).
-- RLS sigue decidiendo qué filas ve cada usuario.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

-- ---------- Storage: estados de cuenta en PDF (bucket privado) ----------
insert into storage.buckets (id, name, public)
values ('estados-de-cuenta', 'estados-de-cuenta', false)
on conflict (id) do nothing;

-- Cada archivo vive en una carpeta con el id del usuario: <user_id>/<archivo>.pdf
create policy "Estados de cuenta: leer los propios" on storage.objects for select to authenticated
  using (bucket_id = 'estados-de-cuenta' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Estados de cuenta: subir los propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'estados-de-cuenta' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Estados de cuenta: borrar los propios" on storage.objects for delete to authenticated
  using (bucket_id = 'estados-de-cuenta' and (storage.foldername(name))[1] = (select auth.uid())::text);
