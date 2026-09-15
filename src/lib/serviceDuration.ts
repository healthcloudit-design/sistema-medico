// Minutos que un turno BLOQUEA realmente en la agenda de un profesional.
//
// Modelo de 3 tiempos (ver migración 053):
//   - duration_minutes         = "paso" de la grilla (cada cuánto se ofrece un horario)
//   - display_duration_minutes = lo que se MUESTRA a la clienta en la web
//   - block_duration_minutes   = lo que BLOQUEA el calendario/cupo  ← lo que importa acá
//
// Si el servicio define block_duration_minutes (ej: Acqua), ese es el bloqueo real.
// Si NO lo define (resto de los tenants), se mantiene el comportamiento clásico:
// GREATEST(duration_minutes, display_duration_minutes).
export function realBlockingMinutes(
  service:
    | { duration_minutes?: number | null; display_duration_minutes?: number | null; block_duration_minutes?: number | null }
    | null
    | undefined,
  fallback = 30,
): number {
  if (service?.block_duration_minutes != null) return service.block_duration_minutes
  const base = service?.duration_minutes ?? fallback
  const display = service?.display_duration_minutes ?? base
  return Math.max(base, display)
}
