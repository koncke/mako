// =============================================================================
// Spy: «Todas sus piezas» se reparte en columnas, como los outliers de Create (13/11/2026)
// =============================================================================
// Desde el 12/11 cada tarjeta lleva la forma de su red (un short vertical, un video largo apaisado). En una grilla de FILAS, un
// short al lado de un video largo dejaba un hueco debajo del largo; el Cerebro, mirando la captura: «Martín pidió buen diseño, y un
// hueco bajo cada video largo no lo es». Con `proporcion` y varias columnas, GrillaPiezas reparte la página con `GrillaMixta`
// (app/_crear/GrillaMixta.tsx, la de Copywriting): cada tarjeta, en orden, a la columna más baja.
//   1. la tarjeta que sigue a un short va debajo de un video largo, no deja hueco;
//   2. la página sigue siendo `columnas × FILAS_POR_PAGINA` tarjetas: cambia cómo se apilan, no cuántas;
//   3. el teléfono (una columna) sigue con su grilla, y la pantalla le pasa a la grilla la proporción de cada pieza;
//   4. en las columnas, cada celda va a lo ancho de su columna (no se encoge a su contenido);
//   5. la pantalla se puede leer: su hoja es un template literal y una comilla invertida en un comentario la cortaba (13/11: lo
//      frenó el chequeo de hooks del pre-push, no un test).
//
// Probado rompiéndolo (romper.mjs + roturas-grilla-mixta.mjs):
//   · GrillaPiezas sin GrillaMixta (siempre la grilla de filas)            → 1
//   · repartir TODAS las piezas en vez de la página                         → 2
//   · SpyApp sin pasar `proporcion`                                        → 3
//   · la celda de la columna con `align-self:start`                         → 4
//   · una comilla invertida en un comentario de la hoja de SpyApp            → 5
//
// Correr: node --import tsx --test tests/spy-grilla-mixta.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FILAS_POR_PAGINA } from '../lib/spy-vista';

// Node no carga CSS (los íconos de la casa pueden traer el suyo): se reemplaza por nada antes de importar la grilla.
type Hook = (url: string, ctx: { parentURL?: string }, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { resolve?: Hook; load?: Hook }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

type P = { id: number; forma: number };
const LARGO = 16 / 9;
const SHORT = 9 / 16;

async function dibujar(piezas: P[], columnas: number): Promise<string> {
  const { GrillaPiezas } = await import('../app/competitor-spy/GrillaPiezas');
  return renderToStaticMarkup(createElement(GrillaPiezas<P>, {
    piezas, reinicio: 'x', columnas, cabecera: null, proporcion: (p) => p.forma,
    tarjeta: (p) => createElement('b', null, `pieza-${p.id}`),
  }));
}
/** Qué piezas quedaron en cada columna (cada `<ul>` de GrillaMixta), en orden. */
const columnasDe = (html: string) => [...html.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/g)].map((m) => [...m[1].matchAll(/pieza-(\d+)/g)].map((x) => Number(x[1])));

test('1. la tarjeta que sigue a un short va debajo de un video largo, no deja hueco', async () => {
  // Un largo, un short, un largo: en tres columnas, la cuarta pieza va debajo del primer largo (la columna más baja), no de la
  // del short. En la grilla de filas iba a la fila 2, y la fila 1 tenía el alto del short: un hueco debajo de cada largo.
  const cols = columnasDe(await dibujar([{ id: 1, forma: LARGO }, { id: 2, forma: SHORT }, { id: 3, forma: LARGO }, { id: 4, forma: LARGO }, { id: 5, forma: LARGO }], 3));
  assert.equal(cols.length, 3, 'tres columnas');
  assert.deepEqual(cols, [[1, 4], [2], [3, 5]], 'los largos se apilan al lado del short');
});

test('2. la página sigue siendo `columnas × FILAS_POR_PAGINA` tarjetas', async () => {
  const muchas = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, forma: i % 3 ? LARGO : SHORT }));
  const html = await dibujar(muchas, 4);
  assert.equal((html.match(/pieza-\d+/g) ?? []).length, 4 * FILAS_POR_PAGINA, 'una página, no todas');
  assert.match(html, /1–12 de 40/, 'y el paginador cuenta lo mismo');
});

test('3. el teléfono (una columna) sigue con su grilla, y la pantalla le pasa la proporción de cada pieza', async () => {
  const una = await dibujar([{ id: 1, forma: LARGO }, { id: 2, forma: SHORT }], 1);
  assert.doesNotMatch(una, /<ul/, 'con una columna no hay huecos que llenar');
  assert.match(una, /grid-template-columns:repeat\(1, minmax\(0, 1fr\)\)/);
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const grilla = app.slice(app.indexOf('<GrillaPiezas'), app.indexOf('<GrillaPiezas') + 800);
  assert.match(grilla, /proporcion=\{\(p\) => proporcionDe\(p\)\.ancho \/ proporcionDe\(p\)\.alto\}/, 'la proporción de SU red');
});

test('4. en las columnas, cada celda va a lo ancho de su columna', () => {
  const css = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(css, /\.spy-mixta \.spy-pgrid__celda\{align-self:stretch\}/, 'con `align-self:start` la tarjeta se encoge a su contenido');
  assert.match(leer('app/competitor-spy/GrillaPiezas.tsx'), /className="spy-mixta"/);
});

test('5. la pantalla se puede leer (una comilla invertida en su hoja la corta)', async () => {
  const ts = (await import('typescript')).default;
  for (const f of ['app/competitor-spy/SpyApp.tsx', 'app/competitor-spy/GrillaPiezas.tsx', 'app/competitor-spy/TarjetaPieza.tsx']) {
    const src = ts.createSourceFile(f, leer(f), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) as unknown as { parseDiagnostics: Array<{ messageText: unknown; start?: number }> };
    assert.deepEqual(src.parseDiagnostics.map((d) => `${d.start}: ${String(d.messageText)}`), [], `${f} tiene errores de sintaxis`);
  }
});
