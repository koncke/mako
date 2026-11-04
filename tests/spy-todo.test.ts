// =============================================================================
// Traer TODO: todas sus publicaciones, sus videos y sus anuncios (puntos 8 y 10 del 4/11/2026)
// =============================================================================
// Martín: «que no traiga solo 50 reels o videos, que traiga muchos más, si puede, todos directamente» y «todos los
// anuncios de la biblioteca de anuncios». Lo que cuida este archivo:
//   1. que la lectura de siempre (lo último) NO marque como borrado el historial que trajo la corrida larga;
//   2. que la corrida larga pida mucho la primera vez y sólo lo nuevo después, con su techo en dólares;
//   3. que los anuncios del actor se lean en los dos dialectos que se vieron, y sin inventar fechas;
//   4. que YouTube completo pagine hasta el final y no corte al llegar a los largos.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada:
//   · `seFueron` sin la ventana (marca todo lo que no vino)            → 1
//   · `pedidoDePublicaciones` que pide 300 también al refrescar        → 2
//   · `tocaPedir` con una corrida en marcha                            → 3
//   · `anuncioDeApify` sin el dialecto snake_case                       → 4
//   · `anuncioDeApify` que lee `hasta` de un anuncio activo             → 4
//   · `entradaDeAnuncios` sin `active_status=all`                       → 5
//   · YouTube completo que corta en los 20 largos                       → 7
// Correr: node --import tsx --test tests/spy-todo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORRIDAS_LARGAS_POR_DIA, DIAS_ENTRE_CORRIDAS, PUBLICACIONES_PRIMERA, PUBLICACIONES_REFRESCO, anuncioDeApify,
  entradaDeAnuncios, entradaDePublicaciones, estadoDeCorrida, fechaDeAnuncio, leerTareas, pedidoDePublicaciones, seFueron, tocaPedir,
} from '../lib/spy-todo-reglas';
import { piezasDeApify } from '../lib/instagram-perfil';
import { leerCompleto, traerVideosDelCanal, VIDEOS_POR_LECTURA_COMPLETA } from '../lib/spy-youtube';

const AHORA = Date.parse('2026-11-04T12:00:00Z');

test('1. lo que no vino en la lectura de siempre se marca borrado sólo si esa lectura llegaba hasta ahí', () => {
  const guardadas = [
    { id: 1, ref: 'nuevo', publicada_en: '2026-11-01' },
    { id: 2, ref: 'borrado-reciente', publicada_en: '2026-10-25' },
    { id: 3, ref: 'viejo-del-historial', publicada_en: '2025-03-10' },
    { id: 4, ref: 'sin-fecha', publicada_en: null },
  ];
  const leidas = [{ ref: 'nuevo', publicadaEn: '2026-11-01' }, { ref: 'otro', publicadaEn: '2026-10-20' }];
  assert.deepEqual(seFueron(guardadas, leidas), [2], 'sólo el que estaba dentro de lo que la lectura mira');
  assert.deepEqual(seFueron(guardadas, []), [], 'una lectura vacía no borra nada');
  assert.deepEqual(seFueron(guardadas, [{ ref: 'x' }]), [], 'sin fechas no hay ventana: no se marca nada');
});

test('2. la primera corrida trae mucho; después, sólo lo nuevo desde la anterior (con un día de solape)', () => {
  const primera = pedidoDePublicaciones(undefined);
  assert.equal(primera.cuantas, PUBLICACIONES_PRIMERA);
  assert.equal(primera.desde, null);
  assert.ok(primera.techoUsd > 0 && primera.techoUsd <= 1, `el techo de la primera: US$${primera.techoUsd}`);
  const despues = pedidoDePublicaciones({ ultima: '2026-10-28T09:00:00Z' });
  assert.equal(despues.cuantas, PUBLICACIONES_REFRESCO);
  assert.equal(despues.desde, '2026-10-27');
  assert.deepEqual(entradaDePublicaciones('@denborgg', despues), {
    directUrls: ['https://www.instagram.com/denborgg/'], resultsType: 'posts', resultsLimit: PUBLICACIONES_REFRESCO,
    addParentData: false, onlyPostsNewerThan: '2026-10-27',
  });
  assert.ok(CORRIDAS_LARGAS_POR_DIA > 0);
});

test('3. se pide si nunca hubo, o a la semana; nunca con una corrida en marcha', () => {
  assert.equal(tocaPedir(undefined, AHORA), true);
  assert.equal(tocaPedir({ ultima: new Date(AHORA - 86_400_000).toISOString() }, AHORA), false);
  assert.equal(tocaPedir({ ultima: new Date(AHORA - DIAS_ENTRE_CORRIDAS * 86_400_000).toISOString() }, AHORA), true);
  assert.equal(tocaPedir({ run: 'abcdef123', dataset: 'ds123456', ultima: '2020-01-01T00:00:00Z' }, AHORA), false);
  // El registro: una corrida sin su dataset no se puede leer, y lo que no tiene forma se descarta.
  const r = leerTareas(JSON.stringify({ '7': { instagram: { run: 'abcdef123' }, anuncios: { run: 'r1x2y3z4', dataset: 'd1x2y3z4' } }, x: {} }));
  assert.deepEqual(r, { '7': { instagram: {}, anuncios: { run: 'r1x2y3z4', dataset: 'd1x2y3z4' } } });
  assert.equal(estadoDeCorrida('RUNNING'), 'corre');
  assert.equal(estadoDeCorrida('SUCCEEDED'), 'termino');
  assert.equal(estadoDeCorrida('TIMED-OUT'), 'fallo');
});

test('4. un anuncio del actor, en sus dos dialectos, y sin inventar el fin de uno que sigue', () => {
  const camel = anuncioDeApify({
    adArchiveID: '1234567890', pageName: 'Víctor Heras', isActive: true, startDate: 1761955200, endDate: 1762560000,
    snapshot: { body: { text: 'Aprende a vender con reels' }, title: 'Curso', linkUrl: 'https://viralidad.com/curso', images: [{ originalImageUrl: 'https://scontent/x.jpg' }] },
  });
  assert.deepEqual(camel, {
    id: '1234567890', desde: '2025-11-01T00:00:00.000Z', hasta: null, pagina: { nombre: 'Víctor Heras', handle: null },
    texto: 'Aprende a vender con reels', titulo: 'Curso', destino: 'https://viralidad.com/curso', miniatura: 'https://scontent/x.jpg',
  });
  const snake = anuncioDeApify({
    ad_archive_id: 987654321, page_name: 'Otra', is_active: false, start_date: '2026-09-01', end_date: '2026-09-30',
    snapshot: {
      body: { markup: { __html: '<p>Hola <b>mundo</b></p>' } },
      cards: [{ title: 'T', link_url: 'https://otra.com', video_preview_image_url: 'https://v/p.jpg' }],
      page_profile_uri: 'https://www.facebook.com/otra.pagina/',
    },
  });
  assert.equal(snake?.id, '987654321');
  assert.equal(snake?.hasta, '2026-09-30T00:00:00.000Z', 'uno que terminó dice cuándo');
  assert.equal(snake?.texto, 'Hola mundo');
  assert.equal(snake?.destino, 'https://otra.com');
  assert.equal(snake?.miniatura, 'https://v/p.jpg');
  assert.equal(snake?.pagina?.handle, 'otra.pagina');
  assert.equal(anuncioDeApify({ adArchiveID: 'no-es-un-numero' }), null);
  assert.equal(anuncioDeApify('x'), null);
  assert.equal(fechaDeAnuncio('nada'), null);
  assert.equal(fechaDeAnuncio(1761955200000), '2025-11-01T00:00:00.000Z', 'en milisegundos también');
});

test('5. la búsqueda de anuncios pide los activos Y los viejos', () => {
  const e = entradaDeAnuncios('https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=MX&view_all_page_id=123', 50);
  const url = new URL((e.startUrls as Array<{ url: string }>)[0].url);
  assert.equal(url.searchParams.get('active_status'), 'all');
  assert.equal(url.searchParams.get('view_all_page_id'), '123');
  assert.equal(e.resultsLimit, 50);
});

test('6. las publicaciones de la corrida larga salen con la misma forma que las de la lectura de siempre', () => {
  const ps = piezasDeApify([
    { shortCode: 'abc', url: 'https://www.instagram.com/reel/abc/', type: 'Video', productType: 'clips', caption: 'Reel', timestamp: '2025-02-01T10:00:00.000Z', likesCount: 50, commentsCount: 3, videoViewCount: 900, displayUrl: 'https://c/1.jpg' },
    { shortCode: 'def', type: 'Sidecar', caption: 'Carrusel', timestamp: '2025-01-01T10:00:00.000Z', likesCount: -1 },
    { caption: 'sin código' },
  ]);
  assert.deepEqual(ps.map((p) => [p.ref, p.formato, p.vistas, p.megusta]), [['abc', 'REELS', 900, 50], ['def', 'FEED', null, null]]);
  assert.deepEqual(piezasDeApify(null), []);
});

test('7. YouTube completo pagina hasta el final, sin cortar en los primeros largos; la corta, no', async () => {
  const CANAL = { items: [{ id: 'UCabcdefghijklmnopqrstuv', snippet: { title: 'C' }, statistics: {}, contentDetails: { relatedPlaylists: { uploads: 'UUx' } } }] };
  // Tres páginas de 50 videos largos cada una.
  const pagina = (n: number, siguiente: string | null) => ({
    ids: { items: Array.from({ length: 50 }, (_, i) => ({ contentDetails: { videoId: `v${n}-${i}` } })), ...(siguiente ? { nextPageToken: siguiente } : {}) },
    videos: { items: Array.from({ length: 50 }, (_, i) => ({ id: `v${n}-${i}`, snippet: { title: 't', publishedAt: '2026-01-01T00:00:00Z' }, statistics: { viewCount: '10' }, contentDetails: { duration: 'PT10M' } })) },
  });
  const ps = [pagina(1, 'p2'), pagina(2, 'p3'), pagina(3, null)];
  const falso = () => {
    let i = 0;
    return async (url: string): Promise<Response> => {
      let cuerpo: unknown;
      if (url.includes('/channels?')) cuerpo = CANAL;
      else if (url.includes('/playlistItems?')) cuerpo = ps[Math.min(i, 2)].ids;
      else { cuerpo = ps[Math.min(i, 2)].videos; i += 1; }
      return { status: 200, json: async () => cuerpo } as Response;
    };
  };
  const completa = await traerVideosDelCanal({ id: 'UCabcdefghijklmnopqrstuv' }, 'k', falso(), VIDEOS_POR_LECTURA_COMPLETA, true);
  assert.ok(completa.ok);
  assert.equal(completa.videos.length, 150, 'completa trae las tres páginas');
  const corta = await traerVideosDelCanal({ id: 'UCabcdefghijklmnopqrstuv' }, 'k', falso());
  assert.ok(corta.ok);
  // La corta sigue como era: los 20 largos más nuevos (`LARGOS_QUE_QUEREMOS`) y los cortos, hasta 50.
  assert.equal(corta.videos.length, 20, 'la corta sigue como era');
  assert.equal(leerCompleto(0), true);
  assert.equal(leerCompleto(500), false);
});
