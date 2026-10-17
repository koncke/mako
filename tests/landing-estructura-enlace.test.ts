// =============================================================================
// Del mapa de calor de la hoja Landing al diagnóstico de estructura del Web Generator (#886, lado Dashboard)
// =============================================================================
// Martín, revisión del 16/10/2026 (1:29:51): «que lo que recién vimos en dashboard del template de landing se combine
// con esta funcionalidad del feedback de la estructura que te da Web Generator, que vivan ambos lugares». Lo que se puede
// romper sin que se vea: el link a OTRA página que la del mapa (el diagnóstico de la equivocada), una URL que no es
// http(s) metida en el link, y el botón en un link compartido (el Web Generator pide sesión).
//
// Correr: node --import tsx --test tests/landing-estructura-enlace.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 3/0): `hrefAnalizarEstructura` aceptando cualquier esquema → 2 / 1; el botón
// con la primera página de la lista en vez de la que se mira → 2 / 1; el botón también en un link compartido → 2 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hrefAnalizarEstructura } from '../lib/landing-estructura-enlace';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

test('el link va al diagnóstico del Web Generator con LA página, y sólo si es http(s)', () => {
  assert.equal(hrefAnalizarEstructura('https://negocio.com/vsl?x=1'), '/web-generator?analizar=https%3A%2F%2Fnegocio.com%2Fvsl%3Fx%3D1');
  for (const malo of ['javascript:alert(1)', 'negocio.com/vsl', 'ftp://negocio.com', '', null, 3]) {
    assert.equal(hrefAnalizarEstructura(malo), null, String(malo));
  }
});

test('el mapa de calor lo ofrece para la página que se está mirando', () => {
  const mapa = leer('app/dashboard/MapaCalor.tsx');
  assert.match(mapa, /const analizar = conEnlaces \? hrefAnalizarEstructura\(pagina\.url\) : null;/);
  assert.match(mapa, /\{analizar && <Link href=\{analizar\}/);
});

test('sólo con sesión y mirando: el gráfico le pasa al dibujo propio si puede enlazar', () => {
  const graf = leer('app/dashboard/Grafico.tsx');
  assert.match(graf, /<Propio g=\{g\} estado=\{estado\} tema=\{tema\} onDetalle=\{onDetalle\} efectivo=\{efectivo\} conEnlaces=\{conReproductor\} \/>/);
  assert.match(leer('app/dashboard/graficos/registro.ts'), /conEnlaces\?: boolean;/);
});
