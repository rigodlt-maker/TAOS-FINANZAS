-- Últimos 4 dígitos de cada tarjeta: con ellos la app reconoce con qué tarjeta pagaste al leer la foto de un ticket
alter table public.accounts add column if not exists terminacion text check (terminacion ~ '^[0-9]{4}$');
