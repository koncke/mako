// =============================================================================
// Los números por día del VSL en Wistia y Bunny Stream, y las lecturas del VSL de TODOS los alojadores (25/10/2026)
// =============================================================================
// «Otros alojadores de video» (Martín, por el Cerebro: «Los números por día de Wistia y Bunny: hazlo tú... lib/queries.ts
// lee todos los alojadores. Mira que el funnel y /general no se rompan»). Lo que fija:
//   1. lo que se lee de cada respuesta (la forma de su documentación): reproducciones, y el tiempo medio sólo si la
//      unidad es segura (Wistia sí; Bunny no dice en qué viene su tiempo: se guarda crudo, no se inventa);
//   2. el cron escribe SÓLO el VSL que el negocio marcó, y de ese alojador: toda la cuenta metería las clases de un
//      curso en el paso «vio el VSL» del funnel;
//   3. el funnel, la serie del VSL, sus fuentes y el Dashboard leen todas las plataformas de video, y la base las acepta.
// Correr: node --import tsx --test tests/alojadores-video-numeros.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { numerosDeBunny, numerosDeWistia } from '../lib/alojadores-video';
import { PLATAFORMAS_VIDEO } from '../lib/types';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('Wistia: las reproducciones del día y el tiempo medio (horas vistas sobre reproducciones)', () => {
  const r = [
    { date: '2026-10-23', load_count: 300, play_count: 10, hours_watched: 0.5 },
    { date: '2026-10-24', load_count: 900, play_count: 40, hours_watched: 2.5 },
  ];
  const n = numerosDeWistia(r, '2026-10-24');
  assert.equal(n?.plays, 40);
  assert.equal(n?.promedioSeg, 225);
  assert.equal(numerosDeWistia(r, '2026-10-25'), null, 'un día que no vino no es un cero');
  assert.equal(numerosDeWistia([{ date: '2026-10-24', play_count: 0, hours_watched: 0 }], '2026-10-24')?.promedioSeg, null, 'sin reproducciones no hay promedio');
});

test('Bunny: las reproducciones del día; su tiempo va crudo, sin inventar la unidad', () => {
  const r = { viewsChart: { '2026-10-23T00:00:00Z': 3, '2026-10-24T00:00:00Z': 12 }, watchTimeChart: { '2026-10-24T00:00:00Z': 3456 }, engagementScore: 61 };
  const n = numerosDeBunny(r, '2026-10-24');
  assert.equal(n?.plays, 12);
  assert.equal(n?.promedioSeg, null);
  assert.equal(n?.crudo.watch_time, 3456);
  assert.equal(numerosDeBunny(r, '2026-10-25'), null);
  assert.equal(numerosDeBunny({}, '2026-10-24'), null);
});

test('el cron escribe sólo el VSL que marcó el negocio, de ese alojador, con su forma de siempre', () => {
  const c = leer('app/api/cron/videos-daily/route.ts');
  assert.match(c, /export async function GET\(request: NextRequest\) \{\s*const authFail = checkCronAuth\(request\);\s*if \(authFail\) return authFail;/);
  assert.match(c, /const vsl = vslDe\(await getVideosLanding\(\)\);\s*if \(!vsl \|\| !vsl\.id\.startsWith\(PREFIJO\[alojador\]\)\) return \{ omitido:/);
  assert.match(c, /for \(const alojador of \['wistia', 'bunny'\] as const\) \{\s*rondas\[alojador\] = await correrPorWorkspace\(alojador,/);
  assert.match(c, /\.delete\(\)\.eq\('fecha', fecha\)\.eq\('plataforma', alojador\)\.eq\('video_id', vsl\.id\);/, 'idempotente, como Panda');
  assert.match(c, /video_unique_viewers: null, video_retention_p50: null/, 'lo que no dan es null, nunca cero');
  const v = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  assert.deepEqual(v.crons.find((x) => x.path === '/api/cron/videos-daily'), { path: '/api/cron/videos-daily', schedule: '35 13 * * *' });
});

test('la base acepta las plataformas, y el funnel, la serie del VSL, sus fuentes y el Dashboard leen todas', () => {
  assert.deepEqual([...PLATAFORMAS_VIDEO], ['panda', 'wistia', 'bunny', 'vimeo', 'cloudflare']);
  const mig = leer('supabase/migrations/XXXX_alojadores_video_plataforma.sql');
  assert.match(mig, /CHECK \(plataforma IN \('meta', 'youtube', 'panda', 'wistia', 'bunny', 'vimeo', 'cloudflare'\)\);/);
  const q = leer('lib/queries.ts');
  assert.equal(q.split("filtros: (q) => enRango(q).in('plataforma', [...PLATAFORMAS_VIDEO])").length - 1, 3, 'la ventana, el funnel y las tendencias');
  assert.match(q, /\.select\('fecha, video_plays, video_unique_viewers, video_retention_p50, video_avg_watch_seconds'\)\s*\.in\('plataforma', \[\.\.\.PLATAFORMAS_VIDEO\]\)/, 'la serie del VSL');
  for (const rel of ['lib/queries.ts', 'lib/sources.ts', 'lib/graficos-datos.ts']) {
    assert.doesNotMatch(leer(rel), /plataforma: 'panda' \}|\.eq\('plataforma', 'panda'\)/, `${rel} todavía lee sólo Panda`);
  }
  assert.match(leer('lib/graficos-datos.ts'), /extra: \(q\) => q\.in\('plataforma', \['youtube', \.\.\.PLATAFORMAS_VIDEO\]\),/);
});
