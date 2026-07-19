-- PIN de re-entry (fallback si Face ID falla). El PIN se guarda hasheado
-- con bcrypt en la tabla; una fila por user. 3 intentos fallidos y se
-- bloquea hasta que el user recupere via magic link.
create table if not exists user_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_pins enable row level security;

create policy "user_pins: select own row"
  on user_pins for select
  using (auth.uid() = user_id);

create policy "user_pins: insert own row"
  on user_pins for insert
  with check (auth.uid() = user_id);

create policy "user_pins: update own row"
  on user_pins for update
  using (auth.uid() = user_id);

create policy "user_pins: delete own row"
  on user_pins for delete
  using (auth.uid() = user_id);

-- Credenciales WebAuthn/Passkey (Face ID). Un user puede tener varias
-- (un iPhone y un iPad, por ejemplo). El counter se usa para detectar
-- clonación de credenciales.
create table if not exists user_passkeys (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key bytea not null,
  counter bigint not null default 0,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table user_passkeys enable row level security;

create policy "user_passkeys: select own row"
  on user_passkeys for select
  using (auth.uid() = user_id);

create policy "user_passkeys: insert own row"
  on user_passkeys for insert
  with check (auth.uid() = user_id);

create policy "user_passkeys: update own row"
  on user_passkeys for update
  using (auth.uid() = user_id);

create policy "user_passkeys: delete own row"
  on user_passkeys for delete
  using (auth.uid() = user_id);
