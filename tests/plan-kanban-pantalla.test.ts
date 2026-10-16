// =============================================================================
// El kanban de verdad, en la PANTALLA: columnas por estado, soltar sin pop-up, ＋ con estado,
// los filtros de Prioridad y Responsable, y el navegador que ya no re-puntúa solo
// =============================================================================
// 16/10/2026, «hacer el kanban un kanban» (Martín, sobre la reunión con Mauricio del 12/10):
// «el espíritu más importante del Kanban es el flujo… No la clasificación». La tanda 1 hizo el
// modelo (tests/plan-kanban-modelo.test.ts y tests/plan-kanban-server.test.ts); esto es la
// pantalla (decisiones 1, 2, 3, 4 y 8 de la SPEC):
//   · las columnas son Por iniciar · En proceso · Atorada · Completada (+ «No cumplen tu
//     criterio» sólo si el tablero tiene alguna), y una tarjeta va a la de su ESTADO;
//   · dentro de la columna manda el orden MANUAL, y soltar escribe el lugar entre las vecinas;
//   · soltar MUEVE (`board.mover`) y no abre el pop-up de prioridad;
//   · el «＋» de una columna crea en ese estado;
//   · la prioridad es un filtro (con «Sin priorizar», que no es «A futuro») y hay «Responsable»;
//   · el navegador no llama al Perro por su cuenta (`rePriorizar` se apagó).
//
// Dos mitades: las reglas se EJECUTAN (app/plan/board/kanban.ts, puro) y el cableado se lee del
// fuente SIN COMENTARIOS, por bloque (la función o el JSX), nunca el archivo entero — la casa
// explica en comentarios lo que sacó y citaría al pop-up que ya no está (AGENTS.md).
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026), base en verde primero (13 de 13), cada rotura restaurada.
// Doce roturas, doce cazadas, cada una en SU test (la 2 tira también la de al lado):
//   1. `columnasPorEstado` agrupando por el AVANCE (sin mirar `estado`)
//                                                → cae «una tarjeta va a la columna de su estado» (1 de 13)
//   2. `columnasDelKanban` con `no_cumple` siempre → caen «las columnas son el ESTADO» y «una
//      tarjeta va a la columna de su estado» (2 de 13: aparece una quinta columna vacía)
//   3. `enOrdenManual` con la sin `orden` al FONDO (+Infinity) → cae «el orden por defecto» (1 de 13)
//   4. `ordenAlSoltar` sin el `i - 1` (la de arriba = la misma de abajo) → cae «el lugar al soltar» (1 de 13)
//   5. `avanceLocal` sin recalcular (devuelve el estado de antes) → cae «la columna sigue al avance» (1 de 13)
//   6. `prioFiltroDe` usado como `prioFromScore` en `pasaPrioYResponsable` → cae «Sin priorizar no es A futuro» (1 de 13)
//   7. `responsableFiltroDe` con `?? 'mio'` → cae «Responsable: null es Sin asignar» (1 de 13)
//   8. el Kanban volviendo a `setSoltada({ entidad: 'tarea', … destino … })` al soltar → cae «sin pop-up» (1 de 13)
//   9. el «＋» de la columna con `onNew()` sin estado → cae «el ＋ crea en ese estado» (1 de 13)
//  10. `passes` sin `pasaPrioYResponsable` → cae «los filtros nuevos» (1 de 13)
//  11. el `useEffect` del disparo de `rePriorizar` restaurado (fetch a /api/mako-guardian) → cae
//      «sin re-puntuación oculta» (1 de 13)
//  12. `mover` en useBoard con `markDirty(id)` en vez de `repo.mover` → cae «useBoard: mover» (1 de 13)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  columnasPorEstado, enOrdenManual, ordenAlSoltar, ordenTopeLocal, avanceLocal, pasaPrioYResponsable,
  responsableFiltroDe, RESPONSABLES_FILTRO,
} from '../app/plan/board/kanban';
import type { BoardTask } from '../app/plan/board/types';

const RAIZ = resolve(fileURLToPath(import.meta.url), '..', '..');
const leer = (...p: string[]) => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
/** El bloque que va de `desde` hasta el próximo `hasta` (su cierre real, no un número de caracteres). */
const bloque = (src: string, desde: string, hasta: string) => {
  const a = src.indexOf(desde);
  assert.ok(a >= 0, `no encontré «${desde}»`);
  const b = src.indexOf(hasta, a + desde.length);
  assert.ok(b > a, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(a, b);
};

const t = (id: string, p: Partial<BoardTask> = {}): BoardTask => ({
  id, num: Number(id.replace(/\D/g, '')) || 1, emoji: '', title: id, detalle: '', priority: 'media', score: 50, progress: 0, deadline: '',
  labels: [], checklist: [], historial: [], origen: 'user', enPrioridad: false, ...p,
} as BoardTask);

// ── LAS REGLAS (kanban.ts, puro) ────────────────────────────────────────────────

test('las columnas son el ESTADO, en orden, y «No cumplen tu criterio» sólo si el tablero tiene', () => {
  const sin = columnasPorEstado([t('a1')], [t('a1')]);
  assert.deepEqual(sin.map((c) => c.label), ['Por iniciar', 'En proceso', 'Atorada', 'Completada']);
  // Con una en el TABLERO aparece al final, aunque el filtro la esconda de lo visible.
  const con = columnasPorEstado([t('a1')], [t('a1'), t('n2', { estado: 'no_cumple' })]);
  assert.deepEqual(con.map((c) => c.estado), ['por_hacer', 'en_curso', 'en_seguimiento', 'hecho', 'no_cumple']);
  assert.equal(con[4].items.length, 0, 'la columna existe; lo filtrado no se dibuja');
});

test('una tarjeta va a la columna de su ESTADO, no a la de su prioridad', () => {
  const tareas = [
    t('alta1', { score: 92, estado: 'por_hacer' }),
    t('baja2', { score: 30, estado: 'en_curso' }),
    t('libre3', { score: 0, estado: 'en_seguimiento' }),
    // Sin estado (una tarjeta armada a mano): sale del avance, la regla del backfill.
    t('vieja4', { score: 70, progress: 100 }),
  ];
  const cols = Object.fromEntries(columnasPorEstado(tareas, tareas).map((c) => [c.estado, c.items.map((x) => x.id)]));
  assert.deepEqual(cols, { por_hacer: ['alta1'], en_curso: ['baja2'], en_seguimiento: ['libre3'], hecho: ['vieja4'] });
});

test('el orden por defecto es el MANUAL: `orden` ascendente, la recién creada arriba, empate la más nueva', () => {
  const r = enOrdenManual([t('a1', { orden: 5 }), t('b2', { orden: -1 }), t('c3'), t('d4', { orden: 5 }), t('e5', { orden: 2 })]);
  // c3 no trae `orden` (la tarjeta optimista): arriba. d4 y a1 empatan en 5: la de num mayor primero.
  assert.deepEqual(r.map((x) => x.id), ['c3', 'b2', 'e5', 'd4', 'a1']);
  // Y la score NO cuenta: el orden manual no es «por prioridad».
  const s = enOrdenManual([t('x1', { orden: 1, score: 10 }), t('y2', { orden: 2, score: 99 })]);
  assert.deepEqual(s.map((x) => x.id), ['x1', 'y2']);
});

test('el lugar al soltar: entre la de arriba y la de abajo; arriba de todo y al fondo', () => {
  const col = [{ orden: 10 }, { orden: 20 }, { orden: 30 }];
  assert.equal(ordenAlSoltar(col, 1), 15, 'entre la 1ra y la 2da');
  assert.equal(ordenAlSoltar(col, 0), 9, 'arriba de todo: una menos que la primera');
  assert.equal(ordenAlSoltar(col, 3), 31, 'al fondo: una más que la última');
  assert.equal(ordenAlSoltar([], 0), 0, 'columna vacía');
  // «Arriba de todo» con lo que ve la pantalla: el menor menos uno, como `ordenTope` del server.
  assert.equal(ordenTopeLocal([t('a1', { estado: 'en_curso', orden: 4 }), t('b2', { estado: 'en_curso', orden: -3 }), t('c3', { estado: 'hecho', orden: -9 })], 'en_curso'), -4);
  assert.equal(ordenTopeLocal([t('b2', { estado: 'en_curso', orden: -3 })], 'en_curso', 'b2'), -1, 'sin contarse a sí misma');
});

test('la columna sigue al avance en la pantalla, con la MISMA regla del server', () => {
  // Completar desde «En proceso» la pasa a «Completada» (antes se quedaba tachada en su columna).
  assert.deepEqual(avanceLocal({ estado: 'en_curso', progress: 0 }, 100), { progress: 100, estado: 'hecho', motivoAtorada: null });
  // Reabrir.
  assert.equal(avanceLocal({ estado: 'hecho', progress: 100 }, 0).estado, 'por_hacer');
  // «Atorada» con avance se queda atorada y conserva su motivo; al 100%, sale y lo pierde.
  assert.deepEqual(avanceLocal({ estado: 'en_seguimiento', progress: 0, motivoAtorada: 'sin plata' }, 40), { progress: 40, estado: 'en_seguimiento', motivoAtorada: 'sin plata' });
  assert.deepEqual(avanceLocal({ estado: 'en_seguimiento', progress: 0, motivoAtorada: 'sin plata' }, 100), { progress: 100, estado: 'hecho', motivoAtorada: null });
  // Si el avance NO cambió, el estado explícito manda (la tarjeta arrastrada a mano no vuelve).
  assert.equal(avanceLocal({ estado: 'en_curso', progress: 0 }, 0).estado, 'en_curso');
});

test('Prioridad: «Sin priorizar» (score 0) NO es «A futuro»', () => {
  const libre = { score: 0, responsableTipo: null };
  const futuro = { score: 12, responsableTipo: null };
  assert.equal(pasaPrioYResponsable(libre, new Set(['sin_priorizar']), null), true);
  assert.equal(pasaPrioYResponsable(futuro, new Set(['sin_priorizar']), null), false);
  assert.equal(pasaPrioYResponsable(libre, new Set(['futuro']), null), false, 'la libre no es «A futuro»');
  assert.equal(pasaPrioYResponsable({ score: 80 }, new Set(['alta', 'media']), null), true);
  assert.equal(pasaPrioYResponsable({ score: 80 }, new Set(), null), true, 'vacío = no filtres');
});

test('Responsable: null es «Sin asignar» (no «Míos»), y sin el dato el filtro no se aplica', () => {
  assert.equal(responsableFiltroDe({ responsableTipo: null }), 'sin_asignar');
  assert.equal(responsableFiltroDe({}), 'sin_asignar');
  assert.equal(pasaPrioYResponsable({ score: 50, responsableTipo: null }, new Set(), new Set(['mio'])), false);
  assert.equal(pasaPrioYResponsable({ score: 50, responsableTipo: 'cliente' }, new Set(), new Set(['cliente', 'mio'])), true);
  // El tablero del dueño no tiene el dato (`responsables: null`): un Set que quedó guardado de
  // otra visita no puede esconder nada detrás de un control que no se dibuja.
  assert.equal(pasaPrioYResponsable({ score: 50 }, new Set(), null), true);
  // `tercero` existe en la base (la extracción lo escribe): tiene su opción.
  assert.deepEqual([...RESPONSABLES_FILTRO], ['mio', 'cliente', 'tercero', 'sin_asignar']);
});

// ── EL CABLEADO (el fuente, sin comentarios) ────────────────────────────────────

const SHELL = sinComentarios(leer('app', 'plan', 'board', 'BoardShell.tsx'));
const KANBAN = bloque(SHELL, 'function Kanban(', '\nfunction ColumnaKanban(');
const COLUMNA = bloque(SHELL, 'function ColumnaKanban(', '\nfunction CampoMotivo(');

test('el Kanban suelta con `mover` y NO abre el pop-up de prioridad', () => {
  for (const [nombre, src] of [['Kanban', KANBAN], ['ColumnaKanban', COLUMNA]] as const) {
    assert.doesNotMatch(src, /setSoltada|prioridadManual|sugerirNumero|scoreEntre\(|onSoltar/, `${nombre} volvió a preguntar la prioridad`);
  }
  assert.match(KANBAN, /const columnas = columnasPorEstado\(tasks, tablero, /);
  assert.match(KANBAN, /void board\.mover\(id, destino, ordenNuevo\);/);
  assert.match(KANBAN, /useArrastreTactil<EstadoTarea>\(\(id, destino\) => soltarEn\(id, destino\), colDe, puedeMover\)/);
  assert.match(COLUMNA, /soltarEn\(id, e, ordenAlSoltar\(otros, idx\)\);/);
  // El montaje no le pasa al Kanban ningún camino al pop-up.
  const montaje = bloque(SHELL, '<Kanban tasks={visibles}', '/>');
  assert.match(montaje, /tablero=\{conFin\}/);
  assert.doesNotMatch(montaje, /onSoltar|setSoltada/);
  // Y el campo del motivo sale al caer en «Atorada».
  assert.match(KANBAN, /if \(destino === 'en_seguimiento' && estadoDe\(t\) !== 'en_seguimiento'\) setMotivoDe\(id\);/);
});

test('el «＋» de cada columna crea la tarea con ESE estado', () => {
  assert.match(COLUMNA, /onClick=\{\(\) => onNew\(e\)\}/);
  assert.match(bloque(SHELL, '<Kanban tasks={visibles}', '/>'), /onNew=\{\(e\) => \{ setNuevaTareaEstado\(e \?\? null\); setNuevaTarea\(true\); \}\}/);
  assert.match(SHELL, /<CrearTareaModal proyectoInicial=\{nuevaTareaProj\} estadoInicial=\{nuevaTareaEstado\}/);
  const MODAL = sinComentarios(leer('app', 'plan', 'board', 'CrearTareaModal.tsx'));
  assert.match(MODAL, /\.\.\.\(estadoInicial \? \{ estado: estadoInicial \} : \{\}\)/);
  // …y el alta se lo pasa a `board.create`, que lo manda al repo (tanda 1).
  assert.match(bloque(SHELL, 'const crearConGuardian = ', '\n  };'), /board\.create\(d\.title, prioFromScore\(score\), [^)]*\{ detalle: d\.detalle, score, estado: d\.estado \}\)/);
});

test('los filtros nuevos están en el predicado de la vista y en el menú', () => {
  assert.match(bloque(SHELL, 'const passes = ', ';\n'), /&& pasaPrioYResponsable\(t, fPrio, repo\.responsables \? fResp : null\)/);
  const menu = bloque(SHELL, "{view === 'tareas' && <FilterMenu", '/>}');
  assert.match(menu, /fPrio=\{fPrio\} setFPrio=\{setFPrio\}/);
  assert.match(menu, /\.\.\.\(repo\.responsables \? \{ fResp, setFResp \} : \{\}\)/);
  assert.match(menu, /ordenOps=\{ORDEN_OPS_KANBAN\}/);
  // El orden del kanban arranca en MANUAL, con su clave propia.
  assert.match(SHELL, /usePref<OrdenModo>\('orden\.kanban', 'manual', /);
});

test('el filtro Responsable sólo en el tablero que tiene el dato (el del cliente)', () => {
  assert.match(sinComentarios(leer('app', 'plan', 'TodoBoard.tsx')), /responsables: true,/);
  assert.doesNotMatch(sinComentarios(leer('app', 'plan', 'board', 'repo-plan.ts')), /responsables/);
  // El dato entra por el mapper de lectura del cliente y NO sale en el guardado parcial.
  assert.match(sinComentarios(leer('app', 'plan', 'board', 'desde-todo.ts')), /responsableTipo: t\.responsable_tipo,/);
  assert.doesNotMatch(bloque(sinComentarios(leer('app', 'plan', 'TodoBoard.tsx')), 'const editPatch = ', '\n});'), /responsable/);
});

test('sin re-puntuación oculta: el navegador no llama al Perro por su cuenta', () => {
  assert.doesNotMatch(SHELL, /rePriorizar|planSignature|skipRePrio|guardianNuevasRef/);
  assert.doesNotMatch(SHELL, /fetch\('\/api\/mako-guardian'/);
  // Y nada que dependa de la firma del plan dispara un efecto.
  assert.doesNotMatch(SHELL, /\}, \[planSig\]\);/);
});

test('useBoard: mover escribe por `repo.mover` (no por el guardado) y el avance mueve la columna', () => {
  const B = sinComentarios(leer('app', 'plan', 'board', 'useBoard.ts'));
  const mover = bloque(B, 'const mover = async ', '\n  const deshacerMover = ');
  assert.match(mover, /const canon = await repo\.mover\(id, estado, lugar, \{ motivo, historial \}\);/);
  assert.doesNotMatch(mover, /markDirty\(/, 'el estado no viaja en el upsert de la fila entera');
  assert.match(mover, /motivoParaNoMover\(t, estado\)/);
  // El choke point del avance pasa por `conAvance` (completar, reabrir, deshacer un avance).
  assert.match(bloque(B, 'function patchLogExplicit<', '\n  }'), /conAvance\(x, \{ \.\.\.x, \[field\]: value/);
  assert.match(bloque(B, 'const undoHist = ', '\n  };'), /return conAvance\(x, next\);/);
  assert.match(B, /mover, setMotivoAtorada,/);
});
