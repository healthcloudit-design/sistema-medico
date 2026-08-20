export interface Service {
  id: string
  organization_id: string
  name: string
  description?: string
  duration_minutes: number
  /** Duración informativa a mostrar al paciente/staff; si no está, se muestra duration_minutes. No afecta el bloqueo de agenda. */
  display_duration_minutes?: number | null
  price?: number
  color: string
  category?: string | null
  active: boolean
  /** Cantidad de personas que pueden reservar el mismo horario (1 = turno individual, >1 = clase grupal con cupo) */
  capacity: number
  /** Cantidad máxima de personas en lista de espera cuando el cupo está lleno (0 = sin lista de espera) */
  waitlist_limit: number
  /** Si true (default), este servicio necesita al profesional dedicado todo el turno y no puede combinarse con otro servicio que también lo requiera al mismo tiempo. Si false, tiene tiempo de espera/procesado durante el cual el profesional puede atender otro servicio (ej: Color). */
  requiere_atencion_completa: boolean
  /** Override opcional del último horario de inicio ofrecido, por día de semana (0=domingo..6=sábado), ej: {"6":"15:00"}. Si un día no está presente, se usa el horario normal del profesional. */
  last_start_overrides?: Record<string, string> | null
  /** Si true, el flujo público multi-centro (salud pública) pide la orden del médico de cabecera antes de reservar este servicio. */
  requiere_orden?: boolean
  created_at: string
}

export type TenantType = 'medical' | 'beauty' | 'general' | 'petshop' | 'veterinary' | 'estetica' | 'cancha'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  timezone: string
  active: boolean
  feature_mp: boolean
  feature_hc: boolean
  /** Monto fijo de seña (ARS) a cobrar por Mercado Pago al reservar, para cualquier servicio. null = sin seña. */
  deposit_amount?: number | null
  tenant_type: TenantType
  primary_color?: string | null
  whatsapp_number?: string | null
  instagram_handle?: string | null
  facebook_url?: string | null
  specialty?: string | null
  cover_image_url?: string | null
  booking_headline?: string | null
  booking_weeks?: 1 | 2 | null
  created_at: string
  updated_at: string
}

export interface Professional {
  id: string
  organization_id: string
  location_id?: string
  user_id?: string
  full_name: string
  specialty?: string
  consultorio?: string | null
  bio?: string
  avatar_url?: string
  active: boolean
  /** Cantidad de clientes que puede atender en simultáneo (default 1 = sin superposición). */
  concurrent_capacity: number
  created_at: string
}

export interface Schedule {
  id: string
  professional_id: string
  day_of_week: number
  start_time: string
  end_time: string
  interval_minutes: number
  active: boolean
  created_at: string
}

export interface AvailabilityBlock {
  id: string
  professional_id: string
  blocked_date?: string
  blocked_start?: string
  blocked_end?: string
  reason?: string
  created_at: string
}

/** Apertura puntual: habilita una franja horaria en una fecha específica para un profesional. */
export interface AvailabilityOpening {
  id: string
  professional_id: string
  opening_date: string
  start_time: string
  end_time: string
  reason?: string | null
  created_at: string
}

export interface Patient {
  id: string
  organization_id: string
  full_name: string
  phone?: string
  email?: string
  dni?: string
  obra_social?: string
  nro_socio?: string
  notes?: string
  created_at: string
  updated_at: string
}

export type AppointmentStatus =
  | 'pendiente'
  | 'confirmado'
  | 'cancelado'
  | 'no_asistio'
  | 'completado'
  | 'en_atencion'
  | 'lista_espera'

export interface Appointment {
  id: string
  organization_id: string
  location_id?: string
  professional_id: string
  service_id: string
  patient_id?: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  notes?: string
  patient_name: string
  patient_phone?: string
  patient_email?: string
  payment_status?: string
  payment_amount?: number
  payment_date?: string
  payment_provider?: string
  transaction_id?: string
  created_at: string
  updated_at: string
  patient?: Patient
  professional?: Professional
  service?: Service
}

export interface BookingState {
  step: 1 | 2 | 3 | 4
  service?: Service
  professional?: Professional
  fecha?: string
  hora?: string
  nombre: string
  telefono: string
  email: string
  dni: string
  obra_social: string
  nro_socio: string
  observaciones: string
}

export interface TimeSlot {
  hora: string
  disponible: boolean
  /** Solo para servicios con cupo (capacity > 1): cupos que quedan libres en este horario */
  cuposRestantes?: number
  /** Solo para servicios con cupo: el cupo está lleno pero se puede anotar en lista de espera */
  enListaDeEspera?: boolean
}

export type UserRole = 'paciente' | 'medico' | 'recepcion' | 'admin' | 'superadmin' | 'globaladmin' | 'comercial'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  professional_id: string | null
  organization_id?: string | null
  created_at: string
}
