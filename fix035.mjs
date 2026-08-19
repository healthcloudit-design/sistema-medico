import { readFileSync } from 'fs';
const PAT = 'sbp_7f9af7ea4047355d4bdef3db635692d1075f7256';
const REF = 'xuwkxelrcglstvisbcnk';

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  return { ok: res.ok, body: await res.json() };
}

// 1. Aplicar migración 035
const sql035 = readFileSync('./supabase/migrations/035_professional_services_rls.sql', 'utf8');
const r1 = await query(sql035);
console.log(r1.ok ? '✅ Migration 035 OK' : '❌ Migration 035', JSON.stringify(r1.body));

// 2. Verificar datos de da-derm
const r2 = await query(`
  SELECT name, instagram_handle, whatsapp_number 
  FROM organizations WHERE slug = 'da-derm'
`);
console.log('📋 Org data:', JSON.stringify(r2.body));

// 3. Verificar professional_services
const r3 = await query(`
  SELECT p.full_name, s.name as service
  FROM professional_services ps
  JOIN professionals p ON p.id = ps.professional_id
  JOIN services s ON s.id = ps.service_id
  WHERE p.organization_id = (SELECT id FROM organizations WHERE slug = 'da-derm')
  ORDER BY p.full_name, s.name
`);
console.log('🔗 Professional services:', JSON.stringify(r3.body));
