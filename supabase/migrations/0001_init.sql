-- Configuración de facturación de cada usuario (CUIT, punto de venta,
-- certificado/clave privada cifrados). Una sola fila por usuario.
create table if not exists afip_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cuit text not null,
  razon_social text,
  punto_venta integer not null,
  ambiente text not null check (ambiente in ('homologacion', 'produccion')),
  cert_encrypted text not null,
  key_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table afip_config enable row level security;

create policy "afip_config: select own row"
  on afip_config for select
  using (auth.uid() = user_id);

create policy "afip_config: insert own row"
  on afip_config for insert
  with check (auth.uid() = user_id);

create policy "afip_config: update own row"
  on afip_config for update
  using (auth.uid() = user_id);

-- Cache del Ticket de Acceso (TA) de WSAA, válido ~12hs, para no pedir uno
-- nuevo en cada factura. Solo accedido desde el server (service role).
create table if not exists afip_tickets (
  user_id uuid not null references auth.users(id) on delete cascade,
  ambiente text not null check (ambiente in ('homologacion', 'produccion')),
  token text not null,
  sign text not null,
  expiration_time timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, ambiente)
);

alter table afip_tickets enable row level security;

create policy "afip_tickets: select own row"
  on afip_tickets for select
  using (auth.uid() = user_id);

create policy "afip_tickets: insert own row"
  on afip_tickets for insert
  with check (auth.uid() = user_id);

create policy "afip_tickets: update own row"
  on afip_tickets for update
  using (auth.uid() = user_id);

-- Historial de facturas emitidas.
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ambiente text not null check (ambiente in ('homologacion', 'produccion')),
  cbte_tipo integer not null,
  punto_venta integer not null,
  numero_comprobante bigint not null,
  concepto integer not null,
  cliente_doc_tipo integer not null,
  cliente_doc_nro text not null,
  cliente_nombre text,
  condicion_iva_receptor_id integer not null,
  items jsonb not null,
  importe_total numeric(14, 2) not null,
  moneda text not null default 'PES',
  fecha_emision date not null,
  cae text not null,
  cae_vencimiento date not null,
  created_at timestamptz not null default now(),
  unique (user_id, ambiente, punto_venta, cbte_tipo, numero_comprobante)
);

alter table invoices enable row level security;

create policy "invoices: select own rows"
  on invoices for select
  using (auth.uid() = user_id);

create policy "invoices: insert own rows"
  on invoices for insert
  with check (auth.uid() = user_id);

create index if not exists invoices_user_id_created_at_idx
  on invoices (user_id, created_at desc);
