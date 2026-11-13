// =============================================================================
// Marketing CoPilot — las tareas de «Lo que te toca» viven en el Plan (13/11/2026)
// =============================================================================
// Martín (13/11): «las tareas se crean en el Plan y completarlas en un lado las completa en el otro». El Plan tiene dos tableros
// y cada negocio usa uno (lib/tablero-de-capa.ts): el del dueño (`plan_tareas`, lib/plan-board.ts) y el de los clientes
// (`experimento_tareas`, lib/todo.ts). Se escribe SIEMPRE por las funciones del Plan, nunca por fuera (el Cerebro, 13/11):
//   · crear: `agregarTareasPlanOwner` (sin IA: no gasta ni re-puntúa) o `crearTarea` (origen MaKo);
//   · completar o reabrir: `moverPlanTarea` / `moverTarea`, que respetan las reglas del kanban (el avance, `hecho_at`, la columna).
// Una tarea es del CoPilot por el link de su fuente (./tareas.ts → urlDeTarea / claveDeFuente). Todo dentro de runWithWorkspace(ws).
// =============================================================================

import 'server-only';
import { getWorkspace, runWithWorkspace } from '@/lib/workspace';
import { tableroDeCapa } from '@/lib/tablero-de-capa';
import { crearTarea, listTareas, moverTarea } from '@/lib/todo';
import { agregarTareasPlanOwner, listPlanBoard, moverPlanTarea } from '@/lib/plan-board';
import {
  ETIQUETA_FUENTE_COPILOTO, TIPO_FUENTE_COPILOTO, claveDeFuente, planDeSincronizacion, urlDeTarea, type TareaCoPilot,
} from './tareas';

export type TareaEnPlan = { clave: string; id: string; hecha: boolean };

async function esDelDueno(ws: number): Promise<boolean> {
  return tableroDeCapa((await getWorkspace(ws))?.capa) === 'dueno';
}

/** Las tareas del CoPilot que ya están en el Plan del negocio, con su estado. */
export async function tareasEnElPlan(ws: number): Promise<TareaEnPlan[]> {
  return runWithWorkspace(ws, async () => {
    const out: TareaEnPlan[] = [];
    if (await esDelDueno(ws)) {
      const { tareas } = await listPlanBoard();
      for (const t of tareas) {
        const clave = claveDeFuente(t.fuente);
        if (clave) out.push({ clave, id: t.id, hecha: t.estado ? t.estado === 'hecho' : t.progress >= 100 });
      }
    } else {
      for (const t of await listTareas()) {
        const clave = claveDeFuente(t.fuente);
        if (clave) out.push({ clave, id: String(t.id), hecha: t.estado === 'hecho' });
      }
    }
    return out;
  });
}

/**
 * Crea en el Plan lo que el CoPilot pide y el Plan no tiene, y cierra lo que el CoPilot dio por resuelto (./tareas.ts →
 * planDeSincronizacion). Devuelve cómo quedó todo: la pantalla dibuja el check desde acá.
 */
export async function sincronizarConElPlan(ws: number, hoy: readonly TareaCoPilot[], resueltas: readonly string[]): Promise<TareaEnPlan[]> {
  const antes = await tareasEnElPlan(ws);
  const { crear, cerrar } = planDeSincronizacion(hoy, resueltas, antes);
  if (!crear.length && !cerrar.length) return antes;
  await runWithWorkspace(ws, async () => {
    const dueno = await esDelDueno(ws);
    if (crear.length) {
      if (dueno) {
        await agregarTareasPlanOwner(
          crear.map((t) => ({ titulo: t.titulo, proyecto: ETIQUETA_FUENTE_COPILOTO, fuente: { tipo: TIPO_FUENTE_COPILOTO, etiqueta: ETIQUETA_FUENTE_COPILOTO, url: urlDeTarea(t) } })),
          { tipo: TIPO_FUENTE_COPILOTO, etiqueta: ETIQUETA_FUENTE_COPILOTO },
          { sinIA: true },
        );
      } else {
        for (const t of crear) await crearTarea({ titulo: t.titulo, origen: 'mako', fuente: { tipo: TIPO_FUENTE_COPILOTO, etiqueta: ETIQUETA_FUENTE_COPILOTO, url: urlDeTarea(t) } });
      }
    }
    const porClave = new Map(antes.map((t) => [t.clave, t]));
    for (const k of cerrar) {
      const t = porClave.get(k);
      if (!t) continue;
      if (dueno) await moverPlanTarea(t.id, 'hecho');
      else await moverTarea(Number(t.id), 'hecho');
    }
  });
  return tareasEnElPlan(ws);
}

/** Marcar o desmarcar en el CoPilot una tarea que vive en el Plan: la completa (o la reabre) allá. */
export async function marcarEnElPlan(ws: number, clave: string, hecha: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = (await tareasEnElPlan(ws)).find((x) => x.clave === clave);
  if (!t) return { ok: false, error: 'Esa tarea ya no está en tu Plan.' };
  if (t.hecha === hecha) return { ok: true };
  const r = await runWithWorkspace(ws, async () => ((await esDelDueno(ws))
    ? moverPlanTarea(t.id, hecha ? 'hecho' : 'por_hacer')
    : moverTarea(Number(t.id), hecha ? 'hecho' : 'por_hacer')));
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
