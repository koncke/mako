// =============================================================================
// Las tareas de «Feature: CRM» para el runway — ABIERTAS Y CERRADAS
// =============================================================================
// ⚠️ POR QUÉ NO USA `roadmapDe` (app/admin/dev/roadmap.ts). Ese lector filtra con
// `.lt('progress', 100)` EN LA CONSULTA, así que una tarea cerrada deja de existir
// para él. Para /admin/dev eso es correcto —su pregunta es «¿qué queda?»— y acá es
// justo lo contrario: la pantalla tiene que poder decir «esto ya está hecho», y si
// las cerradas desaparecen, lo terminado se lee igual que lo que nunca existió.
//
// Lo que NO se hace es escribir los títulos a mano en `datos.ts`: el título, la
// prioridad y el avance salen del tablero en cada carga. Lo único propio de la
// pantalla es el veredicto de la depuración del 03/10.

import 'server-only';
import { runWithWorkspace, getTenantDb } from '@/lib/workspace';

export type TareaCrm = {
  num: number;
  titulo: string;
  score: number;
  /** 100 = terminada. La pantalla la marca «Hecha» y no le pregunta a `datos.ts`. */
  progreso: number;
};

/** El proyecto del tablero del que cuelga todo el CRM. */
export const PROYECTO_CRM = 'Feature: CRM';

/**
 * Todas las tareas del proyecto, ordenadas por prioridad como el tablero.
 *
 * Sin caché a propósito: esta pantalla se abre de a una por vez y lo que se mira
 * acá es si una tarea ya se cerró — un TTL de 30 s sobre eso es exactamente el
 * tiempo en que alguien cierra algo, mira la pantalla y no lo ve.
 */
export async function tareasDelCrm(ws: number): Promise<TareaCrm[]> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const [{ data: proys }, { data: tareas }] = await Promise.all([
      db.from('plan_proyectos').select('id, name'),
      db.from('plan_tareas').select('num, title, labels, score, progress'),
    ]);
    const ids = new Set((proys ?? []).filter((p) => p.name === PROYECTO_CRM).map((p) => p.id as string));
    if (!ids.size) return [];
    return (tareas ?? [])
      .filter((t) => (((t.labels as string[] | null) ?? []).some((id) => ids.has(id))))
      .map((t) => ({
        num: t.num as number,
        titulo: (t.title as string) ?? '',
        score: (t.score as number) ?? 0,
        progreso: (t.progress as number) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
  });
}
