import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  const top = await sql`SELECT ad_name, sum(agendas_meta)::int agendas, sum(spend)::int spend_mxn
    FROM marketing_metrics_daily WHERE plataforma='meta' AND fecha >= '2025-11-01' AND agendas_meta > 0
    GROUP BY ad_name ORDER BY agendas DESC LIMIT 10`;
  console.log('Top ads por agendas (Meta) desde 2025-11-01:');
  for (const r of top) console.log(`  ${String(r.agendas).padStart(3)}  ${r.ad_name}`);
  const [crm] = await sql`SELECT count(*)::int n FROM leads WHERE fecha_junta_1 >= '2025-11-01'`;
  const [meta] = await sql`SELECT sum(agendas_meta)::int n FROM marketing_metrics_daily WHERE plataforma='meta' AND fecha>='2025-11-01'`;
  console.log(`\nComparador (desde 2025-11-01): Meta=${meta.n} · CRM=${crm.n} · brecha=${crm.n - meta.n}`);
} finally { await sql.end({ timeout: 5 }); }
