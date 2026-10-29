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
