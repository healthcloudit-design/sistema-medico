export interface Service {
  id: string
  organization_id: string
  name: string
  description?: string
  duration_minutes: number
  price?: number
  color: string
  category?: string | null
  active: boolean
  created_at: string
}

export type TenantType = 'medical' | 'beauty' | 'general' | 'petshop' | 'veterinary'

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
  tenant_type: TenantType
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
  bio?: string
  avatar_url?: string
  active: boolean
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
}

export type UserRole = 'paciente' | 'medico' | 'recepcion' | 'admin' | 'superadmin'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  professional_id: string | null
  created_at: string
  updated_at: string
}
