-- ============================================================
-- Migration 024: Libre Hair and Nails — branding + contacto
-- ============================================================

UPDATE organizations SET
  name             = 'Libre Hair and Nails',
  whatsapp_number  = '+5491568777730',
  primary_color    = '#C4A35A',
  -- logo_url: subir la imagen al Supabase Storage y reemplazar la URL
  -- logo_url = 'https://xuwkxelrcglstvisbcnk.supabase.co/storage/v1/object/public/logos/libre-logo.png',
  updated_at       = now()
WHERE slug = 'libre';

-- Servicios de Libre: desactivar los genéricos que no corresponden.
-- No se borran para preservar el historial de appointments existentes.
UPDATE services SET active = false
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'libre')
  AND category NOT IN ('Peluquería', 'Manicuría', 'Uñas', 'Pedicuría', 'Nail Art', 'Barbería');
