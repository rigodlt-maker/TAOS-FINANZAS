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
