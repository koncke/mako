// Los formatos de «¿Qué formatos le funcionan?» salen del catálogo investigado (4/11/2026).
//
// Martín: «Tanto para funnels como para formatos de contenido al momento de clasificar "lo que le funciona" quiero que hagas una
// investigación profunda de todos los tipos de formatos». La investigación es docs/catalogo-funnels-y-formatos.md (§3); `FORMATOS`
// (lib/spy-detalle.ts) son sus mismos ids y nombres, la IA recibe qué es cada uno, y lo que la IA no clasificó se lee del texto.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `FORMATOS` sin «mito» (el formato nuevo del catálogo)                 → 1
//   · el prompt del analista sin `{{formatosQueSon}}`                        → 2
//   · `formatoPorTexto` que también acepta las débiles                       → 3
//   · `formatosDe` que sólo mira lo que dijo la IA                           → 4
//
// Correr: node --import tsx --test tests/spy-formatos-catalogo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FORMATOS_DEL_CATALOGO } from '../lib/spy-catalogo-datos';
import { FORMATOS, GUIA_DE_FORMATOS, formatoPorTexto, formatosDe } from '../lib/spy-detalle';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');

test('1. los formatos son los del catálogo: mismos ids, mismos nombres, y cada uno dice qué es', () => {
  assert.deepEqual(FORMATOS.map((f) => [f.value, f.label]), FORMATOS_DEL_CATALOGO.map((f) => [f.id, f.label]));
  for (const f of FORMATOS_DEL_CATALOGO) assert.ok(f.que && f.que.length <= 70, `${f.id}: su línea de «qué es», corta`);
  for (const f of FORMATOS) assert.match(GUIA_DE_FORMATOS, new RegExp(`^- ${f.value}: `, 'm'), `la guía nombra ${f.value}`);
});

test('2. la IA recibe qué es cada formato, no sólo sus ids', () => {
  const spy = leer('lib/spy.ts');
  const plantilla = spy.slice(spy.indexOf('export const SPY_ANALISIS_SYSTEM_TEMPLATE'), spy.indexOf('export const SPY_ANALISIS_USER_TEMPLATE'));
  assert.match(plantilla, /\{\{formatosQueSon\}\}/);
  assert.match(spy, /formatosQueSon: GUIA_DE_FORMATOS,/);
  assert.match(leer('lib/prompt-registry.ts'), /v\('formatosQueSon', /, 'el slot está declarado (si no, /configuraciones no lo conoce)');
});

test('3. sin IA, el texto dice el formato sólo con una frase clara', () => {
  assert.equal(formatoPorTexto('POV: eres dueño de una agencia y te llega este cliente'), 'pov');
  assert.equal(formatoPorTexto('Mi antes y después en 6 meses'), 'antes-despues');
  assert.equal(formatoPorTexto('7 errores que cometes al grabar'), 'lista');
  assert.equal(formatoPorTexto('Storytime: cómo perdí mi primer cliente'), 'storytime');
  assert.equal(formatoPorTexto('Antes de grabar, piensa qué vas a decir después.'), '', '«antes» y «después» sueltos no son un antes y después');
  assert.equal(formatoPorTexto(''), '');
  assert.equal(formatoPorTexto(null), '');
});

test('4. «¿Qué formatos le funcionan?» cuenta también lo que la IA no clasificó', () => {
  const AHORA = Date.parse('2026-11-04T12:00:00Z');
  const p = (id: number, vistas: number, extra: object) => ({
    id, canal: 'instagram' as const, tipo: 'reel' as const, vistas, megusta: null, publicada_en: '2026-10-01T00:00:00Z',
    visto_primera_vez: '2026-10-01T00:00:00Z', dejo_de_verse_en: null, ...extra,
  });
  const filas = formatosDe([
    p(1, 1000, { analisis: { formato: 'tutorial' } }),
    p(2, 1200, { analisis: { formato: 'tutorial' } }),
    p(3, 9000, { analisis: null, texto: 'POV: te escribe un cliente a las 3 am' }),
    p(4, 8000, { analisis: { formato: 'otro' }, texto: 'POV: llegas a tu primera reunión' }),
    p(5, 500, { analisis: null, texto: 'Un día normal' }),
  ], AHORA);
  assert.deepEqual(filas.map((f) => [f.formato, f.n]), [['pov', 2], ['tutorial', 2]]);
});
