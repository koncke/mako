// =============================================================================
// El filtro «Responsable» en el tablero del DUEÑO (F156, 18/11/2026)
// =============================================================================
// El filtro (míos / del cliente / de terceros / sin asignar) existía desde el 16/10/2026 sólo en el tablero del CLIENTE:
// `plan_tareas` no tenía `responsable_tipo`. La mig 0419 agrega la columna y AGENTS.md («El tablero es UNO y las tablas son
// DOS: un campo nuevo son SEIS lugares») dice dónde puede caerse. Del lado del dueño son cuatro (la puerta y el `upd` del
// server son del cliente), y cada uno con su modo de falla:
//   · la LECTURA (`rowToTask`): sin ella el guardado de la fila entera la borra (lo destructivo de siempre);
//   · la ESCRITURA (`taskToRow`): con la 0419 sin aplicar, mandar la columna haría rechazar el guardado de CUALQUIER tarjeta,
//     así que va sólo si la fila la trajo. Las dos reglas viven puras en lib/todo-estados.ts y acá se EJECUTAN;
//   · el ALTA desde una reunión (`agregarTareasPlanOwner`): la escribe, y sin la columna reintenta sin ella;
//   · el REPO (`responsables: true`): sin eso el filtro no se dibuja.
// Lo de lib/plan-board.ts lleva `server-only` y no se puede ejecutar acá: su cableado se mira en el fuente sin comentarios.
//
// Probado rompiéndolo (18/11/2026), base 3 pasan / 0 fallan, cada rotura restaurada de memoria (pasan / fallan):
//   · `responsableDeLaFila` que devuelve `null` aunque la fila no traiga la columna      → 1 / 2 (la lectura y la vuelta)
//   · `responsableParaGuardar` que manda la columna siempre (también sin la clave)        → 2 / 1
//   · `rowToTask` sin `...responsableDeLaFila(r)`                                        → 2 / 1
//   · el alta del dueño sin el reintento sin la columna                                   → 2 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { responsableDeLaFila, responsableParaGuardar } from '../lib/todo-estados';
import { pasaPrioYResponsable } from '../app/plan/board/kanban';

const RAIZ = resolve(fileURLToPath(import.meta.url), '..', '..');
const leer = (...p: string[]) => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const a = src.indexOf(desde);
  assert.ok(a >= 0, `no encontré «${desde}»`);
  const b = src.indexOf(hasta, a + desde.length);
  assert.ok(b > a, `no encontré el cierre «${hasta}» después de «${desde}»`);
  return src.slice(a, b);
};

test('la lectura: con la columna trae el valor o null; sin la columna, no trae la clave', () => {
  assert.deepEqual(responsableDeLaFila({ responsable_tipo: 'cliente' }), { responsableTipo: 'cliente' });
  assert.deepEqual(responsableDeLaFila({ responsable_tipo: null }), { responsableTipo: null }, 'null es «nadie lo dijo», no «mío»');
  assert.deepEqual(responsableDeLaFila({ responsable_tipo: 'jefe' }), { responsableTipo: null }, 'un valor fuera del check no entra');
  // Una fila leída con la 0419 sin aplicar: la clave no está, y eso NO es lo mismo que null.
  const sinColumna = responsableDeLaFila({ id: 't1', title: 'x' });
  assert.deepEqual(sinColumna, {});
  assert.ok(!('responsableTipo' in sinColumna));
});

test('el guardado: devuelve lo leído tal cual, y sin la clave no manda la columna', () => {
  assert.deepEqual(responsableParaGuardar({ responsableTipo: 'tercero' }), { responsable_tipo: 'tercero' });
  assert.deepEqual(responsableParaGuardar({ responsableTipo: null }), { responsable_tipo: null });
  assert.deepEqual(responsableParaGuardar({}), {}, 'sin la 0419 la columna viajaría y rechazaría el guardado entero');
  // La ida y vuelta: lo que se lee es lo que se guarda.
  for (const fila of [{ responsable_tipo: 'mio' }, { responsable_tipo: null }, { otra: 1 }]) {
    const t = responsableDeLaFila(fila);
    const vuelta = responsableParaGuardar(t);
    assert.deepEqual(vuelta, 'responsable_tipo' in fila ? { responsable_tipo: fila.responsable_tipo } : {});
  }
  // Y el filtro trata a la tarjeta sin el dato como «Sin asignar», igual que a la que tiene null.
  assert.equal(pasaPrioYResponsable({ score: 50 }, new Set(), new Set(['sin_asignar'])), true);
  assert.equal(pasaPrioYResponsable({ score: 50, responsableTipo: 'mio' }, new Set(), new Set(['sin_asignar'])), false);
});

test('el tablero del dueño lo lee, lo devuelve, lo escribe al crear desde una reunión y dibuja el filtro', () => {
  const pb = sinComentarios(leer('lib', 'plan-board.ts'));
  assert.match(bloque(pb, 'export function rowToTask(', '\nfunction estadoDeFila('), /\.\.\.responsableDeLaFila\(r\),/, 'la lectura no trae el responsable: el próximo guardado lo borra');
  assert.match(bloque(pb, 'function taskToRow(', '\nexport function rowToLabel('), /\.\.\.responsableParaGuardar\(t\),/, 'el guardado de la fila entera no lo devuelve');
  const alta = bloque(pb, 'export async function agregarTareasPlanOwner(', '\nexport type AmpliarTareaPlan');
  assert.match(alta, /responsableTipo: esResponsableTipo\(it\.responsableTipo\) \? it\.responsableTipo : null/, 'el alta no lo escribe');
  assert.match(alta, /if \(error && esColumnaInexistente\(error\) && filas\.some\(\(f\) => 'responsable_tipo' in f\)\)/, 'sin la 0419 el alta de una reunión se cae entera');
  assert.match(sinComentarios(leer('lib', 'plan-propuesta.ts')), /fuente: fuenteDe\(t\), responsableTipo: tipoDeResponsable\(t, !!prop\?\.clienteNombre\) \}\)\), \{ tipo: fuenteTipo \}/,
    'la extracción no le pasa el responsable al tablero del dueño');
  assert.match(sinComentarios(leer('app', 'plan', 'board', 'repo-plan.ts')), /responsables: true,/);
  // La migración: la misma columna y el mismo check que la del cliente (0159).
  const mig = leer('supabase', 'migrations', '0419_plan_tareas_responsable_tipo.sql');
  assert.match(mig, /alter table plan_tareas\s+add column if not exists responsable_tipo text\s+check \(responsable_tipo in \('mio', 'cliente', 'tercero'\)\);/);
});
