// Tipos generados para Supabase (simplificados)
// Podés generar los tipos completos con: npx supabase gen types typescript

export type Database = {
  public: {
    Tables: {
      organizations: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      locations: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      professionals: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      services: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      professional_services: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      schedules: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      availability_blocks: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      patients: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      appointments: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      appointment_status: 'pendiente' | 'confirmado' | 'cancelado' | 'no_asistio' | 'completado'
    }
  }
}
