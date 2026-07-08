import { useEffect, useState, useRef } from 'react'
import {
  FileText, X, Loader2, Save, Plus, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, Lock,
  Paperclip, Download, Activity, Clock, Printer,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getTemplateForSpecialty, ALERT_KEYWORDS } from './clinicalTemplates'
import type { TemplateQuestion, QuestionType } from './clinicalTemplates'

// ─── Types ───────────────────────────────────────────────────
interface Question {
  id: string
  question_text: string
  question_type: QuestionType
  display_order: number
}

interface VitalSigns {
  id?: string
  weight_kg?: number | null
  height_cm?: number | null
  blood_pressure?: string | null
  heart_rate?: number | null
  temperature_c?: number | null
  oxygen_sat?: number | null
}

interface Attachment {
  id: string
  file_name: string
  file_path: string
  file_type: string
  file_size?: number
  label?: string
  created_at: string
}

interface ConsultationNote {
  id: string
  motivo: string
  diagnostico: string | null
  indicaciones: string | null
  notas: string | null
  is_closed: boolean
  closed_at: string | null
  created_at: string
}

interface Props {
  appointmentId: string
  patientId: string | null
  professionalId: string
  organizationId: string
  patientName: string
  specialty?: string | null
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ─── PDF Export ──────────────────────────────────────────────
function exportPDF(
  patientName: string,
  note: ConsultationNote | null,
  vitals: VitalSigns,
  questions: Question[],
  answers: Record<string, string>,
) {
  const vitalsHtml = [
    vitals.weight_kg    ? `<b>Peso:</b> ${vitals.weight_kg} kg` : '',
    vitals.height_cm    ? `<b>Talla:</b> ${vitals.height_cm} cm` : '',
    vitals.blood_pressure ? `<b>TA:</b> ${vitals.blood_pressure} mmHg` : '',
    vitals.heart_rate   ? `<b>FC:</b> ${vitals.heart_rate} lpm` : '',
    vitals.temperature_c ? `<b>Temp:</b> ${vitals.temperature_c} °C` : '',
    vitals.oxygen_sat   ? `<b>SpO₂:</b> ${vitals.oxygen_sat}%` : '',
  ].filter(Boolean).join(' &nbsp;|&nbsp; ')

  const anamnesisHtml = questions
    .filter(q => answers[q.id])
    .map(q => `<tr><td style="font-weight:600;padding:4px 8px 4px 0;vertical-align:top;color:#374151;">${q.question_text}</td><td style="padding:4px 0;color:#111827;">${answers[q.id]}</td></tr>`)
    .join('')

  const html = `
    <!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Historia Clínica – ${patientName}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 40px; }
      h1 { font-size: 18px; color: #1e40af; margin-bottom: 4px; }
      h2 { font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-top: 24px; }
      .meta { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
      .vitals { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      .field { margin-bottom: 12px; }
      .label { font-weight: 600; color: #374151; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
      .value { margin-top: 3px; line-height: 1.5; }
      @media print { body { margin: 20px; } }
    </style>
    </head><body>
    <h1>Historia Clínica</h1>
    <div class="meta">
      <b>Paciente:</b> ${patientName} &nbsp;|&nbsp;
      <b>Fecha:</b> ${note ? fmtDate(note.created_at) : new Date().toLocaleDateString('es-AR')}
    </div>

    ${vitalsHtml ? `<div class="vitals"><b>Signos vitales:</b> &nbsp; ${vitalsHtml}</div>` : ''}

    ${anamnesisHtml ? `
    <h2>Anamnesis</h2>
    <table>${anamnesisHtml}</table>` : ''}

    ${note ? `
    <h2>Evolución del turno</h2>
    <div class="field"><div class="label">Motivo</div><div class="value">${note.motivo}</div></div>
    ${note.diagnostico ? `<div class="field"><div class="label">Diagnóstico</div><div class="value">${note.diagnostico}</div></div>` : ''}
    ${note.indicaciones ? `<div class="field"><div class="label">Indicaciones</div><div class="value">${note.indicaciones}</div></div>` : ''}
    ${note.notas ? `<div class="field"><div class="label">Notas</div><div class="value">${note.notas}</div></div>` : ''}
    ` : ''}

    <div style="margin-top:48px;border-top:1px solid #e5e7eb;padding-top:12px;font-size:11px;color:#9ca3af;">
      Generado por PRAXIS Agenda · ${new Date().toLocaleString('es-AR')}
    </div>
    </body></html>
  `

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.print() }
}

// ─── Component ───────────────────────────────────────────────
export function ClinicalRecordModal({
  appointmentId, patientId, professionalId, organizationId, patientName, specialty, onClose,
}: Props) {
  const [tab, setTab] = useState<'hc' | 'turno' | 'historial'>('hc')
  const [loading, setLoading] = useState(true)

  // ── Historia Clínica ──
  const [questions, setQuestions]   = useState<Question[]>([])
  const [answers, setAnswers]       = useState<Record<string, string>>({})
  const [alerts, setAlerts]         = useState<string[]>([])
  const [savingHC, setSavingHC]     = useState(false)
  const [savedHC, setSavedHC]       = useState(false)
  const [addingQ, setAddingQ]       = useState(false)
  const [newQText, setNewQText]     = useState('')
  const [newQType, setNewQType]     = useState<QuestionType>('text')
  const newQRef = useRef<HTMLInputElement>(null)

  // ── Signos vitales ──
  const [vitals, setVitals]         = useState<VitalSigns>({})
  const [savingVitals, setSavingVitals] = useState(false)
  const [savedVitals, setSavedVitals]   = useState(false)

  // ── Turno ──
  const [note, setNote]             = useState<ConsultationNote | null>(null)
  const [motivo, setMotivo]         = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [indicaciones, setIndicaciones] = useState('')
  const [notas, setNotas]           = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [savedNote, setSavedNote]   = useState(false)
  const [closing, setClosing]       = useState(false)

  // ── Adjuntos ──
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Historial ──
  const [history, setHistory]         = useState<ConsultationNote[]>([])
  const [expandedHist, setExpandedHist] = useState<string | null>(null)

  // ─── Load ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const [questRes, noteRes, vitalsRes, attachRes] = await Promise.all([
        supabase.from('professional_questions')
          .select('id, question_text, question_type, display_order')
          .eq('professional_id', professionalId).eq('active', true).order('display_order'),

        supabase.from('clinical_records')
          .select('*').eq('appointment_id', appointmentId).maybeSingle(),

        supabase.from('vital_signs')
          .select('*').eq('appointment_id', appointmentId).maybeSingle(),

        supabase.from('appointment_attachments')
          .select('*').eq('appointment_id', appointmentId).order('created_at'),
      ])

      const qs: Question[] = (questRes.data ?? []) as Question[]
      setQuestions(qs)

      // Cargar respuestas de anamnesis
      if (patientId && qs.length > 0) {
        const { data: ansData } = await supabase
          .from('patient_anamnesis')
          .select('question_id, answer')
          .eq('patient_id', patientId)
          .eq('professional_id', professionalId)

        const map: Record<string, string> = {}
        ;(ansData ?? []).forEach((r: { question_id: string; answer: string | null }) => {
          map[r.question_id] = r.answer ?? ''
        })
        setAnswers(map)
        computeAlerts(qs, map)
      }

      // Signos vitales
      if (vitalsRes.data) setVitals(vitalsRes.data as VitalSigns)

      // Evolución
      if (noteRes.data) {
        const r = noteRes.data as ConsultationNote
        setNote(r)
        setMotivo(r.motivo)
        setDiagnostico(r.diagnostico ?? '')
        setIndicaciones(r.indicaciones ?? '')
        setNotas(r.notas ?? '')
      }

      // Adjuntos
      setAttachments((attachRes.data ?? []) as Attachment[])

      // Historial previo
      if (patientId) {
        const { data: hist } = await supabase
          .from('clinical_records')
          .select('id, motivo, diagnostico, indicaciones, notas, is_closed, closed_at, created_at')
          .eq('patient_id', patientId)
          .eq('professional_id', professionalId)
          .neq('appointment_id', appointmentId)
          .order('created_at', { ascending: false })
          .limit(10)
        setHistory((hist ?? []) as ConsultationNote[])
      }

      setLoading(false)
    }
    load()
  }, [appointmentId, patientId, professionalId])

  useEffect(() => { if (addingQ) setTimeout(() => newQRef.current?.focus(), 50) }, [addingQ])

  // ─── Alertas clínicas ─────────────────────────────────────
  const computeAlerts = (qs: Question[], ans: Record<string, string>) => {
    const found: string[] = []
    qs.forEach(q => {
      const lower = q.question_text.toLowerCase()
      const isAlert = ALERT_KEYWORDS.some(kw => lower.includes(kw))
      if (isAlert && ans[q.id]?.toLowerCase().startsWith('sí')) {
        found.push(q.question_text)
      }
    })
    setAlerts(found)
  }

  const onAnswerChange = (qid: string, val: string) => {
    const next = { ...answers, [qid]: val }
    setAnswers(next)
    computeAlerts(questions, next)
  }

  // ─── Template de especialidad ─────────────────────────────
  const loadTemplate = async () => {
    const template: TemplateQuestion[] = getTemplateForSpecialty(specialty)
    const inserts = template.map((t, i) => ({
      professional_id: professionalId,
      question_text: t.question_text,
      question_type: t.question_type,
      display_order: i,
    }))
    const { data } = await supabase
      .from('professional_questions')
      .insert(inserts)
      .select('id, question_text, question_type, display_order')
    if (data) setQuestions(data as Question[])
  }

  // ─── Anamnesis: agregar pregunta ──────────────────────────
  const addQuestion = async () => {
    if (!newQText.trim()) return
    const { data } = await supabase
      .from('professional_questions')
      .insert({ professional_id: professionalId, question_text: newQText.trim(), question_type: newQType, display_order: questions.length })
      .select('id, question_text, question_type, display_order')
      .single()
    if (data) setQuestions(prev => [...prev, data as Question])
    setNewQText('')
    setNewQType('text')
    setAddingQ(false)
  }

  const deleteQuestion = async (id: string) => {
    await supabase.from('professional_questions').update({ active: false }).eq('id', id)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  // ─── Guardar anamnesis ────────────────────────────────────
  const saveAnamnesis = async () => {
    if (!patientId || questions.length === 0) return
    setSavingHC(true)
    await supabase.from('patient_anamnesis').upsert(
      questions.map(q => ({
        patient_id: patientId, professional_id: professionalId,
        organization_id: organizationId, question_id: q.id, answer: answers[q.id] ?? null,
      })),
      { onConflict: 'patient_id,question_id' }
    )
    setSavingHC(false)
    setSavedHC(true)
    setTimeout(() => setSavedHC(false), 2000)
  }

  // ─── Guardar signos vitales ───────────────────────────────
  const saveVitals = async () => {
    if (!patientId) return
    setSavingVitals(true)
    const payload = {
      appointment_id: appointmentId, patient_id: patientId,
      professional_id: professionalId, organization_id: organizationId,
      ...vitals,
    }
    if (vitals.id) {
      await supabase.from('vital_signs').update(payload).eq('id', vitals.id)
    } else {
      const { data } = await supabase.from('vital_signs').insert(payload).select('id').single()
      if (data) setVitals(v => ({ ...v, id: data.id }))
    }
    setSavingVitals(false)
    setSavedVitals(true)
    setTimeout(() => setSavedVitals(false), 2000)
  }

  // ─── Guardar evolución ────────────────────────────────────
  const saveNote = async () => {
    if (!motivo.trim() || note?.is_closed) return
    setSavingNote(true)
    const payload = {
      appointment_id: appointmentId, patient_id: patientId,
      professional_id: professionalId, organization_id: organizationId,
      motivo, diagnostico: diagnostico || null,
      indicaciones: indicaciones || null, notas: notas || null,
    }
    if (note) {
      await supabase.from('clinical_records')
        .update({ motivo, diagnostico: diagnostico || null, indicaciones: indicaciones || null, notas: notas || null })
        .eq('id', note.id)
    } else {
      const { data } = await supabase.from('clinical_records').insert(payload).select('*').single()
      if (data) setNote(data as ConsultationNote)
    }
    setSavingNote(false)
    setSavedNote(true)
    setTimeout(() => setSavedNote(false), 2000)
  }

  // ─── Cerrar turno ─────────────────────────────────────────
  const closeNote = async () => {
    if (!note || note.is_closed) return
    setClosing(true)
    await supabase.from('clinical_records')
      .update({ is_closed: true, closed_at: new Date().toISOString() })
      .eq('id', note.id)
    setNote(n => n ? { ...n, is_closed: true, closed_at: new Date().toISOString() } : n)
    setClosing(false)
  }

  // ─── Adjuntos ─────────────────────────────────────────────
  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !patientId) return
    setUploading(true)
    const path = `${organizationId}/${patientId}/${appointmentId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('clinical-attachments').upload(path, file)
    if (!error) {
      const { data: rec } = await supabase.from('appointment_attachments')
        .insert({
          appointment_id: appointmentId, patient_id: patientId,
          professional_id: professionalId, organization_id: organizationId,
          file_name: file.name, file_path: path,
          file_type: file.type, file_size: file.size,
        })
        .select('*').single()
      if (rec) setAttachments(prev => [...prev, rec as Attachment])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const downloadFile = async (att: Attachment) => {
    const { data } = await supabase.storage.from('clinical-attachments').createSignedUrl(att.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const deleteAttachment = async (att: Attachment) => {
    await supabase.storage.from('clinical-attachments').remove([att.file_path])
    await supabase.from('appointment_attachments').delete().eq('id', att.id)
    setAttachments(prev => prev.filter(a => a.id !== att.id))
  }

  // ─── Render input anamnesis ───────────────────────────────
  const renderInput = (q: Question) => {
    const val = answers[q.id] ?? ''
    const set = (v: string) => onAnswerChange(q.id, v)

    if (q.question_type === 'boolean') {
      const base = val.startsWith('Sí') ? 'Sí' : val.startsWith('No') ? 'No' : ''
      const detail = val.replace(/^(Sí|No)\s*[–-]?\s*/, '')
      return (
        <div className="mt-1 flex flex-wrap gap-2 items-center">
          {['Sí', 'No'].map(opt => (
            <button key={opt} type="button" onClick={() => set(opt)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all
                ${base === opt ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'}`}>
              {opt}
            </button>
          ))}
          {base === 'Sí' && (
            <input type="text" value={detail} placeholder="Especificar..."
              onChange={e => set(`Sí – ${e.target.value}`)}
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          )}
        </div>
      )
    }

    if (q.question_type === 'number') {
      return (
        <input type="number" value={val} onChange={e => set(e.target.value)}
          className="mt-1 w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
      )
    }

    return (
      <textarea value={val} onChange={e => set(e.target.value)} rows={2} placeholder="Respuesta..."
        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500" />
    )
  }

  // ─── UI ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600" />
            <h3 className="font-semibold text-gray-900 truncate">{patientName}</h3>
            {note?.is_closed && (
              <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" /> Cerrado
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(note || questions.length > 0) && (
              <button
                onClick={() => exportPDF(patientName, note, vitals, questions, answers)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                title="Exportar PDF"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alertas clínicas */}
        {alerts.length > 0 && (
          <div className="mx-5 mt-3 flex-shrink-0 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Alertas clínicas</p>
              {alerts.map(a => (
                <p key={a} className="text-sm text-red-700">• {a}</p>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mx-5 mt-3 flex-shrink-0">
          {([
            { key: 'hc',       label: 'Historia Clínica' },
            { key: 'turno',    label: 'Este turno' },
            { key: 'historial', label: 'Historial' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
            </div>
          ) : tab === 'hc' ? (

            /* ── TAB: HISTORIA CLÍNICA ── */
            <div className="space-y-5">

              {/* Signos vitales */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-sky-600" />
                  <h4 className="text-sm font-semibold text-gray-700">Signos vitales</h4>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'weight_kg',    label: 'Peso (kg)',   type: 'number', step: '0.1' },
                    { key: 'height_cm',    label: 'Talla (cm)',  type: 'number', step: '0.1' },
                    { key: 'blood_pressure', label: 'T.A.',      type: 'text',   placeholder: '120/80' },
                    { key: 'heart_rate',   label: 'FC (lpm)',    type: 'number' },
                    { key: 'temperature_c', label: 'Temp (°C)', type: 'number', step: '0.1' },
                    { key: 'oxygen_sat',   label: 'SpO₂ (%)',   type: 'number' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-gray-500 mb-0.5">{f.label}</label>
                      <input
                        type={f.type}
                        step={(f as any).step}
                        placeholder={(f as any).placeholder}
                        value={(vitals as any)[f.key] ?? ''}
                        onChange={e => setVitals(v => ({ ...v, [f.key]: e.target.value === '' ? null : f.type === 'number' ? +e.target.value : e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  ))}
                </div>
                <button onClick={saveVitals} disabled={savingVitals}
                  className="mt-2 w-full py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                  {savingVitals ? <Loader2 className="w-3 h-3 animate-spin" /> : savedVitals ? '✓ Guardado' : <><Save className="w-3 h-3" /> Guardar signos vitales</>}
                </button>
              </div>

              <div className="border-t border-gray-100" />

              {/* Anamnesis */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Anamnesis</h4>
                </div>

                {!patientId && (
                  <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl">
                    Este turno no tiene paciente registrado.
                  </p>
                )}

                {questions.length === 0 && !addingQ ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-400 mb-4">No hay campos definidos.</p>
                    <div className="flex flex-col gap-2 items-center">
                      <button onClick={loadTemplate}
                        className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors">
                        Cargar template de {specialty ?? 'especialidad'}
                      </button>
                      <button onClick={() => setAddingQ(true)}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
                        Crear campos manualmente
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questions.map(q => (
                      <div key={q.id} className="group">
                        <div className="flex items-start justify-between gap-2">
                          <label className="text-sm font-medium text-gray-700">{q.question_text}</label>
                          <button onClick={() => deleteQuestion(q.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {renderInput(q)}
                      </div>
                    ))}

                    {addingQ && (
                      <div className="border border-sky-200 bg-sky-50/50 rounded-2xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Nuevo campo</p>
                        <input ref={newQRef} type="text" value={newQText}
                          onChange={e => setNewQText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addQuestion()}
                          placeholder="Ej: Alergias conocidas"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                        <div className="flex gap-2">
                          {(['text', 'boolean', 'number'] as QuestionType[]).map(t => (
                            <button key={t} type="button" onClick={() => setNewQType(t)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                                ${newQType === t ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'}`}>
                              {t === 'text' ? 'Texto' : t === 'boolean' ? 'Sí/No' : 'Número'}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setAddingQ(false); setNewQText('') }}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                          <button onClick={addQuestion} disabled={!newQText.trim()}
                            className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-40">Agregar</button>
                        </div>
                      </div>
                    )}

                    {!addingQ && (
                      <button onClick={() => setAddingQ(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-sky-300 hover:text-sky-600 transition-colors">
                        <Plus className="w-4 h-4" /> Agregar campo
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

          ) : tab === 'turno' ? (

            /* ── TAB: ESTE TURNO ── */
            <div className="space-y-4">
              {note?.is_closed && (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    Turno cerrado el {note.closed_at ? fmtDate(note.closed_at) : '—'}. No se puede editar.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Motivo de consulta <span className="text-red-500">*</span>
                </label>
                <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
                  disabled={note?.is_closed}
                  placeholder="Motivo principal..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Diagnóstico</label>
                <textarea value={diagnostico} onChange={e => setDiagnostico(e.target.value)} rows={2}
                  disabled={note?.is_closed}
                  placeholder="CIE-10 o descripción libre..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Indicaciones / Tratamiento</label>
                <textarea value={indicaciones} onChange={e => setIndicaciones(e.target.value)} rows={3}
                  disabled={note?.is_closed}
                  placeholder="Medicación, dosis, frecuencia..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                  disabled={note?.is_closed}
                  placeholder="Observaciones adicionales..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>

              {/* Adjuntos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Adjuntos
                  </label>
                  {!note?.is_closed && (
                    <>
                      <button onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="text-xs text-sky-600 hover:text-sky-700 font-medium disabled:opacity-50 flex items-center gap-1">
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        {uploading ? 'Subiendo...' : 'Subir archivo'}
                      </button>
                      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={uploadFile} />
                    </>
                  )}
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Sin adjuntos.</p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                        <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">{att.file_name}</p>
                          {att.file_size && <p className="text-xs text-gray-400">{fmtSize(att.file_size)}</p>}
                        </div>
                        <button onClick={() => downloadFile(att)} className="p-1 text-gray-400 hover:text-sky-600">
                          <Download className="w-4 h-4" />
                        </button>
                        {!note?.is_closed && (
                          <button onClick={() => deleteAttachment(att)} className="p-1 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          ) : (

            /* ── TAB: HISTORIAL ── */
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Sin consultas previas registradas.</p>
                </div>
              ) : (
                history.map(h => (
                  <div key={h.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedHist(expandedHist === h.id ? null : h.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{fmtDate(h.created_at)}</span>
                          {h.is_closed && <Lock className="w-3 h-3 text-gray-300" />}
                        </div>
                        <p className="text-sm text-gray-700 font-medium mt-0.5 truncate max-w-xs">{h.motivo}</p>
                      </div>
                      {expandedHist === h.id
                        ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </button>
                    {expandedHist === h.id && (
                      <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
                        {h.diagnostico && (
                          <div className="pt-3">
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
                        {h.notas && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Notas: </span>
                            <span className="text-sm text-gray-800">{h.notas}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-2">
          {tab === 'hc' && (
            <button onClick={saveAnamnesis} disabled={savingHC || !patientId || questions.length === 0}
              className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white py-3 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
              {savingHC ? <Loader2 className="w-4 h-4 animate-spin" /> : savedHC ? '✓ Guardado' : <><Save className="w-4 h-4" /> Guardar historia clínica</>}
            </button>
          )}

          {tab === 'turno' && !note?.is_closed && (
            <>
              <button onClick={saveNote} disabled={savingNote || !motivo.trim()}
                className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white py-3 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : savedNote ? '✓ Guardado' : <><Save className="w-4 h-4" /> {note ? 'Actualizar' : 'Guardar'}</>}
              </button>
              {note && (
                <button onClick={closeNote} disabled={closing}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
                  title="Cerrar y bloquear este turno">
                  {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> Cerrar turno</>}
                </button>
              )}
            </>
          )}

          {tab === 'historial' && (
            <button onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-3 rounded-2xl font-semibold text-sm transition-colors">
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
