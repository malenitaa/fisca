-- Feedback in-app: cuando la usuaria quiere reportar algo (o sacude el
-- teléfono, o toca "Queja o sugerencia" en Ayuda) escribe acá en vez de
-- abrir el cliente de mail. Se guarda en la DB — solo yo lo veo desde
-- el dashboard de Supabase.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  user_agent text,
  path text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

-- Cualquier usuaria autenticada puede insertar su propio feedback.
create policy "feedback: insert own row"
  on feedback for insert
  with check (auth.uid() = user_id);

-- Nadie puede leer via la app — el feedback se lee desde el dashboard.
