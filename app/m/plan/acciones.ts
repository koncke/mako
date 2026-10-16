'use server';

// =============================================================================
// /m/plan — marcar hecha una tarea del plan desde el teléfono (y su Deshacer)
// =============================================================================
// La escritura vive en `lib/plan-marcar.ts` (relee la fila fresca y la guarda por el
// camino de cada tablero). Acá sólo está la puerta: quién puede, y refrescar la pantalla.
//
// ⚠️ UNA SERVER ACTION NO HEREDA NINGÚN GUARD. `/api/plan-board` exige admin y
// `/api/todo` no mira el rol; esta action no pasa por ninguna de las dos, así que lleva el
// suyo ADENTRO: sesión + la tab Plan (`todo`) visible para este rol en esta capa, con la
// MISMA regla que la barra de /m y el Sidebar (`puedeVerKey`, lib/movil-rutas.ts). Un id
// de otro workspace no se puede marcar: la lectura va por `getTenantDb`, scopeada al
// workspace de quien mira.
//
// ⚠️ 'use server' EXPORTA SÓLO FUNCIONES ASYNC. Los tipos del resultado viven en
// `app/plan/board/hoy.ts` (puro): la pantalla los importa de ahí con `import type`.
// =============================================================================

import { refresh } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { puedeVerKey } from '@/lib/movil-rutas';
import { marcarHecha } from '@/lib/plan-marcar';
import type { DeshacerMarca, ResultadoMarcar } from '@/app/plan/board/hoy';
import { moverDesdeElTelefono, type DeshacerMover, type ResultadoMoverTarea } from '@/lib/plan-mover';

/**
 * `hecha: true` = completar; `false` = reabrir. Con `deshacer` (lo que devolvió el
 * marcado: `{ prev, entryId }`) revierte ese marcado y saca su entrada del historial;
 * ahí `hecha` no se mira.
 *
 * Devuelve `{ ok: true, prev, entryId }` (con `yaEstaba: true` si no había nada que
 * cambiar: sin Deshacer) o `{ ok: false, error }` con una frase corta para el toast.
 * Al guardar, refresca la página: Today y /m/plan vuelven a leer solos.
 */
export async function marcarHechaAction(id: string, hecha: boolean, deshacer?: DeshacerMarca): Promise<ResultadoMarcar> {
  // Lo que llega de una server action lo escribe cualquiera: se valida la FORMA antes de
  // tocar nada, igual que un body de una ruta.
  if (typeof id !== 'string' || typeof hecha !== 'boolean') return { ok: false, error: 'Tarea inválida' };
  const desh = deshacer == null ? undefined
    : (typeof deshacer === 'object' && typeof deshacer.entryId === 'string' && typeof deshacer.prev === 'number' && Number.isFinite(deshacer.prev))
      ? { prev: deshacer.prev, entryId: deshacer.entryId.slice(0, 80) }
      : null;
  if (desh === null) return { ok: false, error: 'Ya no se puede deshacer' };

  if (!(await getUsuarioActual())) return { ok: false, error: 'Sesión vencida' };
  const [rol, capa] = await Promise.all([getRolWsEfectivo(), getCapaActual()]);
  if (!puedeVerKey('todo', rol, capa)) return { ok: false, error: 'Sin permiso' };

  const r = await marcarHecha(id, hecha, desh);
  if (r.ok && !r.yaEstaba) {
    // Re-pide la página desde acá: las 5 prioridades se rellenan solas al completar una.
    // Envuelto: la escritura ya pasó, y un fallo al refrescar no puede volverla un error.
    try { refresh(); } catch (e) { console.error('[m/plan] refresh:', e instanceof Error ? e.message : e); }
  }
  return r;
}

/**
 * MOVER UNA TAREA DE COLUMNA desde el kanban del teléfono (16/10/2026): el mismo gesto que el
 * CRM, ahora que las columnas del Plan son el ESTADO. Con `deshacer` (lo que devolvió el mover:
 * `{ entryId }`) la devuelve a `estado` sacando esa entrada del historial.
 *
 * Mismo guard que `marcarHechaAction` y por lo mismo: una server action no hereda ninguno.
 */
export async function moverTareaAction(id: string, estado: string, deshacer?: DeshacerMover): Promise<ResultadoMoverTarea> {
  if (typeof id !== 'string' || typeof estado !== 'string') return { ok: false, error: 'Tarea inválida' };
  const desh = deshacer == null ? undefined
    : (typeof deshacer === 'object' && typeof deshacer.entryId === 'string' && deshacer.entryId) ? { entryId: deshacer.entryId.slice(0, 80) } : null;
  if (desh === null) return { ok: false, error: 'Ya no se puede deshacer' };

  if (!(await getUsuarioActual())) return { ok: false, error: 'Sesión vencida' };
  const [rol, capa] = await Promise.all([getRolWsEfectivo(), getCapaActual()]);
  if (!puedeVerKey('todo', rol, capa)) return { ok: false, error: 'Sin permiso' };

  const r = await moverDesdeElTelefono(id, estado, desh);
  if (r.ok && !r.yaEstaba) {
    try { refresh(); } catch (e) { console.error('[m/plan] refresh:', e instanceof Error ? e.message : e); }
  }
  return r;
}
