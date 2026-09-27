// =============================================================================
// LO QUE SE CREA ADENTRO DE LA FICHA ES DEL CLIENTE — y sigue siéndolo un segundo después
// =============================================================================
// `FichaCliente` monta el tablero filtrado a UN cliente, así que lo que se cree ahí adentro
// tiene que nacer suyo: la pantalla sólo lee las filas con ese `cliente_lead_id`, y una
// tarjeta que nace sin dueño aparece mientras el modal está abierto y se evapora al
// recargar. El docstring de `clienteFijo` dice exactamente eso desde el 26/09/2026.
//
// Lo decía y no lo cumplía. Medido contra el código el 27/09/2026, eran TRES agujeros:
//
//  1. EL ALTA DE TAREA SE AUTO-BORRABA. `clienteFijo` envuelve `repo.createTask`, así que
//     la fila nace con el lead puesto — pero `useBoard.create` se queda sólo con `id`,
//     `num` y `origen` de la respuesta y conserva el borrador LOCAL, que no lo tiene. El
//     `markDirty` de la línea siguiente dispara un `saveTask` de la fila ENTERA con
//     `cliente_lead_id: null`. La tarea nacía con dueño y lo perdía milisegundos después,
//     sin un solo error.
//  2. EL `editar` INTERNO DEL ALTA (mitad cliente) hacía lo mismo un paso antes: si el
//     borrador traía contenido, `editPatch(d)` mandaba `cliente_lead_id: d.clienteLeadId
//     ?? null` sobre el borrador local.
//  3. EL ALTA DE PROYECTO NUNCA TUVO CLIENTE. `clienteFijo` envolvía `createTask` y nada
//     más, en las dos mitades. Un proyecto creado adentro de la ficha nacía sin dueño, y
//     con él se perdían de vista las tareas que le colgaras adentro.
//
// ⚠️ LOS TRES SON SILENCIOSOS. No hay excepción, no hay 4xx, no hay nada en la consola: la
// pantalla muestra la tarjeta recién creada y la base tiene la columna en `null`. Por eso
// esto se fija con un test y no con un comentario.
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ. Base: **6 pasan, 0 fallan**
// (`node --import tsx --test tests/cliente-fijo-al-crear.test.ts`):
//
//  #  Qué se rompió                                                      Result.  Qué cayó
//  1  el merge de `useBoard.create` sin `clienteLeadId: canon…`           5 / 1  «el alta de una tarea no pierde el cliente…»
//  2  `createLabel` fuera del override de PlanBoard                       5 / 1  «el alta de un PROYECTO nace del cliente…»
//  3  `clienteFijo?.leadId` fuera del payload de `categoria-crear`        5 / 1  «el alta de un PROYECTO nace del cliente…»
//  4  el `editar` interno del alta volviendo a `editPatch(d)`             5 / 1  «el editar que sigue al alta no lo borra»
//  5  `clienteFijo` fuera del `<PlanBoard>` de la ficha                   5 / 1  «la ficha le pasa el cliente a los dos tableros»
//  6  el `?? null` de `editPatch` cambiado por `?? undefined`             5 / 1  «desasignar tiene que seguir siendo posible»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
const leer = (...p: string[]): string => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r/g, '');

const USE_BOARD = leer('app', 'plan', 'board', 'useBoard.ts');
const PLAN = leer('app', 'plan', 'PlanBoard.tsx');
const TODO = leer('app', 'plan', 'TodoBoard.tsx');
const FICHA = leer('app', 'customer-success', 'FichaCliente.tsx');

test('el alta de una tarea no pierde el cliente que puso el repo', () => {
  // El merge post-alta tiene que copiar de vuelta lo que escribió el server. Sin esto, el
  // `saveTask` que dispara el `markDirty` de la línea siguiente lo manda como `null`.
  assert.match(USE_BOARD, /clienteLeadId: canon\.clienteLeadId \?\? x\.clienteLeadId/);
  assert.match(USE_BOARD, /clienteNombre: canon\.clienteNombre \?\? x\.clienteNombre/);
  // Y el `?? x.…` importa: un repo que NO inyecta nada devuelve el borrador tal cual, y
  // ahí lo que vale es lo que ya tenía el local. Sin el fallback, el tablero normal
  // perdería un cliente puesto a mano antes de guardar.
  assert.ok(!/clienteLeadId: canon\.clienteLeadId,/.test(USE_BOARD), 'sin fallback al local');
});

test('el alta de un PROYECTO nace del cliente, en las DOS mitades', () => {
  // ⚠️ LAS DOS. `BoardShell` es UNO y lo montan dos mitades sobre dos tablas: arreglarlo
  // en una deja el agujero abierto para la otra, que es el modo de falla que este repo ya
  // pagó cuatro veces con las columnas del tablero (AGENTS.md).
  assert.match(PLAN, /createLabel: \(l\) => base\.createLabel\(\{ \.\.\.l, \.\.\.conCliente \}\)/, 'mitad dueño');
  assert.match(TODO, /action: 'categoria-crear'[^;]*cliente_lead_id: l\.clienteLeadId \?\? clienteFijo\?\.leadId/, 'mitad cliente');
  // Y el alta de TAREA sigue estando, que es la que ya funcionaba.
  assert.match(PLAN, /createTask: \(d\) => base\.createTask\(\{ \.\.\.d, \.\.\.conCliente \}\)/, 'tarea, mitad dueño');
  assert.match(TODO, /action: 'crear'[^;]*cliente_lead_id: clienteFijo\?\.leadId/, 'tarea, mitad cliente');
});

test('el editar que sigue al alta no lo borra', () => {
  // `editPatch` se arma sobre el borrador LOCAL, que no conoce `clienteFijo`: hay que
  // pasárselo explícito o el patch manda `null` y deshace el alta.
  assert.match(TODO, /const conCli = clienteFijo\s*\n?\s*\? \{ \.\.\.d, clienteLeadId: clienteFijo\.leadId, clienteNombre: clienteFijo\.nombre \}/);
  assert.match(TODO, /patch: editPatch\(conCli\)/);
});

test('desasignar tiene que seguir siendo posible', () => {
  // El `?? null` de `editPatch` NO se toca: es lo único que permite sacarle el cliente a
  // una tarjeta desde su propio detalle. Cambiarlo por `undefined` («no lo toques») haría
  // que el campo del detalle contestara 200 sin guardar nada — el bug de siempre.
  assert.match(TODO, /cliente_lead_id: d\.clienteLeadId \?\? null, cliente_nombre: d\.clienteNombre \?\? null/);
});

test('la ficha le pasa el cliente a los dos tableros', () => {
  assert.match(FICHA, /<PlanBoard[^>]*clienteFijo=\{clienteFijo\}/, 'PlanBoard');
  assert.match(FICHA, /<TodoBoard[^>]*clienteFijo=\{clienteFijo\}/, 'TodoBoard');
});

test('el cliente NO se inyecta en los guardados, sólo en las altas', () => {
  // Es la contracara: si `saveTask`/`saveLabel` también lo inyectaran, el cliente quedaría
  // clavado en cada guardado y desasignar desde el detalle sería imposible. El alta lo
  // pone; después manda lo que diga la tarjeta.
  const overridePlan = /const repo: Repo = conCliente\s*\n\s*\? \{([\s\S]*?)\n\s*\}\s*\n\s*: base;/.exec(PLAN);
  assert.ok(overridePlan, 'encontré el override de PlanBoard');
  assert.ok(!/saveTask/.test(overridePlan[1]), 'saveTask no se envuelve');
  assert.ok(!/saveLabel/.test(overridePlan[1]), 'saveLabel no se envuelve');
});
