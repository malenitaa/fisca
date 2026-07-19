-- Rate limiting persistente por usuario y endpoint. En serverless
-- (Vercel) no podemos guardar contadores en memoria porque cada request
-- puede ir a una lambda distinta, así que los mantenemos en Postgres.
--
-- El diseño es una fila por (user_id, endpoint) que se resetea cuando
-- termina la ventana. count/window_start se actualizan en cada request.
create table if not exists api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  window_start timestamptz not null default now(),
  count integer not null default 1,
  primary key (user_id, endpoint)
);

alter table api_rate_limits enable row level security;

-- Cada user solo ve/actualiza sus propias filas. Los checks se hacen
-- desde route handlers server-side con el JWT del user.
create policy "api_rate_limits: select own"
  on api_rate_limits for select
  using (auth.uid() = user_id);

create policy "api_rate_limits: insert own"
  on api_rate_limits for insert
  with check (auth.uid() = user_id);

create policy "api_rate_limits: update own"
  on api_rate_limits for update
  using (auth.uid() = user_id);

create index if not exists api_rate_limits_window_idx
  on api_rate_limits (window_start);
