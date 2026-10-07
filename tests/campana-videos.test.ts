// =============================================================================
// Qué videos lleva una publicación, y qué cuenta como «listo» (tarea #59)
// =============================================================================
// lib/campana-videos.ts decide QUÉ se le pregunta a Meta antes de crear nada, y qué
// respuesta corta la publicación. Las dos mitades fallan en silencio: un ganador contado
// como video subido hace una consulta de más (y puede frenar por un video ajeno); un «no
// pude leer» contado como «sin procesar» frena publicaciones sanas.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeVideoStatus, faltaMiniatura, motivoVideos, videosDeCampana, videosDeConjunto, videosDeCreativos } from '../lib/campana-videos';
import type { CampaignSpec, Creative } from '../lib/campaign-types';

const video = (id: string, extra: Partial<Creative> = {}): Creative => ({ source: 'upload', media_type: 'video', video_id: id, ...extra });

test('los ganadores reusados no cuentan, aunque traigan un video_id', () => {
  const spec = {
    adsets: [
      { ads: [{ name: 'a', creative: video('111') }, { name: 'b', creative: { source: 'existing', source_ad_id: '9', media_type: 'video', video_id: '222' } as Creative }] },
      { ads: [{ name: 'c', creative: video('333') }, { name: 'd', creative: video('111') }] },
    ],
  } as unknown as CampaignSpec;
  assert.deepEqual(videosDeCampana(spec), ['111', '333'], 'el ganador (222) afuera, y el 111 una sola vez');
  //   ROTO A PROPÓSITO (07/10/2026): sacando `c.source === 'existing'` de esVideoSubido,
  //   pass 4 / fail 2 — éste y el del conjunto.
});

test('sólo cuenta un VIDEO: el mismo criterio que buildObjectStorySpec', () => {
  assert.deepEqual(videosDeCreativos([
    { source: 'upload', media_type: 'image', image_hash: 'h', video_id: '555' },
    { source: 'upload', video_id: '666' },
    video('777'),
  ]), ['777'], 'una imagen o un creativo sin media_type no mandan su video_id a Meta');
  assert.deepEqual(videosDeConjunto({ ads: [{ name: 'x', creative: { source: 'existing', source_ad_id: '1', media_type: 'video', video_id: '8' } }] }), []);
});

test('lo que no es un id de Meta no viaja a la URL', () => {
  assert.deepEqual(videosDeCreativos([video('12/../act_1'), video('abc'), video(' 42 ')]), ['42']);
});

test('video_status: expired y lo desconocido son error; «no pude leer» no es nada', () => {
  assert.equal(estadoDeVideoStatus('ready'), 'ready');
  assert.equal(estadoDeVideoStatus('processing'), 'processing');
  assert.equal(estadoDeVideoStatus('expired'), 'error');
  assert.equal(estadoDeVideoStatus('error'), 'error');
  assert.equal(estadoDeVideoStatus('algo_nuevo'), 'error');
  // null NO bloquea: tratarlo como «sin procesar» frena publicaciones sanas por un bache.
  assert.equal(estadoDeVideoStatus(undefined), null);
  assert.equal(estadoDeVideoStatus(''), null);
  assert.equal(estadoDeVideoStatus(null), null);
  //   ROTO A PROPÓSITO (07/10/2026): con `if (typeof vs !== 'string' || …) return 'processing'`,
  //   pass 5 / fail 1 — éste.
});

test('el motivo del 409: el error manda sobre el «procesando», y sin nada no hay motivo', () => {
  assert.equal(motivoVideos(null), null);
  assert.equal(motivoVideos({ procesando: [], conError: [] }), null);
  assert.match(motivoVideos({ procesando: ['1'], conError: [] }) ?? '', /sigue procesándose/);
  assert.match(motivoVideos({ procesando: ['1'], conError: ['2'] }) ?? '', /no pudo procesar/, 'esperar no arregla un error');
  assert.match(motivoVideos({ procesando: ['1', '2'], conError: [] }) ?? '', /^2 videos/);
});

test('la miniatura que exige Meta para publicar: una data: no sirve', () => {
  assert.equal(faltaMiniatura(video('1', { thumbnail_url: 'data:image/jpeg;base64,xx' })), true, 'el frame del navegador Meta no lo descarga');
  assert.equal(faltaMiniatura(video('1')), true);
  assert.equal(faltaMiniatura(video('1', { thumbnail_url: 'https://scontent.xx/t.jpg' })), false);
  assert.equal(faltaMiniatura(video('1', { image_hash: 'abc' })), false);
  assert.equal(faltaMiniatura({ source: 'upload', media_type: 'image', image_hash: 'h' }), false);
  //   ROTO A PROPÓSITO (07/10/2026): aceptando cualquier thumbnail_url no vacía (sin el
  //   /^https?:/), pass 5 / fail 1 — éste: la data: URL pasaba como miniatura válida.
});
