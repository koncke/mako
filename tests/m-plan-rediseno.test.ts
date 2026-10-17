// =============================================================================
// MaKo Mobile — el rediseño del Plan del 17/10/2026 (Todoist, Things 3 y Linear en el teléfono)
// =============================================================================
// Se lee del fuente (es piel y cableado, no reglas): que la casilla de Prioridades lleve el color de SU prioridad
// (Todoist), que la tarjeta de Tareas MUESTRE la prioridad con las rayitas de Linear pero ningún tablero del Plan
// la CAMBIE (decisión de Martín: «los tableros del Plan NO cambian prioridad»), y que la piel viva en la carpeta
// del Plan, no en el KanbanM compartido ni en app/m/m.css.
//
// Probado rompiéndolo (17/10/2026), con `node --test --import tsx tests/m-plan-rediseno.test.ts`:
//   · la casilla sin la banda (`className="m-plan-casilla"` a secas)                       → 3 pasan / 1 falla
//   · un `onMover={mover}` en el tablero de Proyectos (cambiaría la prioridad)            → 3 / 1
//   · la rayita de «Alta» pintada desde app/m/m.css (`.m-plan-prio` movida allá)          → 3 / 1
//   · las rayitas de Media con `nth-child(-n+3)` (Media se vería como Alta)               → 3 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(import.meta.url), '..', '..');
const crudo = (...p: string[]) => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
const fuente = (...p: string[]) => crudo(...p).replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('Prioridades: el círculo de Todoist con el color de la prioridad de ESA tarea', () => {
  const L = fuente('app', 'm', 'plan', 'ListaPlan.tsx');
  assert.match(L, /className=\{`m-plan-casilla m-plan-casilla--\$\{item\.banda\}`\}/);
  const css = fuente('app', 'm', 'plan', 'plan.css');
  assert.match(css, /\.m-plan-casilla--alta \.m-casilla__c \{ border-color: var\(--bad\);/);
  assert.match(css, /\.m-plan-casilla--media \.m-casilla__c \{ border-color: var\(--warn\);/);
  assert.match(css, /\.m-plan-casilla--baja \.m-casilla__c \{ border-color: var\(--primary\);/);
});

test('Tareas MUESTRA la prioridad; ningún tablero del Plan la cambia', () => {
  const L = fuente('app', 'm', 'plan', 'ListaPlan.tsx');
  assert.match(L, /<Prioridad k=\{it\.prioridad\} \/>/);
  // El de Tareas mueve de COLUMNA (el estado) con su action; el de Proyectos no mueve nada.
  const proyectos = L.slice(L.indexOf('data-tablero="proyectos"'));
  const kanbanProyectos = proyectos.slice(0, proyectos.indexOf('</div>'));
  assert.doesNotMatch(kanbanProyectos, /onMover|moverA/);
  assert.doesNotMatch(L, /prioridadManual|moverPrioridad/);
});

test('la piel es del Plan: KanbanM y app/m/m.css no se tocan', () => {
  const L = fuente('app', 'm', 'plan', 'ListaPlan.tsx');
  assert.match(L, /<div className="m-plan-tablero" data-tablero="tareas">\s*<KanbanM/);
  assert.doesNotMatch(fuente('app', 'm', 'm.css'), /m-plan-/);
  assert.doesNotMatch(fuente('app', 'm', '_ui', 'KanbanM.tsx'), /m-plan-|m-crm-/);
});

test('las rayitas de Linear: Alta 3, Media 2, Baja 1, A futuro ninguna', () => {
  const css = fuente('app', 'm', 'plan', 'plan.css');
  assert.match(css, /\.m-plan-prio\[data-prio="alta"\] i,\n\.m-plan-prio\[data-prio="media"\] i:nth-child\(-n\+2\),\n\.m-plan-prio\[data-prio="baja"\] i:nth-child\(1\) \{ background: var\(--ink\); \}/);
  assert.doesNotMatch(css, /data-prio="futuro"\] i[^{]*\{ background: var\(--ink\)/);
});
