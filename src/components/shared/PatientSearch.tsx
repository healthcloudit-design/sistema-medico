import { useState, useRef } from 'react'
import { Search, UserCircle, Phone, Mail, CreditCard, Heart, Hash } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Patient {
  id: string
  full_name: string
  phone?: string
  email?: string
  dni?: string
  obra_social?: string
  nro_socio?: string
  notes?: string
  last_appointment?: { scheduled_at: string; status: string; professionals?: { full_name: string } }
}

interface Props {
  /** Si se pasa, filtra pacientes de esa org. Si no, busca en todas (superadmin). */
  orgId?: string | null
  /** Si se pasa, filtra solo pacientes que tuvieron turnos con este profesional. */
  professionalId?: string | null
}

export function PatientSearch({ orgId, professionalId }: Props) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<Patient[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)

    // Si es vista de médico, primero obtenemos los patient_ids con turnos de ese profesional
    let allowedPatientIds: string[] | null = null
    if (professionalId) {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('professional_id', professionalId)
        .not('patient_id', 'is', null)
      allowedPatientIds = [...new Set((apptData ?? []).map((a: any) => a.patient_id as string))]
    }

    let baseQuery = supabase
      .from('patients')
      .select('id, full_name, phone, email, dni, obra_social, nro_socio, notes, appointments(starts_at, status)')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,dni.ilike.%${q}%,obra_social.ilike.%${q}%,nro_socio.ilike.%${q}%`)
      .order('full_name')
      .limit(25)

    if (orgId) baseQuery = baseQuery.eq('organization_id', orgId)
    if (allowedPatientIds && allowedPatientIds.length > 0) {
      baseQuery = baseQuery.in('id', allowedPatientIds)
    } else if (allowedPatientIds !== null && allowedPatientIds.length === 0) {
      // Médico sin pacientes aún
      setResults([])
      setLoading(false)
      return
    }

    const { data } = await baseQuery

    const mapped: Patient[] = (data ?? []).map((p: any) => {
      const appts = (p.appointments ?? []).sort(
        (a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
      )
      return { ...p, last_appointment: appts[0] ?? null }
    })

    setResults(mapped)
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 350)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const STATUS_LABEL: Record<string, string> = {
    pendiente:  'Pendiente',
    confirmado: 'Confirmado',
    cancelado:  'Cancelado',
    no_asistio: 'No asistió',
    completado: 'Completado',
  }

  const STATUS_COLOR: Record<string, string> = {
    pendiente:  'bg-yellow-100 text-yellow-800',
    confirmado: 'bg-green-100 text-green-800',
    cancelado:  'bg-red-100 text-red-800',
    no_asistio: 'bg-gray-100 text-gray-600',
    completado: 'bg-blue-100 text-blue-800',
  }

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        )}
        <input
          value={query}
          onChange={handleChange}
          placeholder="Buscar por nombre, DNI, teléfono, email u obra social…"
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          autoComplete="off"
        />
      </div>

      {/* Hint */}
      {!searched && (
        <p className="text-xs text-gray-400 text-center">Escribí al menos 2 caracteres para buscar</p>
      )}

      {/* Sin resultados */}
      {searched && !loading && results.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No se encontraron pacientes</p>
        </div>
      )}

      {/* Resultados */}
      <div className="space-y-3">
        {results.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{p.full_name}</div>

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {p.dni && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Hash className="w-3 h-3" /> DNI {p.dni}
                    </span>
                  )}
                  {p.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" /> {p.phone}
                    </span>
                  )}
                  {p.email && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="w-3 h-3" /> {p.email}
                    </span>
                  )}
                  {p.obra_social && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Heart className="w-3 h-3" /> {p.obra_social}
                      {p.nro_socio && <span className="text-gray-400">#{p.nro_socio}</span>}
                    </span>
                  )}
                  {!p.obra_social && p.nro_socio && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <CreditCard className="w-3 h-3" /> Socio #{p.nro_socio}
                    </span>
                  )}
                </div>

                {p.notes && (
                  <p className="mt-1 text-xs text-gray-400 truncate">{p.notes}</p>
                )}

                {p.last_appointment && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      Último turno: {formatDate(p.last_appointment.starts_at)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.last_appointment.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[p.last_appointment.status] ?? p.last_appointment.status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
