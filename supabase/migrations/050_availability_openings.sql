-- ============================================================
-- Migración 050: Aperturas de disponibilidad
-- Permite HABILITAR días/horarios puntuales por profesional (lo inverso a bloquear).
-- Tabla: availability_openings (fecha + franja horaria).
-- RLS: SELECT público (la reserva pública necesita ver la disponibilidad);
--      INSERT/DELETE para staff (admin/recepcion/medico) dentro de su organización.
-- ============================================================

create table if not exists public.availability_openings (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  opening_date    date not null,
  start_time      time not null,
  end_time        time not null,
  reason          text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_avail_openings_prof_date
  on public.availability_openings(professional_id, opening_date);

alter table public.availability_openings enable row level security;

drop policy if exists "openings_public_read" on public.availability_openings;
create policy "openings_public_read"
  on public.availability_openings for select
  using (true);

drop policy if exists "openings_insert_staff" on public.availability_openings;
create policy "openings_insert_staff"
  on public.availability_openings for insert
  with check (
    get_my_role() = any (array['superadmin','globaladmin'])
    or (get_my_role() = any (array['admin','recepcion','medico']) and exists (
      select 1 from professionals p
      where p.id = availability_openings.professional_id
        and p.organization_id = get_my_org_id()
    ))
  );

drop policy if exists "openings_delete_staff" on public.availability_openings;
create policy "openings_delete_staff"
  on public.availability_openings for delete
  using (
    get_my_role() = any (array['superadmin','globaladmin'])
    or (get_my_role() = any (array['admin','recepcion','medico']) and exists (
      select 1 from professionals p
      where p.id = availability_openings.professional_id
        and p.organization_id = get_my_org_id()
    ))
  );
