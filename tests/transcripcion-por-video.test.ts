// =============================================================================
// O9 (18/11/2026): el mismo video en varios anuncios se transcribe UNA vez (creative_transcripts)
// =============================================================================
// Martín, 31/07/2026: «guardar la transcripción al cargar el anuncio, para no transcribir dos veces». La tabla existía (mig 0106)
// y desde el 27/10 no la escribía nadie: el cron diario y la extracción del historial transcribían cada anuncio aunque su video
// ya estuviera transcripto. Lo que fija este test, corriendo `transcribirAnuncio` de verdad (tests/_transcripcion-por-video-hijo.ts):
//   1. el primer anuncio de un video se transcribe y queda guardado en creative_transcripts, en SU negocio;
//   2. el segundo anuncio del mismo video sale de lo guardado, sin bajar el video ni llamar a la IA;
//   3. lo guardado de un negocio no lo ve otro con el mismo video;
//   4. con una instrucción (el «Re-generar») no se pregunta por lo guardado, y si la lectura falla se transcribe igual;
//   5. qué se guarda y qué se reusa (las reglas puras): ok y muy_grande sí, error nunca.
//
// Probado rompiéndolo (18/11/2026, una rotura por vez, restaurada; base en verde: 5 de 5):
//   · sin la pregunta por lo guardado en transcribeAd → 1 en rojo (el 2);
//   · sin la escritura en transcribirAnuncio → 2 en rojo (el 1 y el 2);
//   · leyendo con getSupabaseServer() en vez del db del negocio → 1 en rojo (el 3);
//   · preguntando por lo guardado también con instrucción → 1 en rojo (el 4);
//   · guardando también los `error` → 1 en rojo (el 5).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { filaParaGuardar, guardadaDeFila } from '../lib/transcripcion-por-video-reglas';
import type { TranscribeResult } from '../lib/transcribe';

const RAIZ = join(__dirname, '..');
type R = { ad_id: string; video_id: string | null; status: string; transcript: string | null; model: string | null; reusada?: boolean };
type Corrida = { r: R; red: string[] };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_transcripcion-por-video-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
});
const S = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  a1: Corrida; a2: Corrida; ws13: Corrida; instruccion: Corrida & { preguntada: boolean }; fallaLectura: Corrida;
  guardadas: Array<{ ws: number; video: string; status: string; texto: string }>; error?: string;
};
const ia = (red: string[]) => red.filter((x) => /api\.openai\.com/.test(x));
const bajada = (red: string[]) => red.filter((x) => /video\.test/.test(x));

test('1. el primer anuncio de un video se transcribe y queda guardado en su negocio', () => {
  assert.equal(S.error, undefined, String(S.error));
  assert.equal(S.a1.r.status, 'ok');
  assert.equal(S.a1.r.reusada, undefined, 'el primero no sale de lo guardado');
  assert.ok(ia(S.a1.red).length > 0, 'el primero sí llama a la IA');
  assert.deepEqual(S.guardadas.map((g) => `${g.ws}:${g.video}:${g.status}`), ['3:v1:ok']);
  assert.equal(S.guardadas[0].texto, S.a1.r.transcript);
});

test('2. el segundo anuncio del mismo video sale de lo guardado: ni se baja el video ni se llama a la IA', () => {
  assert.equal(S.a2.r.reusada, true);
  assert.equal(S.a2.r.ad_id, 'a2', 'la fila es del anuncio nuevo');
  assert.equal(S.a2.r.video_id, 'v1');
  assert.equal(S.a2.r.transcript, S.a1.r.transcript);
  assert.equal(S.a2.r.model, 'openai', 'dice quién la transcribió de verdad');
  assert.deepEqual(ia(S.a2.red), [], 'no se paga la IA otra vez');
  assert.deepEqual(bajada(S.a2.red), [], 'no se baja el video otra vez');
});

test('3. lo guardado de un negocio no lo ve otro con el mismo video', () => {
  assert.notEqual(S.ws13.r.reusada, true, 'ws13 reusó la transcripción de ws3');
  assert.equal(S.ws13.r.status, 'error', 'ws13 no tiene IA: tiene que intentar y fallar');
  assert.ok(bajada(S.ws13.red).length > 0, 'ws13 baja su video');
});

test('4. con una instrucción no se pregunta por lo guardado; si la lectura falla, se transcribe igual', () => {
  assert.equal(S.instruccion.preguntada, false, 'rehacerla es el pedido');
  assert.notEqual(S.instruccion.r.transcript, 'GUARDADA');
  assert.ok(ia(S.instruccion.red).length > 0);
  assert.equal(S.fallaLectura.r.status, 'ok');
  assert.notEqual(S.fallaLectura.r.reusada, true);
  assert.ok(ia(S.fallaLectura.red).length > 0, 'no pude leer no es «no hay que hacerla»');
});

test('5. qué se guarda y qué se reusa: ok y muy_grande sí; error, una imagen o lo ya reusado, no', () => {
  const base: TranscribeResult = { ad_id: 'a', video_id: 'v', tipo: 'video', status: 'ok', transcript: 't', secciones: null, idioma: null, duracion_s: null, model: 'm', error: null };
  assert.equal(filaParaGuardar(base)?.video_id, 'v');
  assert.equal(filaParaGuardar({ ...base, status: 'muy_grande', transcript: null })?.status, 'muy_grande');
  assert.equal(filaParaGuardar({ ...base, status: 'error' }), null, 'un error suele ser transitorio');
  assert.equal(filaParaGuardar({ ...base, tipo: 'imagen' }), null);
  assert.equal(filaParaGuardar({ ...base, video_id: null }), null);
  assert.equal(filaParaGuardar({ ...base, reusada: true }), null);
  assert.equal(guardadaDeFila({ status: 'error', transcript: 'x' }), null, 'una fila con error no se reusa');
  assert.equal(guardadaDeFila(null), null);
  const g = guardadaDeFila({ status: 'ok', transcript: '', secciones: [{ titulo: 'Hook', texto: 'h' }, { titulo: 1 }], duracion_s: '12.5' });
  assert.equal(g?.transcript, '', 'un video sin voz es un resultado');
  assert.deepEqual(g?.secciones, [{ titulo: 'Hook', texto: 'h' }]);
  assert.equal(g?.duracion_s, 12.5);
});
