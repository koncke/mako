// =============================================================================
// Los ANUNCIOS en video de la competencia también se transcriben (13/11/2026, Copywriting: «no está transcribiendo»)
// =============================================================================
// El Cerebro: «transcribe también los anuncios en video de la competencia… extiende la misma ruta de Spy que ya transcribe reels y
// YouTube». El video se pide fresco al actor de anuncios (su enlace vence), con la clave y el tope del día de Spy, y lo escucha la IA
// del negocio. La pantalla de Spy NO lo pide sola al abrir un anuncio: lo pide Copywriting al replicarlo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { entradaDeUnAnuncio, videoDelAnuncio } from '../lib/spy-todo-reglas';
import { enlaceDeLaPublicacion, esAnuncioConVideo, esDeLaBibliotecaDeAnuncios, tieneGuion } from '../lib/spy-transcripcion';
import { transcribirSiHaceFalta, TRANSCRITO, type Dependencias } from '../app/copywriter/transcribir-original';
import type { OutlierCopy } from '../lib/copywriter/outliers';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('el video de un anuncio: el HD del snapshot, el SD, o el de una tarjeta; nada si es de imagen', () => {
  assert.equal(videoDelAnuncio([{ snapshot: { videos: [{ videoHdUrl: 'https://video.xx.fbcdn.net/hd.mp4', videoSdUrl: 'https://video.xx.fbcdn.net/sd.mp4' }] } }]), 'https://video.xx.fbcdn.net/hd.mp4');
  assert.equal(videoDelAnuncio([{ snapshot: { videos: [{ video_sd_url: 'https://video.xx.fbcdn.net/sd.mp4' }] } }]), 'https://video.xx.fbcdn.net/sd.mp4');
  assert.equal(videoDelAnuncio([{ snapshot: { videos: [], cards: [{ videoHdUrl: 'https://video.xx.fbcdn.net/carta.mp4' }] } }]), 'https://video.xx.fbcdn.net/carta.mp4');
  assert.equal(videoDelAnuncio([{ snapshot: { images: [{ originalImageUrl: 'https://x/y.jpg' }] } }]), null);
  assert.equal(videoDelAnuncio([{ snapshot: { videos: [{ videoHdUrl: 'http://inseguro/v.mp4' }] } }]), null, 'sólo https');
  assert.equal(videoDelAnuncio(null), null);
  assert.deepEqual(entradaDeUnAnuncio('https://www.facebook.com/ads/library/?id=123456789'), { startUrls: [{ url: 'https://www.facebook.com/ads/library/?id=123456789' }], resultsLimit: 1, isDetailsPerAd: false, onlyTotal: false });
});

test('un anuncio en video tiene guion para el SERVER, pero la pantalla de Spy no lo pide sola', () => {
  const anuncio = { canal: 'anuncios', tipo: 'anuncio', ref: '1234567890', url: 'https://www.facebook.com/ads/library/?id=1234567890', medio: 'video' };
  assert.equal(esAnuncioConVideo(anuncio), true);
  assert.equal(esAnuncioConVideo({ ...anuncio, medio: 'imagen' }), false);
  assert.equal(tieneGuion(anuncio), false, 'abrir el detalle en Spy no gasta Apify ni IA');
  const enlace = enlaceDeLaPublicacion(anuncio);
  assert.equal(enlace, 'https://www.facebook.com/ads/library/?id=1234567890');
  assert.equal(esDeLaBibliotecaDeAnuncios(enlace ?? ''), true);
  assert.equal(esDeLaBibliotecaDeAnuncios('https://www.instagram.com/p/abc/'), false);
  // El server: lo admite, lo pide por el actor de anuncios con el mismo tope del día, y lee `medio` sin nombrar columnas.
  const srv = leer('lib/spy-transcripcion-servidor.ts');
  assert.ok(srv.includes('const enlace = tieneGuion(p) || esAnuncioConVideo(p) ? enlaceDeLaPublicacion(p) : null;'));
  assert.ok(srv.includes('video: (enlace) => (esDeLaBibliotecaDeAnuncios(enlace) ? videoDeUnAnuncio(ws, enlace) : videoDeUnaPublicacion(ws, enlace)),'));
  assert.ok(srv.includes(".from('spy_piezas').select('*').eq('id', piezaId)"));
  const todo = leer('lib/spy-todo.ts');
  assert.ok(todo.includes('export async function videoDeUnAnuncio(ws: number, enlace: string)'));
  assert.ok(todo.includes('if (!(await reservarCorrida(CLAVE_DIA_TRANSCRIPCIONES, TRANSCRIPCIONES_POR_DIA))) return { ok: false, motivo: \'limite\' };'));
});

test('un anuncio transcrito llega a MaKo con lo que se dice Y su texto', () => {
  const src = leer('lib/copywriter/outliers.ts');
  assert.ok(src.includes("const texto = formato === 'anuncio' && guion && copy ? `${guion}\\n\\nEL TEXTO DEL ANUNCIO: ${copy}` : guion || copy;"));
});

test('Copywriting pide el guion de un anuncio al replicarlo; uno de imagen no dice nada', async () => {
  const anuncio = { ok: true as const, outlier: { formato: 'anuncio', deDonde: 'copy' } as OutlierCopy };
  const deps = (estado: 'listo' | 'no-aplica' | 'sin-clave'): Dependencias => ({
    original: async () => anuncio,
    transcribir: async () => (estado === 'listo'
      ? { ok: true, guion: { estado: 'listo', texto: 'Vamos a mostrar en vivo…', motivo: null } }
      : { ok: true, guion: { estado } }),
    espera: async () => {}, ahora: () => 0,
  });
  assert.deepEqual(await transcribirSiHaceFalta('spy:9', () => {}, deps('listo')), { ok: true, texto: TRANSCRITO });
  assert.equal(await transcribirSiHaceFalta('spy:9', () => {}, deps('no-aplica')), null, 'un anuncio de imagen');
  assert.match((await transcribirSiHaceFalta('spy:9', () => {}, deps('sin-clave')))?.texto ?? '', /falta la clave de Competitors Spy\), así que no sé lo que se dice: lo escribo con el texto del anuncio/);
});
