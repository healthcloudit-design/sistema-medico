import { useEffect, useState } from 'react'
import { X, FileText, Loader2, Save, ChevronDown, ChevronUp, Clock, Plus, Lock, UserCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Record {
  id: string
  motivo: string
  diagnostico?: string | null
  indicaciones?: string | null
  notas?: string | null
  is_closed?: boolean
  created_at: string
  professional_id?: string | null
  professionals?: { full_name: string } | null
}

interface Props {
  patientId: string
  patientName: string
  organizationId: string
  professionalId: string
  onClose: () => void
}

/**
 * Visor de historia clínica a nivel PACIENTE (se abre desde la búsqueda de pacientes,
 * sin necesidad de un turno). Muestra el historial COMPARTIDO del centro (todas las
 * evoluciones cargadas por cualquier profesional) y permite cargar una nota nueva.
 * La lectura compartida y la escritura sin turno están habilitadas por la migración
 * 052_shared_clinical_history (RLS + appointment_id nullable).
 */
export function PatientHistoryModal({ patientId, patientName, organizationId, professionalId, onClose }: Props) {
  const [records, setRecords]   = useState<Record[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [adding, setAdding]     = useState(false)
  const [motivo, setMotivo]           = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [indicaciones, setIndicaciones] = useState('')
  const [notas, setNotas]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('clinical_records')
      .select('id, motivo, diagnostico, indicaciones, notas, is_closed, created_at, professional_id, professionals(full_name)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(50)
    setRecords((data ?? []) as unknown as Record[])
    setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  const resetForm = () => {
    setMotivo(''); setDiagnostico(''); setIndicaciones(''); setNotas(''); setError('')
  }

  const saveNote = async () => {
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase
      .from('clinical_records')
      .insert({
        organization_id: organizationId,
        patient_id:      patientId,
        professional_id: professionalId,
        appointment_id:  null,
        motivo:          motivo.trim(),
        diagnostico:     diagnostico || null,
        indicaciones:    indicaciones || null,
        notas:           notas || null,
      })
      .select('id, motivo, diagnostico, indicaciones, notas, is_closed, created_at, professional_id, professionals(full_name)')
      .single()
    if (err || !data) {
      setError('No se pudo guardar la nota. Intentá de nuevo.')
      setSaving(false)
      return
    }
    setRecords(prev => [data as unknown as Record, ...prev])
    setSaving(false)
    setAdding(false)
    resetForm()
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-sky-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{patientName}</h3>
              <p className="text-xs text-gray-400">Historia clínica</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* Agregar nota */}
          {!adding ? (
            <button onClick={() => { resetForm(); setAdding(true) }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-sky-300 text-sky-600 text-sm font-medium hover:bg-sky-50 transition-colors">
              <Plus className="w-4 h-4" /> Agregar nota
            </button>
          ) : (
            <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50/60">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo *</label>
                <input value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Motivo de consulta"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Diagnóstico</label>
                <input value={diagnostico} onChange={e => setDiagnostico(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Indicaciones</label>
                <textarea value={indicaciones} onChange={e => setIndicaciones(e.target.value)} rows={2}
                  placeholder="Medicación, estudios, indicaciones..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl">{error}</div>}
              <div className="flex gap-2">
                <button onClick={() => { setAdding(false); resetForm() }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
                <button onClick={saveNote} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar nota</>}
                </button>
              </div>
            </div>
          )}

          {/* Historial */}
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Sin registros en la historia clínica.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map(r => (
                <div key={r.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{fmtDate(r.created_at)}</span>
                        {r.is_closed && <Lock className="w-3 h-3 text-gray-300" />}
                      </div>
                      <p className="text-sm text-gray-700 font-medium mt-0.5 truncate">{r.motivo}</p>
                      {r.professionals?.full_name && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <UserCircle className="w-3 h-3" /> {r.professionals.full_name}
                        </p>
                      )}
                    </div>
                    {expanded === r.id
                      ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>
                  {expanded === r.id && (
                    <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
                      {r.diagnostico && (
                        <div className="pt-3">
                          <span className="text-xs font-medium text-gray-500">Diagnóstico: </span>
                          <span className="text-sm text-gray-800">{r.diagnostico}</span>
                        </div>
                      )}
                      {r.indicaciones && (
                        <div>
                          <span className="text-xs font-medium text-gray-500">Indicaciones: </span>
                          <span className="text-sm text-gray-800 whitespace-pre-line">{r.indicaciones}</span>
                        </div>
                      )}
                      {r.notas && (
                        <div>
                          <span className="text-xs font-medium text-gray-500">Notas: </span>
                          <span className="text-sm text-gray-800 whitespace-pre-line">{r.notas}</span>
                        </div>
                      )}
                      {!r.diagnostico && !r.indicaciones && !r.notas && (
                        <p className="pt-3 text-sm text-gray-400">Sin datos adicionales.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
