// Duración REAL que un turno ocupa en la agenda de un profesional.
//
// duration_minutes es el "paso" de la grilla (cada cuánto se puede ofrecer un
// horario, ej: cada 30 min). display_duration_minutes es la duración real que
// se le informa al paciente/staff (ej: Reflejos = 240 min de proceso químico).
//
// El backend (reservar_turno / reprogramar_turno) ya usa GREATEST(duration_minutes,
// display_duration_minutes) como ventana real de bloqueo — así nunca se puede doble-
// reservar un profesional dentro del tiempo real que un tratamiento ocupa, aunque la
// grilla siga ofreciendo horarios cada 30 min. El front tiene que usar el mismo
// número al calcular qué horarios mostrar como disponibles, para no ofrecer horarios
// que el backend después va a rechazar.
export function realBlockingMinutes(
  service: { duration_minutes?: number | null; display_duration_minutes?: number | null } | null | undefined,
  fallback = 30,
): number {
  const base = service?.duration_minutes ?? fallback
  const display = service?.display_duration_minutes ?? base
  return Math.max(base, display)
}
