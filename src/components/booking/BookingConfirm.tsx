import { useState } from 'react'
import { ChevronLeft, Calendar, Clock, UserCircle, Stethoscope, Scissors, Sparkles, PawPrint, Dumbbell, CreditCard, Building2, QrCode, CheckCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import { useOrgFeatures } from '../../hooks/useOrgFeatures'
import type { BookingState, TenantType } from '../../types'
import { Button } from '../ui/Button'

interface Props {
  state: BookingState
  onChange: (partial: Partial<BookingState>) => void
  onBack: () => void
  onComplete: () => void
  tenantType?: TenantType
  accentColor?: string
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
    nombrePlaceholder: isPet ? 'Ej: Firulais' : 'Ej: Maria Gonzalez',
    dniLabel:          tenantType === 'veterinary' ? 'DNI del dueno (opcional)' : 'DNI',
    dniRequired:       tenantType === 'medical',
    showDni:           tenantType === 'medical' || tenantType === 'veterinary',
    showObraSocial:    tenantType === 'medical' || tenantType === 'veterinary',
    confirmLabel:      isPet ? 'Confirmar reserva' : isCancha ? 'Reservar cancha' : isBeauty ? 'Confirmar reserva' : 'Confirmar turno',
    observLabel:       isBeauty ? 'Algo que quieras aclarar?' : isPet ? 'Algo mas sobre tu mascota?' : isCancha ? 'Cantidad de jugadores, necesitan pelota...' : 'Observaciones',
    observPlaceholder: isBeauty
      ? 'Alergias, preferencias, largo de cabello...'
      : isPet ? 'Raza, edad, peso, comportamiento, medicacion...'
      : isCancha ? 'Cantidad de jugadores, necesitan pelota...'
      : 'Usa lentes? Tiene alguna condicion preexistente?',
    headerLabel:      isBeauty ? 'Confirma tu reserva' : isCancha ? 'Reserva tu cancha' : 'Confirme su turno',
    profesionalLabel: isCancha ? 'Cancha' : isPet ? 'Veterinario/a' : isBeauty ? 'Con' : 'Profesional',
  }
}

function ServiceIcon({ tenantType, className }: { tenantType: TenantType; className: string }) {
  if (tenantType === 'beauty')    return <Scissors  className={className} />
  if (tenantType === 'estetica')  return <Sparkles  className={className} />
  if (tenantType === 'petshop' || tenantType === 'veterinary') return <PawPrint className={className} />
  if (tenantType === 'cancha')    return <Dumbbell  className={className} />
  return <Stethoscope className={className} />
}

export function BookingConfirm({ state, onChange, onBack, onComplete, tenantType = 'medical', accentColor = '#0ea5e9' }: Props) {
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('presencial')
  const [redirecting, setRedirecting]   = useState(false)
  const [modoQrUrl, setModoQrUrl]       = useState<string | null>(null)
  const [modoBookingDone, setModoBookingDone] = useState(false)

  const labels = getTenantLabels(tenantType)
  const orgId        = state.professional?.organization_id ?? null
  const { featureMp, featureModo, modoQr } = useOrgFeatures(orgId)
  const servicePrice    = state.service?.price ?? 0
  const ofrecePagoOnline = (featureMp || featureModo) && servicePrice > 0
  const tieneObraSocial  = labels.showObraSocial && state.obra_social.trim().length > 0

  const markPendingPago = async (appointmentId: string, provider: 'mercadopago' | 'modo') => {
    await supabase
      .from('appointments')
      .update({ payment_status: 'pendiente_pago', payment_provider: provider })
      .eq('id', appointmentId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.service || !state.professional || !state.fecha || !state.hora) return
    if (!state.nombre.trim())   { setError(labels.nombreLabel + ' es obligatorio'); return }
    if (!state.telefono.trim()) { setError('El telefono es obligatorio'); return }
    if (labels.dniRequired && !state.dni.trim()) { setError('El DNI es obligatorio'); return }
    // nro_socio es opcional — no bloqueamos si falta

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
      const result = rpcResult as { id?: string; error?: string; cancellation_token?: string }
      if (result?.error === 'slot_taken') {
        setError('Ese horario ya fue reservado. Por favor elegi otro.'); setLoading(false); return
      }
      if (result?.error) throw new Error(result.error)

      // Notificaciones (fire and forget)
      if (result?.id && state.email) {
        supabase.functions.invoke('send-confirmation', {
          body: { appointment_id: result.id, patient_name: state.nombre, patient_email: state.email,
            professional_name: state.professional.full_name, service_name: state.service.name,
            starts_at: startsAt, cancellation_token: result.cancellation_token },
        }).catch(() => {})
      }
      if (result?.id && state.telefono) {
        supabase.functions.invoke('send-whatsapp', {
          body: { appointment_id: result.id, message_type: 'confirmation' },
        }).catch(() => {})
      }

      // ── Flujo por medio de pago ──────────────────────────────

      if (paymentMethod === 'mercadopago' && result?.id) {
        // Marcar como pendiente_pago ANTES de redirigir
        await markPendingPago(result.id, 'mercadopago')
        setRedirecting(true)
        const { data: mpData, error: mpError } = await supabase.functions.invoke('mp-create-preference', {
          body: { appointment_id: result.id },
        })
        if (!mpError && mpData?.init_point) {
          window.location.href = mpData.init_point
          return
        }
        // Si MP falla, revertir a presencial
        await supabase.from('appointments').update({ payment_status: null, payment_provider: null }).eq('id', result.id!)
        setRedirecting(false)
        setError('No se pudo conectar con MercadoPago. Tu turno fue reservado sin pago.')
        setTimeout(() => onComplete(), 2000)
        return
      }

      if (paymentMethod === 'modo' && result?.id) {
        await markPendingPago(result.id, 'modo')
        // Buscar QR de MODO de la org
        const qr = modoQr ?? null
        setModoQrUrl(qr)
        setModoBookingDone(true)
        setLoading(false)
        return
      }

      // Presencial: flujo normal
      onComplete()
    } catch (err) {
      console.error(err)
      setError('Hubo un error al reservar. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const dateLabel = state.fecha ? format(parseISO(state.fecha), "EEEE d 'de' MMMM", { locale: es }) : ''

  // ── Pantalla de pago con MODO ───────────────────────────────
  if (modoBookingDone) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Turno reservado!</h2>
        <p className="text-sm text-gray-500 mb-5">
          Tu turno esta apartado. Completá el pago con MODO para confirmarlo.
        </p>

        {modoQrUrl ? (
          <div className="bg-gray-50 rounded-2xl p-4 mb-4 inline-block">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Escaneá con la app MODO
            </p>
            <img src={modoQrUrl} alt="QR MODO" className="w-48 h-48 mx-auto rounded-xl" />
          </div>
        ) : (
          <div className="bg-amber-50 rounded-2xl p-4 mb-4 text-sm text-amber-700">
            <QrCode className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            Pedile el QR de MODO al local para completar el pago.
          </div>
        )}

        <p className="text-xs text-gray-400 mb-5">
          Si no pagás en los próximos 30 minutos el turno se libera automáticamente.
        </p>
        <button
          onClick={onComplete}
          className="text-sm text-sky-600 underline"
        >
          Listo, ya pagué
        </button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors mb-4" style={{ color: accentColor, backgroundColor: alpha(accentColor, 0.08) }}>
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{labels.headerLabel}</h2>

      {/* Resumen del turno */}
      <div className="rounded-2xl p-4 mb-5 space-y-2.5" style={{ backgroundColor: alpha(accentColor, 0.07) }}>
        <div className="flex items-center gap-3 text-sm">
          <span style={{ color: accentColor }} className="flex-shrink-0"><ServiceIcon tenantType={tenantType} className="w-4 h-4" /></span>
          <span className="font-medium text-gray-900">{state.service?.name}</span>
          <span className="text-gray-400 text-xs">{state.service?.duration_minutes} min</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <UserCircle className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          <span className="text-gray-900">{state.professional?.full_name}</span>
          {!labels.isCancha && state.professional?.specialty && (
            <span className="text-gray-400 text-xs">{state.professional.specialty}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          <span className="capitalize text-gray-900">{dateLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Clock className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          <span className="text-gray-900">{state.hora}hs</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {labels.nombreLabel} <span className="text-red-500">*</span>
          </label>
          <input type="text" value={state.nombre} onChange={e => onChange({ nombre: e.target.value })}
            placeholder={labels.nombrePlaceholder}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
        </div>

        {/* Dueno (mascotas) */}
        {labels.isPet && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre del dueno <span className="text-red-500">*</span>
            </label>
            <input type="text" value={state.observaciones} onChange={e => onChange({ observaciones: e.target.value })}
              placeholder="Ej: Juan Perez"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>
        )}

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Telefono / WhatsApp <span className="text-red-500">*</span>
          </label>
          <input type="tel" value={state.telefono} onChange={e => onChange({ telefono: e.target.value })}
            placeholder="Ej: +54 11 1234-5678"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
        </div>

        {/* DNI */}
        {labels.showDni && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {labels.dniLabel}{' '}
              {labels.dniRequired
                ? <span className="text-red-500">*</span>
                : <span className="text-gray-400 text-xs font-normal">(opcional)</span>}
            </label>
            <input type="text" value={state.dni} onChange={e => onChange({ dni: e.target.value })}
              placeholder="Ej: 30123456"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email <span className="text-gray-400 text-xs font-normal">(opcional)</span>
          </label>
          <input type="email" value={state.email} onChange={e => onChange({ email: e.target.value })}
            placeholder="Ej: juan@email.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
        </div>

        {/* Obra social */}
        {labels.showObraSocial && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Obra social <span className="text-gray-400 text-xs font-normal">(opcional)</span>
              </label>
              <input type="text" value={state.obra_social}
                onChange={e => onChange({ obra_social: e.target.value, nro_socio: e.target.value ? state.nro_socio : '' })}
                placeholder="Ej: OSDE, Swiss Medical, PAMI..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
            </div>
            {tieneObraSocial && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  No de socio / carnet <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input type="text" value={state.nro_socio} onChange={e => onChange({ nro_socio: e.target.value })}
                  placeholder="Ej: 0012345678"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                <p className="text-xs text-amber-600 mt-1.5">Tu turno quedara pendiente hasta verificar la cobertura.</p>
              </div>
            )}
          </>
        )}

        {/* Observaciones */}
        {!labels.isPet && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {labels.observLabel} <span className="text-gray-400 text-xs font-normal">(opcional)</span>
            </label>
            <textarea value={state.observaciones} onChange={e => onChange({ observaciones: e.target.value })}
              placeholder={labels.observPlaceholder} rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" />
          </div>
        )}

        {/* Info mascota */}
        {labels.isPet && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Info de la mascota <span className="text-gray-400 text-xs font-normal">(opcional)</span>
            </label>
            <textarea value={state.nro_socio} onChange={e => onChange({ nro_socio: e.target.value })}
              placeholder="Raza, edad, peso, medicacion, comportamiento..." rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" />
          </div>
        )}

        {/* ── Selector de medio de pago ── */}
        {ofrecePagoOnline && !tieneObraSocial && (
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
              Como queres abonar?
            </p>
            <div className={['grid gap-0 divide-x divide-gray-200 border-t border-gray-200',
              featureMp && featureModo ? 'grid-cols-3' : 'grid-cols-2'].join(' ')}>

              {/* Presencial */}
              <button type="button" onClick={() => setPaymentMethod('presencial')}
                className={['flex flex-col items-center gap-1.5 py-4 text-sm font-medium transition-colors',
                  paymentMethod === 'presencial' ? '' : 'text-gray-500 hover:bg-gray-50'].join(' ')}
                style={paymentMethod === 'presencial' ? { backgroundColor: alpha(accentColor, 0.08), color: accentColor } : {}}>
                <Building2 className="w-5 h-5" />
                En el lugar
              </button>

              {/* MercadoPago */}
              {featureMp && (
                <button type="button" onClick={() => setPaymentMethod('mercadopago')}
                  className={['flex flex-col items-center gap-1.5 py-4 text-sm font-medium transition-colors',
                    paymentMethod === 'mercadopago' ? '' : 'text-gray-500 hover:bg-gray-50'].join(' ')}
                  style={paymentMethod === 'mercadopago' ? { backgroundColor: alpha(accentColor, 0.08), color: accentColor } : {}}>
                  <CreditCard className="w-5 h-5" />
                  MercadoPago
                  <span className="text-xs font-normal text-gray-400">${servicePrice.toLocaleString('es-AR')}</span>
                </button>
              )}

              {/* MODO */}
              {featureModo && (
                <button type="button" onClick={() => setPaymentMethod('modo')}
                  className={['flex flex-col items-center gap-1.5 py-4 text-sm font-medium transition-colors',
                    paymentMethod === 'modo' ? '' : 'text-gray-500 hover:bg-gray-50'].join(' ')}
                  style={paymentMethod === 'modo' ? { backgroundColor: alpha(accentColor, 0.08), color: accentColor } : {}}>
                  <QrCode className="w-5 h-5" />
                  MODO
                  <span className="text-xs font-normal text-gray-400">${servicePrice.toLocaleString('es-AR')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
        {redirecting && (
          <div className="text-sm px-4 py-3 rounded-xl text-center" style={{ backgroundColor: alpha(accentColor, 0.08), color: accentColor }}>
            Redirigiendo a MercadoPago...
          </div>
        )}

        <Button type="submit" loading={loading || redirecting} size="lg" className="w-full" style={{ backgroundColor: accentColor }}>
          {paymentMethod === 'mercadopago'
            ? 'Reservar y pagar con MercadoPago'
            : paymentMethod === 'modo'
              ? 'Reservar y pagar con MODO'
              : labels.confirmLabel}
        </Button>
      </form>
    </div>
  )
}
