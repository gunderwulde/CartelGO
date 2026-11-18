-- Caché compartida de POIs por celda H3 (res. 8). Datos públicos de OpenStreetMap (ODbL).
create table if not exists public.poi_cells (
  cell        text primary key,            -- índice H3 res. 8, p. ej. "88390cb2dbfffff"
  fetched_at  timestamptz not null default now(),
  pois        jsonb       not null default '[]'::jsonb
);

alter table public.poi_cells enable row level security;

-- Cualquiera (clave anónima) puede leer; solo la función de borde (service role) escribe.
drop policy if exists "poi_cells lectura publica" on public.poi_cells;
create policy "poi_cells lectura publica"
  on public.poi_cells for select
  to anon, authenticated
  using (true);
