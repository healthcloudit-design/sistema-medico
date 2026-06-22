// Templates de preguntas de anamnesis por especialidad
// Se ofrecen como "carga rápida" la primera vez que el médico abre una HC sin preguntas

export type QuestionType = 'text' | 'boolean' | 'number'

export interface TemplateQuestion {
  question_text: string
  question_type: QuestionType
}

// Palabras clave en la especialidad → template
const TEMPLATES: Record<string, TemplateQuestion[]> = {
  default: [
    { question_text: 'Motivo de consulta previo',      question_type: 'text' },
    { question_text: 'Antecedentes hereditarios',       question_type: 'text' },
    { question_text: 'Alergias conocidas',              question_type: 'boolean' },
    { question_text: 'Medicamentos actuales',           question_type: 'text' },
    { question_text: 'Cirugías previas',                question_type: 'boolean' },
    { question_text: 'Enfermedades crónicas',           question_type: 'text' },
    { question_text: 'Hábitos (tabaco, alcohol)',       question_type: 'text' },
  ],

  cardiolog: [
    { question_text: 'Presión arterial habitual',       question_type: 'text' },
    { question_text: 'Frecuencia cardíaca en reposo',   question_type: 'number' },
    { question_text: 'Dolor en el pecho',               question_type: 'boolean' },
    { question_text: 'Disnea de esfuerzo',              question_type: 'boolean' },
    { question_text: 'Toma anticoagulantes',            question_type: 'boolean' },
    { question_text: 'Antecedentes de IAM/ACV',        question_type: 'boolean' },
    { question_text: 'Colesterol / triglicéridos',      question_type: 'text' },
    { question_text: 'Alergias conocidas',              question_type: 'boolean' },
    { question_text: 'Medicamentos actuales',           question_type: 'text' },
  ],

  flebolog: [
    { question_text: 'Toma anticoagulantes',            question_type: 'boolean' },
    { question_text: 'Antecedentes de trombosis',       question_type: 'boolean' },
    { question_text: 'Várices familiares',              question_type: 'boolean' },
    { question_text: 'Hormonal / anticonceptivos',      question_type: 'boolean' },
    { question_text: 'Trabajo de pie o sentado horas',  question_type: 'text' },
    { question_text: 'Embarazos',                       question_type: 'text' },
    { question_text: 'Alergias conocidas',              question_type: 'boolean' },
    { question_text: 'Cirugías vasculares previas',     question_type: 'boolean' },
    { question_text: 'Peso kg',                         question_type: 'number' },
  ],

  traumatol: [
    { question_text: 'Zona afectada',                   question_type: 'text' },
    { question_text: 'Mecanismo de lesión',             question_type: 'text' },
    { question_text: 'Dolor en reposo (0-10)',          question_type: 'number' },
    { question_text: 'Dolor en movimiento (0-10)',      question_type: 'number' },
    { question_text: 'Cirugías previas en la zona',     question_type: 'boolean' },
    { question_text: 'Toma anticoagulantes',            question_type: 'boolean' },
    { question_text: 'Alergias conocidas',              question_type: 'boolean' },
    { question_text: 'Medicamentos actuales',           question_type: 'text' },
  ],

  kinesiolog: [
    { question_text: 'Zona a tratar',                   question_type: 'text' },
    { question_text: 'Dolor en reposo (0-10)',          question_type: 'number' },
    { question_text: 'Limitación funcional',            question_type: 'text' },
    { question_text: 'Tratamientos kinésicos previos',  question_type: 'boolean' },
    { question_text: 'Diagnóstico médico previo',       question_type: 'text' },
    { question_text: 'Cirugías en la zona',             question_type: 'boolean' },
    { question_text: 'Alergias conocidas',              question_type: 'boolean' },
  ],

  dermatolog: [
    { question_text: 'Zona afectada',                   question_type: 'text' },
    { question_text: 'Tiempo de evolución',             question_type: 'text' },
    { question_text: 'Antecedentes de psoriasis / atopía', question_type: 'boolean' },
    { question_text: 'Alergias conocidas',              question_type: 'boolean' },
    { question_text: 'Medicamentos actuales',           question_type: 'text' },
    { question_text: 'Exposición solar frecuente',      question_type: 'boolean' },
    { question_text: 'Tratamientos previos',            question_type: 'text' },
  ],

  psicolog: [
    { question_text: 'Motivo de consulta',              question_type: 'text' },
    { question_text: 'Tratamientos psicológicos previos', question_type: 'boolean' },
    { question_text: 'Medicación psiquiátrica actual',  question_type: 'boolean' },
    { question_text: 'Red de apoyo familiar',           question_type: 'text' },
    { question_text: 'Situación laboral / estudiantil', question_type: 'text' },
    { question_text: 'Calidad del sueño',               question_type: 'text' },
  ],

  nutricion: [
    { question_text: 'Peso actual kg',                  question_type: 'number' },
    { question_text: 'Talla cm',                        question_type: 'number' },
    { question_text: 'Objetivo (bajar / mantener / subir)', question_type: 'text' },
    { question_text: 'Alergias / intolerancias',        question_type: 'boolean' },
    { question_text: 'Enfermedades metabólicas',        question_type: 'boolean' },
    { question_text: 'Actividad física semanal',        question_type: 'text' },
    { question_text: 'Medicamentos actuales',           question_type: 'text' },
  ],

  odontolog: [
    { question_text: 'Última consulta odontológica',    question_type: 'text' },
    { question_text: 'Alergias a anestesia local',      question_type: 'boolean' },
    { question_text: 'Toma anticoagulantes',            question_type: 'boolean' },
    { question_text: 'Bruxismo',                        question_type: 'boolean' },
    { question_text: 'Enfermedades sistémicas',         question_type: 'text' },
    { question_text: 'Medicamentos actuales',           question_type: 'text' },
  ],

  oftalmolog: [
    { question_text: 'Usa anteojos / lentes',           question_type: 'boolean' },
    { question_text: 'Última consulta oftalmológica',   question_type: 'text' },
    { question_text: 'Antecedentes de glaucoma familiar', question_type: 'boolean' },
    { question_text: 'Diabetes',                        question_type: 'boolean' },
    { question_text: 'Cirugías oculares previas',       question_type: 'boolean' },
    { question_text: 'Alergias conocidas',              question_type: 'boolean' },
    { question_text: 'Medicamentos actuales',           question_type: 'text' },
  ],

  // Belleza / bienestar
  peluquer: [
    { question_text: 'Tratamientos químicos previos',   question_type: 'text' },
    { question_text: 'Alergias a tinturas / productos', question_type: 'boolean' },
    { question_text: 'Resultado esperado',              question_type: 'text' },
  ],

  estetica: [
    { question_text: 'Tratamientos estéticos previos',  question_type: 'text' },
    { question_text: 'Alergias conocidas',              question_type: 'boolean' },
    { question_text: 'Medicamentos / isotretinoína',    question_type: 'boolean' },
    { question_text: 'Resultado esperado',              question_type: 'text' },
  ],

  masaj: [
    { question_text: 'Zona a trabajar',                 question_type: 'text' },
    { question_text: 'Contracturas / lesiones activas', question_type: 'boolean' },
    { question_text: 'Presión preferida (suave/media/fuerte)', question_type: 'text' },
  ],
}

// Alertas: preguntas cuyo nombre contiene estas palabras activan banner si la respuesta es "Sí"
export const ALERT_KEYWORDS = [
  'anticoagulante',
  'alergia',
  'trombosis',
  'diabetes',
  'hipertension',
  'hipertensión',
  'cardio',
  'infeccio',
  'embaraz',
]

export function getTemplateForSpecialty(specialty: string | null | undefined): TemplateQuestion[] {
  if (!specialty) return TEMPLATES.default
  const lower = specialty.toLowerCase()
  const match = Object.keys(TEMPLATES).find(key => lower.includes(key))
  return match ? TEMPLATES[match] : TEMPLATES.default
}
