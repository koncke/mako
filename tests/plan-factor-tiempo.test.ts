// =============================================================================
// El FACTOR TIEMPO: que MaKo sepa los días parados (#158)
// =============================================================================
// El tiempo YA movía el ranking desde hace meses (`castigoQuietud`, enchufado al reparto
// diario) y la tarjeta ya decía el deadline con los días que faltan. Lo que faltaba es el
// otro eje, y es el único que un agente NO puede deducir del JSON: **cuánto lleva parada**.
// El deadline viaja y se lee solo; la quietud no está en ningún otro campo.
//
// La consecuencia medida: MaKo propone «habría que arrancar con X» sobre una tarjeta que
// lleva cuarenta días abierta sin que nadie la toque, y no puede contestar «¿qué está
// trabado?» — porque `listar_tareas_vencidas` mira el DEADLINE, y una tarea SIN fecha
// puede llevar meses parada y no aparecer ahí por mucho que el ranking la esté hundiendo.
//
// ⚠️ Y NO VUELVE A LA TARJETA DEL KANBAN. El dueño sacó de ahí el chip de tiempo el
// 25/09/2026 con todas las letras —«quita los íconos de subió de prioridad o bajó»— y el
// motivo está medido: la card mide 249px y cada ícono le come ancho al nombre del
// proyecto, que es lo que él reclamó dos veces. Va al DETALLE, que es donde hay lugar
// para la frase, y a las tools. Lo que el dueño decidió es una restricción del problema.
//
// ⚠️ PROBADO ROMPIÉNDOLO, cuatro veces (30/09/2026):
//   1. Sacando `dias_sin_moverse` de `tareaCompacta`: falla 1 de 6.
//   2. Bajando el umbral a 0 (sale en las 300 tareas): falla 1 de 6 — es ruido en el
//      prompt, la misma razón por la que `se_repite: false` tampoco viaja.
//   3. Dejando que una RECURRENTE traiga el campo: falla 1 de 6. Una recurrente no se
//      «traba»: no se completa, se repite, y su historial no se toca entre una vuelta y
//      la otra — saldría siempre primera en la lista de lo trabado.
//   4. Devolviendo el chip a la tarjeta del Kanban: falla 1 de 6, que es el guard que
//      cuida la decisión del dueño.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diasQuieta, castigoQuietud, DIA } from '../app/plan/board/envejecer';

const leer = (r: string) => readFileSync(resolve(import.meta.dirname, '..', r), 'utf8');
const HELPERS = leer('lib/api-mako/areas/plan.helpers.ts');
const DEF = leer('lib/api-mako/areas/plan.def.ts');
const RUN = leer('lib/api-mako/areas/plan.run.ts');
const SHELL = leer('app/plan/board/BoardShell.tsx');

const AHORA = Date.parse('2026-09-30T12:00:00Z');
const haceDias = (n: number) => AHORA - n * DIA;

test('el umbral del dato es el MISMO en el que el ranking empieza a castigar', () => {
  // Si se separan, MaKo dice «lleva 20 días parada» sobre algo que el ranking todavía no
  // tocó, o —peor— calla sobre algo que ya está hundido. Dos números para la misma
  // pregunta es cómo divergen.
  assert.match(HELPERS, /DIAS_PARADA_NOTORIA = 30/);
  assert.equal(castigoQuietud(29), 0, 'el castigo arranca antes de los 30');
  assert.ok(castigoQuietud(30) > 0, 'a los 30 el ranking ya la castiga y el dato no saldría');
});

test('los días salen de la MISMA función que usa el reparto, no de una copia', () => {
  // Un número que le decimos a un agente y otro que mueve el score son dos números que
  // van a divergir. Es el bug que este tablero ya pagó dos veces.
  assert.match(HELPERS, /import \{ diasQuieta \} from '@\/app\/plan\/board\/envejecer'/);
  assert.match(HELPERS, /export const diasParada =[\s\S]*?diasQuieta\(/);
  // Y lo que mide: el último toque de una PERSONA, no la creación.
  const hist = [{ id: 'a', ts: haceDias(5), actor: 'user' as const, text: 'la moví' }];
  assert.equal(diasQuieta(hist, haceDias(90), AHORA), 5, 'no cuenta desde el último toque');
});

test('lo que hace MaKo NO cuenta como tocarla', () => {
  // Si contara, el Perro reseteando scores dejaría el tablero entero como recién movido
  // y esta lista no encontraría nunca nada.
  const soloIA = [{ id: 'a', ts: haceDias(2), actor: 'ia' as const, text: 'MaKo la puntuó' }];
  assert.equal(diasQuieta(soloIA, haceDias(60), AHORA), 60, 'un toque de la IA reseteó el contador');
});

test('EL QUE IMPORTA: el campo viaja en `tareaCompacta`, con su nota y sólo cuando importa', () => {
  // Lo único que un modelo sabe de esta tarea es este JSON: sin la nota ve un número y
  // no sabe que 40 días es mucho, ni que por eso el score está bajo.
  const i = HELPERS.indexOf('export function tareaCompacta');
  const bloque = HELPERS.slice(i, HELPERS.indexOf('\n}', i));
  assert.match(bloque, /dias_sin_moverse: parada/, 'tareaCompacta no expone los días parada');
  assert.match(bloque, /dias_sin_moverse_nota:/, 'el número viaja sin explicación');
  assert.match(bloque, /parada >= DIAS_PARADA_NOTORIA/, 'el campo sale siempre: es ruido en 300 tareas');
  assert.match(bloque, /!esRecurrente\(t\)/, 'una recurrente no se «traba»: se repite');
});

test('hay una tool que contesta «¿qué está trabado?», declarada en el registro', () => {
  // `listar_tareas_vencidas` mira el DEADLINE: una tarea sin fecha puede llevar meses
  // parada y no aparecer ahí. Son dos preguntas y hacían falta dos operaciones.
  assert.match(DEF, /id: 'listar_tareas_paradas'/, 'la operación no está declarada');
  assert.match(DEF, /costo: 'gratis'/);
  assert.match(RUN, /listar_tareas_paradas: \{/, 'la operación se declaró y no la implementa nadie');
  assert.match(RUN, /\.filter\(compite\)/, 'la lista no saca las hechas ni las recurrentes');
});

test('NO vuelve a la tarjeta del Kanban: el dueño lo sacó de ahí', () => {
  // 25/09/2026, textual: «quita los íconos de subió de prioridad o bajó». Lo que el
  // dueño decidió es una RESTRICCIÓN del problema, no una opción del espacio de
  // soluciones — y el motivo está medido: la card mide 249px.
  assert.doesNotMatch(SHELL, /function TiempoChip/, 'volvió el chip de tiempo a la tarjeta');
  // Y la línea larga sigue existiendo, en el detalle, que es donde hay lugar.
  assert.match(SHELL, /function TiempoLinea/);
  assert.match(SHELL, /Nació hace /, 'el detalle no dice cuándo nació');
});
