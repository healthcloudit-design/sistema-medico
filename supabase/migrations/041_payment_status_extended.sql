-- Extend payment_status to include pendiente_pago and exento
-- Column already exists; just ensure new values are accepted (TEXT, no enum constraint)
-- Add index for reception dashboard queries
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status
  ON appointments (payment_status)
  WHERE payment_status IS NOT NULL;

-- Back-fill: appointments with status=completado that have no payment_status → pendiente_pago
UPDATE appointments
SET payment_status = 'pendiente_pago'
WHERE status = 'completado'
  AND (payment_status IS NULL OR payment_status = 'pendiente');
