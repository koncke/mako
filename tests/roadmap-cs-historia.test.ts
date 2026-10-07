// =============================================================================
// La sección Historia de /admin/dev/customer-success sólo dice «#N abierta» si la tarjeta lo está
// =============================================================================
// `RoadmapCS.tsx` busca la tarjeta de cada paso por título en `board.tasks`, que sale de
// `listPlanBoard()` (lib/plan-board.ts, `select('*')` SIN filtro): trae también las cerradas.
// En el resto del panel «abierta» es `progress < 100` (`tareasAbiertas`, app/admin/dev/roadmap.ts,
// `.lt('progress', 100)`). Sin ese filtro, una fila de Historia decía «#N abierta» y se dejaba
// abrir sobre una tarjeta ya cerrada —la #659 y la #660 cuando se cierren por propuesta—, para
// siempre. Dos capas, cada una con su test: la función (se EJECUTA) y su cableado (se lee el
// bloque de Historia, sin comentarios, cortado en su cierre real).
//
// PROBADO ROMPIÉNDOLO (06/10/2026, arnés que muta de a una cosa y restaura de memoria):
//   · `tarjetaAbierta` con `<= 100` en vez de `< 100`                        → 1 / 1 (cae la función)
//   · Historia vuelve a `const abierta = tareaDe(p);` sin el filtro           → 1 / 1 (cae el cableado)
//   · la fila clickeable vuelve a colgar de `tareaDe(p)` (`return tareaDe(p) ? …`) → 1 / 1
// (pasan / caen). Restaurado todo: 2 / 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tarjetaAbierta } from '../app/admin/dev/customer-success/roadmap-cs';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // los comentarios de JSX
  .replace(/\/\*[\s\S]*?\*\//g, '');  // y los bloques después

test('tarjetaAbierta: abierta es progress < 100, el criterio de tareasAbiertas', () => {
  const t = (progress: number) => ({ id: 'x', num: 659, progress });
  assert.deepEqual(tarjetaAbierta(t(0)), t(0));
  assert.deepEqual(tarjetaAbierta(t(99)), t(99));
  assert.equal(tarjetaAbierta(t(100)), undefined, 'una tarjeta cerrada (100) se cuenta como abierta');
  assert.equal(tarjetaAbierta(undefined), undefined);
});

test('en Historia, el «#N abierta» y la fila clickeable cuelgan de la tarjeta FILTRADA', () => {
  const src = sinComentarios(leer('app/admin/dev/customer-success/RoadmapCS.tsx'));
  const ini = src.indexOf('HISTORIA.map(');
  const fin = src.indexOf('sueltas.length > 0', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el bloque de Historia en RoadmapCS.tsx');
  const bloque = src.slice(ini, fin);
  // El universo de la pregunta es ESTE bloque, y nada más: si mañana mide el triple, está
  // mirando otra cosa (medido el 06/10 sin comentarios: 1.691 caracteres).
  assert.ok(bloque.length < 3000, `el bloque de Historia mide ${bloque.length}: el corte está mirando de más`);

  const decl = bloque.match(/const (\w+) = tarjetaAbierta\(tareaDe\(p\)\);/);
  assert.ok(decl, 'Historia ya no pasa la tarjeta por tarjetaAbierta(tareaDe(p))');
  const v = decl[1];
  assert.doesNotMatch(bloque, /(?<!tarjetaAbierta\()tareaDe\(/, 'en Historia hay una tarjeta que llega sin pasar por tarjetaAbierta');
  assert.match(bloque, new RegExp(`\\{${v} && <span[^>]*>#\\{${v}\\.num\\} abierta`), 'el rótulo «#N abierta» no depende de la tarjeta filtrada');
  assert.match(bloque, new RegExp(`return ${v} \\?`), 'la fila clickeable no depende de la tarjeta filtrada');
  assert.match(bloque, new RegExp(`id: ${v}\\.id`), 'el modal abre otra tarjeta que la filtrada');
});
