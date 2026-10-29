-- Rendimiento de cuentas de ahorro (Cajita Turbo, Cajita de Nu, Revolut…): se suma solo cada día, con interés compuesto.
-- tope_tasa: hasta cuánto paga tasa_anual (p. ej. la Cajita Turbo solo los primeros $25,000); lo de arriba paga tasa_excedente.
alter table public.accounts add column tasa_anual numeric(6, 3);
alter table public.accounts add column tope_tasa numeric(14, 2);
alter table public.accounts add column tasa_excedente numeric(6, 3);
alter table public.accounts add column rendimiento_desde date;
