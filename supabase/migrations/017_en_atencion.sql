-- ============================================================
-- Migración 017: nuevo status en_atencion para sala de espera
-- ============================================================

ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'en_atencion';
