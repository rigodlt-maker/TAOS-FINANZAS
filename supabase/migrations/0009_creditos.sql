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
