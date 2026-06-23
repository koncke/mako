// Sonda solo-lectura: descubrir el action_type de "Programaciones"/agendas en
// los insights de Meta, y ver cobertura de previews en el rango completo.
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const API = process.env.META_API_VERSION, TOKEN = process.env.META_ACCESS_TOKEN;
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
const SINCE = '2025-11-01', UNTIL = '2026-06-19';

try {
  // Cobertura de previews en el rango completo (lo que muestra /anuncios con Máximo)
  const [cov] = await sql`SELECT count(DISTINCT ad_id)::int total,
      count(DISTINCT ad_id) FILTER (WHERE ad_id NOT IN (
        SELECT ad_id FROM marketing_metrics_daily WHERE ad_thumbnail_url IS NOT NULL
      ))::int sin_thumb
    FROM marketing_metrics_daily WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= ${SINCE}`;
  console.log(`Rango ${SINCE}→hoy: ${cov.total} ads, sin preview ~${cov.sin_thumb}`);

  // Ads con más "agendas" conocidas en Meta (de los screenshots): buscamos por nombre
  const nombres = ['Delegar resultados es diseño', 'DECISIONES POR INTUICIÓN', 'Ventas impredecibles', 'Imagen 1 PipeLine'];
  const ads = await sql`SELECT DISTINCT ad_id, ad_name FROM marketing_metrics_daily
    WHERE plataforma='meta' AND ad_id IS NOT NULL AND ad_name = ANY(${nombres})`;
  console.log(`\nSondeando ${ads.length} ads conocidos…`);

  for (const a of ads) {
    const url = new URL(`https://graph.facebook.com/${API}/${a.ad_id}/insights`);
    url.searchParams.set('fields', 'ad_name,actions');
    url.searchParams.set('action_breakdowns', 'action_type');
    url.searchParams.set('time_range', JSON.stringify({ since: SINCE, until: UNTIL }));
    url.searchParams.set('access_token', TOKEN);
    const r = await fetch(url); const b = await r.json();
    console.log(`\n=== ${a.ad_name} (${a.ad_id}) ===`);
    if (b.error) { console.log('  error:', b.error.message); continue; }
    const row = b.data?.[0];
    if (!row?.actions) { console.log('  (sin actions)'); continue; }
    // Imprime todas las acciones con su valor; resaltamos las que parecen agenda
    for (const ac of row.actions) {
      const hint = /schedule|programaci|appointment|lead/i.test(ac.action_type) ? '  ← posible agenda/lead' : '';
      console.log(`  ${ac.action_type} = ${ac.value}${hint}`);
    }
  }
} catch (e) { console.error('Error:', e.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
