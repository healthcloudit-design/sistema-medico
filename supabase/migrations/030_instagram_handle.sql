-- ============================================================
-- Migration 030: instagram_handle en organizations
-- ============================================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

-- Libre, Aqua, Flavia con sus handles reales
UPDATE organizations SET instagram_handle = 'librehairandnails' WHERE slug = 'libre';
UPDATE organizations SET instagram_handle = 'alejandraacqua'    WHERE slug = 'aqua';
UPDATE organizations SET instagram_handle = 'fla.stilo.nails'   WHERE slug = 'flavia-nails';
