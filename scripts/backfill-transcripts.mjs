// =============================================================================
// Backfill: transcribe TODOS los anuncios sin transcripción (Meta mp4 → OpenAI).
// Uso: node scripts/backfill-transcripts.mjs [desde]   (default 2025-11-01)
// Requiere en .env.local: DATABASE_URL, META_API_VERSION, META_ACCESS_TOKEN,
// OPENAI_API_KEY.
// =============================================================================
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

const ver = process.env.META_API_VERSION, token = process.env.META_ACCESS_TOKEN, oai = process.env.OPENAI_API_KEY;
for (const [k, v] of [['META_API_VERSION', ver], ['META_ACCESS_TOKEN', token], ['OPENAI_API_KEY', oai], ['DATABASE_URL', process.env.DATABASE_URL]])
  if (!v) { console.error(`Falta ${k}`); process.exit(1); }
const SINCE = process.argv[2] || '2025-11-01';
const MAX_BYTES = 25 * 1024 * 1024;
const G = 'https://graph.facebook.com';

async function getVideo(adId) {
  const cu = new URL(`${G}/${ver}/${adId}`);
  cu.searchParams.set('fields', 'creative{object_story_spec{video_data{video_id}},video_id}'); cu.searchParams.set('access_token', token);
  const c = await (await fetch(cu)).json();
  if (c.error) throw new Error(c.error.message);
  const vid = c?.creative?.object_story_spec?.video_data?.video_id || c?.creative?.video_id;
  if (!vid) return null;
  const vu = new URL(`${G}/${ver}/${vid}`); vu.searchParams.set('fields', 'source'); vu.searchParams.set('access_token', token);
  const vb = await (await fetch(vu)).json();
  if (vb.error || !vb.source) return null;
  return { video_id: vid, source: vb.source };
}

async function transcribe(adId) {
  const base = { ad_id: adId, video_id: null, status: 'ok', transcript: null, idioma: null, duracion_s: null, model: null, error: null };
  try {
    const v = await getVideo(adId);
    if (!v) return { ...base, status: 'sin_video' };
    base.video_id = v.video_id;
    const buf = Buffer.from(await (await fetch(v.source)).arrayBuffer());
    if (buf.length > MAX_BYTES) return { ...base, status: 'muy_grande', error: `${(buf.length / 1048576).toFixed(1)} MB` };
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buf)], { type: 'video/mp4' }), 'ad.mp4');
    form.append('model', 'whisper-1'); form.append('response_format', 'verbose_json');
    const j = await (await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${oai}` }, body: form })).json();
    if (j.error) return { ...base, status: 'error', error: j.error.message };
    return { ...base, status: 'ok', transcript: j.text ?? '', idioma: j.language ?? null, duracion_s: j.duration ?? null, model: 'whisper-1' };
  } catch (e) { return { ...base, status: 'error', error: String(e.message || e) }; }
}

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
try {
  const ads = await sql`SELECT DISTINCT ad_id FROM marketing_metrics_daily WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= ${SINCE}`;
  const done = new Set((await sql`SELECT ad_id FROM ad_transcripts`).map((r) => r.ad_id));
  const pend = ads.map((r) => r.ad_id).filter((id) => !done.has(id));
  console.log(`Anuncios: ${ads.length} | ya transcritos: ${done.size} | pendientes: ${pend.length}`);
  let ok = 0, sv = 0, big = 0, er = 0;
  for (let i = 0; i < pend.length; i++) {
    const adId = pend[i];
    const r = await transcribe(adId);
    await sql`INSERT INTO ad_transcripts (ad_id, video_id, status, transcript, idioma, duracion_s, model, error, updated_at)
      VALUES (${r.ad_id}, ${r.video_id}, ${r.status}, ${r.transcript}, ${r.idioma}, ${r.duracion_s}, ${r.model}, ${r.error}, now())
      ON CONFLICT (ad_id) DO UPDATE SET video_id=EXCLUDED.video_id, status=EXCLUDED.status, transcript=EXCLUDED.transcript, idioma=EXCLUDED.idioma, duracion_s=EXCLUDED.duracion_s, model=EXCLUDED.model, error=EXCLUDED.error, updated_at=now()`;
    if (r.status === 'ok') ok++; else if (r.status === 'sin_video') sv++; else if (r.status === 'muy_grande') big++; else er++;
    console.log(`[${i + 1}/${pend.length}] ${r.status.padEnd(10)} ${adId}`);
  }
  console.log(`\n✅ Listo: ok=${ok} sin_video=${sv} muy_grande=${big} error=${er}`);
} catch (e) { console.error('Error:', e.message); process.exitCode = 1; }
finally { await sql.end({ timeout: 5 }); }
