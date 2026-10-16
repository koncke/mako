// =============================================================================
// Los tableros del Plan en el teléfono (v3, 14/10/2026) — lógica pura, con test
// =============================================================================
// Martín (14/10/2026): «el Plan no cambia: en el celular todo se ve SIMILAR al escritorio, pero
// con menos texto y menos cosas». El escritorio tiene cuatro vistas (Prioridades · Tareas ·
// Proyectos · Recurrentes, `VISTAS` de app/plan/board/BoardShell.tsx); el teléfono, las mismas:
//
//   · Tareas     → el Kanban por ESTADO, el mismo de escritorio desde el 16/10/2026 («hacer el
//                  kanban un kanban»): Por iniciar · En proceso · Atorada · Completada (+ «No
//                  cumplen tu criterio» sólo si hay), en el orden manual de cada columna, sin las
//                  recurrentes. Hasta el 16/10 era por prioridad (Alta · Media · Baja · A futuro)
//                  y sólo con las abiertas, la de mayor score arriba. Las columnas, el orden y el
//                  «Sin priorizar» salen de app/plan/board/kanban.ts: el MISMO módulo que escritorio.
//                  «Completada» viaja recortada (las más recientes) y dice cuántas hay de verdad.
//   · Proyectos  → los mismos cuatro escalones por el score del proyecto (el prototipo v3
//                  aprobado), sin los recurrentes ni los terminados, con su avance.
//   · Recurrentes→ la lista de lo que se repite, con cada cuánto.
//
// La prioridad NO se cambia desde el teléfono: es la audiencia con el Perro (prioridadManual),
// y se queda en la computadora. La COLUMNA sí (16/10/2026): mover una tarea de estado es el gesto
// del kanban, y en el teléfono es el mismo «mantener y arrastrar» del CRM (`moverTareaAction`).
//
// ⚠️ El avance del proyecto es el de `projProgress` (app/plan/board/piezas.tsx), copiado y no
// importado: ese archivo es 'use client' y desde el server su función llega como referencia
// de cliente, no como función. Si cambia allá, cambia acá (el test fija los dos casos).
// =============================================================================

import { prioFromScore, prioFiltroDe, type BoardTask, type Label, type Prio, type PrioFiltro, type EstadoTarea } from '@/app/plan/board/types';
import { columnasPorEstado } from '@/app/plan/board/kanban';
import { cuandoDe } from '@/app/plan/board/cuando';
import { esRecurrente, sinRecurrentes, soloRecurrentes, textoRepeticionCorto, recurrenciaDe } from '@/lib/plan-recurrentes';
import type { ItemPlan } from '@/app/plan/board/hoy';

export type ProyectoPlanM = {
  id: string;
  nombre: string;
  emoji: string;
  color: string;
  banda: Prio;
  /** Tareas con fin (sin las recurrentes): hechas de total. */
  hechas: number;
  total: number;
  /** El promedio de avance, 0-100 (el número de escritorio). */
  pct: number;
  deadline: string | null;
};

export type RecurrenteM = {
  id: string;
  titulo: string;
  /** «Cada lunes», «Cada mes»… null = se repite y nadie dijo cada cuánto. */
  repite: string | null;
  proyecto: ItemPlan['proyecto'];
};

type Entrada = { tareas: BoardTask[]; proyectos: Label[]; hoy: string; conNum: boolean };

function proyectoDe(t: BoardTask, porId: Map<string, Label>): ItemPlan['proyecto'] {
  const p = t.labels.map((id) => porId.get(id)).find((x): x is Label => !!x) ?? null;
  return p ? { nombre: p.name, emoji: p.emoji, color: p.color } : null;
}

const mapa = (proyectos: Label[]) => {
  const m = new Map<string, Label>();
  for (const l of proyectos) if (!m.has(l.id)) m.set(l.id, l);
  return m;
};

/** Una tarjeta del Kanban de tareas del teléfono: la fila de siempre más su columna. */
export type TareaKanbanM = ItemPlan & {
  /** La columna (el estado de la tarea). */
  estado: EstadoTarea;
  /** El chip de prioridad: la banda, o «Sin priorizar» (score 0). No es `banda`: ésa es la del número. */
  prioridad: PrioFiltro;
  /** Por qué está «Atorada», en una línea. Sólo ahí. */
  motivo: string | null;
};
export type ColumnaTareasM = { key: EstadoTarea; titulo: string; cuantos: number };
export type TableroTareasM = { columnas: ColumnaTareasM[]; tareas: TareaKanbanM[] };

/**
 * Cuántas de «Completada» viajan al teléfono: las más recientes (el orden manual de esa columna
 * pone arriba lo último que se completó). Es la única columna que crece sin techo — en el
 * tablero del dueño, 248 de 424 el 16/10/2026 — y el conteo dice el total (`cuantos`).
 */
export const COMPLETADAS_EN_EL_TELEFONO = 30;

/**
 * El Kanban de tareas POR ESTADO (16/10/2026): las columnas y las tarjetas, en el mismo orden y
 * con las mismas reglas que escritorio (`columnasPorEstado`, app/plan/board/kanban.ts). Sin las
 * recurrentes (tienen su vista), como `hoyDelTablero`.
 */
export function tareasDelTablero({ tareas, proyectos, hoy, conNum }: Entrada): TableroTareasM {
  const porId = mapa(proyectos);
  const conFin = sinRecurrentes(tareas);
  const columnas: ColumnaTareasM[] = [];
  const out: TareaKanbanM[] = [];
  for (const c of columnasPorEstado(conFin, conFin)) {
    columnas.push({ key: c.estado, titulo: c.label, cuantos: c.items.length });
    const viajan = c.estado === 'hecho' ? c.items.slice(0, COMPLETADAS_EN_EL_TELEFONO) : c.items;
    for (const t of viajan) {
      const dl = (t.deadline ?? '').trim() || null;
      out.push({
        id: t.id,
        ...(conNum && Number.isFinite(t.num) && t.num > 0 ? { num: t.num } : {}),
        titulo: t.title,
        proyecto: proyectoDe(t, porId),
        deadline: dl,
        cuando: cuandoDe(t, hoy),
        banda: prioFromScore(t.score),
        esInstancia: t.fuente?.tipo === 'recurrente',
        // Lo completado no está «vencido»: el plazo pasado ya no pide nada.
        vencida: c.estado !== 'hecho' && !!dl && dl < hoy,
        linkEscritorio: `/plan?tarea=${encodeURIComponent(t.id)}`,
        estado: c.estado,
        prioridad: prioFiltroDe(t),
        motivo: c.estado === 'en_seguimiento' ? t.motivoAtorada ?? null : null,
      });
    }
  }
  return { columnas, tareas: out };
}

/** El avance de un proyecto: el de `projProgress` de escritorio (ver la cabecera). */
export function avanceProyecto(tareas: BoardTask[], id: string): { pct: number; total: number; hechas: number } {
  const conFin = tareas.filter((t) => t.labels.includes(id) && !esRecurrente(t));
  if (!conFin.length) return { pct: 0, total: 0, hechas: 0 };
  return {
    pct: Math.round(conFin.reduce((s, t) => s + t.progress, 0) / conFin.length),
    total: conFin.length,
    hechas: conFin.filter((t) => t.progress >= 100).length,
  };
}

/** Los proyectos por escalón: sin recurrentes ni terminados, el de mayor score arriba. */
export function proyectosDelTablero({ tareas, proyectos }: Pick<Entrada, 'tareas' | 'proyectos'>): ProyectoPlanM[] {
  return sinRecurrentes(proyectos)
    .map((l) => ({ l, a: avanceProyecto(tareas, l.id) }))
    // Terminado = el de escritorio (`proyectoTerminado`): con tareas y todas al 100.
    .filter(({ a }) => !(a.total > 0 && a.pct >= 100))
    .sort((x, y) => y.l.score - x.l.score)
    .map(({ l, a }) => ({
      id: l.id, nombre: l.name, emoji: l.emoji, color: l.color,
      banda: prioFromScore(l.score),
      hechas: a.hechas, total: a.total, pct: a.pct,
      deadline: (l.deadline ?? '').trim() || null,
    }));
}

/** Lo que se repite: tareas recurrentes abiertas, con cada cuánto. */
export function recurrentesDelTablero({ tareas, proyectos }: Pick<Entrada, 'tareas' | 'proyectos'>): RecurrenteM[] {
  const porId = mapa(proyectos);
  return soloRecurrentes(tareas)
    .filter((t) => t.progress < 100)
    .map((t) => ({ id: t.id, titulo: t.title, repite: textoRepeticionCorto(recurrenciaDe(t)), proyecto: proyectoDe(t, porId) }));
}
