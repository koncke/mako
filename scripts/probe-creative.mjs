// Sonda de solo-lectura: para varios anuncios, ver qué campos de imagen
// (alta resolución) expone Meta y cuántos anuncios hay en la ventana real.
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const API = process.env.META_API_VERSION, TOKEN = process.env.META_ACCESS_TOKEN;
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });

const SINCE = '2026-06-04'; // ventana que usa la página (ayer 06-18 menos 14)

try {
  const [c] = await sql`SELECT count(DISTINCT ad_id)::int n FROM marketing_metrics_daily
    WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= ${SINCE}`;
  console.log(`Anuncios distintos desde ${SINCE}: ${c.n}`);

  // Anuncios SIN thumbnail tras el backfill (los que no se ven):
  const sinThumb = await sql`SELECT DISTINCT ad_id, ad_name FROM marketing_metrics_daily
    WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= ${SINCE} AND ad_thumbnail_url IS NULL`;
  console.log(`Sin thumbnail: ${sinThumb.length}`);
  for (const a of sinThumb.slice(0, 8)) console.log(`  ${a.ad_id}  ${a.ad_name}`);

  // Toma 5 anuncios variados para sondear campos ricos.
  const muestra = await sql`SELECT DISTINCT ad_id, ad_name FROM marketing_metrics_daily
    WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= ${SINCE} LIMIT 5`;

  const fields = 'creative{id,thumbnail_url,image_url,object_story_spec{video_data{image_url,video_id},link_data{picture,image_hash},photo_data{url}},asset_feed_spec{images{url},videos{thumbnail_url}}}';
  for (const a of muestra) {
    const url = new URL(`https://graph.facebook.com/${API}/${a.ad_id}`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('thumbnail_width', '1080');
    url.searchParams.set('thumbnail_height', '1080');
    url.searchParams.set('access_token', TOKEN);
    const r = await fetch(url); const b = await r.json();
    console.log(`\n=== ${a.ad_name} (${a.ad_id}) ===`);
    if (b.error) { console.log('  error:', b.error.message); continue; }
    const cr = b.creative ?? {};
    const oss = cr.object_story_spec ?? {};
    const afs = cr.asset_feed_spec ?? {};
    const show = (k, v) => console.log(`  ${k}: ${v ? (typeof v === 'string' ? v.slice(0, 90) : 'sí') : '—'}`);
    show('thumbnail_url(1080)', cr.thumbnail_url);
    show('image_url', cr.image_url);
    show('video_data.image_url', oss.video_data?.image_url);
    show('link_data.picture', oss.link_data?.picture);
    show('photo_data.url', oss.photo_data?.url);
    show('asset_feed.images[0]', afs.images?.[0]?.url);
    show('asset_feed.videos[0].thumb', afs.videos?.[0]?.thumbnail_url);
  }
} catch (e) { console.error('Error:', e.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
