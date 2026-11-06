// La carga de la biblioteca de miniaturas desde la YouTube Data API (lib/thumbnails/carga.ts, 6/11/2026). La corre la PC con la
// clave de la plataforma (scripts/thumbnails-biblioteca.mts); acá, sin red: las respuestas tienen la forma de las de `search.list`
// (https://developers.google.com/youtube/v3/docs/search/list) y las filas, la de la mig 0409.
//
// Probado rompiéndolo (6/11/2026), base 6/0, restaurando desde memoria:
//   · la búsqueda sin `videoDuration=medium` (trae Shorts) → 1 rojo;
//   · `filasDeVideos` guardando un Short → 1 rojo;
//   · `buscarCanales` dando ok con un 403 → 1 rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONSULTAS, buscarCanales, canalesDeBusqueda, filaDeCanal, filasDeVideos, motivoDeError, urlDeBusqueda } from '../lib/thumbnails/carga';
import { NICHOS_THUMBNAIL, IDIOMAS_THUMBNAIL } from '../lib/carruseles/opciones';
import type { CanalYoutube, VideoYoutube } from '../lib/spy-youtube';

const AHORA = Date.parse('2026-11-06T12:00:00Z');
const UC = (c: string) => 'UC' + c.repeat(22);

test('hay una consulta por rubro e idioma, y son frases de dueño de negocio', () => {
  for (const nicho of NICHOS_THUMBNAIL) for (const idioma of IDIOMAS_THUMBNAIL) {
    const q = CONSULTAS[nicho.value][idioma.value];
    assert.ok(q && q.split(' ').length >= 3, `${nicho.value}/${idioma.value}`);
  }
  assert.equal(NICHOS_THUMBNAIL.length * IDIOMAS_THUMBNAIL.length <= 12, true, 'una corrida entera entra en el balde de 100 búsquedas por día');
});

test('la búsqueda: los más vistos de los últimos N días, videos medianos, en el idioma, sin la clave a la vista en otro lado', () => {
  const u = new URL(urlDeBusqueda('cómo vender más', 'es', 'CLAVE', { dias: 90, ahora: AHORA }));
  assert.equal(u.origin + u.pathname, 'https://www.googleapis.com/youtube/v3/search');
  const p = Object.fromEntries(u.searchParams);
  assert.equal(p.type, 'video');
  assert.equal(p.order, 'viewCount');
  assert.equal(p.maxResults, '50');
  assert.equal(p.relevanceLanguage, 'es');
  assert.equal(p.videoDuration, 'medium', 'ni Shorts ni transmisiones de horas');
  assert.equal(p.safeSearch, 'strict');
  assert.equal(p.publishedAfter, new Date(AHORA - 90 * 86_400_000).toISOString());
  assert.equal(p.q, 'cómo vender más');
  assert.equal(p.key, 'CLAVE');
  assert.equal(new URL(urlDeBusqueda('x', 'en', 'K', { dias: 1, ahora: AHORA })).searchParams.get('publishedAfter'), new Date(AHORA - 7 * 86_400_000).toISOString(), 'como mínimo una semana');
});

test('de la respuesta, los canales que más aparecen; un id que no es de canal no entra', () => {
  const cuerpo = { items: [
    { snippet: { channelId: UC('a'), channelTitle: 'Ana Ventas' } },
    { snippet: { channelId: UC('b'), channelTitle: 'Bruno' } },
    { snippet: { channelId: UC('a'), channelTitle: 'Ana Ventas' } },
    { snippet: { channelId: 'no-es-un-canal', channelTitle: 'X' } },
    { snippet: {} },
    'basura',
  ] };
  assert.deepEqual(canalesDeBusqueda(cuerpo), [{ id: UC('a'), nombre: 'Ana Ventas', veces: 2 }, { id: UC('b'), nombre: 'Bruno', veces: 1 }]);
  assert.deepEqual(canalesDeBusqueda(null), []);
  assert.deepEqual(canalesDeBusqueda({ items: 'x' }), []);
});

test('el error de YouTube en una frase', () => {
  assert.match(motivoDeError(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }), /cuota de YouTube/);
  assert.match(motivoDeError(400, { error: { errors: [{ reason: 'keyInvalid' }] } }), /clave de YouTube no es válida/);
  assert.match(motivoDeError(403, { error: { errors: [{ reason: 'forbidden' }] } }), /no dejó \(forbidden\)/);
  assert.equal(motivoDeError(500, null), 'YouTube contestó 500');
});

test('buscarCanales: con 200, los canales; con un error, el motivo (nunca ok)', async () => {
  const resp = (status: number, cuerpo: unknown) => async () => new Response(JSON.stringify(cuerpo), { status });
  const bien = await buscarCanales('x', 'es', 'K', resp(200, { items: [{ snippet: { channelId: UC('c'), channelTitle: 'C' } }] }));
  assert.deepEqual(bien, { ok: true, canales: [{ id: UC('c'), nombre: 'C', veces: 1 }] });
  const mal = await buscarCanales('x', 'es', 'K', resp(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }));
  assert.equal(mal.ok, false);
  assert.match(mal.ok ? '' : mal.error, /cuota/);
});

test('las filas: el canal con su rubro e idioma; sólo videos largos con id válido', () => {
  const ahora = new Date(AHORA).toISOString();
  const c: CanalYoutube = { id: UC('d'), nombre: 'Dani Negocios', descripcion: '', subidas: 'UU' + 'd'.repeat(22), suscriptores: 1000, vistasTotales: 1, videos: 3, foto: 'http://yt3.ggpht.com/x.jpg', handle: 'daninegocios' };
  const fila = filaDeCanal(c, 'emprendimiento', 'es', 'busqueda', ahora);
  assert.equal(fila.handle, '@daninegocios');
  assert.equal(fila.foto, null, 'una foto que no es https no se guarda');
  assert.equal(fila.nicho, 'emprendimiento');
  assert.equal(fila.estado, 'activo');
  const v = (o: Partial<VideoYoutube>): VideoYoutube => ({ id: 'dQw4w9WgXcQ', titulo: 'Cómo empezar', descripcion: '', publicadoEn: '2026-09-01T10:00:00Z', etiquetas: [], miniatura: null, duracion: 'PT14M', vistas: 5000, megusta: 100, comentarios: 9, ...o });
  const filas = filasDeVideos([v({}), v({ id: 'shortshortx', duracion: 'PT45S' }), v({ id: 'malo' }), v({ id: 'otroVideo12', publicadoEn: 'nunca' })], 7, ahora);
  assert.deepEqual(filas.map((f) => f.video_id), ['dQw4w9WgXcQ', 'otroVideo12'], 'el Short y el id roto no entran');
  assert.equal(filas[1].publicado_en, null, 'una fecha que no se entiende queda vacía, no inventada');
  assert.equal(filas[0].canal_id, 7);
  assert.equal(filas[0].leido_en, ahora);
});
