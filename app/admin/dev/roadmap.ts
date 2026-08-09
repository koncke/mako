// =============================================================================
// El Roadmap de un área SALE DEL PLAN, no de una lista escrita a mano
// =============================================================================
// Cada área declara sus `proyectos` del tablero y acá se leen sus tareas abiertas.
// La razón es la que ya está escrita en `areas.ts`: un roadmap escrito a mano se
// queda viejo el martes, y con 121 áreas serían 121 listas desactualizándose en
// paralelo. El tablero es donde el trabajo ya vive; esto solo lo mira.
//
// De acá sale también el ESTADO real: una pieza con tareas abiertas no está
// cerrada, por más que el catálogo diga `listo`. Es literalmente lo que pidió el
// dueño: «hay algunos que en realidad están en parcial, por ejemplo el Goal Tracker
// hay una tarea específica que pidió Mauricio».

import 'server-only';
import { getTenantDb, runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import { AREAS, type AreaDev, type EstadoArea } from './areas';

export type TareaRoadmap = {
  num: number;
  titulo: string;
  score: number;
  progreso: number;
  deadline: string | null;
  proyecto: string;
};

export type RoadmapArea = {
  tareas: TareaRoadmap[];
  /** El estado EFECTIVO: el del catálogo, salvo que haya trabajo abierto. */
  estado: EstadoArea;
};

/** Cuántas tareas abiertas tiene cada área. Una sola consulta para las 121. */
export async function conteoPorArea(): Promise<Map<string, number>> {
  const filas = await tareasAbiertas();
  const porProyecto = new Map<string, number>();
  for (const t of filas) porProyecto.set(t.proyecto, (porProyecto.get(t.proyecto) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const a of AREAS) {
    out.set(a.slug, (a.proyectos ?? []).reduce((n, p) => n + (porProyecto.get(p) ?? 0), 0));
  }
  return out;
}

/** El estado que se pinta: `listo` solo si de verdad no queda nada abierto. */
export function estadoEfectivo(a: AreaDev, abiertas: number): EstadoArea {
  if (a.estado === 'por-construir') return 'por-construir';
  return abiertas > 0 ? 'parcial' : a.estado;
}

export async function roadmapDe(slug: string): Promise<RoadmapArea> {
  const area = AREAS.find((a) => a.slug === slug);
  if (!area) return { tareas: [], estado: 'por-construir' };
  const suyos = new Set(area.proyectos ?? []);
  const tareas = suyos.size
    ? (await tareasAbiertas()).filter((t) => suyos.has(t.proyecto)).sort((a, b) => b.score - a.score)
    : [];
  return { tareas, estado: estadoEfectivo(area, tareas.length) };
}

// ---------------------------------------------------------------------------

let cache: { at: number; filas: TareaRoadmap[] } | null = null;

/**
 * Las tareas abiertas del tablero del dueño, con el NOMBRE de su proyecto.
 *
 * Se cachea 30 s en memoria porque el índice de /admin/dev pinta las 121 áreas de
 * una: sin esto era una consulta por área. El TTL corto alcanza — es una pantalla
 * de construcción, no el tablero.
 *
 * ⚠️ El tablero del dueño vive en el workspace del dueño, no en el del super admin
 * que está mirando. Va con `runWithWorkspace(OWNER_WS)` explícito, igual que el
 * resto de `lib/plan-board.ts`.
 */
async function tareasAbiertas(): Promise<TareaRoadmap[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.filas;
  const filas = await runWithWorkspace(OWNER_WS, async () => {
    const db = await getTenantDb();
    const [{ data: proys }, { data: tareas }] = await Promise.all([
      db.from('plan_proyectos').select('id, name'),
      db.from('plan_tareas').select('num, title, labels, score, progress, deadline').lt('progress', 100),
    ]);
    const nombre = new Map((proys ?? []).map((p) => [p.id as string, p.name as string]));
    const out: TareaRoadmap[] = [];
    for (const t of tareas ?? []) {
      // Una tarea puede colgar de varios proyectos: aparece en el roadmap de cada
      // área que la reclame. No se deduplica a propósito — si dos áreas comparten
      // trabajo, las dos tienen que verlo.
      for (const id of (t.labels as string[] | null) ?? []) {
        const p = nombre.get(id);
        if (!p) continue;
        out.push({
          num: t.num as number,
          titulo: (t.title as string) ?? '',
          score: (t.score as number) ?? 0,
          progreso: (t.progress as number) ?? 0,
          deadline: (t.deadline as string | null) ?? null,
          proyecto: p,
        });
      }
    }
    return out;
  });
  cache = { at: Date.now(), filas };
  return filas;
}
