import { useEffect, useState } from 'react'
import { Plus, Trash2, CheckCircle, X, Stethoscope, DollarSign } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Service } from '../../types'

const P800 = '#0F2830'
const P600 = '#1A3F4E'
const GOLD = '#C9A96E'
const BD   = '#E2E8F0'
const T2   = '#475569'
const T3   = '#94A3B8'

interface SessionTreatment {
  id?: string
  service_id: string
  service_name: string
  quantity: number
  unit_price: number | null
  notes: string
}

interface Props {
  appointmentId: string
  organizationId: string
  patientName: string
  readOnly?: boolean
  onClose: () => void
}

export function SessionTreatmentsModal({ appointmentId, organizationId, patientName, readOnly = false, onClose }: Props) {
  const [services,    setServices]    = useState<Service[]>([])
  const [treatments,  setTreatments]  = useState<SessionTreatment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [selectedSvc, setSelectedSvc] = useState('')

  // Load org services + existing session treatments
  useEffect(() => {
    Promise.all([
      supabase.from('services').select('*').eq('organization_id', organizationId).eq('active', true).order('name'),
      supabase.from('session_treatments').select('*, services(name, price)').eq('appointment_id', appointmentId),
    ]).then(([{ data: svcs }, { data: existing }]) => {
      setServices((svcs ?? []) as Service[])
      if (existing && existing.length > 0) {
        setTreatments(existing.map((e: any) => ({
          id:           e.id,
          service_id:   e.service_id,
          service_name: e.services?.name ?? '—',
          quantity:     e.quantity,
          unit_price:   e.unit_price,
          notes:        e.notes ?? '',
        })))
      }
      setLoading(false)
    })
  }, [appointmentId, organizationId])

  const addTreatment = () => {
    if (!selectedSvc) return
    const svc = services.find(s => s.id === selectedSvc)
    if (!svc) return
    // avoid duplicates
    if (treatments.some(t => t.service_id === selectedSvc)) {
      setSelectedSvc(''); return
    }
    setTreatments(p => [...p, {
      service_id:   svc.id,
      service_name: svc.name,
      quantity:     1,
      unit_price:   svc.price ?? null,
      notes:        '',
    }])
    setSelectedSvc('')
  }

  const remove = (idx: number) => setTreatments(p => p.filter((_, i) => i !== idx))
  const update = <K extends keyof SessionTreatment>(idx: number, key: K, val: SessionTreatment[K]) =>
    setTreatments(p => p.map((t, i) => i === idx ? { ...t, [key]: val } : t))

  const total = treatments.reduce((sum, t) => sum + (t.quantity * (t.unit_price ?? 0)), 0)

  const save = async () => {
    setSaving(true)
    // Delete existing then re-insert (simple upsert strategy)
    await supabase.from('session_treatments').delete().eq('appointment_id', appointmentId)
    if (treatments.length > 0) {
      await supabase.from('session_treatments').insert(
        treatments.map(t => ({
          appointment_id: appointmentId,
          service_id:     t.service_id,
          quantity:       t.quantity,
          unit_price:     t.unit_price,
          notes:          t.notes || null,
        }))
      )
    }
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(11,30,36,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: '520px', borderRadius: '18px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 32px 72px rgba(0,0,0,0.22)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', backgroundColor: P800, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                <Stethoscope size={14} style={{ color: GOLD }}/>
                <span style={{ fontSize: '11px', fontWeight: 600, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {readOnly ? 'Tratamientos realizados' : 'Registrar tratamientos'}
                </span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{patientName}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(i => <div key={i} style={{ height: '52px', borderRadius: '10px', backgroundColor: '#f1f5f9' }}/>)}
            </div>
          ) : (
            <>
              {/* Add row — only for medico */}
              {!readOnly && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <select value={selectedSvc} onChange={e => setSelectedSvc(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '9px', border: `1px solid ${BD}`, fontSize: '13px', color: T2, backgroundColor: '#f8fafc', outline: 'none' }}>
                    <option value="">Seleccionar tratamiento…</option>
                    {services.filter(s => !treatments.some(t => t.service_id === s.id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.price ? ` ($${s.price})` : ''}</option>
                    ))}
                  </select>
                  <button onClick={addTreatment} disabled={!selectedSvc}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 14px', borderRadius: '9px', border: 'none', backgroundColor: selectedSvc ? P600 : '#e2e8f0', color: selectedSvc ? '#fff' : T3, fontSize: '13px', fontWeight: 500, cursor: selectedSvc ? 'pointer' : 'default', flexShrink: 0 }}>
                    <Plus size={14}/> Agregar
                  </button>
                </div>
              )}

              {/* Treatment list */}
              {treatments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', borderRadius: '12px', border: `1.5px dashed ${BD}`, color: T3 }}>
                  <Stethoscope size={28} style={{ opacity: 0.2, marginBottom: '8px' }}/>
                  <p style={{ fontSize: '13px', margin: 0 }}>
                    {readOnly ? 'No se registraron tratamientos para este turno' : 'Agregá los tratamientos realizados en esta sesión'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {treatments.map((t, i) => (
                    <div key={i} style={{ borderRadius: '10px', border: `1px solid ${BD}`, backgroundColor: '#f8fafc', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: readOnly ? 0 : '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: P600, flexShrink: 0 }}/>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f1923' }}>{t.service_name}</span>
                        </div>
                        {!readOnly
                          ? <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', opacity: 0.7 }}><Trash2 size={13}/></button>
                          : t.unit_price != null && (
                            <span style={{ fontSize: '13px', fontWeight: 600, color: P600 }}>${(t.quantity * t.unit_price).toLocaleString('es-AR')}</span>
                          )
                        }
                      </div>
                      {!readOnly && (
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '3px' }}>Cant.</label>
                            <input type="number" min="1" value={t.quantity}
                              onChange={e => update(i, 'quantity', parseInt(e.target.value)||1)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '7px', border: `1px solid ${BD}`, fontSize: '13px', outline: 'none', textAlign: 'center' }}/>
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '3px' }}>Precio unit.</label>
                            <input type="number" min="0" value={t.unit_price ?? ''}
                              placeholder="0"
                              onChange={e => update(i, 'unit_price', e.target.value === '' ? null : parseFloat(e.target.value))}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '7px', border: `1px solid ${BD}`, fontSize: '13px', outline: 'none' }}/>
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '3px' }}>Notas</label>
                            <input type="text" value={t.notes}
                              onChange={e => update(i, 'notes', e.target.value)}
                              placeholder="Opcional"
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '7px', border: `1px solid ${BD}`, fontSize: '13px', outline: 'none' }}/>
                          </div>
                        </div>
                      )}
                      {readOnly && t.notes && (
                        <div style={{ fontSize: '11px', color: T3, marginTop: '4px' }}>{t.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              {treatments.length > 0 && total > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', marginTop: '12px', borderRadius: '10px', backgroundColor: `${P600}0A`, border: `1px solid ${P600}20` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={14} style={{ color: P600 }}/>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: P600 }}>Total de la sesión</span>
                  </div>
                  <span style={{ fontSize: '17px', fontWeight: 700, color: P600 }}>
                    ${total.toLocaleString('es-AR')}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!readOnly && !loading && (
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${BD}`, flexShrink: 0, display: 'flex', gap: '8px' }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, backgroundColor: '#f1f5f9', color: T2, border: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving || saved}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, backgroundColor: saved ? '#16a34a' : P600, color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', transition: 'background-color 0.2s' }}>
              {saved ? <><CheckCircle size={14}/> Guardado</> : saving ? 'Guardando…' : <><CheckCircle size={14}/> Confirmar sesión</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
