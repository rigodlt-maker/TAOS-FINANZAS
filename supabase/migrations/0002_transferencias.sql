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
