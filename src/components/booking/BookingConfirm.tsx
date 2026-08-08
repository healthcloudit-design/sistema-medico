import { useState } from 'react'
import { ChevronLeft, Calendar, Clock, UserCircle, Stethoscope, Scissors, Sparkles, PawPrint, Dumbbell, CreditCard, Building2, QrCode, CheckCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import { useOrgFeatures } from '../../hooks/useOrgFeatures'
import type { BookingState, TenantType } from '../../types'
import { Button } from '../ui/Button'

const GOLD = '#C9A96E'

interface Props {
  state: BookingState
  onChange: (partial: Partial<BookingState>) => void
  onBack: () => void
  onComplete: () => void
  tenantType?: TenantType
  accentColor?: string
  darkMode?: boolean
}

type PaymentMethod = 'presencial' | 'mercadopago' | 'modo'

function getTenantLabels(tenantType: TenantType) {
  const isPet    = tenantType === 'petshop' || tenantType === 'veterinary'
  const isBeauty = tenantType === 'beauty' || tenantType === 'estetica'
  const isCancha = tenantType === 'cancha'
  return {
    isPet, isBeauty, isCancha,
    isMedical: !isPet && !isBeauty && !isCancha,
    nombreLabel:       isPet ? 'Nombre de la mascota' : 'Nombre y apellido',
    nombrePlaceholder: isPet ? 'Ej: Firulais' : 'Ej: María González',
    dniLabel:          tenantType === 'veterinary' ? 'DNI del dueño (opcional)' : 'DNI',
    dniRequired:       tenantType === 'medical',
    showDni:           tenantType === 'medical' || tenantType === 'veterinary',
    showObraSocial:    tenantType === 'medical' || tenantType === 'veterinary',
    confirmLabel:      isPet ? 'Confirmar reserva' : isCancha ? 'Reservar cancha' : isBeauty ? 'Confirmar reserva' : 'Confirmar turno',
    observLabel:       isBeauty ? 'Algo que quieras aclarar?' : isPet ? 'Algo más sobre tu mascota?' : isCancha ? 'Cantidad de jugadores, necesitan pelota...' : 'Observaciones',
    observPlaceholder: isBeauty ? 'Alergias, preferencias, largo de cabello...' : isPet ? 'Raza, edad, peso, comportamiento, medicación...' : isCancha ? 'Cantidad de jugadores, necesitan pelota...' : 'Usa lentes? Tiene alguna condición preexistente?',
    headerLabel:      isBeauty ? 'Tus datos' : isCancha ? 'Reservar cancha' : 'Confirmá tu turno',
    profesionalLabel: isCancha ? 'Cancha' : isPet ? 'Veterinario/a' : isBeauty ? 'Con' : 'Profesional',
  }
}

function ServiceIcon({ tenantType, size = 14 }: { tenantType: TenantType; size?: number }) {
  const s = { width: size, height: size }
  if (tenantType === 'beauty')    return <Scissors    style={s} />
  if (tenantType === 'estetica')  return <Sparkles    style={s} />
  if (tenantType === 'petshop' || tenantType === 'veterinary') return <PawPrint style={s} />
  if (tenantType === 'cancha')    return <Dumbbell    style={s} />
  return <Stethoscope style={s} />
}

export function BookingConfirm({ state, onChange, onBack, onComplete, tenantType = 'medical', accentColor = '#0ea5e9', darkMode = false }: Props) {
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('presencial')
  const [redirecting, setRedirecting]     = useState(false)
  const [modoQrUrl, setModoQrUrl]         = useState<string | null>(null)
  const [modoBookingDone, setModoBookingDone] = useState(false)
  const [waitlisted, setWaitlisted]       = useState(false)

  const labels         = getTenantLabels(tenantType)
  const orgId          = state.professional?.organization_id ?? null
  const { featureMp, featureModo, modoQr, depositAmount } = useOrgFeatures(orgId)
  const servicePrice      = state.service?.price ?? 0
  // Seña fija: si la organización la tiene configurada, se pide SIEMPRE (para cualquier servicio,
  // tenga o no precio cargado) y se cobra ese monto fijo por MercadoPago — nunca el precio del
  // servicio, que además no se muestra en ningún lado del flujo de reserva.
  const isDeposit         = depositAmount != null && depositAmount > 0
  const ofrecePagoOnline  = isDeposit || ((featureMp || featureModo) && servicePrice > 0)
  const tieneObraSocial   = labels.showObraSocial && state.obra_social.trim().length > 0
  const accent            = darkMode ? GOLD : accentColor
  const dateLabel         = state.fecha ? format(parseISO(state.fecha), "EEEE d 'de' MMMM", { locale: es }) : ''

  const markPendingPago = async (appointmentId: string, provider: 'mercadopago' | 'modo') => {
    await supabase.from('appointments').update({ payment_status: 'pendiente_pago', payment_provider: provider }).eq('id', appointmentId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.service || !state.professional || !state.fecha || !state.hora) return
    if (!state.nombre.trim())   { setError(labels.nombreLabel + ' es obligatorio'); return }
    if (!state.telefono.trim()) { setError('El teléfono es obligatorio'); return }
    if (labels.dniRequired && !state.dni.trim()) { setError('El DNI es obligatorio'); return }

    setLoading(true); setError('')
    try {
      const startsAt = state.fecha + 'T' + state.hora + ':00-03:00'
      const { data: rpcResult, error: rpcError } = await supabase.rpc('reservar_turno', {
        p_professional_id:     state.professional.id,
        p_service_id:          state.service.id,
        p_starts_at:           startsAt,
        p_patient_name:        state.nombre,
        p_patient_phone:       state.telefono,
        p_patient_email:       state.email        || undefined,
        p_patient_dni:         state.dni          || undefined,
        p_patient_obra_social: state.obra_social  || undefined,
        p_patient_nro_socio:   state.nro_socio    || undefined,
        p_patient_notes:       state.observaciones || undefined,
      })
      if (rpcError) throw rpcError
      const result = rpcResult as { id?: string; status?: string; error?: string; cancellation_token?: string }
      if (result?.error === 'slot_taken') { setError('Ese horario ya fue reservado. Por favor elegí otro.'); setLoading(false); return }
      if (result?.error === 'cupo_completo') { setError('Este horario alcanzó el cupo máximo y la lista de espera también está completa. Por favor elegí otro horario.'); setLoading(false); return }
      if (result?.error === 'service_conflict') { setError('Ese horario no está disponible por un turno de otro servicio que ocupa a la profesional en ese momento. Por favor elegí otro horario.'); setLoading(false); return }
      if (result?.error) throw new Error(result.error)

      const isWaitlisted = result?.status === 'lista_espera'

      if (result?.id && state.email) {
        supabase.functions.invoke('send-confirmation', { body: { appointment_id: result.id, patient_name: state.nombre, patient_email: state.email, professional_name: state.professional.full_name, service_name: state.service.name, starts_at: startsAt, cancellation_token: result.cancellation_token, notification_type: isWaitlisted ? 'waitlist_joined' : 'confirmed' } }).catch(() => {})
      }
      if (result?.id && state.telefono && !isWaitlisted) {
        supabase.functions.invoke('send-whatsapp', { body: { appointment_id: result.id, message_type: 'confirmation' } }).catch(() => {})
      }

      if (isWaitlisted) {
        setWaitlisted(true)
        setLoading(false)
        return
      }

      if ((isDeposit || paymentMethod === 'mercadopago') && result?.id) {
        await markPendingPago(result.id, 'mercadopago')
        setRedirecting(true)
        const { data: mpData, error: mpError } = await supabase.functions.invoke('mp-create-preference', { body: { appointment_id: result.id } })
        if (!mpError && mpData?.init_point) { window.location.href = mpData.init_point; return }
        await supabase.from('appointments').update({ payment_status: null, payment_provider: null }).eq('id', result.id!)
        setRedirecting(false)
        setError('No se pudo conectar con MercadoPago. Tu turno fue reservado.')
        setTimeout(() => onComplete(), 2000)
        return
      }
      if (paymentMethod === 'modo' && result?.id) {
        await markPendingPago(result.id, 'modo')
        setModoQrUrl(modoQr ?? null)
        setModoBookingDone(true)
        setLoading(false)
        return
      }
      onComplete()
    } catch (err) {
      console.error(err)
      setError('Hubo un error al reservar. Por favor intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Waitlisted screen ─────────────────────────────────────────────────────
  if (waitlisted) {
    const bg = darkMode ? '#141414' : '#f9fafb'
    const tc = darkMode ? '#fff' : '#111827'
    const sc = darkMode ? 'rgba(255,255,255,0.5)' : '#6b7280'
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center', backgroundColor: darkMode ? '#141414' : 'transparent' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: darkMode ? 'rgba(217,119,6,0.15)' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Clock size={28} style={{ color: '#d97706' }} />
        </div>
        <h2 style={{ fontFamily: darkMode ? "'Playfair Display', Georgia, serif" : 'inherit', fontSize: '20px', fontStyle: darkMode ? 'italic' : 'normal', fontWeight: 400, color: tc, marginBottom: '8px' }}>Quedaste en lista de espera</h2>
        <p style={{ fontSize: '13px', color: sc, marginBottom: '24px', lineHeight: 1.6 }}>
          Este horario está completo por ahora. Te anotamos en la lista de espera{state.email ? ' y te avisaremos por mail' : ''} apenas se libere un lugar.
        </p>
        <button onClick={onComplete} style={{ background: 'none', border: `1px solid ${darkMode ? 'rgba(217,119,6,0.4)' : '#fde68a'}`, borderRadius: '12px', padding: '12px 24px', color: '#d97706', fontSize: '13px', fontWeight: 600, cursor: 'pointer', backgroundColor: bg }}>
          Entendido
        </button>
      </div>
    )
  }

  // ── MODO payment screen ───────────────────────────────────────────────────
  if (modoBookingDone) {
    const bg  = darkMode ? '#141414' : '#f9fafb'
    const tc  = darkMode ? '#fff' : '#111827'
    const sc  = darkMode ? 'rgba(255,255,255,0.5)' : '#6b7280'
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center', backgroundColor: darkMode ? '#141414' : 'transparent' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: darkMode ? 'rgba(201,169,110,0.12)' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle size={28} style={{ color: darkMode ? GOLD : '#16a34a' }} />
        </div>
        <h2 style={{ fontFamily: darkMode ? "'Playfair Display', Georgia, serif" : 'inherit', fontSize: '20px', fontStyle: darkMode ? 'italic' : 'normal', fontWeight: 400, color: tc, marginBottom: '8px' }}>Turno reservado</h2>
        <p style={{ fontSize: '13px', color: sc, marginBottom: '24px', lineHeight: 1.6 }}>
          Completá el pago con MODO para confirmarlo.
        </p>
        {modoQrUrl ? (
          <div style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : '#f9fafb', borderRadius: '16px', padding: '20px', display: 'inline-block', marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: sc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Escaneá con la app MODO</p>
            <img src={modoQrUrl} alt="QR MODO" style={{ width: '180px', height: '180px', borderRadius: '12px' }} />
          </div>
        ) : (
          <div style={{ backgroundColor: darkMode ? 'rgba(251,191,36,0.08)' : '#fffbeb', borderRadius: '12px', padding: '16px', marginBottom: '16px', fontSize: '13px', color: '#d97706' }}>
            <QrCode size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
            Pedile el QR de MODO al local para completar el pago.
          </div>
        )}
        <p style={{ fontSize: '11px', color: sc, marginBottom: '16px' }}>Si no pagás en 30 minutos el turno se libera.</p>
        <button onClick={onComplete} style={{ background: 'none', border: 'none', color: accent, fontSize: '13px', textDecoration: 'underline', cursor: 'pointer' }}>
          Listo, ya pagué
        </button>
      </div>
    )
  }

  // ── Common field style helpers ────────────────────────────────────────────
  const fieldBase = darkMode
    ? { width: '100%', backgroundColor: '#1C1C1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#fff', outline: 'none', boxSizing: 'border-box' as const }
    : { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'Inter, sans-serif' }

  const labelStyle = darkMode
    ? { display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', letterSpacing: '0.03em' }
    : { display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }

  const optSpan = darkMode
    ? { fontSize: '11px', color: 'rgba(255,255,255,0.28)', fontWeight: 400 }
    : { fontSize: '12px', color: '#9ca3af', fontWeight: 400 }

  return (
    <div style={{ padding: darkMode ? '24px 20px 28px' : '0' }}>

      {/* CSS for dark inputs */}
      {darkMode && (
        <style>{`
          .pf-dark-field { transition: border-color 0.2s; }
          .pf-dark-field:focus { border-color: rgba(201,169,110,0.55) !important; box-shadow: 0 0 0 3px rgba(201,169,110,0.07) !important; }
          .pf-dark-field::placeholder { color: rgba(255,255,255,0.2) !important; }
        `}</style>
      )}

      {/* Back */}
      {darkMode ? (
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', padding: '7px 14px', color: GOLD, fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer', marginBottom: '28px' }}>
          <ChevronLeft size={14} /> Volver
        </button>
      ) : (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors mb-4" style={{ color: accentColor, backgroundColor: alpha(accentColor, 0.08) }}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
      )}

      {!darkMode && <h2 className="text-lg font-semibold text-gray-900 mb-4">{labels.headerLabel}</h2>}

      {/* Booking summary */}
      <div style={{
        borderRadius: '14px', padding: '16px', marginBottom: '24px',
        backgroundColor: darkMode ? 'rgba(201,169,110,0.06)' : alpha(accentColor, 0.07),
        border: darkMode ? '1px solid rgba(201,169,110,0.18)' : 'none',
      }}>
        {[
          { icon: <ServiceIcon tenantType={tenantType} />, main: state.service?.name, sub: `${state.service?.display_duration_minutes ?? state.service?.duration_minutes} min` },
          { icon: <UserCircle size={14} />, main: state.professional?.full_name, sub: state.professional?.specialty },
          { icon: <Calendar size={14} />, main: dateLabel, sub: null },
          { icon: <Clock size={14} />, main: state.hora ? `${state.hora}hs` : '', sub: null },
        ].map(({ icon, main, sub }, i) => main ? (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
            <span style={{ color: accent, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: darkMode ? '#fff' : '#111827', fontWeight: 500, textTransform: 'capitalize' }}>{main}</span>
            {sub && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: darkMode ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>{sub}</span>}
          </div>
        ) : null)}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Nombre */}
        <div>
          <label style={labelStyle}>{labels.nombreLabel} <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={state.nombre} onChange={e => onChange({ nombre: e.target.value })} placeholder={labels.nombrePlaceholder}
            className={darkMode ? 'pf-dark-field' : ''} style={fieldBase} />
        </div>

        {/* Dueño (mascotas) */}
        {labels.isPet && (
          <div>
            <label style={labelStyle}>Nombre del dueño <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="text" value={state.observaciones} onChange={e => onChange({ observaciones: e.target.value })} placeholder="Ej: Juan Pérez"
              className={darkMode ? 'pf-dark-field' : ''} style={fieldBase} />
          </div>
        )}

        {/* Teléfono */}
        <div>
          <label style={labelStyle}>Teléfono / WhatsApp <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="tel" value={state.telefono} onChange={e => onChange({ telefono: e.target.value })} placeholder="Ej: +54 11 1234-5678"
            className={darkMode ? 'pf-dark-field' : ''} style={fieldBase} />
        </div>

        {/* DNI */}
        {labels.showDni && (
          <div>
            <label style={labelStyle}>{labels.dniLabel} {labels.dniRequired ? <span style={{ color: '#ef4444' }}>*</span> : <span style={optSpan}>(opcional)</span>}</label>
            <input type="text" value={state.dni} onChange={e => onChange({ dni: e.target.value })} placeholder="Ej: 30123456"
              className={darkMode ? 'pf-dark-field' : ''} style={fieldBase} />
          </div>
        )}

        {/* Email */}
        <div>
          <label style={labelStyle}>Email <span style={optSpan}>(opcional)</span></label>
          <input type="email" value={state.email} onChange={e => onChange({ email: e.target.value })} placeholder="Ej: juan@email.com"
            className={darkMode ? 'pf-dark-field' : ''} style={fieldBase} />
        </div>

        {/* Obra social */}
        {labels.showObraSocial && (
          <>
            <div>
              <label style={labelStyle}>Obra social <span style={optSpan}>(opcional)</span></label>
              <input type="text" value={state.obra_social} onChange={e => onChange({ obra_social: e.target.value, nro_socio: e.target.value ? state.nro_socio : '' })} placeholder="Ej: OSDE, Swiss Medical, PAMI..."
                className={darkMode ? 'pf-dark-field' : ''} style={fieldBase} />
            </div>
            {tieneObraSocial && (
              <div>
                <label style={labelStyle}>N° de socio / carnet <span style={optSpan}>(opcional)</span></label>
                <input type="text" value={state.nro_socio} onChange={e => onChange({ nro_socio: e.target.value })} placeholder="Ej: 0012345678"
                  className={darkMode ? 'pf-dark-field' : ''} style={fieldBase} />
                <p style={{ fontSize: '11px', color: '#d97706', marginTop: '6px', fontFamily: 'Inter, sans-serif' }}>Tu turno quedará pendiente hasta verificar la cobertura.</p>
              </div>
            )}
          </>
        )}

        {/* Observaciones */}
        {!labels.isPet && (
          <div>
            <label style={labelStyle}>{labels.observLabel} <span style={optSpan}>(opcional)</span></label>
            <textarea value={state.observaciones} onChange={e => onChange({ observaciones: e.target.value })} placeholder={labels.observPlaceholder} rows={3}
              className={darkMode ? 'pf-dark-field' : ''}
              style={{ ...fieldBase, resize: 'none' as const }} />
          </div>
        )}

        {/* Mascota info */}
        {labels.isPet && (
          <div>
            <label style={labelStyle}>Info de la mascota <span style={optSpan}>(opcional)</span></label>
            <textarea value={state.nro_socio} onChange={e => onChange({ nro_socio: e.target.value })} placeholder="Raza, edad, peso, medicación, comportamiento..." rows={3}
              className={darkMode ? 'pf-dark-field' : ''}
              style={{ ...fieldBase, resize: 'none' as const }} />
          </div>
        )}

        {/* Seña obligatoria (monto fijo, nunca se muestra el precio del servicio) */}
        {isDeposit && !tieneObraSocial && (
          <div style={{
            border: darkMode ? '1px solid rgba(201,169,110,0.25)' : `1px solid ${alpha(accentColor, 0.3)}`,
            borderRadius: '14px', padding: '14px 16px',
            backgroundColor: darkMode ? 'rgba(201,169,110,0.06)' : alpha(accentColor, 0.06),
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <CreditCard size={18} style={{ color: accent, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: darkMode ? '#fff' : '#111827' }}>
                Seña para reservar: ${depositAmount!.toLocaleString('es-AR')}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: darkMode ? 'rgba(255,255,255,0.45)' : '#6b7280', marginTop: '2px' }}>
                Se paga con MercadoPago para confirmar el turno.
              </div>
            </div>
          </div>
        )}

        {/* Payment selector (solo cuando NO hay seña fija, comportamiento original) */}
        {!isDeposit && ofrecePagoOnline && !tieneObraSocial && (
          <div style={{
            border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
            borderRadius: '14px', overflow: 'hidden',
            backgroundColor: darkMode ? '#141414' : 'transparent',
          }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, color: darkMode ? 'rgba(255,255,255,0.35)' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 16px 8px' }}>
              ¿Cómo querés abonar?
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: featureMp && featureModo ? '1fr 1fr 1fr' : '1fr 1fr',
              borderTop: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e5e7eb',
            }}>
              {[
                { id: 'presencial' as const, icon: <Building2 size={18} />, label: 'En el lugar', price: null },
                ...(featureMp ? [{ id: 'mercadopago' as const, icon: <CreditCard size={18} />, label: 'MercadoPago', price: servicePrice }] : []),
                ...(featureModo ? [{ id: 'modo' as const, icon: <QrCode size={18} />, label: 'MODO', price: servicePrice }] : []),
              ].map((opt, i, arr) => {
                const isSel = paymentMethod === opt.id
                return (
                  <button key={opt.id} type="button" onClick={() => setPaymentMethod(opt.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '14px 8px',
                      fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: 'none',
                      borderRight: i < arr.length - 1 ? (darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e5e7eb') : 'none',
                      backgroundColor: isSel ? (darkMode ? 'rgba(201,169,110,0.08)' : alpha(accentColor, 0.08)) : 'transparent',
                      color: isSel ? accent : (darkMode ? 'rgba(255,255,255,0.4)' : '#6b7280'),
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                    {opt.price != null && <span style={{ fontSize: '10px', opacity: 0.65 }}>${opt.price.toLocaleString('es-AR')}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: darkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: darkMode ? '1px solid rgba(239,68,68,0.2)' : 'none', borderRadius: '10px', padding: '12px 14px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: darkMode ? '#fca5a5' : '#b91c1c' }}>
            {error}
          </div>
        )}

        {redirecting && (
          <div style={{ backgroundColor: darkMode ? 'rgba(201,169,110,0.08)' : alpha(accentColor, 0.08), borderRadius: '10px', padding: '12px 14px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: accent, textAlign: 'center' }}>
            Redirigiendo a MercadoPago...
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || redirecting}
          style={{
            width: '100%', border: 'none', borderRadius: '12px', padding: '16px',
            fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', letterSpacing: '0.04em', cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: loading ? (darkMode ? 'rgba(201,169,110,0.4)' : alpha(accentColor, 0.5)) : (darkMode ? GOLD : accentColor),
            color: darkMode ? '#0B0B0B' : '#fff',
            transition: 'opacity 0.2s',
          }}
        >
          {loading
            ? 'Reservando...'
            : isDeposit ? `Reservar y pagar seña ($${depositAmount!.toLocaleString('es-AR')})`
            : paymentMethod === 'mercadopago' ? 'Reservar y pagar con MercadoPago'
            : paymentMethod === 'modo' ? 'Reservar y pagar con MODO'
            : labels.confirmLabel}
        </button>
      </form>
    </div>
  )
}
