import type { TurnoEstado } from '../../types'

const STATUS_CONFIG: Record<TurnoEstado, { label: string; className: string }> = {
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-800' },
  confirmado: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
  cancelado:  { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
  ausente:    { label: 'No asistió', className: 'bg-gray-100 text-gray-600' },
  atendido:   { label: 'Atendido',   className: 'bg-blue-100 text-blue-800' },
}

export function StatusBadge({ status }: { status: TurnoEstado }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}

export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}
