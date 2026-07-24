import type { AppointmentStatus } from '../../types'

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; className: string }> = {
  pendiente:    { label: 'Pendiente',         className: 'bg-yellow-100 text-yellow-800' },
  confirmado:   { label: 'Confirmado',        className: 'bg-green-100 text-green-800' },
  cancelado:    { label: 'Cancelado',         className: 'bg-red-100 text-red-800' },
  no_asistio:   { label: 'No asistio',        className: 'bg-gray-100 text-gray-600' },
  completado:   { label: 'Completado',        className: 'bg-blue-100 text-blue-800' },
  en_atencion:  { label: 'En atencion',       className: 'bg-sky-100 text-sky-800' },
  lista_espera: { label: 'En lista de espera',className: 'bg-amber-100 text-amber-800' },
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className].join(' ')}>
      {config.label}
    </span>
  )
}

export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', className].join(' ')}>
      {children}
    </span>
  )
}
