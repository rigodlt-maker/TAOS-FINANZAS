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
