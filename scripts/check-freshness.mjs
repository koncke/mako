// Solo-lectura: frescura de datos por plataforma. NO escribe nada.
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  const fresh = await sql`
    SELECT plataforma, max(fecha) AS ultima, count(*) FILTER (WHERE fecha >= current_date - 14)::int AS filas_14d
    FROM marketing_metrics_daily GROUP BY plataforma ORDER BY plataforma`;
  console.log('=== FRESCURA marketing_metrics_daily ===');
  for (const r of fresh) console.log(`${r.plataforma.padEnd(8)} última=${r.ultima?.toISOString?.().slice(0,10) ?? r.ultima} | filas últimos 14d=${r.filas_14d}`);

  const ads = await sql`
    SELECT count(DISTINCT ad_id)::int AS ads_14d,
           count(*) FILTER (WHERE spend > 0)::int AS filas_con_spend
    FROM marketing_metrics_daily
    WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= current_date - 14`;
  console.log(`\nMeta anuncios distintos últimos 14d: ${ads[0].ads_14d} | filas con spend: ${ads[0].filas_con_spend}`);

  const days = await sql`
    SELECT fecha::text AS f, count(DISTINCT ad_id)::int AS ads, round(sum(spend)::numeric,0) AS spend_mxn
    FROM marketing_metrics_daily
    WHERE plataforma='meta' AND fecha >= current_date - 14
    GROUP BY fecha ORDER BY fecha DESC LIMIT 14`;
  console.log('\n=== Meta por día (últimos 14) ===');
  for (const d of days) console.log(`${d.f}  ads=${String(d.ads).padStart(3)}  spend=${d.spend_mxn} MXN`);
} catch (e) { console.error('Error:', e.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
