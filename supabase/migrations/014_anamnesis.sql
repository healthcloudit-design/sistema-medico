-- ============================================================
-- Migración 014: Anamnesis base + banco de preguntas del médico
-- ============================================================

-- Banco de preguntas reutilizables del profesional
CREATE TABLE IF NOT EXISTS professional_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL DEFAULT 'text'
                  CHECK (question_type IN ('text', 'boolean', 'number')),
  display_order   INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_professional_questions_prof
  ON professional_questions(professional_id, display_order);

-- Respuestas de anamnesis base: una por paciente × pregunta
-- Se completan la primera vez y persisten entre consultas
CREATE TABLE IF NOT EXISTS patient_anamnesis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES professional_questions(id) ON DELETE CASCADE,
  answer          TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, question_id)
);

CREATE INDEX idx_patient_anamnesis_lookup
  ON patient_anamnesis(patient_id, professional_id);

-- Trigger updated_at en patient_anamnesis
CREATE OR REPLACE FUNCTION update_patient_anamnesis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patient_anamnesis_updated_at
  BEFORE UPDATE ON patient_anamnesis
  FOR EACH ROW EXECUTE FUNCTION update_patient_anamnesis_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE professional_questions ENABLE ROW LEVEL SECURITY;

-- Médico: gestiona sus propias preguntas
CREATE POLICY "medico_all_own_questions"
  ON professional_questions FOR ALL
  USING (
    get_my_role() = 'medico'
    AND professional_id = get_my_professional_id()
  )
  WITH CHECK (
    get_my_role() = 'medico'
    AND professional_id = get_my_professional_id()
  );

-- Staff: solo lectura
CREATE POLICY "staff_select_questions"
  ON professional_questions FOR SELECT
  USING (get_my_role() IN ('admin', 'superadmin', 'recepcion'));

ALTER TABLE patient_anamnesis ENABLE ROW LEVEL SECURITY;

-- Médico: gestiona anamnesis de sus pacientes
CREATE POLICY "medico_all_own_anamnesis"
  ON patient_anamnesis FOR ALL
  USING (
    get_my_role() = 'medico'
    AND professional_id = get_my_professional_id()
  )
  WITH CHECK (
    get_my_role() = 'medico'
    AND professional_id = get_my_professional_id()
  );

-- Staff: solo lectura
CREATE POLICY "staff_select_anamnesis"
  ON patient_anamnesis FOR SELECT
  USING (get_my_role() IN ('admin', 'superadmin', 'recepcion'));
