-- Instalación completa de la base de datos. Pega todo en Supabase › SQL Editor y toca Run.

-- ===== 0001_esquema.sql =====
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

-- ===== 0002_transferencias.sql =====
-- Movimientos entre tus propias cuentas (p. ej. pagar una tarjeta de crédito desde el débito).
-- No son gastos ni ingresos: solo mueven saldo de una cuenta a otra.
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  origen_id uuid not null references public.accounts (id) on delete cascade,
  destino_id uuid not null references public.accounts (id) on delete cascade,
  monto numeric(14, 2) not null check (monto > 0),
  nota text,
  created_at timestamptz not null default now(),
  check (origen_id <> destino_id)
);

create index on public.transfers (user_id, fecha desc);

alter table public.transfers enable row level security;
create policy "Solo el dueño" on public.transfers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.transfers to authenticated, service_role;

-- ===== 0003_correos.sql =====
-- Avisos de tu banco que llegan a tu correo (Nu, Revolut, HSBC…): la app los lee y los registra solos.
-- Cada correo se procesa una sola vez (gmail_id único por usuario).
create table public.bank_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  gmail_id text not null,
  recibido timestamptz not null,
  banco text not null,
  asunto text not null default '',
  clase text not null check (clase in ('salida', 'entrada', 'pago_tarjeta', 'compra')),
  monto numeric(14, 2) not null check (monto > 0),
  cuenta_id uuid references public.accounts (id) on delete set null,
  contraparte text,
  entidad text,
  propio boolean not null default false,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aplicado', 'ignorado', 'duplicado')),
  resultado text,
  transferencia_id uuid references public.transfers (id) on delete set null,
  movimiento_hash text,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_id)
);

create index on public.bank_emails (user_id, recibido desc);
create index on public.bank_emails (user_id, estado);

alter table public.bank_emails enable row level security;
create policy "Solo el dueño" on public.bank_emails for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.bank_emails to authenticated, service_role;

-- ===== 0004_saldo_al_corte.sql =====
-- Tarjetas: el "pago para no generar intereses" que dice tu app del banco, y el corte al que corresponde.
-- Así la app separa lo que debes al corte de las compras nuevas (que van al siguiente estado de cuenta).
alter table public.accounts add column saldo_al_corte numeric(14, 2);
alter table public.accounts add column fecha_corte_saldo date;

-- ===== 0005_rendimientos.sql =====
-- Rendimiento de cuentas de ahorro (Cajita Turbo, Cajita de Nu, Revolut…): se suma solo cada día, con interés compuesto.
-- tope_tasa: hasta cuánto paga tasa_anual (p. ej. la Cajita Turbo solo los primeros $25,000); lo de arriba paga tasa_excedente.
alter table public.accounts add column tasa_anual numeric(6, 3);
alter table public.accounts add column tope_tasa numeric(14, 2);
alter table public.accounts add column tasa_excedente numeric(6, 3);
alter table public.accounts add column rendimiento_desde date;

-- ===== 0006_prestamos.sql =====
-- Préstamos: dinero que le mandaste a alguien y te van a regresar (saldo a favor). No es gasto.
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  persona text not null,
  monto numeric(14, 2) not null check (monto > 0),
  abonado numeric(14, 2) not null default 0 check (abonado >= 0),
  cuenta_id uuid references public.accounts (id) on delete set null,
  fecha date not null default current_date,
  fecha_pago date,
  nota text,
  liquidado_el date,
  created_at timestamptz not null default now()
);

create index on public.loans (user_id, liquidado_el);

alter table public.loans enable row level security;
create policy "Solo el dueño" on public.loans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.loans to authenticated, service_role;

-- ===== 0007_push.sql =====
-- Notificaciones push (Web Push). Una fila por celular o navegador donde activaste los avisos.
-- La tabla la comparten las apps TAOS del mismo proyecto de Supabase; "app" dice de cuál es cada suscripción.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dispositivo text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_app on public.push_subscriptions (user_id, app);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Solo el dueño" on public.push_subscriptions;
create policy "Solo el dueño" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;
