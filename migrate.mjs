/**
 * migrate.mjs — runner de migraciones via Supabase Management API
 * Uso: node migrate.mjs supabase/migrations/036_xxx.sql
 */
import { readFileSync } from 'fs';

const PAT = 'sbp_7f9af7ea4047355d4bdef3db635692d1075f7256';
const REF = 'xuwkxelrcglstvisbcnk';

const file = process.argv[2];
if (!file) { console.error('Uso: node migrate.mjs <archivo.sql>'); process.exit(1); }

const sql = readFileSync(file, 'utf8');
const name = file.split('/').pop();

console.log(`▶ Aplicando ${name}...`);
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql })
});
const body = await res.json();
if (!res.ok) { console.error('❌ Error:', JSON.stringify(body)); process.exit(1); }
console.log(`✅ ${name} aplicada`);
