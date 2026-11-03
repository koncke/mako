// =============================================================================
// Buscar perfiles por NOMBRE: el @ también sale de la URL (3/11/2026)
// =============================================================================
// Martín: «no necesariamente yo tenga que poner una arroba para que me empiecen a salir
// resultados».
//
// ⚠️ ESTE TEST EXISTE POR UNA MEDICIÓN CONTRA EL ACTOR DE VERDAD, no por una sospecha. Buscando
// «leila hormozi» con `apify~instagram-scraper`, la respuesta trajo **7 candidatos y sólo 1 con
// `username`**. Los otros 6 venían así:
//
//   { url: 'https://www.instagram.com/leila_hormozi63/', inputUrl: '…', error: 'no_items',
//     errorDescription: 'Empty or private data for provided input' }
//
// Porque el actor BUSCA y después intenta scrapear cada perfil: una cuenta privada o vacía no se
// deja scrapear, pero **el hallazgo del buscador está igual, en `url`**. La primera versión del
// mapeo pedía `username` y descartaba 6 de 7 resultados que SÍ existen: la lista salía casi vacía y
// habría parecido que el actor no sirve.
//
// Para una lista donde la persona ELIGE, el @ alcanza. El nombre y la foto son un plus.
//
// PROBADO ROMPIÉNDOLO (3/11/2026), con el archivo en 5 / 0, una rotura por vez y restaurada:
//   · el mapeo pidiendo sólo `username` (la primera versión)      → 4 / 1
//   · `usuarioDeUrl` aceptando cualquier ruta de instagram.com     → 4 / 1
//   · sin deduplicar por usuario                                   → 4 / 1
// Correr: node --import tsx --test tests/instagram-buscar-apify.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESULTADOS_POR_BUSQUEDA, USD_POR_BUSQUEDA, USD_POR_MIL, perfilesDeLaRespuesta, usuarioDeUrl } from '../lib/instagram-buscar-apify-reglas';

/** Respuesta REAL del actor, recortada: el primer ítem es el caso que se perdía. */
const COMO_CONTESTA = [
  { url: 'https://www.instagram.com/leila_hormozi63/', inputUrl: 'https://www.instagram.com/leila_hormozi63/', error: 'no_items', errorDescription: 'Empty or private data for provided input' },
  { username: 'leillahormozi', fullName: 'Leila Hormozi', profilePicUrl: 'https://scontent.cdninstagram.com/x.jpg' },
  { url: 'https://www.instagram.com/leila_hormozi63/' },
  { url: 'https://www.instagram.com/p/ABC123/' },
];

test('un candidato que el actor no pudo scrapear SIGUE SIRVIENDO: su @ está en la url', () => {
  const r = perfilesDeLaRespuesta(COMO_CONTESTA);
  assert.ok(r.some((p) => p.usuario === 'leila_hormozi63'), 'se perdió el candidato que vino con error: es 6 de cada 7');
});

test('el que sí trajo datos conserva nombre y foto', () => {
  const r = perfilesDeLaRespuesta(COMO_CONTESTA);
  const p = r.find((x) => x.usuario === 'leillahormozi');
  assert.equal(p?.nombre, 'Leila Hormozi');
  assert.ok(p?.foto);
});

test('una url que NO es un perfil se descarta', () => {
  // `/p/ABC123/` es una publicación. Ofrecerla como perfil sería ofrecer algo que no se puede mirar.
  const r = perfilesDeLaRespuesta(COMO_CONTESTA);
  assert.ok(!r.some((p) => p.usuario === 'p'), 'una publicación entró como si fuera un perfil');
  // ⚠️ ÉSTE ES EL CASO QUE PRUEBA LA LISTA DE RUTAS RESERVADAS, y la primera versión del test no lo
  // tenía: `/p/` ya lo descarta la expresión por tener UNA sola letra (pide 2 a 30), así que sacar
  // la lista no ponía nada en rojo. `/reel/` y `/explore/` sí pasan el largo y son los que la
  // necesitan. Es la misma trampa de siempre: el caso tiene que ser aquel donde ESA regla es la
  // única que puede rechazar.
  assert.equal(usuarioDeUrl('https://www.instagram.com/reel/XYZ/'), '');
  assert.equal(usuarioDeUrl('https://www.instagram.com/explore/'), '');
  assert.equal(usuarioDeUrl('https://www.instagram.com/stories/'), '');
  // Y un @ de verdad sigue entrando.
  assert.equal(usuarioDeUrl('https://www.instagram.com/leillahormozi'), 'leillahormozi');
});

test('no se repite un perfil que vino dos veces', () => {
  const r = perfilesDeLaRespuesta(COMO_CONTESTA);
  assert.equal(r.filter((p) => p.usuario === 'leila_hormozi63').length, 1);
});

test('el costo está escrito y es el medido en la tienda', () => {
  // US$1,50 por 1.000 resultados, 8 por búsqueda. Si alguien sube `RESULTADOS_POR_BUSQUEDA`, que
  // sepa que está subiendo la factura de cada búsqueda.
  assert.equal(USD_POR_MIL, 1.5);
  assert.equal(RESULTADOS_POR_BUSQUEDA, 8);
  assert.ok(Math.abs(USD_POR_BUSQUEDA - 0.012) < 1e-9, `una búsqueda sale US$${USD_POR_BUSQUEDA}`);
});
