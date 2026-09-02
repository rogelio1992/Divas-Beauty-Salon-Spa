-- Aplicar una sola vez en SQL Editor para el proyecto ya creado.
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

create policy "staff can view profiles" on public.profiles for select to authenticated using (true);
create policy "staff can view services" on public.services for select to authenticated using (true);
create policy "staff can manage appointments" on public.appointments for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select on public.profiles, public.services to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant usage, select on sequence public.appointments_id_seq to authenticated;
