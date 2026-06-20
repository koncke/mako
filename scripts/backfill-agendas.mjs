// =============================================================================
// Backfill de agendas_meta (Programaciones de Meta) por anuncio/día.
// Trae insights level=ad con time_increment=1 en el rango y guarda
// offsite_conversion.fb_pixel_custom en marketing_metrics_daily.agendas_meta.
// Uso: node scripts/backfill-agendas.mjs [desde] [hasta]   (default 2025-11-01..ayer)
// =============================================================================
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

const API = process.env.META_API_VERSION;
const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCT = process.env.META_AD_ACCOUNT_ID;
for (const [k, v] of [['META_API_VERSION', API], ['META_ACCESS_TOKEN', TOKEN], ['META_AD_ACCOUNT_ID', ACCT]])
  if (!v) { console.error(`Falta ${k}`); process.exit(1); }

const SINCE = process.argv[2] || '2025-11-01';
const UNTIL = process.argv[3] || new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function actionVal(actions, type) {
  if (!actions) return 0;
  const f = actions.find((a) => a.action_type === type);
  return f ? Number(f.value) || 0 : 0;
}

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  const base = new URL(`https://graph.facebook.com/${API}/${ACCT}/insights`);
  base.searchParams.set('level', 'ad');
  base.searchParams.set('fields', 'ad_id,actions');
  base.searchParams.set('action_breakdowns', 'action_type');
  base.searchParams.set('time_increment', '1');
  base.searchParams.set('time_range', JSON.stringify({ since: SINCE, until: UNTIL }));
  base.searchParams.set('limit', '500');
  base.searchParams.set('access_token', TOKEN);

  let url = base.toString();
  let pages = 0, rows = 0, updated = 0, totalAgendas = 0;
  while (url) {
    if (++pages > 1000) throw new Error('demasiadas páginas');
    const r = await fetch(url); const b = await r.json();
    if (b.error) throw new Error(b.error.message);
    for (const row of b.data ?? []) {
      rows++;
      const fecha = row.date_start;
      const adId = row.ad_id;
      if (!fecha || !adId) continue;
      const agendas = actionVal(row.actions, 'offsite_conversion.fb_pixel_custom');
      if (agendas <= 0) continue; // los demás quedan NULL = 0
      const res = await sql`
        UPDATE marketing_metrics_daily SET agendas_meta = ${agendas}
        WHERE plataforma='meta' AND ad_id = ${adId} AND fecha = ${fecha}`;
      updated += res.count; totalAgendas += agendas;
    }
    url = b.paging?.next ?? null;
  }
  console.log(`Páginas=${pages} filas=${rows} | filas actualizadas=${updated} | total agendas Meta=${totalAgendas}`);

  const [chk] = await sql`SELECT sum(agendas_meta)::int total, count(*) FILTER (WHERE agendas_meta>0)::int dias_con_agenda
    FROM marketing_metrics_daily WHERE plataforma='meta' AND fecha >= ${SINCE}`;
  console.log(`En BD desde ${SINCE}: total agendas_meta=${chk.total}, ad-días con agenda=${chk.dias_con_agenda}`);
} catch (e) { console.error('Error:', e.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
