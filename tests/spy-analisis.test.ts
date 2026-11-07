// =============================================================================
// La IA lee sola las piezas de un competidor, de a tandas y sólo lo que falta (4/11/2026)
// =============================================================================
// Martín: «"Con qué abre" no se entiende… la IA ya debería analizar por sí sola todo, sin pedirlo. Obvio, jamás que el
// usuario tenga que esperar… y de última que en el detail de cada reel aparezca "Analizando"».
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada:
//   · `faltaAnalisis` que cuenta un análisis vacío como pendiente   → 1 y 3
//   · `pendientesDeAnalisis` sin ordenar por vistas                 → 2
//   · `refsSinRespuesta` sin ignorar mayúsculas                     → 4
//   · `ofertaQueQueda` que pisa con una vacía                       → 5
//   · el análisis volviendo a `chatClaude` (la IA de la plataforma) → 6
//   · `opcionesDeContenido` sin «Agregar su Instagram»              → 7
//   · `faltaAnalisis` sin pedir el formato a lo ya leído            → 1 y 2   (el detalle, 4/11)
//   · `pendientesDeAnalisis` que no pone primero lo nunca leído    → 2
// Correr: node --import tsx --test tests/spy-analisis.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ANALISIS_SIN_DATOS, PIEZAS_POR_ANALISIS, cuantasFaltan, faltaAnalisis, ofertaQueQueda, pendientesDeAnalisis, refsSinRespuesta,
} from '../lib/spy-analisis-reglas';
import { VERSION_FORMATOS } from '../lib/spy-detalle';
import { opcionesDeContenido } from '../lib/spy-vista';

const RAIZ = resolve(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const pieza = (ref: string, vistas: number | null, analisis: unknown = null, canal = 'instagram', publicada_en: string | null = null) =>
  ({ ref, canal, vistas, analisis, publicada_en });

test('1. falta el análisis sólo si nunca se leyó; uno vacío ya cuenta como leído', () => {
  assert.equal(faltaAnalisis(pieza('a', 10)), true);
  assert.equal(faltaAnalisis(pieza('a', 10, ANALISIS_SIN_DATOS)), false);
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'pov' })), false);
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'otro', formatosV: VERSION_FORMATOS })), false, 'la IA no vio el formato: no se vuelve a pedir');
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x' })), true, 'lo analizado antes del formato se lee una vez más');

  // ⚠️ LO MARCADO `otro` CON LOS ONCE FORMATOS VIEJOS SE LEE UNA VEZ MÁS (6/11/2026). Hasta hoy no: la línea de arriba
  // decía que un `otro` ya estaba listo, y así lo analizado antes del catálogo de 19 se quedaba en el formato viejo para
  // siempre, con los dos criterios conviviendo sin que nada lo avisara. De los 19 de hoy, OCHO entraron después de los
  // 11 primeros, así que un `otro` de entonces puede ser un `promo` o un `mito` de ahora.
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'otro' })), true, 'sin la marca del catálogo, un `otro` es de los 11 viejos');
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'otro', formatosV: 1 })), true);
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'Otro', formatosV: 1 })), true, 'el nombre y el id son lo mismo (`formatoDe`)');
  // Pero SÓLO los `otro`: los ids del catálogo nuevo son un superconjunto de los viejos, así que releer un `tutorial`
  // no cambiaría nada y lo pagaría el negocio.
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'tutorial' })), false, 'un tutorial sigue siendo un tutorial');
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'pov', formatosV: 1 })), false);
  // Y es UNA vez: lo que se guarda desde ahora lleva la marca, también lo que la IA no devolvió.
  assert.equal(ANALISIS_SIN_DATOS.formatosV, VERSION_FORMATOS, 'sin esto, una pieza que la IA no devuelve pide lectura para siempre');
  assert.equal(faltaAnalisis(pieza('a', 10, ANALISIS_SIN_DATOS)), false);
  // La web se lee aparte (su funnel): no es una pieza que lea esta IA.
  assert.equal(faltaAnalisis(pieza('https://x.com', null, null, 'landing')), false);
});

test('2. primero lo más visto, lo que no publica sus vistas al final, y de a una tanda', () => {
  const ps = [pieza('chico', 5), pieza('sin', null), pieza('grande', 900), pieza('medio', 50), pieza('leido', 5000, { gancho: 'g', formato: 'pov' })];
  assert.deepEqual(pendientesDeAnalisis(ps).map((p) => p.ref), ['grande', 'medio', 'chico', 'sin']);
  // Lo leído antes del formato va DESPUÉS de lo que nunca se leyó, aunque tenga más vistas.
  assert.deepEqual(pendientesDeAnalisis([pieza('sinFormato', 9000, { gancho: 'g' }), pieza('nueva', 3)]).map((p) => p.ref), ['nueva', 'sinFormato']);
  const muchas = Array.from({ length: 70 }, (_, i) => pieza(`p${i}`, i));
  assert.equal(pendientesDeAnalisis(muchas).length, PIEZAS_POR_ANALISIS);
  assert.equal(pendientesDeAnalisis(muchas)[0].ref, 'p69');
  // A igual vistas, lo más nuevo.
  assert.deepEqual(pendientesDeAnalisis([pieza('vieja', 1, null, 'youtube', '2026-01-01'), pieza('nueva', 1, null, 'youtube', '2026-10-01')]).map((p) => p.ref), ['nueva', 'vieja']);
});

test('3. cuántas faltan: con eso la pantalla dibuja «Analizando…» y deja de preguntar en cero', () => {
  assert.equal(cuantasFaltan([pieza('a', 1), pieza('b', 2, ANALISIS_SIN_DATOS), pieza('c', 3, { gancho: 'x', formato: 'lista' })]), 1);
  assert.equal(cuantasFaltan([]), 0);
});

test('4. lo que se mandó y la IA no devolvió se marca leído, aunque lo devuelva en minúsculas', () => {
  assert.deepEqual(refsSinRespuesta(['AbC123', 'xyz', 'Q9'], ['abc123', ' q9 ']), ['xyz']);
  assert.deepEqual(refsSinRespuesta(['a'], []), ['a']);
});

test('5. una tanda que no dice qué promete no borra la oferta que ya estaba', () => {
  const antes = { promete: 'Vender más con reels', aQuien: '', precio: null, objecion: '', huecos: [] };
  assert.equal(ofertaQueQueda({ ...antes, promete: '  ' }, antes), antes);
  assert.equal(ofertaQueQueda({ ...antes, promete: 'Otra' }, antes)?.promete, 'Otra');
  assert.equal(ofertaQueQueda({ ...antes, promete: '' }, null), null);
});

test('6. la IA es la del negocio: el análisis no llama a la de la plataforma', () => {
  const spy = sinComentarios(readFileSync(resolve(RAIZ, 'lib/spy.ts'), 'utf8'));
  const cuerpo = spy.slice(spy.indexOf('export async function analizarCompetidor('), spy.indexOf('async function guardarAnalisis('));
  assert.ok(cuerpo.length > 500, 'encontré la función');
  assert.match(cuerpo, /chatCheapCascade\(\{/);
  assert.doesNotMatch(cuerpo, /chatClaude\(/);
  assert.match(cuerpo, /soloPendientes \? pendientesDeAnalisis\(todas\)/);
  // Y la ruta que lo dispara solo contesta en el acto: el trabajo sigue en un `after()`.
  const ruta = sinComentarios(readFileSync(resolve(RAIZ, 'app/api/competitor-spy/analizar/route.ts'), 'utf8'));
  assert.match(ruta, /after\(trabajo\)/);
  assert.match(ruta, /sinIA: true/);
});

test('7. el desplegable de tipos: sólo los que tiene, con cuántas, y la red que le falta al final', () => {
  const ps = [
    { canal: 'instagram' as const, tipo: 'reel' as const, duracion: null },
    { canal: 'instagram' as const, tipo: 'reel' as const, duracion: null },
    { canal: 'youtube' as const, tipo: 'video' as const, duracion: 'PT40S' },
  ];
  assert.deepEqual(opcionesDeContenido(ps, { instagram: 'x', youtube_id: null }).map((o) => [o.value, o.label]), [
    ['todo', 'Todo lo que publica · 3'], ['reels', 'Reels · 2'], ['shorts', 'Shorts · 1'], ['agregar-youtube', 'Agregar su YouTube'],
  ]);
  assert.deepEqual(opcionesDeContenido([], { instagram: null, youtube_id: 'UC1' }).map((o) => o.value), ['todo', 'agregar-instagram']);
});
