-- ============================================================
-- Migration 022: Tenants Aqua + Flavia Nails
-- (Libre ya existe desde 009_libre_tenant.sql)
-- ============================================================

-- Ampliar el check constraint de tenant_type para incluir nuevos tipos
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_tenant_type_check;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_tenant_type_check
  CHECK (tenant_type IN ('medical', 'beauty', 'general', 'petshop', 'veterinary', 'estetica', 'cancha'));

DO $$
DECLARE
  org_aqua   uuid := gen_random_uuid();
  org_flavia uuid := gen_random_uuid();
BEGIN

  -- ── ORGANIZATIONS ────────────────────────────────────────

  INSERT INTO organizations (id, name, slug, timezone, active, feature_mp, feature_hc, tenant_type)
  VALUES
    (org_aqua,   'Aqua',         'aqua',         'America/Argentina/Buenos_Aires', true, false, false, 'beauty'),
    (org_flavia, 'Flavia Nails', 'flavia-nails',  'America/Argentina/Buenos_Aires', true, false, false, 'estetica');


  -- ── AQUA — Peluquería + Manicuría ────────────────────────

  INSERT INTO services (id, organization_id, name, description, duration_minutes, price, color, category, active)
  VALUES
    (gen_random_uuid(), org_aqua, 'Corte de cabello dama',     'Corte + lavado + secado',         60,  null, '#a855f7', 'Peluquería', true),
    (gen_random_uuid(), org_aqua, 'Corte de cabello caballero','Corte + lavado',                   30,  null, '#9333ea', 'Peluquería', true),
    (gen_random_uuid(), org_aqua, 'Coloración completa',       'Tintura + lavado + secado',        120, null, '#7c3aed', 'Peluquería', true),
    (gen_random_uuid(), org_aqua, 'Mechas / Highlights',       'Mechas + lavado + secado',         150, null, '#6d28d9', 'Peluquería', true),
    (gen_random_uuid(), org_aqua, 'Tratamiento capilar',       'Keratina o hidratación profunda',  90,  null, '#8b5cf6', 'Peluquería', true),
    (gen_random_uuid(), org_aqua, 'Brushing / Secado',         'Lavado + brushing',                45,  null, '#a78bfa', 'Peluquería', true),
    (gen_random_uuid(), org_aqua, 'Manicuria simple',          'Limado + cutícula + esmaltado',    30,  null, '#ec4899', 'Manicuría',  true),
    (gen_random_uuid(), org_aqua, 'Manicuria semipermanente',  'Limado + cutícula + gel/shellac',  45,  null, '#db2777', 'Manicuría',  true),
    (gen_random_uuid(), org_aqua, 'Pedicuria simple',          'Limado + cutícula + esmaltado',    45,  null, '#f472b6', 'Manicuría',  true),
    (gen_random_uuid(), org_aqua, 'Pedicuria semipermanente',  'Limado + cutícula + gel/shellac',  60,  null, '#f9a8d4', 'Manicuría',  true);


  -- ── FLAVIA NAILS — Solo uñas ─────────────────────────────

  INSERT INTO services (id, organization_id, name, description, duration_minutes, price, color, category, active)
  VALUES
    (gen_random_uuid(), org_flavia, 'Manicuria simple',         'Limado + cutícula + esmaltado',     30,  null, '#ec4899', 'Manicuría', true),
    (gen_random_uuid(), org_flavia, 'Manicuria semipermanente', 'Gel / shellac duración 3 semanas',  45,  null, '#db2777', 'Manicuría', true),
    (gen_random_uuid(), org_flavia, 'Uñas acrílicas (juego)',   'Construcción completa acrílico',    90,  null, '#be185d', 'Uñas',      true),
    (gen_random_uuid(), org_flavia, 'Uñas gel full (juego)',    'Construcción completa en gel',      90,  null, '#9d174d', 'Uñas',      true),
    (gen_random_uuid(), org_flavia, 'Relleno acrílico',         'Mantenimiento cada 3 semanas',      60,  null, '#831843', 'Uñas',      true),
    (gen_random_uuid(), org_flavia, 'Remoción acrílico / gel',  'Remoción segura sin dañar la uña', 30,  null, '#f472b6', 'Uñas',      true),
    (gen_random_uuid(), org_flavia, 'Nail art / Diseño',        'Decoración artística por uña',      30,  null, '#f9a8d4', 'Nail Art',  true),
    (gen_random_uuid(), org_flavia, 'Pedicuria simple',         'Limado + cutícula + esmaltado',     45,  null, '#fda4af', 'Pedicuría', true),
    (gen_random_uuid(), org_flavia, 'Pedicuria semipermanente', 'Gel / shellac en pies',             60,  null, '#fb7185', 'Pedicuría', true);

END $$;
