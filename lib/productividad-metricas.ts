// =============================================================================
// productividad-metricas — lo que calcula Productivity Analyst sobre el tablero
// =============================================================================
// Proyectos, avance, pirámide de prioridad, cumplimiento de deadlines, cycle time,
// estancadas y deadlines corridos. Vivía en el `useMemo` de GraphicsView
// (app/plan/board/Graphics.tsx, `'use client'`) y se mudó acá el 11/10/2026 para que
// el Dashboard cuente EXACTAMENTE igual: lo usan los conjuntos `proyectos` y
// `ejecucion` (lib/graficos-datos-extra.ts; hasta v5, también los bloques de la plantilla
// «Productividad»). Un `.tsx` con `'use client'` no le
// exporta valores al server (AGENTS.md, «'use client' es una frontera de DATOS»).
//
// SIN `server-only`, a propósito (lo usan la pantalla, el server y los tests).
//
// ⚠️ EL CRITERIO ES EL DE LA TAB, Y TIENE DOS TRAMPAS ESCRITAS (docs del relevo del 11/10):
//   · Las tareas RECURRENTES no cuentan (se repiten para siempre: hundirían el avance), los
//     proyectos recurrentes SÍ.
//   · Una tarea cuenta en TODOS sus proyectos (`labels.includes`), no sólo en el primero
//     como hace el conjunto `tareas` del catálogo. Por eso «Avance por proyecto» sale de
//     acá y no de `tareas`.
//   · «Estancada» mira el ts más reciente de CUALQUIER entrada del historial, incluidas las
//     de MaKo (`ultActividad`). La versión canónica de «nadie la tocó» es `diasQuieta` de
//     app/plan/board/envejecer.ts; cambiarla es cambiar lo que dibuja la tab, y no es de
//     esta mudanza.
//   · Los «tiempos» salen del TEXTO del historial ('Creó…', /completa/i, 'Deadline…'), que se
//     recorta a 40-80 entradas: en tareas viejas el ciclo sale más corto.

import { sinRecurrentes } from './plan-recurrentes';
import { prioFromScore, type BoardTask, type Hist, type Label, type Prio } from '@/app/plan/board/types';

export const DAY = 86400000;

// ── helpers sobre el historial (eventos con timestamp) ────────────────────────
export const creadoTs = (h: Hist[]): number => {
  const c = h.find((x) => (x.text || '').startsWith('Creó'));
  if (c) return c.ts;
  return h.length ? Math.min(...h.map((x) => x.ts)) : 0;
};
export const completadoTs = (t: BoardTask): number | null => {
  if (t.progress < 100) return null;
  const done = t.historial.filter((x) => /completa/i.test(x.text || '')).sort((a, b) => b.ts - a.ts)[0];
  return done ? done.ts : null;
};
export const ultActividad = (h: Hist[]): number => (h.length ? Math.max(...h.map((x) => x.ts)) : 0);
export const deadlineMoves = (h: Hist[]): number => h.filter((x) => (x.text || '').startsWith('Deadline')).length;

export type DoneFilter = 'todos' | 'activos' | 'completados';
export type ProyectoMeta = { l: Label; total: number; done: number; pct: number; completo: boolean };

export type MetricasProductividad = {
  activas: BoardTask[];
  hechas: BoardTask[];
  projMeta: ProyectoMeta[];
  avanceGlobal: number;
  piramide: Record<Prio, number>;
  ciclos: { t: BoardTask; dias: number; prio: Prio }[];
  conDeadline: { t: BoardTask; aTiempo: boolean; dias: number }[];
  estancadas: { t: BoardTask; dias: number }[];
  sinDeadlineAlta: BoardTask[];
  sinDeadlineTotal: number;
  projSinDeadline: Label[];
  corridos: { t: BoardTask; n: number }[];
  wip: number;
};

/**
 * Todo lo que dibuja Productivity Analyst, de una pasada. Recibe las tareas TAL COMO
 * vienen del tablero (con las recurrentes): el criterio de sacarlas vive acá adentro,
 * en un solo lugar.
 */
export function metricasProductividad(tasksIn: BoardTask[], labels: Label[], now: number): MetricasProductividad {
  // ⚠️ SIN LAS RECURRENTES, igual que el resto del tablero. Todo lo que esta pantalla
  // dibuja —cuántas activas, cuántas hechas, el avance por proyecto, los deadlines
  // corridos— mide trabajo que EMPIEZA Y TERMINA. Una tarea que se repite para siempre
  // está clavada en «activa» y en 0% por definición: contarla hunde todas las barras y el
  // gráfico contesta otra pregunta que la que su título promete.
  const tasks = sinRecurrentes(tasksIn);
  const activas = tasks.filter((t) => t.progress < 100);
  const hechas = tasks.filter((t) => t.progress >= 100);
  // proyecto = "completado" si tiene tareas y todas están hechas
  const projMeta = labels.map((l) => {
    const suyas = tasks.filter((t) => t.labels.includes(l.id));
    const done = suyas.filter((t) => t.progress >= 100).length;
    const pct = suyas.length ? Math.round(suyas.reduce((s, t) => s + t.progress, 0) / suyas.length) : 0;
    return { l, total: suyas.length, done, pct, completo: suyas.length > 0 && done === suyas.length };
  });
  const avanceGlobal = projMeta.length ? Math.round(projMeta.reduce((s, p) => s + p.pct, 0) / projMeta.length) : 0;

  // pirámide: tareas activas por columna
  const piramide: Record<Prio, number> = { alta: 0, media: 0, baja: 0, futuro: 0 };
  activas.forEach((t) => { piramide[prioFromScore(t.score)]++; });

  // comportamiento (necesita eventos reales)
  const ciclos = hechas.map((t) => { const c = creadoTs(t.historial); const f = completadoTs(t); return c && f && f - c > DAY / 2 ? { t, dias: (f - c) / DAY, prio: prioFromScore(t.score) } : null; }).filter(Boolean) as { t: BoardTask; dias: number; prio: Prio }[];
  const conDeadline = hechas.map((t) => { const f = completadoTs(t); if (!f || !t.deadline) return null; const dl = Date.parse(t.deadline + 'T23:59:59'); if (!Number.isFinite(dl)) return null; return { t, aTiempo: f <= dl, dias: Math.round((f - dl) / DAY) }; }).filter(Boolean) as { t: BoardTask; aTiempo: boolean; dias: number }[];

  // estancadas: activas sin actividad hace > 7 días
  const estancadas = activas.map((t) => ({ t, dias: Math.round((now - ultActividad(t.historial)) / DAY) })).filter((x) => x.dias >= 7).sort((a, b) => b.dias - a.dias);
  // sin deadline (foco en Alta)
  const sinDeadlineAlta = activas.filter((t) => prioFromScore(t.score) === 'alta' && !t.deadline);
  const sinDeadlineTotal = activas.filter((t) => !t.deadline).length;
  const projSinDeadline = labels.filter((l) => !l.deadline);
  // deadlines que se corrieron
  const corridos = tasks.map((t) => ({ t, n: deadlineMoves(t.historial) })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n);

  // WIP
  const wip = activas.filter((t) => t.progress > 0).length;

  return { activas, hechas, projMeta, avanceGlobal, piramide, ciclos, conDeadline, estancadas, sinDeadlineAlta, sinDeadlineTotal, projSinDeadline, corridos, wip };
}

/**
 * El filtro «Mostrar: Activos / Completados / Todos» de la matriz y del avance: filtra PROYECTOS. Genérico
 * porque lo usan la tab (con `ProyectoMeta`) y el bloque del Dashboard (con lo que viaja del server).
 */
export function proyectosDelFiltro<T extends { completo: boolean }>(projMeta: T[], filtro: DoneFilter): T[] {
  return projMeta.filter((p) => (filtro === 'todos' ? true : filtro === 'completados' ? p.completo : !p.completo));
}

/** Los cuatro cuadrantes de «Impacto × Esfuerzo», con la cruz en 50/50. */
export type Cuadrante = 'quick' | 'apuesta' | 'relleno' | 'trampa';
export const CUADRANTE_ROTULO: Record<Cuadrante, string> = { quick: 'Quick win', apuesta: 'Apuesta grande', relleno: 'De relleno', trampa: 'Trampa' };
export const cuadranteDe = (imp: number, esf: number): Cuadrante => (imp >= 50 && esf < 50 ? 'quick' : imp >= 50 && esf >= 50 ? 'apuesta' : imp < 50 && esf < 50 ? 'relleno' : 'trampa');
