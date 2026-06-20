// =============================================================================
// Backfill incremental de transcripciones + secciones (reusa lib/transcribe).
// Uso: npx tsx scripts/backfill-transcripts.ts [desde]   (default 2025-11-01)
//   - Anuncio sin fila        → transcribeAd (video o imagen) completo.
//   - Video ya transcrito sin secciones → solo estructura (no re-transcribe).
//   - sin_video               → transcribeAd (ahora procesa la imagen con visión).
//   - Ya con secciones        → se omite.
// Requiere .env.local: DATABASE_URL, META_*, OPENAI_API_KEY.
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { transcribeAd, structureTranscript, type Seccion } from '../lib/transcribe';

const SINCE = process.argv[2] || '2025-11-01';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', connect_timeout: 10, max: 1 });

type Row = { ad_id: string; status: string; tipo: string | null; transcript: string | null; secciones: Seccion[] | null };

async function upsertFull(r: Awaited<ReturnType<typeof transcribeAd>>) {
  await sql`INSERT INTO ad_transcripts (ad_id, video_id, tipo, status, transcript, secciones, idioma, duracion_s, model, error, updated_at)
    VALUES (${r.ad_id}, ${r.video_id}, ${r.tipo}, ${r.status}, ${r.transcript}, ${r.secciones ? sql.json(r.secciones) : null}, ${r.idioma}, ${r.duracion_s}, ${r.model}, ${r.error}, now())
    ON CONFLICT (ad_id) DO UPDATE SET video_id=EXCLUDED.video_id, tipo=EXCLUDED.tipo, status=EXCLUDED.status, transcript=EXCLUDED.transcript, secciones=EXCLUDED.secciones, idioma=EXCLUDED.idioma, duracion_s=EXCLUDED.duracion_s, model=EXCLUDED.model, error=EXCLUDED.error, updated_at=now()`;
}

async function main() {
try {
  const ads = await sql<{ ad_id: string }[]>`SELECT DISTINCT ad_id FROM marketing_metrics_daily WHERE plataforma='meta' AND ad_id IS NOT NULL AND fecha >= ${SINCE}`;
  const rows = await sql<Row[]>`SELECT ad_id, status, tipo, transcript, secciones FROM ad_transcripts`;
  const map = new Map(rows.map((r) => [r.ad_id, r]));
  // Thumbnail más reciente por anuncio (fuente de imagen para anuncios sin video).
  const thumbs = new Map<string, string>();
  for (const t of await sql<{ ad_id: string; ad_thumbnail_url: string }[]>`SELECT DISTINCT ON (ad_id) ad_id, ad_thumbnail_url FROM marketing_metrics_daily WHERE plataforma='meta' AND ad_thumbnail_url IS NOT NULL ORDER BY ad_id, fecha DESC`)
    thumbs.set(t.ad_id, t.ad_thumbnail_url);

  let estructurados = 0, imagenes = 0, nuevos = 0, omitidos = 0, errores = 0;
  let i = 0;
  for (const { ad_id } of ads) {
    i++;
    const ex = map.get(ad_id);
    try {
      if (ex && Array.isArray(ex.secciones) && ex.secciones.length > 0) { omitidos++; continue; }

      if (ex && ex.status === 'ok' && ex.tipo !== 'imagen' && ex.transcript) {
        // Video ya transcrito → solo estructurar (sin re-transcribir).
        const sec = await structureTranscript(ex.transcript);
        await sql`UPDATE ad_transcripts SET secciones=${sec ? sql.json(sec) : null}, tipo='video', updated_at=now() WHERE ad_id=${ad_id}`;
        estructurados++;
        console.log(`[${i}/${ads.length}] estructurado  ${ad_id}`);
        continue;
      }

      // Nuevo o sin_video → procesar completo (video o imagen con visión).
      const r = await transcribeAd(ad_id, { imageUrl: thumbs.get(ad_id) });
      await upsertFull(r);
      if (r.tipo === 'imagen') imagenes++; else nuevos++;
      if (r.status === 'error') errores++;
      console.log(`[${i}/${ads.length}] ${r.status === 'error' ? 'ERROR' : (r.tipo ?? r.status)}  ${ad_id}${r.error ? ' · ' + r.error : ''}`);
    } catch (e) {
      errores++;
      console.log(`[${i}/${ads.length}] EXCEPTION ${ad_id} · ${(e as Error).message}`);
    }
  }
  console.log(`\n✅ Listo: estructurados(video)=${estructurados} imagenes=${imagenes} nuevos=${nuevos} omitidos=${omitidos} errores=${errores}`);
} catch (e) {
  console.error('Error:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
}
main();
