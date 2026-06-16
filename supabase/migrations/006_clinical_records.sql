-- ============================================================
-- Migración 006: Historia Clínica (evoluciones por turno)
-- ============================================================

CREATE TABLE IF NOT EXISTS clinical_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  appointment_id    UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id        UUID REFERENCES patients(id) ON DELETE SET NULL,
  professional_id   UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,

  -- Contenido clínico
  motivo            TEXT NOT NULL,
  diagnostico       TEXT,
  indicaciones      TEXT,
  notas             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un turno puede tener solo una evolución
  UNIQUE(appointment_id)
);

-- Índices
CREATE INDEX idx_clinical_records_professional ON clinical_records(professional_id);
CREATE INDEX idx_clinical_records_patient      ON clinical_records(patient_id);
CREATE INDEX idx_clinical_records_organization ON clinical_records(organization_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_clinical_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION update_clinical_records_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

-- Médico: ve y crea solo sus propios registros
CREATE POLICY "medico_select_own_records"
  ON clinical_records FOR SELECT
  USING (
    get_my_role() = 'medico'
    AND professional_id = get_my_professional_id()
  );

CREATE POLICY "medico_insert_own_records"
  ON clinical_records FOR INSERT
  WITH CHECK (
    get_my_role() = 'medico'
    AND professional_id = get_my_professional_id()
  );

CREATE POLICY "medico_update_own_records"
  ON clinical_records FOR UPDATE
  USING (
    get_my_role() = 'medico'
    AND professional_id = get_my_professional_id()
  );

-- Admin, superadmin y recepción: acceso total
CREATE POLICY "staff_all_records"
  ON clinical_records FOR ALL
  USING (
    get_my_role() IN ('admin', 'superadmin', 'recepcion')
  );
