// =============================================================================
// Los filtros de Thumbnails no pisan los de Carruseles (8/11/2026)
// =============================================================================
// Hallazgo unánime de la revisión de `punta/carruseles-thumbnails`: las dos tablas de filtros
// escribían las MISMAS claves en la URL (`q`, `periodo`, `min`, `omax`, `orden`, `de`, `vista`) y
// con valores que se solapan. Las dos pantallas leen la misma query con las DOS funciones, así que
// un link de Thumbnails con «Últimos 90 días» y «Guardados» dejaba la pestaña Carruseles filtrada
// igual, sin que nadie la hubiera tocado.
//
// Correr: node --import tsx --test tests/thumbnails-claves-propias.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): sacarle el prefijo a `periodo` → 2 / 1;
// sacárselo a `vista` → 2 / 1; ponerle prefijo también a `que` (que ROMPE el selector de pestaña,
// porque sí es compartido a propósito) → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryDeThumbnails, filtrosThumbnailDeQuery } from '../lib/thumbnails/explorar';
import { filtrosDeQuery } from '../lib/carruseles/explorar';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILTROS = { q: 'hola', nicho: '', idioma: '', periodo: '90', outlierMin: 0, outlierMax: 0,
  orden: 'nuevos', canales: [3, 4], vista: 'guardados' } as Parameters<typeof queryDeThumbnails>[0];

test('un link de Thumbnails NO deja filtrada la pestaña Carruseles', () => {
  const url = new URLSearchParams(queryDeThumbnails(FILTROS));
  const carr = filtrosDeQuery(url) as Record<string, unknown>;
  assert.notEqual(carr.periodo, '90', 'el período de Thumbnails no puede filtrar Carruseles');
  assert.notEqual(carr.vista, 'guardados', 'ni su vista');
  assert.ok(!Array.isArray(carr.creadores) || carr.creadores.length === 0, 'ni sus canales');
});

test('y Thumbnails se sigue leyendo a sí mismo', () => {
  const url = new URLSearchParams(queryDeThumbnails(FILTROS));
  const t = filtrosThumbnailDeQuery(url);
  assert.equal(t.periodo, '90');
  assert.equal(t.vista, 'guardados');
  assert.deepEqual(t.canales, [3, 4]);
  assert.equal(t.q, 'hola');
});

test('⚠️ pero `que` SIGUE compartido: es el selector de pestaña, no un filtro', () => {
  const q = queryDeThumbnails(FILTROS);
  assert.match(q, /(^|&)que=thumbnails(&|$)/,
    'si `que` llevara prefijo, la pantalla no sabría qué pestaña abrir');
});

test('⚠️ y la URL las BORRA a las dos: si no, un filtro que se limpia queda pegado', () => {
  // `escribirEnLaUrl` borra `CLAVES_FILTRO` y después pone las de la query nueva. Una clave que no
  // esté en esa lista NO se borra, así que un filtro de Thumbnails que el cliente sacó sigue en el
  // link que copia. Al ponerles prefijo me olvidé de sumarlas: es el otro lado de la misma moneda.
  const src = readFileSync(join(process.cwd(), 'app/image-editor/carruseles/ExplorarCarruseles.tsx'), 'utf8');
  const i = src.indexOf('const CLAVES_FILTRO = [');
  assert.ok(i > 0, 'no existe CLAVES_FILTRO');
  const lista = src.slice(i, src.indexOf('] as const;', i));
  for (const k of ['tq', 'tde', 'tmin', 'tomax', 'tperiodo', 'torden', 'tvista', 'tnicho', 'tidioma']) {
    assert.ok(lista.includes(`'${k}'`), `falta '${k}' en CLAVES_FILTRO: ese filtro se queda pegado en la URL`);
  }
  // Y las de carruseles siguen: sacarlas rompería el lado que ya andaba.
  for (const k of ['q', 'de', 'periodo', 'orden', 'vista', 'que']) {
    assert.ok(lista.includes(`'${k}'`), `falta '${k}', que es de carruseles`);
  }
});
