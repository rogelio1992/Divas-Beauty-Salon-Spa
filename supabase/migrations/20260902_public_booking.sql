alter table public.appointments add column if not exists client_phone text;
alter table public.appointments add column if not exists professional_name text;

-- Necesario porque la exposición automática de tablas fue desactivada.
grant usage on schema public to service_role;
grant select on public.services to service_role;
grant select, insert, update, delete on public.appointments to service_role;
