-- Registro simple de "ya pagué el monotributo este período" para poder
-- mostrar un recordatorio. No automatiza el pago (eso pasa en ARCA).
create table if not exists monotributo_pagos (
  user_id uuid not null references auth.users(id) on delete cascade,
  periodo text not null, -- 'YYYY-MM'
  created_at timestamptz not null default now(),
  primary key (user_id, periodo)
);

alter table monotributo_pagos enable row level security;

create policy "monotributo_pagos: select own rows"
  on monotributo_pagos for select
  using (auth.uid() = user_id);

create policy "monotributo_pagos: insert own rows"
  on monotributo_pagos for insert
  with check (auth.uid() = user_id);

create policy "monotributo_pagos: delete own rows"
  on monotributo_pagos for delete
  using (auth.uid() = user_id);
