// =============================================================================
// Los tableros del Plan en el teléfono (v3, 14/10/2026) — lógica pura, con test
// =============================================================================
// Martín (14/10/2026): «el Plan no cambia: en el celular todo se ve SIMILAR al escritorio, pero
// con menos texto y menos cosas». El escritorio tiene cuatro vistas (Prioridades · Tareas ·
// Proyectos · Recurrentes, `VISTAS` de app/plan/board/BoardShell.tsx); el teléfono, las mismas:
//
//   · Tareas     → el Kanban por prioridad (Alta · Media · Baja · A futuro): las abiertas que
//                  compiten (sin las recurrentes, como `hoyDelTablero`), la de mayor score arriba.
//   · Proyectos  → los mismos cuatro escalones por el score del proyecto (el prototipo v3
//                  aprobado), sin los recurrentes ni los terminados, con su avance.
//   · Recurrentes→ la lista de lo que se repite, con cada cuánto.
//
// La prioridad NO se cambia desde el teléfono: es la audiencia con el Perro (prioridadManual),
// y se queda en la computadora. Los tableros se miran y se completa una tarea; nada más.
//
// ⚠️ El avance del proyecto es el de `projProgress` (app/plan/board/piezas.tsx), copiado y no
// importado: ese archivo es 'use client' y desde el server su función llega como referencia
// de cliente, no como función. Si cambia allá, cambia acá (el test fija los dos casos).
// =============================================================================

import { prioFromScore, type BoardTask, type Label, type Prio } from '@/app/plan/board/types';
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

/** El Kanban de tareas: las abiertas que compiten, como ItemPlan (la fila y el sheet de siempre). */
export function tareasDelTablero({ tareas, proyectos, hoy, conNum }: Entrada): ItemPlan[] {
  const porId = mapa(proyectos);
  return sinRecurrentes(tareas)
    .filter((t) => t.progress < 100)
    .sort((a, b) => b.score - a.score)
    .map((t) => {
      const dl = (t.deadline ?? '').trim() || null;
      return {
        id: t.id,
        ...(conNum && Number.isFinite(t.num) && t.num > 0 ? { num: t.num } : {}),
        titulo: t.title,
        proyecto: proyectoDe(t, porId),
        deadline: dl,
        cuando: cuandoDe(t, hoy),
        banda: prioFromScore(t.score),
        esInstancia: t.fuente?.tipo === 'recurrente',
        vencida: !!dl && dl < hoy,
        linkEscritorio: `/plan?tarea=${encodeURIComponent(t.id)}`,
      };
    });
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
