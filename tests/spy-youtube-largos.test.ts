// =============================================================================
// YouTube: los videos LARGOS llegan, no sólo los Shorts más nuevos
// =============================================================================
// Martín, 2/11/2026: «en YouTube no traigas solamente los shorts, sino todos los videos, porque
// lo valioso está en los videos largos».
//
// ⚠️ LA CAUSA NO ERA UN FILTRO, y por eso este guard mira la CLASIFICACIÓN y no un `include`.
// El lector nunca filtró por formato: pedía los últimos 50 subidos de la playlist de subidas, y
// en un canal que publica Shorts a diario esos 50 son todos Shorts. El video largo quedaba afuera
// por VIEJO. La salida fue paginar y reservarle un cupo a los largos, y eso se apoya enteramente
// en leer bien la duración — que es lo que se prueba acá.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHORT_HASTA_SEGUNDOS, esShort, segundosDeDuracion } from '../lib/spy-youtube';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

test('la duración ISO de YouTube se lee en segundos', () => {
  assert.equal(segundosDeDuracion('PT59S'), 59);
  assert.equal(segundosDeDuracion('PT3M'), 180);
  assert.equal(segundosDeDuracion('PT1H2M3S'), 3723);
  assert.equal(segundosDeDuracion('PT12M8S'), 728);
  // Un directo sin terminar viene como `P0D`: es un DATO (cero), no un error.
  assert.equal(segundosDeDuracion('P0D'), 0);
  assert.equal(segundosDeDuracion('P1DT2H'), 93_600);
  // Lo que no se entiende es null, y null nunca se confunde con cero.
  assert.equal(segundosDeDuracion(null), null);
  assert.equal(segundosDeDuracion('cualquier cosa'), null);
});

test('el corte entre Short y video largo es el de YouTube, 3 minutos', () => {
  // YouTube subió el límite de 1 a 3 minutos en octubre de 2024. Si vuelve a cambiar, cambia acá.
  assert.equal(SHORT_HASTA_SEGUNDOS, 180);
  assert.equal(esShort({ duracion: 'PT45S' }), true);
  assert.equal(esShort({ duracion: 'PT3M' }), true, '3 minutos clavados todavía es un Short');
  assert.equal(esShort({ duracion: 'PT3M1S' }), false, 'un segundo más ya es un video largo');
  assert.equal(esShort({ duracion: 'PT24M' }), false);
});

test('una duración que no se entiende se trata como LARGO, nunca como Short', () => {
  // Si se tratara como Short, un video sin duración legible competiría por el cupo de los Shorts
  // y podría desplazar a un largo de verdad. Al revés, lo peor que pasa es que entre de más.
  assert.equal(esShort({ duracion: null }), false);
  assert.equal(esShort({ duracion: '' }), false);
  assert.equal(esShort({ duracion: 'PT' }), false, 'un `PT` vacío no dice nada: no es un Short');
});

test('el lector pagina la playlist en vez de quedarse con la primera tanda', () => {
  // El guard mira el CÓDIGO porque lo que se rompió no fue una cuenta, fue el método: una sola
  // página de `playlistItems` es exactamente lo que dejaba afuera a los largos.
  const src = readFileSync(join(RAIZ, 'lib/spy-youtube.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /pageToken/, 'el lector dejó de paginar: vuelve a traer sólo lo más nuevo');
  // ⚠️ SE MIRA EL VALOR, NO EL NOMBRE. La primera versión de este guard sólo comprobaba que las
  // constantes existieran, y pasó en verde con `PAGINAS_MAX = 1` — que es exactamente el bug.
  // Un guard que no se pone rojo cuando la cosa está rota no sirve para nada.
  const paginas = /const PAGINAS_MAX = (\d+);/.exec(src);
  assert.ok(paginas, 'se perdió PAGINAS_MAX: sin tope, un canal enorme se lee entero');
  assert.ok(Number(paginas[1]) > 1, `PAGINAS_MAX quedó en ${paginas[1]}: con una sola página vuelven sólo los Shorts más nuevos`);

  const cupo = /const LARGOS_QUE_QUEREMOS = (\d+);/.exec(src);
  assert.ok(cupo, 'se perdió el cupo de videos largos');
  assert.ok(Number(cupo[1]) > 0, 'el cupo de largos quedó en cero: es la forma silenciosa de volver al problema');
});
