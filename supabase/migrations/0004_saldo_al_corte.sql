-- Tarjetas: el "pago para no generar intereses" que dice tu app del banco, y el corte al que corresponde.
-- Así la app separa lo que debes al corte de las compras nuevas (que van al siguiente estado de cuenta).
alter table public.accounts add column saldo_al_corte numeric(14, 2);
alter table public.accounts add column fecha_corte_saldo date;
