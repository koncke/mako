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
