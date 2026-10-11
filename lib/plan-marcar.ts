// =============================================================================
// plan-marcar — «marcar hecha» desde el teléfono, por el camino de cada tablero
// =============================================================================
// El único gesto de ESCRITURA del plan en MaKo Mobile. La cuenta (qué avance, qué
// checklist, qué entrada de historial) es `cambioAlMarcar` (app/plan/board/hoy.ts), la
// semántica exacta de `useBoard.toggleDone`. Acá está lo que no se puede testear sin base:
// releer la fila y guardarla.
//
// ⚠️ SE RELEE LA FILA FRESCA EN EL SERVER, JUSTO ANTES DE ESCRIBIR. El teléfono manda un
// id y nada más: nunca una copia de la tarea. `guardarPlanTarea` es un upsert de la FILA
// ENTERA (un campo que no se leyó vuelve como null y borra la columna), así que la tarea
// que se guarda es la que se acaba de leer, con tres campos cambiados. Es el patrón de
// `actualizar_avance_tarea` (lib/api-mako/areas/plan.run.ts) y de `cerrarPlanTareaOwner`.
//
//   · dueño   → select('*').eq('id') → `rowToTask` → `guardarPlanTarea`, el mismo camino
//               que el autoguardado del tablero.
//   · cliente → select('*').eq('id') → `rowTo` → `editarTarea(id, { progreso, historial,
//               checklist })`, que es PARCIAL y deriva `estado` y `hecho_at` del avance.
//
// ⚠️ LO QUE NO HACE, A PROPÓSITO: no cambia score, score_base, score_manual ni priority, y
// no llama a recurvar, priorizarNuevas ni priorizarProyectos. Marcar hecha no dispara al
// Perro (lo dispara CREAR), y el reparto de las 09:10 ya saca sola a la que llegó a 100.
// `guardarPlanTarea` reescribe esas columnas con el valor que acaba de leer.
//
// ⚠️ UNA PESTAÑA VIEJA DEL ESCRITORIO PUEDE PISAR ESTO: el tablero guarda la fila entera
// desde su memoria y no hay compare-and-set por `updated_at`. Si alguien edita esa misma
// tarjeta en una pestaña abierta antes, revierte el «hecha» y se lleva la entrada.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { enPlan, rowToTask, guardarPlanTarea } from '@/lib/plan-board';
import { rowTo, editarTarea } from '@/lib/todo';
import { tableroActual, type QueTablero } from '@/lib/tablero-actual';
import { toBoard } from '@/app/plan/board/desde-todo';
import { cambioAlMarcar, type DeshacerMarca, type ResultadoMarcar } from '@/app/plan/board/hoy';

export type { DeshacerMarca, ResultadoMarcar };

const nuevoId = (): string => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/**
 * Marca hecha (`hecha: true`), reabre (`false`) o deshace (`deshacer` = lo que devolvió el
 * marcado) una tarea del tablero de QUIEN MIRA. Nunca tira: un fallo vuelve como
 * `{ ok: false, error }` con una frase corta para la pantalla, y el detalle va al log.
 *
 * ⚠️ NO EXIGE SESIÓN: la exige quien la llama (`app/m/plan/acciones.ts`). Desde acá sólo
 * se decide CUÁL tablero, por sesión (`tableroActual`).
 */
export async function marcarHecha(id: string, hecha: boolean, deshacer?: DeshacerMarca): Promise<ResultadoMarcar> {
  let que: QueTablero;
  try { que = await tableroActual(); } catch (e) {
    console.error('[plan-marcar] tablero:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar' };
  }
  return marcarHechaEnTablero(que, id, hecha, deshacer);
}

/**
 * El cuerpo, con el tablero ya decidido. ⚠️ Sólo para scripts y pruebas que corren sin
 * request (adentro de `runWithWorkspace`): en una request se usa `marcarHecha`, que decide
 * el tablero por la sesión. Pasar `'dueno'` en el workspace de un cliente lee `plan_tareas`
 * vacío y contesta «Ya no existe», sin escribir nada.
 */
export async function marcarHechaEnTablero(que: QueTablero, id: string, hecha: boolean, deshacer?: DeshacerMarca): Promise<ResultadoMarcar> {
  const limpio = String(id ?? '').trim();
  if (!limpio || limpio.length > 80) return { ok: false, error: 'Tarea inválida' };
  try {
    return que === 'dueno' ? await marcarDueno(limpio, hecha, deshacer) : await marcarCliente(limpio, hecha, deshacer);
  } catch (e) {
    console.error('[plan-marcar]', que, limpio, e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar' };
  }
}

async function marcarDueno(id: string, hecha: boolean, deshacer?: DeshacerMarca): Promise<ResultadoMarcar> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('plan_tareas').select('*').eq('id', id).limit(1);
    // «No pude leer» no es «no existe»: el error se lee, o la pantalla diría que la tarea
    // se borró con la base caída un segundo.
    if (error) { console.error('[plan-marcar] leer plan_tareas:', error.message); return { ok: false, error: 'No se pudo leer' }; }
    const fila = (data ?? [])[0] as Record<string, unknown> | undefined;
    if (!fila) return { ok: false, error: 'Ya no existe' };
    const t = rowToTask(fila);
    const c = cambioAlMarcar(t, hecha, { deshacer, ahora: Date.now(), nuevoId: nuevoId() });
    if (!c.ok) return c;
    if (c.yaEstaba) return { ok: true, prev: c.prev, entryId: '', yaEstaba: true };
    await guardarPlanTarea({ ...t, progress: c.progress, checklist: c.checklist, historial: c.historial });
    return { ok: true, prev: c.prev, entryId: c.entryId };
  });
}

async function marcarCliente(id: string, hecha: boolean, deshacer?: DeshacerMarca): Promise<ResultadoMarcar> {
  // El id del tablero del cliente es bigint y viaja como texto (el modelo del tablero usa
  // ids string): `Number`, y lo que no sea un entero positivo no llega a la base.
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) return { ok: false, error: 'Tarea inválida' };
  const db = await getTenantDb();
  const { data, error } = await db.from('experimento_tareas').select('*').eq('id', n).limit(1);
  if (error) { console.error('[plan-marcar] leer experimento_tareas:', error.message); return { ok: false, error: 'No se pudo leer' }; }
  const fila = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) return { ok: false, error: 'Ya no existe' };
  const t = toBoard(rowTo(fila));
  const c = cambioAlMarcar(t, hecha, { deshacer, ahora: Date.now(), nuevoId: nuevoId() });
  if (!c.ok) return c;
  if (c.yaEstaba) return { ok: true, prev: c.prev, entryId: '', yaEstaba: true };
  // PARCIAL: `editarTarea` arma su `upd` campo por campo y no toca lo que no viaja. La
  // checklist viaja sólo si cambió (con checklist, marcar la tilda entera).
  await editarTarea(n, { progreso: c.progress, historial: c.historial, ...(c.checklistCambio ? { checklist: c.checklist } : {}) });
  return { ok: true, prev: c.prev, entryId: c.entryId };
}
