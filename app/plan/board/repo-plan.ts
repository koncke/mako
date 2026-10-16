'use client';

// =============================================================================
// repoPlan — el I/O del board del super-admin, en UN solo lugar
// =============================================================================
// Vivía adentro de `PlanBoard.tsx` y se saca acá cuando apareció el segundo
// consumidor: el roadmap de Customer Success (`app/admin/dev/customer-success`)
// abre la MISMA tarjeta con el MISMO modal, y para eso necesita el mismo `Board`.
//
// Copiarlo hubiera sido la forma segura de que el segundo se quedara viejo — es
// literalmente la regla «una cosa, un lugar» de AGENTS.md, y el precedente que la
// escribió (el contrato del `detalle`) costó días de salidas mal sin que nada
// avisara.
//
// Acá va SOLO el I/O contra `/api/plan-board`. El estado optimista, el change
// history y el undo siguen en `useBoard`.

import { type BoardTask, type Label, type Repo, type GuardPatch, type GuardProjPatch, type GuardResult } from './types';
import { sanearDep, type Dep } from './dependencias';
import { CATALOGO_PROYECTOS } from '@/lib/plan-proyectos-catalogo';

/** Pega a la API del board (DB). Devuelve la tarea/proyecto canónico cuando aplica.
 *  Exportada porque la migración one-shot de `PlanBoard` también la usa. */
export async function apiPlan(body: Record<string, unknown>): Promise<{ ok: boolean; tarea?: BoardTask; proyecto?: Label; error?: string; camino?: string[]; deps?: unknown[]; patches?: GuardPatch[]; proyectosPatch?: GuardProjPatch[]; conteo?: GuardResult | null; score?: number; movidos?: Array<{ id: string; nombre: string; antes: number; despues: number }> }> {
  return fetch('/api/plan-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

/**
 * El `Repo` del board del dueño. El board persiste optimista; acá solo el I/O.
 *
 * ⚠️ `apiPlan` NUNCA tira (atrapa y devuelve `{ok:false}`), así que hay que mirar
 * `j.ok`: sin ese chequeo un 403/500/504 resolvía como ÉXITO y el board creía que
 * el Perro había corrido, no activaba el fallback y nadie se enteraba de nada.
 */
export function repoPlan(): Repo {
  return {
    labelMode: 'multi', labelSingular: 'Proyecto', labelPlural: 'Proyectos', fathomExtract: true, debatePrioridad: true, catalogo: CATALOGO_PROYECTOS,
    createTask: async (d) => { const j = await apiPlan({ action: 'crear-tarea', tarea: d }); if (!j.ok || !j.tarea) throw new Error(j.error || 'no se pudo crear'); return j.tarea; },
    // ⚠️ `recurrente` (mig 0163) NO NECESITA UNA ACCIÓN PROPIA y no hay que agregársela:
    // acá viaja el `BoardTask` ENTERO, la ruta lo castea entero (`app/api/plan-board/route.ts`
    // no enumera campos) y `taskToRow` lo escribe. Es la contracara de `prioridadManual`,
    // que sí tiene la suya porque el `score` NO puede viajar en el payload del navegador —
    // ahí lo decide el server. `recurrente` lo decide una PERSONA, así que va por el camino
    // normal, con su entrada de historial y su deshacer (`useBoard.setRecurrente`).
    //
    // ⚠️ Y `recurrencia` (mig 0167) TAMPOCO NECESITA ACCIÓN PROPIA, por lo mismo: viaja
    // adentro del `BoardTask`. Lo que sí hace falta —y es lo que se verificó antes de
    // escribir esto— es que la ruta NO enumere campos: `app/api/plan-board/route.ts`
    // castea `body.tarea` entero y se lo pasa a `taskToRow`. El día que esa ruta pase a
    // armar el payload campo por campo, éste es el primero que se queda afuera y el
    // síntoma va a ser un control que guarda y vuelve vacío al recargar.
    //
    // ⚠️ SON DOS CAMPOS Y NO TRES DESDE LA 0167: la RRULE reemplazó a `frecuencia` +
    // `frecuencia_dia`, que eran dos columnas para un solo estado. Así que si alguna vez
    // hay que hacer enumerar a esa ruta, son `recurrente` y `recurrencia`, juntos.
    saveTask: async (d) => { await apiPlan({ action: 'guardar-tarea', tarea: d }); },
    deleteTask: async (id) => { await apiPlan({ action: 'borrar-tarea', id }); },
    // MOVER EN EL KANBAN (16/10/2026). Una acción propia y no `saveTask`: el estado y el lugar
    // NO viajan en el guardado de la fila entera (`guardarPlanTarea` los saca del payload, para
    // que una pestaña vieja no devuelva de columna lo que se movió desde otra).
    mover: async (id, estado, orden, opts) => {
      const j = await apiPlan({ action: 'mover-tarea', id, estado, orden, motivo: opts?.motivo, historial: opts?.historial });
      if (!j.ok || !j.tarea) throw new Error(j.error || 'No se pudo mover.');
      return j.tarea;
    },
    // ⚠️ Y LO MISMO A NIVEL PROYECTO (mig 0164): `Label.recurrente` tampoco necesita una
    // acción propia. Acá viaja el `Label` ENTERO, la ruta lo castea entero y `labelToRow` lo
    // escribe — y `guardarPlanProyecto` sólo saca del payload lo que decide el SERVER
    // (score, razón, candado, impacto, esfuerzo). `recurrente` no está en esa lista a
    // propósito: es una decisión de la persona, igual que el nombre o el emoji.
    createLabel: async (l) => { const j = await apiPlan({ action: 'crear-proyecto', proyecto: l }); return j.ok && j.proyecto ? j.proyecto : l; },
    saveLabel: async (l) => { await apiPlan({ action: 'guardar-proyecto', proyecto: l }); },
    deleteLabel: async (id) => { await apiPlan({ action: 'borrar-proyecto', id }); },
    // La prioridad A MANO (el slider del detalle y el pop-up del arrastre). Vive acá y NO
    // en el repo del cliente a propósito: `/api/plan-board` es «solo admin» y `score_manual`
    // (mig 0143) es una columna de `plan_tareas` que `experimento_tareas` no tiene.
    // `lugar` y `deshacer` viajan tal cual: las vecinas a correr las decide el SERVER con el
    // tablero recién leído (`hacerLugar` adentro de `fijarPrioridadAMano`), no esta pestaña.
    prioridadManual: async (entidad, id, score, opts) => {
      const j = await apiPlan({ action: 'prioridad-manual', entidad, id, score, lugar: opts?.lugar, deshacer: opts?.deshacer });
      if (!j.ok) throw new Error(j.error || 'no se pudo fijar la prioridad');
      return { score: Number(j.score) || score, movidos: Array.isArray(j.movidos) ? j.movidos : [] };
    },
    prioridadAlPerro: async (entidad, id) => {
      const j = await apiPlan({ action: 'prioridad-al-perro', entidad, id });
      if (!j.ok) throw new Error(j.error || 'no se pudo');
    },
    // ESTE tablero desempata: `fijarYDesempatar` reparte slots únicos, así que pedirle el
    // mismo número a varias las deja en números consecutivos y no en el mismo. Lo mira el
    // pop-up del lote para decir un rango en vez de un número que sería mentira. El del
    // cliente no lo declara, y no es un olvido: allá no hay cascada.
    prioridadDesempata: true,
    priorizarNuevas: async (ids, proyectoIds, contexto) => {
      const j = await apiPlan({ action: 'priorizar-nuevas', ids, proyectoIds: proyectoIds ?? [], contexto: contexto ?? '' });
      if (!j.ok) throw new Error(j.error || 'no se pudo priorizar');
      return { tareas: j.conteo?.tareas ?? { alta: 0, media: 0, baja: 0, futuro: 0 }, proyectos: j.conteo?.proyectos ?? 0, patches: j.patches ?? [], proyectosPatch: j.proyectosPatch ?? [] };
    },
    // El server devuelve la lista ENTERA de aristas, no un ok: es él quien corre el guard
    // de ciclo y quien ve las escrituras de las otras puertas (WhatsApp, el agente, un
    // script). Reconstruir la lista en el cliente sería el segundo productor del mismo dato.
    addDep: async (d) => {
      const j = await apiPlan({ action: 'dep-add', ...d });
      return { ok: !!j.ok, error: j.error, camino: j.camino, deps: (j.deps ?? []).map(sanearDep).filter((x): x is Dep => x != null) };
    },
    delDep: async (entidad, deId, aId) => {
      const j = await apiPlan({ action: 'dep-del', entidad, deId, aId });
      return { ok: !!j.ok, deps: (j.deps ?? []).map(sanearDep).filter((x): x is Dep => x != null) };
    },
    ampliarTareas: async (items, fuente) => {
      const j = await apiPlan({ action: 'ampliar-tareas', items, fuente });
      if (!j.ok) throw new Error(j.error || 'no se pudo ampliar');
      return j.patches ?? [];
    },
  };
}
