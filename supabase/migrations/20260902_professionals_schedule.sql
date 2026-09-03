create table if not exists public.professionals (
  id bigint generated always as identity primary key,
  name text not null unique,
  specialty text not null default 'Servicios de belleza',
  work_days integer[] not null default array[1,2,3,4,5,6],
  work_start_time time not null default '09:00',
  work_end_time time not null default '18:00',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (work_days <@ array[0,1,2,3,4,5,6]),
  check (work_start_time < work_end_time)
);

insert into public.professionals (name, specialty, work_days, work_start_time, work_end_time)
values
  ('Sofía', 'Manicure y pedicure', array[1,2,3,4,5,6], '09:00', '18:00'),
  ('Valentina', 'Manicure y pestañas', array[1,2,3,4,5,6], '10:00', '19:00'),
  ('Daniela', 'Depilación y pestañas', array[1,2,3,4,5,6], '09:30', '18:30')
on conflict (name) do nothing;

alter table public.professionals enable row level security;
create policy "staff can manage professionals" on public.professionals for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.professionals to authenticated;
grant select on public.professionals to service_role;
grant usage, select on sequence public.professionals_id_seq to authenticated;
