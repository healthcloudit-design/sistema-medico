-- ============================================================
-- Migración 019: tenant_type estetica + branding por org + whatsapp logs
-- ============================================================

-- 1. Nuevo tenant type
ALTER TYPE tenant_type ADD VALUE IF NOT EXISTS 'estetica';

-- 2. Branding por organización
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS primary_color    TEXT DEFAULT '#0ea5e9',
  ADD COLUMN IF NOT EXISTS instagram_url    TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number  TEXT,
  ADD COLUMN IF NOT EXISTS booking_headline TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url  TEXT;

-- 3. Flags de recordatorios en appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_confirmation_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent           BOOLEAN NOT NULL DEFAULT false;

-- 4. Log de mensajes WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id)  ON DELETE SET NULL,
  to_number       TEXT NOT NULL,
  message_type    TEXT NOT NULL, -- 'confirmation' | 'reminder_24h' | 'reminder_2h' | 'inbound_cancel' | 'inbound_tardanza'
  body            TEXT,
  twilio_sid      TEXT,
  status          TEXT DEFAULT 'sent',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para whatsapp_logs
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_logs_staff"
ON whatsapp_logs FOR ALL TO authenticated
USING (
  get_my_role() = 'superadmin'
  OR (get_my_role() IN ('admin', 'recepcion') AND organization_id = get_my_org_id())
);
