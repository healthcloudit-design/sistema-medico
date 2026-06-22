-- ============================================================
-- Migración 015: Signos vitales, adjuntos, firma de cierre
-- ============================================================

-- ── Signos vitales (uno por turno) ───────────────────────────
CREATE TABLE IF NOT EXISTS vital_signs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  weight_kg         NUMERIC(5,2),   -- peso kg
  height_cm         NUMERIC(5,1),   -- talla cm
  blood_pressure    TEXT,           -- "120/80"
  heart_rate        INTEGER,        -- lpm
  temperature_c     NUMERIC(4,1),   -- °C
  oxygen_sat        INTEGER,        -- % SpO2

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(appointment_id)
);

CREATE INDEX idx_vital_signs_patient ON vital_signs(patient_id);

CREATE OR REPLACE FUNCTION update_vital_signs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vital_signs_updated_at
  BEFORE UPDATE ON vital_signs
  FOR EACH ROW EXECUTE FUNCTION update_vital_signs_updated_at();

ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medico_all_vital_signs"
  ON vital_signs FOR ALL
  USING (get_my_role() = 'medico' AND professional_id = get_my_professional_id())
  WITH CHECK (get_my_role() = 'medico' AND professional_id = get_my_professional_id());

CREATE POLICY "staff_select_vital_signs"
  ON vital_signs FOR SELECT
  USING (get_my_role() IN ('admin', 'superadmin', 'recepcion'));

-- ── Adjuntos clínicos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointment_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  file_name  TEXT NOT NULL,
  file_path  TEXT NOT NULL,   -- path en Supabase Storage
  file_type  TEXT NOT NULL,   -- MIME type
  file_size  INTEGER,         -- bytes
  label      TEXT,            -- descripción opcional

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_appointment ON appointment_attachments(appointment_id);
CREATE INDEX idx_attachments_patient     ON appointment_attachments(patient_id);

ALTER TABLE appointment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medico_all_attachments"
  ON appointment_attachments FOR ALL
  USING (get_my_role() = 'medico' AND professional_id = get_my_professional_id())
  WITH CHECK (get_my_role() = 'medico' AND professional_id = get_my_professional_id());

CREATE POLICY "staff_select_attachments"
  ON appointment_attachments FOR SELECT
  USING (get_my_role() IN ('admin', 'superadmin', 'recepcion'));

-- ── Firma de cierre en clinical_records ───────────────────────
ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS is_closed  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at  TIMESTAMPTZ;

-- ── Storage bucket para adjuntos clínicos ────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-attachments',
  'clinical-attachments',
  false,
  10485760,   -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage: solo usuarios autenticados
CREATE POLICY "auth_upload_clinical"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'clinical-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "auth_read_clinical"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'clinical-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "auth_delete_clinical"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'clinical-attachments' AND auth.role() = 'authenticated');
