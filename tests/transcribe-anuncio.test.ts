// =============================================================================
// IA7 (22/10/2026): una sola puerta para el audio — los anuncios del negocio se escuchan con SU IA
// =============================================================================
// lib/transcribe.ts era una segunda cascada con las keys del ENTORNO (whisper-1, gpt-4o-mini y gpt-4o de MaKo), fuera de
// D6b y sin registrar uso. La OpenAI de MaKo se quedó sin crédito: en ad_transcripts hubo 55 «vision» y 28 «whisper» con
// «no credits» y 0 OK en 30 días. Lo que fija este test, corriendo `transcribeAd` de verdad (tests/_transcribe-anuncio-hijo.ts):
//   1. un negocio con su OpenAI escucha y estructura el anuncio con SU clave, el uso queda registrado en su workspace, y la
//      fila dice quién lo transcribió;
//   2. ningún pedido lleva una key de la plataforma (ni las del entorno ni la red gratis): sin IA, la fila dice POR QUÉ;
//   3. lib/transcribe.ts no lee ninguna key de IA del entorno, y lo de la plataforma (cursos, Conocimiento) quedó aparte.
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · los anuncios con la red de la plataforma (sin `pii`) → 2 en rojo;
//   · la fila sin quién la transcribió → 1 en rojo;
//   · el error crudo del STT en vez del porqué → 2 en rojo;
//   · una key del entorno leída en lib/transcribe.ts → 3 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
type Corrida = { r: { status: string; transcript: string | null; secciones: unknown[] | null; model: string | null; error: string | null }; red: Array<{ host: string; camino: string; auth: string }> };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_transcribe-anuncio-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as { ws3: Corrida; ws13: Corrida; usoWs3: Array<{ provider: string; feature: string }>; error?: string };

test('1. con su OpenAI, el anuncio se escucha y se estructura con SU clave, y queda registrado', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.equal(R.ws3.r.status, 'ok', String(R.ws3.r.error));
  assert.match(R.ws3.r.transcript ?? '', /duplicar tus ventas/);
  assert.equal(R.ws3.r.secciones?.length, 2);
  assert.equal(R.ws3.r.model, 'openai', 'la fila dice quién lo transcribió');
  const ia = R.ws3.red.filter((x) => x.host === 'api.openai.com');
  assert.deepEqual(ia.map((x) => x.camino), ['/v1/audio/transcriptions', '/v1/chat/completions']);
  for (const x of ia) assert.match(x.auth, /DEL-NEGOCIO/, 'con la clave del negocio');
  assert.deepEqual(R.usoWs3.map((u) => u.feature).sort(), ['anuncios-estructura', 'anuncios-transcribir'], 'el uso se registra (antes, la OpenAI de MaKo no aparecía en anthropic_usage)');
});

test('2. ningún pedido lleva una key de la plataforma, y sin IA la fila dice por qué', () => {
  for (const ws of ['ws3', 'ws13'] as const) {
    for (const x of R[ws].red) assert.doesNotMatch(x.auth, /PLATAFORMA|red-de-la-plataforma/, `${ws}: ${x.host}${x.camino} con una key de la plataforma`);
  }
  assert.deepEqual(R.ws13.red.filter((x) => /openai|groq|googleapis|anthropic/.test(x.host)), [], 'sin IA del negocio, a ninguna IA');
  assert.equal(R.ws13.r.status, 'error');
  assert.match(R.ws13.r.error ?? '', /no puede transcribir el audio del anuncio/, 'el porqué en palabras del negocio');
  assert.doesNotMatch(R.ws13.r.error ?? '', /transcribirAudio —|whisper:|You have no credits/, 'no el error crudo del proveedor');
});

test('3. lib/transcribe.ts no lee keys de IA del entorno; lo de la plataforma quedó en lib/transcribe-plataforma.ts', () => {
  const anuncios = sinComentarios(readFileSync(join(RAIZ, 'lib/transcribe.ts'), 'utf8'));
  assert.doesNotMatch(anuncios, /OPENAI_API_KEY|GROQ_API_KEY|GEMINI_API_KEY|envCred|api\.openai\.com/);
  const plataforma = sinComentarios(readFileSync(join(RAIZ, 'lib/transcribe-plataforma.ts'), 'utf8'));
  assert.match(plataforma, /export async function transcribeMediaBuffer\(/);
  // Quién usa cada uno: el Conocimiento y los cursos, la plataforma; los creativos del negocio, el suyo.
  assert.match(readFileSync(join(RAIZ, 'app/api/mako/knowledge/transcribe/route.ts'), 'utf8'), /from '@\/lib\/transcribe-plataforma'/);
  // (27/10/2026: creative-upload y analyze-creatives se borraron con el Ads Manager viejo; el cron de los anuncios queda.)
  assert.match(readFileSync(join(RAIZ, 'app/api/cron/transcribe-ads/route.ts'), 'utf8'), /from '@\/lib\/transcribe'/);
});
