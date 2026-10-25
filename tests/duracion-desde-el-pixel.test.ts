// =============================================================================
// La duración de cada video sale también de los eventos del propio Pixel, para cualquier alojador (25/10/2026)
// =============================================================================
// «Otros alojadores de video» (Martín, por el Cerebro). Hasta acá la duración de un video salía SÓLO de la API de
// Panda (getDuracionesVsl, lib/leads.ts): un video de Vimeo, YouTube, Wistia, Bunny, Cloudflare o uno propio no tenía
// con qué volver porcentaje sus segundos, ni en la ficha del lead ni en «Cuánto ven el video». Cada evento con
// porcentaje trae los segundos: duración = segundos × 100 / porcentaje. Lo que fija:
//   1. la cuenta, con los eventos REALES que mandó el Pixel con el video de Cloudflare (su reproductor dice 30 s);
//   2. lo que no cuenta (un porcentaje bajo, un play, un player sin identificar) y la mediana contra un valor raro;
//   3. lo de Panda manda, y «la única duración conocida» sigue siendo la única DE PANDA en los dos resolvedores.
// Correr: node --import tsx --test tests/duracion-desde-el-pixel.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { duracionesDeEventos } from '../lib/vsl-retencion';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const CF = 'cfs:6b9e68b07dfee8cc2d116e4c51d6a957';

test('con los eventos reales del video de Cloudflare (30 s según su reproductor)', () => {
  // Lo que mandó el Pixel v27 el 25/10/2026 (scripts/pixel-alojadores-real.mts), tal cual.
  const ev = [
    { video_id: CF, porcentaje: 0, segundos: 0 },
    { video_id: CF, porcentaje: 5, segundos: 1.492461 },
    { video_id: CF, porcentaje: 10, segundos: 3.079143 },
    { video_id: CF, porcentaje: 15, segundos: 4.406267 },
    { video_id: CF, porcentaje: 20, segundos: 5.999372 },
    { video_id: CF, porcentaje: 25, segundos: 7.329533 },
    { video_id: CF, porcentaje: 30, segundos: 8.926701 },
    { video_id: CF, porcentaje: 35, segundos: 10.526649 },
    { video_id: CF, porcentaje: 40, segundos: 11.846027 },
    { video_id: CF, porcentaje: 44, segundos: 13.116593 },
  ];
  const d = duracionesDeEventos(ev).get(CF)!;
  assert.ok(Math.abs(d - 30) < 0.6, `dio ${d}`);
});

test('lo que no cuenta, y la mediana contra un valor raro', () => {
  const ev = [
    { video_id: 'vimeo:1', porcentaje: 5, segundos: 9 }, // diría 180: el redondeo pesa demasiado en un 5 %
    { video_id: 'vimeo:1', porcentaje: 25, segundos: 30 },
    { video_id: 'vimeo:1', porcentaje: 50, segundos: 60 },
    { video_id: 'vimeo:1', porcentaje: 75, segundos: 90 },
    { video_id: 'vimeo:1', porcentaje: 60, segundos: 400 }, // una posición rara: la mediana no se corre
    { video_id: 'yt:abc', porcentaje: 0, segundos: 0 },
    { video_id: 'yt:abc', porcentaje: null, segundos: 15 },
    { video_id: '', porcentaje: 50, segundos: 10 },
  ];
  const m = duracionesDeEventos(ev);
  assert.equal(m.get('vimeo:1'), 120);
  assert.equal(m.has('yt:abc'), false, 'sin un porcentaje desde 25 no hay duración');
  assert.equal(m.size, 1);
});

test('lo de Panda manda, se completa con el Pixel, y «la única» sigue siendo la de Panda', () => {
  const leads = leer('lib/leads.ts');
  const i = leads.indexOf('export async function getDuracionesVsl');
  const cuerpo = leads.slice(i, leads.indexOf('\n}\n', i));
  assert.ok(cuerpo.indexOf(".eq('plataforma', 'panda')") < cuerpo.indexOf(".from('vsl_events')"), 'primero Panda');
  assert.match(cuerpo, /\.gte\('porcentaje', 25\)\s*\.gt\('segundos', 0\)/);
  assert.match(cuerpo, /\.filter\(\(r\) => !\/\^iframe\\d\+\$\/\.test\(r\.video_id\?\.trim\(\) \?\? ''\)\);/);
  assert.match(cuerpo, /for \(const \[vid, dur\] of duracionesDeEventos\(filas\)\) if \(!out\.has\(vid\)\) out\.set\(vid, dur\);/);
  for (const rel of ['lib/leads.ts', 'lib/graficos-datos-extra.ts']) {
    const s = leer(rel);
    assert.match(s, /const dePanda = \[\.\.\.durs\]\.filter\(\(\[k\]\) => !idDeclaraHost\(k\)\);\s*const unica = dePanda\.length === 1 \? dePanda\[0\]\[1\] : null;/, rel);
    assert.doesNotMatch(s, /const unica = durs\.size === 1/, rel);
  }
});
