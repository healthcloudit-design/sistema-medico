-- Historia clínica compartida dentro del centro + historia a nivel paciente (sin turno).

-- 1) Permitir que una historia clínica exista sin estar atada a un turno.
alter table public.clinical_records alter column appointment_id drop not null;

-- 2) Lectura compartida dentro de la organización para médicos.
--    Un médico puede LEER las historias de cualquier paciente de su organización
--    (no solo las que él cargó). Insert/Update siguen restringidos a sus propios
--    registros vía las policies medico_insert_own_records / medico_update_own_records.
drop policy if exists medico_select_own_records on public.clinical_records;
create policy medico_read_org_records on public.clinical_records
  for select
  using (
    get_my_role() = 'medico' and organization_id = get_my_org_id()
  );
