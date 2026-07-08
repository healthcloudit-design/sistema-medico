-- Tracks which services/treatments were actually delivered in a session
-- (may differ from what was originally booked)
CREATE TABLE IF NOT EXISTS session_treatments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id)     ON DELETE RESTRICT,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_session_treatments_appt ON session_treatments(appointment_id);

-- RLS
ALTER TABLE session_treatments ENABLE ROW LEVEL SECURITY;

-- Médico: puede insertar/ver los de sus turnos
CREATE POLICY "medico_own_session_treatments" ON session_treatments
  FOR ALL USING (
    appointment_id IN (
      SELECT a.id FROM appointments a
      JOIN professionals p ON p.id = a.professional_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Recepción y admin: pueden ver todos del org
CREATE POLICY "recepcion_view_session_treatments" ON session_treatments
  FOR SELECT USING (
    appointment_id IN (
      SELECT id FROM appointments WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Superadmin: acceso total
CREATE POLICY "superadmin_all_session_treatments" ON session_treatments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );
