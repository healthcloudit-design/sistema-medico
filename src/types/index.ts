// ============================================================
// TIPOS DE DOMINIO — Centro Oftalmológico
// ============================================================

export type TurnoEstado = 'confirmado' | 'cancelado' | 'ausente' | 'atendido' | 'pendiente'

export interface Consultorio {
  id: string
  nombre: string
  direccion?: string
  telefono?: string
  activo: boolean
  qr_url?: string
  created_at: string
}

export interface Servicio {
  id: string
  consultorio_id: string
  nombre: string
  descripcion?: string
  duracion_minutos: number
  icono?: string
  activo: boolean
  precio?: number
}

export interface HorarioTemplate {
  id: string
  consultorio_id: string
  dia_semana: number   // 0=Dom, 1=Lun, ..., 6=Sáb
  hora_inicio: string  // "HH:MM"
  hora_fin: string     // "HH:MM"
  intervalo_minutos: number
  activo: boolean
}

export interface DiasBloqueados {
  id: string
  consultorio_id: string
  fecha: string   // "YYYY-MM-DD"
  motivo?: string
}

export interface Disponibilidad {
  id: string
  consultorio_id: string
  fecha: string
  hora: string
  disponible: boolean
  motivo_bloqueo?: string
}

export interface Paciente {
  id: string
  nombre: string
  telefono: string
  email?: string
  obra_social?: string
  nro_socio?: string
  observaciones?: string
}

export interface Turno {
  id: string
  paciente_id?: string
  consultorio_id: string
  servicio_id: string
  fecha: string   // "YYYY-MM-DD"
  hora: string    // "HH:MM"
  estado: TurnoEstado
  estado_pago?: string
  importe?: number
  fecha_pago?: string
  medio_pago?: string
  transaction_id?: string
  created_at: string
  // Joins
  paciente?: Paciente
  consultorio?: Consultorio
  servicio?: Servicio
}

// Para el flujo de reserva paso a paso
export interface BookingState {
  step: 1 | 2 | 3 | 4
  servicio?: Servicio
  consultorio?: Consultorio
  fecha?: string     // "YYYY-MM-DD"
  hora?: string      // "HH:MM"
  nombre: string
  telefono: string
  email: string
  obra_social: string
  nro_socio: string
  observaciones: string
}

export interface TimeSlot {
  hora: string
  disponible: boolean
}
