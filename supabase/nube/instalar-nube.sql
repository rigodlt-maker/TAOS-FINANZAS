-- TAOS Nube · instalación completa del servidor (las 4 apps en un solo proyecto de Supabase).
-- Córrelo UNA sola vez, en el proyecto nuevo de Supabase (SQL Editor › Run). Las actualizaciones después se piden aparte.
-- Generado con: node scripts/nube-sql.cjs (no editar a mano)

-- ################ Administrador Tao (Finanzas) ################
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

-- ===== 0022_nube_suscripciones.sql =====
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

-- ################ Tao Fit ################
-- Instalación completa de la base de datos. Pega todo en Supabase › SQL Editor y toca Run.

-- ===== 0001_tao_fit.sql =====
-- Tao Fit. Puede ir en el mismo proyecto de Supabase que las otras apps TAOS: todas sus tablas empiezan con "fit_".
-- Cada fila solo la ve su dueño (Row Level Security).

create table if not exists public.fit_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  genero text not null check (genero in ('hombre', 'mujer')),
  nacimiento date not null,
  altura_cm numeric(5, 1) not null check (altura_cm between 100 and 250),
  objetivo text not null check (objetivo in ('hipertrofia', 'fuerza', 'resistencia', 'grasa')),
  nivel text not null check (nivel in ('principiante', 'intermedio', 'avanzado')),
  dias_semana int not null check (dias_semana between 2 and 6),
  minutos_sesion int not null check (minutos_sesion between 20 and 180),
  lugar text not null check (lugar in ('gimnasio', 'casa_mancuernas', 'casa_sin_equipo')),
  barra_dominadas boolean not null default false,
  lesiones text[] not null default '{}',
  enfasis text[] not null default '{}',
  hora_entreno text,
  avatar jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.fit_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  peso_kg numeric(5, 1) not null check (peso_kg between 25 and 350),
  cintura_cm numeric(5, 1),
  cadera_cm numeric(5, 1),
  pecho_cm numeric(5, 1),
  brazo_cm numeric(5, 1),
  muslo_cm numeric(5, 1),
  cuello_cm numeric(5, 1),
  created_at timestamptz not null default now()
);
create index if not exists fit_measurements_user_fecha on public.fit_measurements (user_id, fecha);

create table if not exists public.fit_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado timestamptz not null default now(),
  activo boolean not null default true,
  dias jsonb not null,
  notas jsonb not null default '[]'
);
create index if not exists fit_plans_user on public.fit_plans (user_id, activo);

create table if not exists public.fit_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  plan_id uuid references public.fit_plans (id) on delete set null,
  dia int not null default 0,
  ejercicio text not null,
  serie int not null check (serie between 1 and 20),
  peso_kg numeric(6, 2) not null default 0 check (peso_kg >= 0),
  reps int not null check (reps between 0 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists fit_sets_user_ejercicio on public.fit_sets (user_id, ejercicio, fecha);

do $$
declare t text;
begin
  foreach t in array array['fit_profiles', 'fit_measurements', 'fit_plans', 'fit_sets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Solo el dueño" on public.%I', t);
    execute format('create policy "Solo el dueño" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- ===== 0002_push.sql =====
-- Notificaciones push: tabla compartida por las apps TAOS (si ya existe, no pasa nada).
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

-- ===== 0003_coach.sql =====
-- Tao Fit, versión "Coach": géneros, meta y comida en el perfil, RIR en las series, registro semanal,
-- historial de ajustes y menú semanal. Se puede correr más de una vez sin problema.

-- Más opciones de género (la base para las fórmulas va en datos.cuerpo)
alter table public.fit_profiles drop constraint if exists fit_profiles_genero_check;
alter table public.fit_profiles add constraint fit_profiles_genero_check check (genero in ('hombre', 'mujer', 'no_binario', 'prefiero_no_decir'));
-- Meta, comida, días y ajustes automáticos: en un solo campo flexible para no necesitar más SQL después
alter table public.fit_profiles add column if not exists datos jsonb not null default '{}';

alter table public.fit_sets add column if not exists rir int check (rir between 0 and 10);
alter table public.fit_sets add column if not exists nota text;

create table if not exists public.fit_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  peso_kg numeric(5, 1) not null check (peso_kg between 25 and 350),
  cintura_cm numeric(5, 1),
  cadera_cm numeric(5, 1),
  brazo_cm numeric(5, 1),
  adherencia int not null check (adherencia between 0 and 100),
  energia int not null check (energia between 1 and 10),
  sueno int not null check (sueno between 1 and 10),
  hambre int not null check (hambre between 1 and 10),
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists fit_checkins_user_fecha on public.fit_checkins (user_id, fecha);

create table if not exists public.fit_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('calorias', 'volumen', 'ejercicio', 'salud', 'rutina')),
  detalle text not null,
  motivo text not null,
  created_at timestamptz not null default now()
);
create index if not exists fit_adjustments_user_fecha on public.fit_adjustments (user_id, fecha);

create table if not exists public.fit_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado timestamptz not null default now(),
  activo boolean not null default true,
  menu jsonb not null
);
create index if not exists fit_meal_plans_user on public.fit_meal_plans (user_id, activo);

do $$
declare t text;
begin
  foreach t in array array['fit_checkins', 'fit_adjustments', 'fit_meal_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Solo el dueño" on public.%I', t);
    execute format('create policy "Solo el dueño" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

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

-- ################ Segundo Cerebro ################
-- Instalación completa de la base de datos. Pega todo en Supabase › SQL Editor y toca Run.

-- ===== 0001_esquema.sql =====
-- Segundo Cerebro: documentos, fichas, notas y preguntas.
-- Cada tabla tiene user_id y Row Level Security: solo el dueño ve y cambia sus filas.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  ruta_storage text,
  tipo_archivo text,
  categoria text not null default 'Notas personales' check (categoria in (
    'Seguros', 'Contratos', 'Identidad y trámites', 'Salud', 'Vehículos', 'Hogar', 'Finanzas e impuestos', 'Notas personales'
  )),
  tipo_documento text,
  texto_extraido text,
  busqueda tsvector generated always as (
    to_tsvector('spanish', coalesce(nombre, '') || ' ' || coalesce(tipo_documento, '') || ' ' || categoria || ' ' || coalesce(texto_extraido, ''))
  ) stored,
  estado_procesamiento text not null default 'procesando' check (estado_procesamiento in ('procesando', 'listo', 'error')),
  error_procesamiento text,
  created_at timestamptz not null default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  pagina int not null,
  contenido text not null,
  busqueda tsvector generated always as (to_tsvector('spanish', contenido)) stored
);

create table public.document_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null unique references public.documents (id) on delete cascade,
  partes text,
  numero_referencia text, -- solo los últimos 4 dígitos
  fecha_inicio date,
  fecha_vencimiento date,
  montos jsonb not null default '{}',
  condiciones_clave jsonb not null default '[]',
  contacto text,
  campos_no_especificados jsonb not null default '[]',
  avisos_enviados jsonb not null default '[]' -- p. ej. ["30:2027-03-15"] para no repetir correos
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  contenido text not null default '',
  categoria text not null default 'Notas personales',
  busqueda tsvector generated always as (to_tsvector('spanish', titulo || ' ' || contenido)) stored,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pregunta text not null,
  respuesta text not null,
  documentos_citados jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index on public.documents using gin (busqueda);
create index on public.documents (user_id, created_at desc);
create index on public.document_chunks using gin (busqueda);
create index on public.document_chunks (document_id, pagina);
create index on public.document_facts (user_id, fecha_vencimiento);
create index on public.notes using gin (busqueda);
create index on public.questions (user_id, created_at desc);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_facts enable row level security;
alter table public.notes enable row level security;
alter table public.questions enable row level security;

create policy "Solo el dueño" on public.documents for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Solo el dueño" on public.document_chunks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Solo el dueño" on public.document_facts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Solo el dueño" on public.notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Solo el dueño" on public.questions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.documents, public.document_chunks, public.document_facts, public.notes, public.questions to authenticated, service_role;

-- Búsqueda de texto completo en español sobre fragmentos, documentos y notas.
-- Usa "o" entre palabras (no "y"), para que "¿cuándo vence mi seguro?" encuentre documentos que digan solo "seguro".
-- security invoker: respeta RLS, así que cada quien solo busca en lo suyo.
create or replace function public.buscar(consulta text, limite int default 8, usuario uuid default null)
returns table (tipo text, documento_id uuid, nota_id uuid, pagina int, contenido text, rango real)
language sql stable security invoker set search_path = public as $$
  with q as (
    select nullif(replace(plainto_tsquery('spanish', consulta)::text, ' & ', ' | '), '')::tsquery as t
  )
  select * from (
    select 'fragmento'::text, c.document_id, null::uuid, c.pagina, c.contenido, ts_rank(c.busqueda, q.t)
    from document_chunks c, q
    where q.t is not null and c.busqueda @@ q.t and (usuario is null or c.user_id = usuario)
    union all
    select 'documento', d.id, null, null, d.nombre, ts_rank(d.busqueda, q.t) * 1.5
    from documents d, q
    where q.t is not null and d.busqueda @@ q.t and (usuario is null or d.user_id = usuario)
    union all
    select 'nota', null, n.id, null, n.titulo || E'\n' || n.contenido, ts_rank(n.busqueda, q.t)
    from notes n, q
    where q.t is not null and n.busqueda @@ q.t and (usuario is null or n.user_id = usuario)
  ) r
  order by 6 desc
  limit limite;
$$;

grant execute on function public.buscar(text, int, uuid) to authenticated, service_role;

-- Archivos: bucket privado; cada usuario solo puede leer y escribir en su carpeta (<user_id>/...)
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800)
on conflict (id) do nothing;

create policy "Leer mis documentos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Subir mis documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Borrar mis documentos" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ===== 0002_drive.sql =====
-- Documentos que vienen de tu carpeta de Google Drive: se actualizan solos cuando cambias el archivo en Drive
alter table public.documents add column drive_id text;
alter table public.documents add column drive_actualizado timestamptz;
alter table public.documents add column url_externa text;
create unique index documents_drive_id on public.documents (user_id, drive_id) where drive_id is not null;

-- ===== 0003_push.sql =====
-- Igual que la 0007 de Finanzas: en el proyecto compartido ya está corrida (28 oct 2026). Se puede volver a correr sin problema.
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

-- ===== 0004_mis_documentos.sql =====
-- Mis documentos: lo que marcas en tu lista ("lo tengo en papel", "no aplica", "no cuento con él").
-- Los documentos que ya subiste se detectan solos; esta tabla solo guarda tus marcas. Se puede volver a correr.
create table if not exists public.document_checklist (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  estado text not null check (estado in ('tengo', 'no_aplica', 'no_tengo')),
  updated_at timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.document_checklist enable row level security;
drop policy if exists "Solo el dueño" on public.document_checklist;
create policy "Solo el dueño" on public.document_checklist for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.document_checklist to authenticated, service_role;

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

-- ################ Optimizador de Vida ################
-- Optimizador de Vida (TAOS): ajustes del panel y dispositivos con notificaciones.
-- Pega todo en Supabase › SQL Editor y toca Run. Se puede correr más de una vez.

create table if not exists public.panel_config (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  datos jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- (Versión anterior: la conexión con Google vivía aquí; desde 1.3 se mueve a panel_google, más abajo)
alter table public.panel_config add column if not exists google_refresh_token text;

-- Notificaciones push: tabla compartida por las apps TAOS
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

-- Notificaciones: cada dueño solo ve los suyos
alter table public.push_subscriptions enable row level security;
drop policy if exists "Solo el dueño" on public.push_subscriptions;
create policy "Solo el dueño" on public.push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;

-- ===================== Seguridad 1.3 (S03 · S17 · S14) =====================
-- Todo lo que sigue lo usa SOLO el servidor de tu Optimizador (con tu llave secreta). Las tablas tienen RLS
-- encendido y sin permisos para nadie más: aunque otra app vuelva a dar permisos, nadie de fuera las puede leer.

-- Ajustes del panel: solo el servidor (antes también se podían leer desde el navegador con tu sesión)
alter table public.panel_config enable row level security;
drop policy if exists "Solo el dueño" on public.panel_config;
alter table public.panel_config add column if not exists version bigint not null default 0;
grant select, insert, update, delete on public.panel_config to service_role;

-- S14-B2 · Ya instalado 1.3, ningún guardado puede escribir tus ajustes sin pasar por panel_guardar (que sube la
-- versión). Una pestaña o un servidor con la versión anterior de la app recibe un error y NO pisa lo que hay.
create or replace function public.panel_config_proteger() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.datos is distinct from old.datos and new.version = old.version then
    raise exception 'TAOS_VERSION_ANTERIOR: este guardado viene de una versión anterior de la app; recarga la página'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists panel_config_proteger on public.panel_config;
create trigger panel_config_proteger before update on public.panel_config for each row execute function public.panel_config_proteger();

-- S03 · La conexión con Google, en su propia tabla (ya no junto con tus ajustes)
create table if not exists public.panel_google (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.panel_google add column if not exists refresh_anterior text;
-- S03-R · Si ya había conexión en panel_google y la columna vieja trae OTRA, esa la escribió una versión anterior de la
-- app DESPUÉS de mudarla (la mudanza deja la columna vacía): es la más nueva. Queda como principal y la otra se guarda
-- como anterior (la app la prueba si Google rechaza la principal). No se pierde ninguna.
update public.panel_google g set refresh_anterior = g.refresh_token, refresh_token = c.google_refresh_token, updated_at = now()
  from public.panel_config c
  where c.user_id = g.user_id and c.google_refresh_token is not null and c.google_refresh_token <> g.refresh_token;
insert into public.panel_google (user_id, refresh_token)
  select user_id, google_refresh_token from public.panel_config where google_refresh_token is not null
  on conflict (user_id) do nothing;
-- La columna vieja solo se vacía cuando ese mismo token ya quedó guardado en panel_google
update public.panel_config c set google_refresh_token = null
  where c.google_refresh_token is not null
    and exists (select 1 from public.panel_google g where g.user_id = c.user_id and g.refresh_token = c.google_refresh_token);

-- S17 · Intentos de contraseña: un solo contador para todos los servidores (clave = huella de instalación + dirección,
-- nunca la dirección en claro)
create table if not exists public.panel_intentos (
  clave text primary key,
  fallos integer not null default 0,
  ventana_desde timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  actualizado timestamptz not null default now()
);
-- S17-B · Cada ventana de 15 minutos tiene su número (generación); cada intento, el suyo dentro de la ventana
alter table public.panel_intentos add column if not exists generacion bigint not null default 0;
alter table public.panel_intentos add column if not exists liberados integer[] not null default '{}';

-- S14 · Guardados que no se pisan: cada guardado queda anotado (si se repite, no se aplica dos veces)
create table if not exists public.panel_operaciones (
  user_id uuid not null references auth.users (id) on delete cascade,
  op_id text not null,
  huella text,
  version bigint,
  creado timestamptz not null default now(),
  primary key (user_id, op_id)
);

-- S14 · Despertador de medicinas: una sola revisión por turno de 15 minutos (ranura = turno mod 192, 2 días)
create table if not exists public.panel_tick_ejecuciones (
  user_id uuid not null references auth.users (id) on delete cascade,
  ranura integer not null,
  slot bigint not null,
  estado text not null,
  lease_token uuid not null,
  lease_hasta timestamptz not null,
  intentos integer not null default 1,
  jti text,
  detalle text,
  actualizado timestamptz not null default now(),
  primary key (user_id, ranura)
);

-- S14 · Cada aviso de medicina por celular: se aparta antes de mandarlo, así dos revisiones no lo mandan juntas
create table if not exists public.panel_medicina_avisos (
  user_id uuid not null references auth.users (id) on delete cascade,
  medicina_id text not null,
  revision text not null,
  fecha date not null,
  hora text not null,
  dispositivo text not null,
  estado text not null default 'pendiente',
  lease_token uuid,
  lease_hasta timestamptz,
  intentos integer not null default 0,
  proximo timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  primary key (user_id, medicina_id, revision, fecha, hora, dispositivo)
);
-- S14-C3 · Hora real de la toma: la cola de reintentos se revisa sola (no depende de volver a "descubrir" la toma)
alter table public.panel_medicina_avisos add column if not exists toma_en timestamptz;
create index if not exists panel_medicina_avisos_cola on public.panel_medicina_avisos (user_id, estado, proximo);

-- S14-C3 · Mantenimiento: la limpieza diaria va por tiempo transcurrido, no por el número del turno
create table if not exists public.panel_mantenimiento (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ultima_limpieza timestamptz not null default 'epoch'
);

do $$
declare t text;
begin
  foreach t in array array['panel_google', 'panel_intentos', 'panel_operaciones', 'panel_tick_ejecuciones', 'panel_medicina_avisos', 'panel_mantenimiento'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
  revoke all on public.panel_config from public, anon, authenticated;
end $$;

-- S17 · Apartar un intento ANTES de revisar la contraseña (atómico). Política: hasta 5 intentos por ventana de
-- 15 minutos; al 5º se bloquea 15 minutos contados desde ese 5º. Devuelve si se permite, cuántos segundos esperar y
-- qué intento es (generación de la ventana + número), para devolver después SOLO ese intento.
drop function if exists public.panel_reservar_intento(text, integer, integer, integer);
create function public.panel_reservar_intento(p_clave text, p_max integer default 5, p_ventana_seg integer default 900, p_bloqueo_seg integer default 900)
returns table (permitido boolean, espera_seg integer, generacion bigint, numero integer)
language plpgsql security invoker set search_path = '' as $$
declare r public.panel_intentos;
begin
  insert into public.panel_intentos (clave) values (p_clave) on conflict (clave) do nothing;
  select * into r from public.panel_intentos i where i.clave = p_clave for update;
  if r.bloqueado_hasta is not null and r.bloqueado_hasta > now() then
    return query select false, greatest(1, ceil(extract(epoch from r.bloqueado_hasta - now()))::integer), r.generacion, 0;
    return;
  end if;
  if r.bloqueado_hasta is not null or r.ventana_desde < now() - make_interval(secs => p_ventana_seg) then
    r.fallos := 0; r.ventana_desde := now(); r.bloqueado_hasta := null; r.generacion := r.generacion + 1; r.liberados := '{}';
  end if;
  r.fallos := r.fallos + 1;
  if r.fallos >= p_max then r.bloqueado_hasta := now() + make_interval(secs => p_bloqueo_seg); end if;
  update public.panel_intentos i set fallos = r.fallos, ventana_desde = r.ventana_desde, bloqueado_hasta = r.bloqueado_hasta,
    generacion = r.generacion, liberados = r.liberados, actualizado = now()
    where i.clave = p_clave;
  return query select true, 0, r.generacion, r.fallos;
end $$;

-- S17 · Contraseña correcta: se devuelve solo ESE intento, solo si sigue siendo de la ventana vigente y una sola vez
-- (si la ventana ya cambió, no toca el contador nuevo)
drop function if exists public.panel_liberar_intento(text, integer);
create or replace function public.panel_liberar_intento(p_clave text, p_generacion bigint, p_numero integer, p_max integer default 5)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.panel_intentos i set fallos = greatest(i.fallos - 1, 0), liberados = i.liberados || p_numero,
    bloqueado_hasta = case when greatest(i.fallos - 1, 0) < p_max then null else i.bloqueado_hasta end, actualizado = now()
    where i.clave = p_clave and i.generacion = p_generacion and p_numero > 0 and not (p_numero = any (i.liberados));
  return found;
end $$;

-- S14 · Guardar sin pisar: bloquea tu fila, revisa que nadie la cambió desde que la leíste (versión) y mezcla solo
-- las partes que cambiaste. Si la operación ya se aplicó (mismo op_id), no la repite.
create or replace function public.panel_guardar(p_usuario uuid, p_version bigint, p_cambios jsonb, p_op_id text default null, p_huella text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_version bigint; v_op public.panel_operaciones;
begin
  if jsonb_typeof(p_cambios) is distinct from 'object' then raise exception 'cambios inválidos'; end if;
  insert into public.panel_config (user_id) values (p_usuario) on conflict (user_id) do nothing;
  select c.version into v_version from public.panel_config c where c.user_id = p_usuario for update;
  if p_op_id is not null then
    select * into v_op from public.panel_operaciones o where o.user_id = p_usuario and o.op_id = p_op_id;
    if found then
      if v_op.huella is distinct from p_huella then return jsonb_build_object('estado', 'conflicto_op'); end if;
      return jsonb_build_object('estado', 'repetida', 'version', v_op.version);
    end if;
  end if;
  if v_version <> p_version then return jsonb_build_object('estado', 'version', 'version', v_version); end if;
  update public.panel_config c set datos = c.datos || p_cambios, version = c.version + 1, updated_at = now() where c.user_id = p_usuario;
  if p_op_id is not null then
    insert into public.panel_operaciones (user_id, op_id, huella, version) values (p_usuario, p_op_id, p_huella, v_version + 1);
  end if;
  return jsonb_build_object('estado', 'ok', 'version', v_version + 1);
end $$;

-- S14 · Tomar el turno de 15 minutos. 'reclamado' = te toca a ti (con tu ficha); 'completado' / 'en_curso' = no repitas.
create or replace function public.panel_tick_reclamar(p_usuario uuid, p_slot bigint, p_jti text, p_lease_seg integer default 120, p_max_intentos integer default 4)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.panel_tick_ejecuciones; v_token uuid := gen_random_uuid(); v_ranura integer := (p_slot % 192)::integer;
begin
  insert into public.panel_tick_ejecuciones (user_id, ranura, slot, estado, lease_token, lease_hasta, intentos, jti)
    values (p_usuario, v_ranura, p_slot, 'en_curso', v_token, now() + make_interval(secs => p_lease_seg), 1, p_jti)
    on conflict (user_id, ranura) do nothing;
  if found then return jsonb_build_object('estado', 'reclamado', 'token', v_token); end if;
  select * into r from public.panel_tick_ejecuciones e where e.user_id = p_usuario and e.ranura = v_ranura for update;
  if r.slot <> p_slot then
    if r.slot > p_slot then return jsonb_build_object('estado', 'viejo'); end if;
    update public.panel_tick_ejecuciones e set slot = p_slot, estado = 'en_curso', lease_token = v_token,
      lease_hasta = now() + make_interval(secs => p_lease_seg), intentos = 1, jti = p_jti, detalle = null, actualizado = now()
      where e.user_id = p_usuario and e.ranura = v_ranura;
    return jsonb_build_object('estado', 'reclamado', 'token', v_token);
  end if;
  if r.estado = 'completado' then return jsonb_build_object('estado', 'completado'); end if;
  if r.estado = 'en_curso' and r.lease_hasta > now() then return jsonb_build_object('estado', 'en_curso'); end if;
  if r.intentos >= p_max_intentos then return jsonb_build_object('estado', 'agotado'); end if;
  update public.panel_tick_ejecuciones e set estado = 'en_curso', lease_token = v_token, lease_hasta = now() + make_interval(secs => p_lease_seg),
    intentos = e.intentos + 1, jti = p_jti, actualizado = now()
    where e.user_id = p_usuario and e.ranura = v_ranura;
  return jsonb_build_object('estado', 'reclamado', 'token', v_token);
end $$;

-- S14 · Terminar el turno (solo quien tiene la ficha vigente puede cerrarlo)
create or replace function public.panel_tick_terminar(p_usuario uuid, p_slot bigint, p_token uuid, p_estado text, p_detalle text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.panel_tick_ejecuciones e set estado = p_estado, detalle = left(p_detalle, 300), actualizado = now()
    where e.user_id = p_usuario and e.ranura = (p_slot % 192)::integer and e.slot = p_slot and e.lease_token = p_token;
  return found;
end $$;

-- S14 · Apartar avisos (toma × celular) antes de mandarlos. Se anotan TODAS las tomas que tocan (sin recortar) y se
-- aparta un lote de la cola: pendientes cuyo reintento ya toca o apartados por una revisión que se cayó (ficha vencida),
-- en orden estable, aunque ya no aparezcan entre las tomas de ahora. Nunca dos revisiones el mismo aviso a la vez.
-- Pasadas p_horizonte_seg desde la toma, o agotados los intentos, el aviso se da por perdido ('vencido' / 'agotado').
drop function if exists public.panel_avisos_reclamar(uuid, jsonb, uuid, integer, integer);
create or replace function public.panel_avisos_reclamar(p_usuario uuid, p_items jsonb, p_token uuid, p_lease_seg integer default 120,
  p_max_intentos integer default 8, p_limite integer default 40, p_horizonte_seg integer default 21600)
returns setof public.panel_medicina_avisos language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.panel_medicina_avisos (user_id, medicina_id, revision, fecha, hora, dispositivo, toma_en)
    select p_usuario, x->>'medicina_id', x->>'revision', (x->>'fecha')::date, x->>'hora', x->>'dispositivo', (x->>'toma_en')::timestamptz
    from jsonb_array_elements(coalesce(p_items, '[]')) x
    on conflict do nothing;
  update public.panel_medicina_avisos a set estado = case when a.intentos >= p_max_intentos then 'agotado' else 'vencido' end,
      lease_token = null, lease_hasta = null, actualizado = now()
    where a.user_id = p_usuario
      and (a.estado = 'pendiente' or (a.estado = 'reservado' and a.lease_hasta < now()))
      and (a.intentos >= p_max_intentos or a.toma_en < now() - make_interval(secs => p_horizonte_seg));
  return query
  with candidatos as (
    select a.medicina_id, a.revision, a.fecha, a.hora, a.dispositivo
    from public.panel_medicina_avisos a
    where a.user_id = p_usuario
      and ((a.estado = 'pendiente' and a.proximo <= now()) or (a.estado = 'reservado' and a.lease_hasta < now()))
    order by a.proximo, a.toma_en nulls last, a.medicina_id, a.dispositivo
    limit greatest(p_limite, 0)
    for update of a skip locked
  )
  update public.panel_medicina_avisos a set estado = 'reservado', lease_token = p_token,
    lease_hasta = now() + make_interval(secs => p_lease_seg), intentos = a.intentos + 1, actualizado = now()
  from candidatos c
  where a.user_id = p_usuario and a.medicina_id = c.medicina_id and a.revision = c.revision and a.fecha = c.fecha
    and a.hora = c.hora and a.dispositivo = c.dispositivo
  returning a.*;
end $$;

-- S14 · Resultado de cada aviso: 'aceptado' (lo recibió el servicio de notificaciones), 'invalido' (ese celular ya no
-- acepta avisos), 'pendiente' (falló: se reintenta en 15 minutos) o 'cancelado'. Solo con la ficha vigente.
create or replace function public.panel_avisos_acusar(p_usuario uuid, p_token uuid, p_resultados jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  update public.panel_medicina_avisos a set estado = x->>'estado',
    proximo = case when x->>'estado' = 'pendiente' then now() + make_interval(secs => coalesce((x->>'espera_seg')::integer, 900)) else a.proximo end,
    lease_token = null, lease_hasta = null, actualizado = now()
  from jsonb_array_elements(p_resultados) x
  where a.user_id = p_usuario and a.lease_token = p_token and a.medicina_id = x->>'medicina_id' and a.revision = x->>'revision'
    and a.fecha = (x->>'fecha')::date and a.hora = x->>'hora' and a.dispositivo = x->>'dispositivo'
    and x->>'estado' in ('aceptado', 'invalido', 'pendiente', 'cancelado');
  get diagnostics n = row_count;
  return n;
end $$;

-- S14-C3 · ¿Toca la limpieza diaria? Sí si pasaron p_horas desde la última; una sola revisión la gana (atómico)
create or replace function public.panel_limpieza_toca(p_usuario uuid, p_horas integer default 24)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.panel_mantenimiento (user_id) values (p_usuario) on conflict (user_id) do nothing;
  update public.panel_mantenimiento m set ultima_limpieza = now()
    where m.user_id = p_usuario and m.ultima_limpieza < now() - make_interval(hours => p_horas);
  return found;
end $$;

-- Las funciones solo las puede usar el servidor
do $$
declare f text;
begin
  foreach f in array array[
    'panel_reservar_intento(text, integer, integer, integer)', 'panel_liberar_intento(text, bigint, integer, integer)',
    'panel_guardar(uuid, bigint, jsonb, text, text)', 'panel_tick_reclamar(uuid, bigint, text, integer, integer)',
    'panel_tick_terminar(uuid, bigint, uuid, text, text)', 'panel_avisos_reclamar(uuid, jsonb, uuid, integer, integer, integer, integer)',
    'panel_avisos_acusar(uuid, uuid, jsonb)', 'panel_limpieza_toca(uuid, integer)', 'panel_config_proteger()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
