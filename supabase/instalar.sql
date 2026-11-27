-- Instalación completa de la base de datos. Pega todo en Supabase › SQL Editor y toca Run.

-- ===== 0001_esquema.sql =====
-- Administrador Tao: esquema inicial
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

-- ===== 0008_terminacion.sql =====
-- Últimos 4 dígitos de cada tarjeta: con ellos la app reconoce con qué tarjeta pagaste al leer la foto de un ticket
alter table public.accounts add column if not exists terminacion text check (terminacion ~ '^[0-9]{4}$');

-- ===== 0009_creditos.sql =====
-- Mis créditos: lo que TÚ le debes a un banco o financiera (carro, personal, hipoteca…), con pagos fijos e interés.
-- (Lo que te deben a ti va en "loans" / Me deben.) Se puede correr dos veces sin error.
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null default 'personal' check (tipo in ('auto', 'personal', 'hipoteca', 'nomina', 'otro')),
  saldo numeric(14, 2) not null check (saldo >= 0),
  pago numeric(14, 2) not null check (pago > 0),
  frecuencia text not null default 'mensual' check (frecuencia in ('mensual', 'quincenal', 'semanal')),
  tasa_anual numeric(6, 3) not null default 0 check (tasa_anual >= 0),
  proximo_pago date not null,
  cuenta_id uuid references public.accounts (id) on delete set null,
  nota text,
  liquidado_el date,
  created_at timestamptz not null default now()
);

create index if not exists debts_usuario on public.debts (user_id, liquidado_el);

alter table public.debts enable row level security;
drop policy if exists "Solo el dueño" on public.debts;
create policy "Solo el dueño" on public.debts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.debts to authenticated, service_role;

-- ===== 0020_nube_duenos.sql =====
-- Nube F1 · Una fila solo puede apuntar a filas del MISMO dueño.
-- Antes, una llave foránea como transactions.account_id → accounts.id solo pedía que la cuenta existiera: con la llave
-- secreta (o con un error de código) un usuario podía quedar ligado a la cuenta de otro. Ahora, junto a cada llave foránea
-- entre tablas con user_id, se agrega otra de dos columnas (columna, user_id) → (id, user_id) del padre.
-- Solo agrega (no borra ni cambia nada) y se puede correr dos veces. Las llaves de antes se quedan igual.
-- Al borrar se porta igual que la llave original (en cascada, o deja la columna vacía).
create table if not exists public.taos_migraciones (nombre text primary key, aplicada timestamptz not null default now());
alter table public.taos_migraciones enable row level security;
do $$ begin
  -- Solo la usa el servidor: los roles públicos de Supabase no la ven (en una base sin esos roles no hace falta)
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.taos_migraciones from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.taos_migraciones from authenticated; end if;
end $$;

do $$
declare
  f record;
  indice text;
  nombre text;
  al_borrar text;
begin
  for f in
    select c.relname hijo, a.attname columna, r.relname padre, k.confdeltype borrar
      from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_class r on r.oid = k.confrelid
      join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1]
      join pg_attribute ra on ra.attrelid = r.oid and ra.attnum = k.confkey[1]
     where k.contype = 'f'
       and c.relnamespace = 'public'::regnamespace
       and r.relnamespace = 'public'::regnamespace
       and array_length(k.conkey, 1) = 1
       and ra.attname = 'id'
       and a.attname <> 'user_id'
       and exists (select 1 from pg_attribute x where x.attrelid = c.oid and x.attname = 'user_id' and not x.attisdropped)
       and exists (select 1 from pg_attribute x where x.attrelid = r.oid and x.attname = 'user_id' and not x.attisdropped)
  loop
    indice := left(f.padre || '_id_dueno', 63);
    execute format('create unique index if not exists %I on public.%I (id, user_id)', indice, f.padre);
    nombre := left(f.hijo || '_' || f.columna || '_dueno', 63);
    if not exists (select 1 from pg_constraint where conname = nombre and conrelid = ('public.' || quote_ident(f.hijo))::regclass) then
      al_borrar := case f.borrar when 'c' then 'on delete cascade' when 'n' then format('on delete set null (%I)', f.columna) else '' end;
      execute format('alter table public.%I add constraint %I foreign key (%I, user_id) references public.%I (id, user_id) %s not valid',
        f.hijo, nombre, f.columna, f.padre, al_borrar);
      begin
        execute format('alter table public.%I validate constraint %I', f.hijo, nombre);
      exception when foreign_key_violation then
        -- Hay filas viejas ligadas a otro dueño: la regla ya vale para todo lo nuevo; las viejas se revisan aparte
        raise notice 'TAOS: % tiene filas ligadas a otro dueño; revisar con soporte', nombre;
      end;
    end if;
  end loop;
end $$;

insert into public.taos_migraciones (nombre) values ('0020_nube_duenos') on conflict do nothing;

-- ===== 0021_nube_claves.sql =====
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
