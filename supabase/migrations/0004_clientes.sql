-- Contactos guardados para autocompletar al facturar. Se llena solo:
-- cada factura con doc_numero hace upsert acá con last_used_at = now().
-- Consumidor Final (doc_tipo 99) NO se guarda — no hay a quién identificar.
create table if not exists clientes (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null default '',
  doc_tipo smallint not null,          -- 80 = CUIT, 96 = DNI
  doc_numero text not null,            -- string para preservar ceros a la izquierda si los tuviera
  condicion_iva_id smallint not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (user_id, doc_tipo, doc_numero)
);

create index if not exists clientes_recent_idx
  on clientes (user_id, last_used_at desc);

alter table clientes enable row level security;

create policy "clientes: select own rows"
  on clientes for select
  using (auth.uid() = user_id);

create policy "clientes: insert own rows"
  on clientes for insert
  with check (auth.uid() = user_id);

create policy "clientes: update own rows"
  on clientes for update
  using (auth.uid() = user_id);

create policy "clientes: delete own rows"
  on clientes for delete
  using (auth.uid() = user_id);
