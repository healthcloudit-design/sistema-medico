-- ============================================================
-- Migración 008: Categorías de servicios + tipo de tenant
-- ============================================================

-- Categoría por servicio (peluquería, manos, barbería, etc.)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Tipo de tenant: medical | beauty | general
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tenant_type TEXT NOT NULL DEFAULT 'medical'
  CHECK (tenant_type IN ('medical', 'beauty', 'general'));

COMMENT ON COLUMN services.category     IS 'Categoría del servicio para agrupación en el selector de reservas';
COMMENT ON COLUMN organizations.tenant_type IS 'Tipo de tenant: medical muestra obra social e HC, beauty los oculta';
