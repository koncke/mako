// =============================================================================
// Las tareas que MaKo propone por WhatsApp (`proponer_tareas_plan`), leídas del JSON del modelo
// =============================================================================
// Sale de lib/mako-doer-acciones.ts (que es `server-only`) para que un test la pueda CORRER.
// Sin `server-only` a propósito.
//
// El agujero que cierra (pendiente T11, verificado el 17/11/2026): el schema de la herramienta le
// ofrecía `recurrente` al modelo, y el `map` de este mismo `case` copiaba título, prioridad,
// proyecto, deadline y detalle — y no `recurrente`. Una «junta de los miércoles» pedida por
// WhatsApp entraba como tarea normal, el Perro le ponía score y deadline, y titilaba pidiendo
// una fecha que nunca iba a tener. Es «escribir la salida no es ofrecerla»: el campo existía en
// el schema, en `PropuestaTarea` y en el alta, y se caía en el único mapeo del medio.
//
// ⚠️ `=== true` es la narrowing de un valor del modelo, no una segunda regla: el desempate con
// `deadline` (gana la fecha) lo hace `limpiarTarea` → `decidirRecurrente` en lib/plan-propuesta.ts,
// que es el choke point por el que pasan todos los productores de un borrador.
// =============================================================================

import { canonNombre } from '@/lib/plan-proyectos-catalogo';
import type { Prio } from '@/app/plan/board/types';

const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];

export type TareaDelDoer = {
  titulo: string;
  prioridad: Prio;
  proyecto?: string;
  deadline?: string;
  detalle?: string;
  recurrente?: boolean;
};

/** El `tareas` crudo que manda el modelo → lo que se le pasa a `crearPropuesta`. Las que no traen
 *  título se descartan (el `case` contesta con una guarda si no queda ninguna). */
export function tareasDelDoer(crudo: unknown): TareaDelDoer[] {
  const raw: unknown[] = Array.isArray(crudo) ? crudo : [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x): TareaDelDoer => ({
      titulo: typeof x.titulo === 'string' ? x.titulo.trim().slice(0, 200) : '',
      prioridad: PRIOS.includes(x.prioridad as Prio) ? (x.prioridad as Prio) : 'media',
      // `canonNombre`: si el modelo escribió «CRM», el proyecto se llama «Feature: CRM». El
      // prefijo no puede depender de que se acuerde de escribirlo. Para un nombre que no está en
      // el catálogo lo deja igual — ahí manda el Perro al aplicar.
      proyecto: x.proyecto ? canonNombre(String(x.proyecto).trim()).slice(0, 120) : undefined,
      deadline: typeof x.deadline === 'string' && x.deadline ? String(x.deadline) : undefined,
      detalle: typeof x.detalle === 'string' && x.detalle ? String(x.detalle).slice(0, 6000) : undefined,
      recurrente: x.recurrente === true ? true : undefined,
    }))
    .filter((t) => t.titulo);
}
