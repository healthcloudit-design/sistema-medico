-- ============================================================
-- Migration 023: Fix payment flow + MODO QR support
-- ============================================================

-- 1. Agregar modo_qr_url a organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS modo_qr_url TEXT;

-- 2. Índice para cleanup job
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status_created
  ON appointments (payment_status, created_at)
  WHERE payment_status = 'pendiente_pago';

-- 3. Función de cleanup: cancela turnos con pago pendiente > 30 minutos
CREATE OR REPLACE FUNCTION cancelar_turnos_pago_abandonado()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE appointments
  SET
    status         = 'cancelado',
    payment_status = 'abandonado',
    updated_at     = now()
  WHERE
    payment_status = 'pendiente_pago'
    AND created_at < now() - INTERVAL '30 minutes'
    AND status NOT IN ('cancelado', 'confirmado', 'completado');
END;
$$;

-- 4. Programar cleanup cada 10 minutos con pg_cron
SELECT cron.schedule(
  'cleanup-payment-pendiente',
  '*/10 * * * *',
  $$SELECT cancelar_turnos_pago_abandonado()$$
);
