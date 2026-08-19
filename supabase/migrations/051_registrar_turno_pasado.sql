-- ============================================================
-- Migración 051: Carga retroactiva de turnos (recepción)
-- RPC registrar_turno_pasado: registra un turno que YA ocurrió, sin las validaciones
-- de disponibilidad (fecha/hora libre, incluso pasada). Estado elegible: 'completado' | 'confirmado'.
-- Autorización dentro de la función: superadmin/globaladmin, o admin/recepcion de la organización
-- del profesional. SECURITY DEFINER para poder insertar saltando RLS de forma controlada.
-- ============================================================

create or replace function public.registrar_turno_pasado(
  p_professional_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_patient_name text,
  p_patient_phone text,
  p_status text default 'completado',
  p_patient_email text default null,
  p_patient_dni text default null,
  p_patient_obra_social text default null,
  p_patient_nro_socio text default null,
  p_patient_notes text default null
) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_service services%rowtype;
  v_ends_at timestamptz;
  v_org_id uuid; v_loc_id uuid; v_patient_id uuid; v_appt_id uuid; v_status appointment_status;
begin
  select organization_id, location_id into v_org_id, v_loc_id from professionals where id = p_professional_id;
  if not found then return jsonb_build_object('error','professional_not_found'); end if;

  if not (
    get_my_role() = any (array['superadmin','globaladmin'])
    or (get_my_role() = any (array['admin','recepcion']) and v_org_id = get_my_org_id())
  ) then
    return jsonb_build_object('error','not_authorized');
  end if;

  select * into v_service from services where id = p_service_id and active = true;
  if not found then return jsonb_build_object('error','service_not_found'); end if;

  v_ends_at := p_starts_at + (v_service.duration_minutes || ' minutes')::interval;
  v_status  := case when p_status in ('completado','confirmado') then p_status::appointment_status else 'completado'::appointment_status end;

  if p_patient_dni is not null and p_patient_dni <> '' then
    select id into v_patient_id from patients where organization_id = v_org_id and dni = p_patient_dni limit 1;
  end if;
  if v_patient_id is null and p_patient_phone is not null and p_patient_phone <> '' then
    select id into v_patient_id from patients where organization_id = v_org_id and phone = p_patient_phone limit 1;
  end if;
  if v_patient_id is not null then
    update patients set
      full_name   = p_patient_name,
      phone       = coalesce(nullif(p_patient_phone,''),       phone),
      dni         = coalesce(nullif(p_patient_dni,''),         dni),
      email       = coalesce(nullif(p_patient_email,''),       email),
      obra_social = coalesce(nullif(p_patient_obra_social,''), obra_social),
      nro_socio   = coalesce(nullif(p_patient_nro_socio,''),   nro_socio),
      notes       = coalesce(nullif(p_patient_notes,''),       notes),
      updated_at  = now()
    where id = v_patient_id;
  else
    insert into patients (organization_id, full_name, phone, email, dni, obra_social, nro_socio, notes)
    values (v_org_id, p_patient_name, nullif(p_patient_phone,''), nullif(p_patient_email,''), nullif(p_patient_dni,''), nullif(p_patient_obra_social,''), nullif(p_patient_nro_socio,''), nullif(p_patient_notes,''))
    returning id into v_patient_id;
  end if;

  insert into appointments (organization_id, location_id, professional_id, service_id, patient_id, starts_at, ends_at, status, patient_name, patient_phone, patient_email, cancellation_token)
  values (v_org_id, v_loc_id, p_professional_id, p_service_id, v_patient_id, p_starts_at, v_ends_at, v_status, p_patient_name, nullif(p_patient_phone,''), nullif(p_patient_email,''), gen_random_uuid())
  returning id into v_appt_id;

  return jsonb_build_object('id', v_appt_id, 'status', v_status);
end; $function$;

grant execute on function public.registrar_turno_pasado(uuid,uuid,timestamptz,text,text,text,text,text,text,text,text) to authenticated;
