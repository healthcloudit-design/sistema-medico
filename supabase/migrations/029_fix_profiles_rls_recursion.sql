-- ============================================================
-- Migration 029: Fix recursión infinita en RLS de profiles
-- ============================================================
-- Las policies que hacen SELECT FROM profiles dentro de una
-- policy ON profiles causan stack overflow (error 500).
-- Fix: mover esas subqueries a funciones SECURITY DEFINER.
-- ============================================================

-- ── Helpers SECURITY DEFINER (bypass RLS) ────────────────────
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS
$$ SELECT organization_id FROM profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION get_my_assigned_orgs()
RETURNS UUID[] LANGUAGE sql SECURITY DEFINER STABLE AS
$$ SELECT COALESCE(assigned_orgs, '{}') FROM profiles WHERE id = auth.uid() $$;

-- ── Reemplazar policies con recursión ───────────────────────
-- Eliminar las problemáticas
DROP POLICY IF EXISTS "profiles_comercial_select"  ON profiles;
DROP POLICY IF EXISTS "profiles_admin_org"          ON profiles;

-- Recrear comercial_select sin subquery directa
CREATE POLICY "profiles_comercial_select" ON profiles
  FOR SELECT USING (
    get_my_role() = 'comercial'
    AND (
      id = auth.uid()
      OR organization_id = ANY(get_my_assigned_orgs())
    )
  );

-- Recrear admin_org sin subquery directa
CREATE POLICY "profiles_admin_org" ON profiles
  FOR ALL USING (
    get_my_role() = 'admin'
    AND organization_id = get_my_org_id()
  );

GRANT EXECUTE ON FUNCTION get_my_org_id       TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_assigned_orgs TO authenticated;
