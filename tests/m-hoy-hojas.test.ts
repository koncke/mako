// =============================================================================
// General en el teléfono: con varias hojas, se pasa de una a otra (#872)
// =============================================================================
// Mauricio, 16/10/2026, en su celular (llamada Mau <> Martín, 33:14): al crear plantillas de General sólo veía la
// primera hoja y no encontraba cómo cambiar. El teléfono dibujaba `tablero.hojas[0]` y no tenía con qué elegir.
// Lo que se puede romper sin que nada se vea roto: el link a la hoja que pierde su `?hoja=` en el desvío al teléfono
// (vuelve siempre la primera), y la página que vuelve a leer la primera aunque la URL pida otra.
//
// Correr: node --import tsx --test tests/m-hoy-hojas.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 3/0): la página de vuelta con `const hoja = tablero.hojas[0];` → 2 / 1; el
// href de la opción a `/general` sin la hoja → 2 / 1; el segmentado con una sola hoja (`> 0` en vez de `> 1`) → 2 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOJAS_SIN_DESLIZAR, opcionesDeHojas } from '../app/m/hoy/modelo';
import { pedidoMovil } from '../lib/movil-desvio';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('cada hoja es un link a la MISMA URL que escritorio, y el teléfono la abre con su hoja', () => {
  const ops = opcionesDeHojas([{ id: 'gen-1', nombre: 'Foco de la semana' }, { id: 'h x/2', nombre: '  ' }]);
  // La primera es «Focus» desde el Dashboard unido (17/10/2026, tests/dashboard-focus.test.ts).
  assert.deepEqual(ops, [
    { id: 'gen-1', label: 'Focus', href: '/general?hoja=gen-1' },
    { id: 'h x/2', label: 'Sin nombre', href: '/general?hoja=h%20x%2F2' },
  ]);
  // El desvío del teléfono reescribe /general a /m/hoy con la query ENTERA: si perdiera `hoja`, volvería la primera.
  const r = pedidoMovil({ pathname: '/general', search: '?hoja=gen-1&ws=4', metodo: 'GET', telefono: true });
  assert.equal(r.tipo, 'reescribir');
  assert.match((r as { destino: string }).destino, /^\/m\/hoy\?(?=.*hoja=gen-1)(?=.*ws=4)/);
});

test('la página dibuja la hoja que pide la URL, no siempre la primera', () => {
  const src = sinComentarios(readFileSync(join(RAIZ, 'app/m/hoy/page.tsx'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(src, /const hoja = tablero\.hojas\.find\(\(h\) => h\.id === pedida\) \?\? tablero\.hojas\[0\];/);
  assert.match(src, /pedida=\{Array\.isArray\(p\.hoja\) \? p\.hoja\[0\] : p\.hoja\}/, 'HoyPage no le pasa la hoja de la URL');
});

test('el segmentado sale con dos hojas o más, y con muchas se desliza', () => {
  const src = sinComentarios(readFileSync(join(RAIZ, 'app/m/hoy/page.tsx'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(src, /\{hoja && opcionesHoja\.length > 1 && \(/, 'con una sola hoja no va el segmentado; con dos, sí');
  assert.match(src, /<SegmentadoM etiqueta="Hoja" valor=\{hoja\.id\} opciones=\{opcionesHoja\} \/>/);
  assert.match(src, /data-muchas=\{opcionesHoja\.length > HOJAS_SIN_DESLIZAR \|\| undefined\}/);
  assert.equal(HOJAS_SIN_DESLIZAR, 3);
  const css = readFileSync(join(RAIZ, 'app/m/hoy/hoy.css'), 'utf8');
  assert.match(css, /\.m-hoy-hojas\[data-muchas\] \.m-seg \{ grid-auto-columns: max-content; overflow-x: auto;/);
});
