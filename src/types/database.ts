// Tipos generados para Supabase
export type Database = {
  public: {
    Tables: {
      consultorios: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      servicios: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      horarios_template: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      dias_bloqueados: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      pacientes: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      turnos: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      recordatorios: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
    }
    Views: Record<string, unknown>
    Functions: {
      reservar_turno: {
        Args: {
          p_paciente_id: string
          p_consultorio_id: string
          p_servicio_id: string
          p_fecha: string
          p_hora: string
          p_estado: string
        }
        Returns: unknown
      }
    }
    Enums: Record<string, unknown>
  }
}
