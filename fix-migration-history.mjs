const PAT = 'sbp_7f9af7ea4047355d4bdef3db635692d1075f7256';
const REF = 'xuwkxelrcglstvisbcnk';
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `DELETE FROM supabase_migrations.schema_migrations WHERE version ~ '^[0-9]{3}_';` })
});
const body = await res.json();
console.log(res.ok ? '✅ Historial limpiado' : '❌', JSON.stringify(body));
