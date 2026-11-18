-- Partida en la nube: una fila por usuario. El cliente juega en local y sincroniza aquí.
-- PRIVACIDAD (AGENTS §3): `data` NO contiene las coordenadas exactas del HQ; solo `hq_cell` (H3 res. 7).
create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  revision   bigint      not null default 1,
  hq_cell    text,
  device_id  text,
  updated_at timestamptz not null default now(),
  constraint saves_size check (octet_length(data::text) < 1000000)
);

alter table public.saves enable row level security;

-- Cada usuario solo ve y modifica su propia partida
drop policy if exists "saves lectura propia" on public.saves;
create policy "saves lectura propia" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "saves alta propia" on public.saves;
create policy "saves alta propia" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "saves cambio propio" on public.saves;
create policy "saves cambio propio" on public.saves
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "saves baja propia" on public.saves;
create policy "saves baja propia" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);
