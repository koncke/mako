// =============================================================================
// General con la búsqueda y el filtro de fecha por defecto, y «Agregar filtro» editando (#858)
// =============================================================================
// Martín, revisión del 16/10/2026 (1:10:12), mirando la General de una clienta: «al momento de crear una plantilla en la
// tab general no aparece el filtro de… fecha y… la barra de búsqueda. Esas dos cosas siempre deberían aparecer por
// defecto… y tampoco aparece en la edición el botón de agregarlo». Revierte lo del 14/10 («menos la barra de busqueda y
// el filtro que no sirven en general»). Las plantillas de General ya traían su período; lo que faltaba era la barra.
//
// Correr: node --import tsx --test tests/general-filtros-por-defecto.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 2/0): la barra otra vez con `!esGeneral &&` → 1 / 1; el armado de las
// plantillas de General sin su control de período → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { instanciarPlantilla } from '../lib/graficos-plantillas';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('cada plantilla de General nace con su filtro de fecha', () => {
  assert.ok(PLANTILLAS_GENERAL.length >= 5, 'no hay plantillas de General: este test no mira nada');
  const sin = PLANTILLAS_GENERAL.filter((p) => !instanciarPlantilla(p).controles.some((c) => c.tipo === 'periodo')).map((p) => p.id);
  assert.deepEqual(sin, [], 'una plantilla de General nace sin el filtro de fecha');
});

test('la barra de búsqueda y filtros se dibuja también en General (sólo en blanco no va)', () => {
  const src = sinComentarios(readFileSync(join(RAIZ, 'app/dashboard/EditorInforme.tsx'), 'utf8').replace(/\r\n/g, '\n'));
  const i = src.indexOf('<div className="lk-top-filtros"');
  assert.ok(i > 0, 'no encontré la barra de filtros de la topbar');
  const antes = src.slice(Math.max(0, i - 120), i);
  assert.match(antes, /\{!enBlanco && \(\s*$/, 'la barra de filtros ya no es «todo menos en blanco»');
  assert.doesNotMatch(antes, /esGeneral/, 'la barra de filtros volvió a esconderse en General');
  // La barra trae la búsqueda y el «Filtro» (con «Agregar filtro» editando): las dos piezas que pidió Martín.
  const barra = sinComentarios(readFileSync(join(RAIZ, 'app/dashboard/BarraControles.tsx'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(barra, /<BuscarEnHoja \/>/);
  assert.match(barra, /<MenuFiltro\b/);
});
