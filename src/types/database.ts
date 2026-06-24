export type AppointmentStatusEnum = 'pendiente' | 'confirmado' | 'cancelado' | 'no_asistio' | 'completado'

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string; logo_url: string | null; phone: string | null; email: string | null; address: string | null; timezone: string; active: boolean; feature_mp: boolean; feature_hc: boolean; tenant_type: 'medical' | 'beauty' | 'general' | 'petshop' | 'veterinary' | 'estetica'; created_at: string; updated_at: string }
        Insert: { name: string; slug: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      locations: {
        Row: { id: string; organization_id: string; name: string; address: string | null; phone: string | null; active: boolean; created_at: string; updated_at: string }
        Insert: { organization_id: string; name: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      professionals: {
        Row: { id: string; organization_id: string; location_id: string | null; user_id: string | null; full_name: string; specialty: string | null; bio: string | null; avatar_url: string | null; active: boolean; created_at: string; updated_at: string }
        Insert: { organization_id: string; full_name: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      services: {
        Row: { id: string; organization_id: string; name: string; description: string | null; duration_minutes: number; price: number | null; color: string; category: string | null; active: boolean; created_at: string; updated_at: string }
        Insert: { organization_id: string; name: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      professional_services: {
        Row: { professional_id: string; service_id: string }
        Insert: { professional_id: string; service_id: string }
        Update: { professional_id?: string; service_id?: string }
      }
      schedules: {
        Row: { id: string; professional_id: string; day_of_week: number; start_time: string; end_time: string; interval_minutes: number; active: boolean; created_at: string }
        Insert: { professional_id: string; day_of_week: number; start_time: string; end_time: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      availability_blocks: {
        Row: { id: string; professional_id: string; blocked_date: string | null; blocked_start: string | null; blocked_end: string | null; reason: string | null; created_at: string }
        Insert: { professional_id: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      patients: {
        Row: { id: string; organization_id: string; full_name: string; phone: string | null; email: string | null; dni: string | null; obra_social: string | null; nro_socio: string | null; notes: string | null; created_at: string; updated_at: string }
        Insert: { organization_id: string; full_name: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      appointments: {
        Row: { id: string; organization_id: string; location_id: string | null; professional_id: string; service_id: string; patient_id: string | null; starts_at: string; ends_at: string; status: AppointmentStatusEnum; notes: string | null; patient_name: string; patient_phone: string | null; patient_email: string | null; payment_status: string | null; payment_amount: number | null; payment_date: string | null; payment_provider: string | null; transaction_id: string | null; reminder_48h_sent: boolean; reminder_24h_sent: boolean; created_at: string; updated_at: string }
        Insert: { professional_id: string; service_id: string; starts_at: string; ends_at: string; patient_name: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      clinical_records: {
        Row: { id: string; organization_id: string; appointment_id: string; patient_id: string | null; professional_id: string; motivo: string; diagnostico: string | null; indicaciones: string | null; notas: string | null; created_at: string; updated_at: string }
        Insert: { organization_id: string; appointment_id: string; professional_id: string; motivo: string; [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
    }
    Views: Record<string, unknown>
    Functions: {
      reservar_turno: {
        Args: { p_professional_id: string; p_service_id: string; p_starts_at: string; p_patient_name: string; p_patient_phone: string; p_patient_email?: string; p_patient_obra_social?: string; p_patient_nro_socio?: string; p_patient_notes?: string }
        Returns: { id?: string; status?: string; error?: string }
      }
    }
    Enums: {
      appointment_status: AppointmentStatusEnum
    }
  }
}
