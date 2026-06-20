// =============================================================================
// Backfill de creativos (miniatura + permalink) en los anuncios de los últimos
// N días. Mismo criterio que lib/meta-ads.fetchAdCreatives, pero por SQL directo.
// Uso: node scripts/backfill-creatives.mjs [dias]   (default 14)
// Requiere en .env.local: DATABASE_URL, META_ACCESS_TOKEN, META_API_VERSION,
// META_AD_ACCOUNT_ID.
// =============================================================================
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

// Default 21: la página "Anuncios ganadores" muestra desde ayer-14, así que
// con margen cubrimos toda su ventana (si no, quedan anuncios sin imagen).
const DIAS = Number(process.argv[2]) || 21;
const CUTOFF = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);
const need = ['DATABASE_URL', 'META_ACCESS_TOKEN', 'META_API_VERSION'];
for (const k of need) if (!process.env[k]) { console.error(`Falta ${k} en .env.local`); process.exit(1); }
const API = process.env.META_API_VERSION;
const TOKEN = process.env.META_ACCESS_TOKEN;

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });

const FIELDS =
  'creative{thumbnail_url,image_url,effective_object_story_id,instagram_permalink_url,' +
  'object_story_spec{video_data{image_url},link_data{picture},photo_data{url}},' +
  'asset_feed_spec{images{url},videos{thumbnail_url}}}';

// Misma prioridad que lib/meta-ads.bestImage: full-res primero, thumbnail_url al final.
function bestImage(c) {
  return c.object_story_spec?.video_data?.image_url
    ?? c.image_url
    ?? c.object_story_spec?.link_data?.picture
    ?? c.object_story_spec?.photo_data?.url
    ?? c.asset_feed_spec?.images?.[0]?.url
    ?? c.asset_feed_spec?.videos?.[0]?.thumbnail_url
    ?? c.thumbnail_url
    ?? null;
}

async function creativeOf(adId) {
  const url = new URL(`https://graph.facebook.com/${API}/${adId}`);
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('thumbnail_width', '1080');
  url.searchParams.set('thumbnail_height', '1080');
  url.searchParams.set('access_token', TOKEN);
  const res = await fetch(url, { method: 'GET' });
  const body = await res.json();
  if (body.error) { console.warn(`  ad ${adId}: ${body.error.message}`); return null; }
  const c = body.creative ?? {};
  const thumbnail = bestImage(c);
  let permalink = null;
  if (c.instagram_permalink_url) permalink = c.instagram_permalink_url;
  else if (c.effective_object_story_id) permalink = `https://www.facebook.com/${c.effective_object_story_id}`;
  return { thumbnail, permalink, sin_enlace: permalink === null };
}

try {
  const ads = await sql`
    SELECT DISTINCT ad_id FROM marketing_metrics_daily
    WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= ${CUTOFF}`;
  console.log(`Anuncios a backfillear (desde ${CUTOFF}): ${ads.length}`);
  let ok = 0, sinEnlace = 0, fail = 0;
  for (const { ad_id } of ads) {
    const c = await creativeOf(ad_id);
    if (!c) { fail++; continue; }
    await sql`
      UPDATE marketing_metrics_daily
      SET ad_thumbnail_url = ${c.thumbnail}, ad_permalink = ${c.permalink}, ad_creative_sin_enlace = ${c.sin_enlace}
      WHERE plataforma='meta' AND ad_id = ${ad_id} AND fecha >= ${CUTOFF}`;
    ok++; if (c.sin_enlace) sinEnlace++;
  }
  console.log(`✅ Backfill listo: ${ok} con creativo (${sinEnlace} sin enlace), ${fail} fallaron.`);
  // Muestra 3 permalinks para validar a mano que reproducen el video en Meta.
  const muestra = await sql`
    SELECT DISTINCT ad_name, ad_permalink FROM marketing_metrics_daily
    WHERE plataforma='meta' AND ad_permalink IS NOT NULL AND fecha >= ${CUTOFF} LIMIT 3`;
  console.log('Muestra de permalinks:');
  for (const m of muestra) console.log(`  ${m.ad_name}: ${m.ad_permalink}`);
} catch (e) { console.error('Error:', e.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
