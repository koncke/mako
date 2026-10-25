// =============================================================================
// El catálogo de videos de cada alojador, con el id que manda el Pixel (25/10/2026)
// =============================================================================
// «Otros alojadores de video» (Martín, por el Cerebro): «que los lugares donde consume eso... puedan traer datos de
// tus videos de esas herramientas conectadas». Lo que fija (lib/alojadores-video.ts, puro):
//   1. de cada respuesta, el video con el MISMO id que manda el Pixel v27 (vimeo:, w:, bunny:, cfs:), su título, su
//      reproductor, su portada, su duración y sus reproducciones cuando la API las da;
//   2. lo que no es un video o no se puede insertar se deja afuera, y nada de la respuesta abre una etiqueta.
// ⚠️ Las respuestas de ejemplo siguen la DOCUMENTACIÓN de cada alojador (25/10/2026), no una cuenta de verdad: probar
// en vivo necesita la clave de una cuenta real de cada uno. Los videos son los públicos con los que se probó el Pixel.
// Correr: node --import tsx --test tests/alojadores-video-catalogo.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videosDeBunny, videosDeCloudflare, videosDeVimeo, videosDeWistia } from '../lib/alojadores-video';
import { videosDeHtml } from '../lib/landing-analisis';

test('Vimeo: GET /me/videos, con el h= del no listado y las reproducciones', () => {
  const r = { total: 2, paging: { next: '/me/videos?page=2' }, data: [
    { uri: '/videos/76979871', name: 'The New Vimeo Player', duration: 62, player_embed_url: 'https://player.vimeo.com/video/76979871?h=8272103f6e', pictures: { base_link: 'https://i.vimeocdn.com/video/452001751-x' }, stats: { plays: 1234 } },
    { uri: '/videos/abc', name: 'Sin número', player_embed_url: 'https://player.vimeo.com/video/1' },
  ] };
  assert.deepEqual(videosDeVimeo(r), [{
    alojador: 'vimeo', id: 'vimeo:76979871', titulo: 'The New Vimeo Player', player: 'https://player.vimeo.com/video/76979871?h=8272103f6e',
    portada: 'https://i.vimeocdn.com/video/452001751-x', duracion: 62, reproducciones: 1234,
  }]);
});

test('Wistia: GET /v1/medias.json, sólo los videos', () => {
  const r = [
    { hashed_id: '4d8229898d', name: 'Demo', type: 'Video', duration: 125.4, thumbnail: { url: 'https://embed-ssl.wistia.com/deliveries/x.jpg' } },
    { hashed_id: 'aud1000000', name: 'Un audio', type: 'Audio', duration: 30 },
  ];
  assert.deepEqual(videosDeWistia(r), [{
    alojador: 'wistia', id: 'w:4d8229898d', titulo: 'Demo', player: 'https://fast.wistia.net/embed/iframe/4d8229898d',
    portada: 'https://embed-ssl.wistia.com/deliveries/x.jpg', duracion: 125.4, reproducciones: null,
  }]);
});

test('Bunny Stream: GET /library/{biblioteca}/videos, con la biblioteca en el reproductor', () => {
  const r = { totalItems: 1, currentPage: 1, itemsPerPage: 100, items: [
    { guid: 'DC48A09E-D9BB-420A-83D7-72DC2304C034', title: 'Demo de Bunny', length: 23, views: 87, thumbnailFileName: 'thumbnail.jpg' },
    { guid: 'no-es-un-guid', title: 'x' },
  ] };
  const v = videosDeBunny(r, '197133');
  assert.deepEqual(v, [{
    alojador: 'bunny', id: 'bunny:dc48a09e-d9bb-420a-83d7-72dc2304c034', titulo: 'Demo de Bunny',
    player: 'https://iframe.mediadelivery.net/embed/197133/dc48a09e-d9bb-420a-83d7-72dc2304c034', portada: null, duracion: 23, reproducciones: 87,
  }]);
  assert.deepEqual(videosDeBunny(r, '19 7"'), [], 'una biblioteca que no es un número no arma reproductores');
});

test('Cloudflare Stream: GET /accounts/{cuenta}/stream, con el dominio customer- del reproductor', () => {
  const r = { success: true, result: [
    { uid: '6b9e68b07dfee8cc2d116e4c51d6a957', meta: { name: 'Demo' }, duration: 30, thumbnail: 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/thumbnails/thumbnail.jpg', preview: 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/watch' },
    { uid: '5d5bc37ffcf54c9b82e996823bffbb81', meta: {}, duration: -1 },
  ] };
  const v = videosDeCloudflare(r);
  assert.equal(v[0].player, 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/iframe');
  assert.equal(v[0].duracion, 30);
  assert.deepEqual(v[1], { alojador: 'cloudflare', id: 'cfs:5d5bc37ffcf54c9b82e996823bffbb81', titulo: 'cfs:5d5bc37ffcf54c9b82e996823bffbb81', player: 'https://iframe.videodelivery.net/5d5bc37ffcf54c9b82e996823bffbb81', portada: null, duracion: null, reproducciones: null }, 'procesando: sin duración, sin nombre');
});

test('el id del catálogo es el MISMO que arma el analizador (y el Pixel) para su reproductor', () => {
  const todos = [
    ...videosDeVimeo({ data: [{ uri: '/videos/76979871', player_embed_url: 'https://player.vimeo.com/video/76979871' }] }),
    ...videosDeWistia([{ hashed_id: '4d8229898d', type: 'Video' }]),
    ...videosDeBunny({ items: [{ guid: 'dc48a09e-d9bb-420a-83d7-72dc2304c034' }] }, '197133'),
    ...videosDeCloudflare({ result: [{ uid: '6b9e68b07dfee8cc2d116e4c51d6a957', preview: 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/watch' }] }),
  ];
  for (const v of todos) {
    assert.equal(videosDeHtml('https://ejemplo.com/', `<iframe src="${v.player}"></iframe>`)[0]?.id, v.id, v.player);
  }
});

test('nada de la respuesta abre una etiqueta ni un enlace que no sea https', () => {
  const v = videosDeVimeo({ data: [{ uri: '/videos/1', name: 'x', player_embed_url: 'javascript:alert(1)' }, { uri: '/videos/2', name: 'y', player_embed_url: 'https://player.vimeo.com/video/2"><script>' }] });
  assert.deepEqual(v, []);
  assert.equal(videosDeWistia([{ hashed_id: '"><img src=x>', type: 'Video' }]).length, 0);
});

test('la API: listar_videos_alojados lee el catálogo de todos los conectados, con su ruta', async () => {
  const { porId } = await import('../lib/api-mako/registro');
  const d = porId('listar_videos_alojados');
  assert.ok(d && d.tipo === 'lectura', 'no está en el registro');
  const { readFileSync } = await import('node:fs');
  const leer = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
  assert.ok(leer('lib/api-mako/rest.ts').includes("['GET', '/landing/videos-alojados', 'listar_videos_alojados'],"));
  const run = leer('lib/api-mako/areas/landing.run.ts');
  assert.ok(run.includes('await Promise.all([catalogoDeVideos(), alojadoresConectados(), pandaConectado()])'));
  assert.ok(run.includes('...(fallas.length ? { no_se_pudo_leer: fallas } : {}),'), 'lo que no se pudo leer se dice');
});
