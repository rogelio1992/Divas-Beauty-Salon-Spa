-- Ejecutar en Supabase SQL Editor cuando se cree el proyecto.
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null, role text not null check (role in ('admin', 'staff')), created_at timestamptz not null default now());
create table public.services (id bigint generated always as identity primary key, name text not null, category text not null, duration_minutes integer not null check (duration_minutes > 0), price integer not null check (price >= 0), active boolean not null default true);
create table public.appointments (id bigint generated always as identity primary key, client_name text not null, service_id bigint references public.services(id), stylist_id uuid references public.profiles(id), starts_at timestamptz not null, duration_minutes integer not null check (duration_minutes > 0), status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')), notes text, created_at timestamptz not null default now());
create index appointments_stylist_starts_at_idx on public.appointments (stylist_id, starts_at);

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

-- Durante la Fase 1, cualquier usuario autenticado del salón puede operar la agenda.
-- En la Fase 2 estas políticas se limitarán por rol (administradora o profesional).
create policy "staff can view profiles" on public.profiles for select to authenticated using (true);
create policy "staff can view services" on public.services for select to authenticated using (true);
create policy "staff can manage appointments" on public.appointments for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select on public.profiles, public.services to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant usage, select on sequence public.appointments_id_seq to authenticated;

insert into public.services (name, category, duration_minutes, price) values
  ('Esmaltado permanente', 'Uñas', 75, 18000),
  ('Manicure', 'Uñas', 45, 12000),
  ('Pedicure spa', 'Uñas', 75, 22000),
  ('Lifting de pestañas', 'Pestañas', 60, 25000),
  ('Extensión de pestañas', 'Pestañas', 120, 35000),
  ('Depilación facial', 'Depilación', 30, 8000),
  ('Depilación corporal', 'Depilación', 45, 16000);
