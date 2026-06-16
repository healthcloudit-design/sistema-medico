import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Save, X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const schema = z.object({
  motivo:       z.string().min(3, 'Requerido'),
  diagnostico:  z.string().optional(),
  indicaciones: z.string().optional(),
  notas:        z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface ClinicalRecord {
  id: string
  motivo: string
  diagnostico: string | null
  indicaciones: string | null
  notas: string | null
  created_at: string
}

interface Props {
  appointmentId: string
  patientId: string | null
  professionalId: string
  organizationId: string
  patientName: string
  onClose: () => void
}

export function ClinicalRecordModal({
  appointmentId,
  patientId,
  professionalId,
  organizationId,
  patientName,
  onClose,
}: Props) {
  const [existing, setExisting]   = useState<ClinicalRecord | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [history, setHistory]     = useState<ClinicalRecord[]>([])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Cargar evolución existente de este turno + historial del paciente
  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Evolución de este turno
      const { data: rec } = await supabase
        .from('clinical_records')
        .select('*')
        .eq('appointment_id', appointmentId)
        .maybeSingle()

      if (rec) {
        setExisting(rec)
        reset({
          motivo:       rec.motivo,
          diagnostico:  rec.diagnostico ?? '',
          indicaciones: rec.indicaciones ?? '',
          notas:        rec.notas ?? '',
        })
      }

      // Historial previo del paciente (últimas 5 evoluciones, excluyendo la actual)
      if (patientId) {
        const { data: hist } = await supabase
          .from('clinical_records')
          .select('*, appointments!inner(starts_at)')
          .eq('patient_id', patientId)
          .neq('appointment_id', appointmentId)
          .order('created_at', { ascending: false })
          .limit(5)
        setHistory((hist ?? []) as ClinicalRecord[])
      }

      setLoading(false)
    }
    load()
  }, [appointmentId, patientId])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    const payload = {
      ...data,
      appointment_id:  appointmentId,
      patient_id:      patientId,
      professional_id: professionalId,
      organization_id: organizationId,
    }

    if (existing) {
      await supabase
        .from('clinical_records')
        .update({ motivo: data.motivo, diagnostico: data.diagnostico, indicaciones: data.indicaciones, notas: data.notas })
        .eq('id', existing.id)
    } else {
      await supabase.from('clinical_records').insert(payload)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600" />
            <h3 className="font-semibold text-gray-900">Historia clínica</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Paciente */}
          <div className="bg-sky-50 rounded-xl px-4 py-3">
            <p className="text-xs text-sky-600 font-medium">Paciente</p>
            <p className="text-sm font-semibold text-sky-900 mt-0.5">{patientName}</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* Formulario evolución actual */}
              <form id="hc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Motivo de consulta <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    {...register('motivo')}
                    rows={2}
                    placeholder="Describe el motivo principal de la consulta..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {errors.motivo && <p className="text-xs text-red-500 mt-1">{errors.motivo.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Diagnóstico</label>
                  <textarea
                    {...register('diagnostico')}
                    rows={2}
                    placeholder="CIE-10 o descripción libre..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Indicaciones / Tratamiento</label>
                  <textarea
                    {...register('indicaciones')}
                    rows={3}
                    placeholder="Medicación, dosis, frecuencia, indicaciones..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas</label>
                  <textarea
                    {...register('notas')}
                    rows={2}
                    placeholder="Observaciones adicionales (no visibles para el paciente)..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </form>

              {/* Historial previo */}
              {history.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Consultas anteriores
                  </h4>
                  <div className="space-y-3">
                    {history.map((h) => (
                      <div key={h.id} className="border border-gray-100 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-gray-400">
                          {new Date(h.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Motivo: </span>
                          <span className="text-sm text-gray-800">{h.motivo}</span>
                        </div>
                        {h.diagnostico && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Diagnóstico: </span>
                            <span className="text-sm text-gray-800">{h.diagnostico}</span>
                          </div>
                        )}
                        {h.indicaciones && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Indicaciones: </span>
                            <span className="text-sm text-gray-800">{h.indicaciones}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            type="submit"
            form="hc-form"
            disabled={saving || loading}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white py-3 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              '✓ Guardado'
            ) : (
              <>
                <Save className="w-4 h-4" />
                {existing ? 'Actualizar evolución' : 'Guardar evolución'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
