-- Borradores del wizard de certificado. Cuando la usuaria pide "generame
-- el certificado", generamos par de claves + CSR en el server; el CSR se lo
-- damos para que lo suba a ARCA, y guardamos la clave privada acá (cifrada,
-- igual que en afip_config) hasta que vuelva con el .crt firmado.
create table if not exists csr_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cuit text not null,
  razon_social text,
  key_encrypted text not null,
  created_at timestamptz not null default now()
);

alter table csr_drafts enable row level security;

create policy "csr_drafts: select own row"
  on csr_drafts for select
  using (auth.uid() = user_id);

create policy "csr_drafts: insert own row"
  on csr_drafts for insert
  with check (auth.uid() = user_id);

create policy "csr_drafts: delete own row"
  on csr_drafts for delete
  using (auth.uid() = user_id);
