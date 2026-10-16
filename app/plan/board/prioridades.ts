// =============================================================================
// prioridades — «¿qué hago AHORA?»: las 5 del tablero, calculadas en UN lugar
// =============================================================================
// Es la vista Prioridades del tablero, sacada de `BoardShell.tsx` tal cual estaba
// (las líneas del objetivo principal y las de `enPrio`, 11/10/2026). La llaman TRES:
//
//   · el tablero de escritorio (`BoardShell`), que dibuja las tarjetas;
//   · el teléfono (`app/plan/board/hoy.ts` → `lib/plan-hoy.ts` → /m/plan y Today);
//   · la API de MaKo (`ver_prioridades_plan`, lib/api-mako/areas/plan.run.ts).
//
// ⚠️ ANTES ERAN DOS DEFINICIONES Y EL TELÉFONO IBA A SER LA TERCERA. La pantalla ordenaba
// por banda → objetivo principal → score del proyecto → urgencia heredada; la API ordenaba
// sólo por score y su comentario decía «es el mismo criterio». No lo era: la misma pregunta
// («¿qué hago hoy?») contestaba distinto según dónde se hiciera. Una función, tres
// llamadores, y `tests/plan-prioridades.test.ts` la compara contra la versión inline que
// reemplazó sobre tableros armados al azar.
//
// SIN `server-only` Y SIN `'use client'`: es aritmética sobre arrays. La importan una
// pantalla cliente, un módulo del server y un test.
//
// ⚠️ GENÉRICA A PROPÓSITO. El tablero la llama con `BoardTask`/`Label` y la API con su
// forma normalizada (`TareaPlan` adaptada). Lo único que mira de una tarea es lo que mira
// el grafo de dependencias (`TareaDep`), y de un proyecto, id, score y si se repite: así
// devuelve los MISMOS objetos que recibió, sin que nadie tenga que mapear de vuelta.
// =============================================================================

import { MAX_PRIORIDAD, PRIOS, prioFromScore } from './types';
import { resolverDeps, estaBloqueada, type Dep, type EstadoDeps, type TareaDep } from './dependencias';
import { sinRecurrentes } from '@/lib/plan-recurrentes';
import type { EstadoTarea } from '@/lib/todo-estados';

/** Lo que la cuenta lee de una tarea: lo mismo que el grafo de dependencias. */
/**
 * Lo que la cuenta lee de una tarea: lo del grafo, y la COLUMNA si la trae (16/10/2026). Con el
 * kanban por estado, una tarea se puede arrastrar a «No cumplen tu criterio» en las dos mitades,
 * y ahí NO es un pendiente (`estaPendiente`, lib/todo-estados.ts): sin mirar el estado, la vista
 * Prioridades ofrecería como «lo que hay que hacer AHORA» algo que el criterio no dejó pasar.
 * Opcional: sin estado, la que manda es el avance, como siempre.
 */
export type TareaPrio = TareaDep & { estado?: EstadoTarea };
/** Lo que la cuenta lee de un proyecto. */
export type ProyectoPrio = { id: string; score: number; recurrente?: boolean };

/**
 * EL FILTRO DE LA VISTA (hoy, el de cliente del tablero): un predicado para tareas y uno
 * para proyectos. `null` = sin filtro. Con filtro cambia el NORTE de la vista
 * (`objetivoVista`) pero NO el objetivo principal del tablero: ver el porqué abajo.
 */
export type FiltroPrioridades<T, P> = { tarea: (t: T) => boolean; proyecto: (p: P) => boolean };

export type EntradaPrioridades<T extends TareaPrio, P extends ProyectoPrio> = {
  /** TODAS las tareas del tablero, recurrentes incluidas: la cuenta las separa sola. */
  tareas: T[];
  /** TODOS los proyectos, recurrentes incluidos. */
  proyectos: P[];
  /** Las aristas del tablero del dueño. El del cliente no tiene: `[]` o nada. */
  deps?: Dep[];
  /**
   * El grafo YA resuelto, si quien llama lo tiene (el tablero lo memoiza en el render).
   * Tiene que ser el de `resolverDeps({ tareas, deps })` sobre las MISMAS tareas.
   */
  estDeps?: EstadoDeps;
  filtro?: FiltroPrioridades<T, P> | null;
  /** Cuántas devuelve. Default: `MAX_PRIORIDAD` (5), el de la pantalla. */
  max?: number;
  /**
   * true = las bloqueadas también entran. Sólo para el caso «está TODO bloqueado» de la
   * API, que devuelve igual las primeras marcadas para saber qué destrabar. La pantalla
   * no lo usa nunca: una lista de «hacé esto» con cosas que no se pueden hacer es peor
   * que una lista corta.
   */
  incluirBloqueadas?: boolean;
};

export type Prioridades<T, P> = {
  /** El grafo con el que se calculó (el que vino, o el que se resolvió acá). */
  estDeps: EstadoDeps;
  /** El norte del TABLERO. No cambia con el filtro: decide la columna del Kanban. */
  objetivoPrincipal: P | null;
  /** El norte de ESTA vista: con filtro, el mejor proyecto que pasa el filtro. */
  objetivoVista: P | null;
  /** Las primeras `max`, en el orden de la vista Prioridades. */
  prioridades: T[];
  /** Cuántas competían antes del tope: abiertas, con fin, sin bloquear y que pasan el filtro. */
  candidatas: number;
};

export function prioridadesDelTablero<T extends TareaPrio, P extends ProyectoPrio>(e: EntradaPrioridades<T, P>): Prioridades<T, P> {
  const { tareas, proyectos, filtro = null, max = MAX_PRIORIDAD, incluirBloqueadas = false } = e;
  const estDeps = e.estDeps ?? resolverDeps({ tareas, deps: e.deps ?? [] });
  // `conFin` (BoardShell): las tareas con inicio y fin, las únicas que se rankean. Una
  // recurrente ocupando 1 de 5 es el 20% de la pantalla del día contestando otra pregunta.
  const conFin = sinRecurrentes(tareas);
  // ABIERTA = con avance < 100 y fuera de «No cumplen tu criterio» (ver `TareaPrio`). Es la
  // pregunta de `estaPendiente` hecha con lo que trae cada llamador.
  const abierta = (t: T) => t.progress < 100 && t.estado !== 'no_cumple';

  // ── El Objetivo Principal ─────────────────────────────────────────────────────
  // Es el proyecto de mayor score QUE TODAVÍA TIENE TRABAJO. Antes era, sin más, el de
  // mayor score: cuando lo terminabas, el norte se quedaba clavado en un proyecto 100%
  // hecho y la vista Prioridades se vaciaba en vez de pasar al siguiente.
  //
  // El score del proyecto lo deriva el Perro de sus tareas, así que dos proyectos empatan
  // seguido en la punta. El desempate NO puede quedar en `orden` (el orden en que se
  // crearon): empata el que tiene MÁS trabajo abierto.
  const pendientesPorProy = new Map<string, number>();
  for (const t of conFin) if (abierta(t)) for (const id of t.labels) pendientesPorProy.set(id, (pendientesPorProy.get(id) ?? 0) + 1);
  // Un proyecto está frenado cuando NINGUNA de sus tareas abiertas se puede empezar:
  // alcanza con que UNA sea arrancable para que el proyecto lo sea.
  const proyArrancable = (id: string) => conFin.some((t) => abierta(t) && t.labels.includes(id) && !estaBloqueada(t.id, estDeps));
  // ⚠️ SIN LOS QUE SE REPITEN: marcar un proyecto recurrente no le baja el score, así que
  // sin este corte el norte del tablero señalaría algo que no se puede terminar.
  const porScore = sinRecurrentes(proyectos).slice().sort((a, b) => b.score - a.score || (pendientesPorProy.get(b.id) ?? 0) - (pendientesPorProy.get(a.id) ?? 0));
  const tienePendientes = (id: string) => (pendientesPorProy.get(id) ?? 0) > 0;
  // Exige trabajo ARRANCABLE, no sólo pendiente; si todo está frenado cae al criterio de
  // siempre en vez de dejar la card vacía. UNA función para el norte del tablero y el de
  // la vista filtrada: dos copias del criterio del norte son dos nortes.
  const elegirObjetivo = (ls: P[]): P | null => ls.find((l) => proyArrancable(l.id)) ?? ls.find((l) => tienePendientes(l.id)) ?? ls[0] ?? null;
  const objetivoPrincipal = elegirObjetivo(porScore);

  // ── Las tarjetas ──────────────────────────────────────────────────────────────
  // `board.labelById` del tablero: el PRIMERO con ese id. Un Map armado de corrido se
  // quedaría con el último si hubiera dos filas con el mismo id.
  const porId = new Map<string, P>();
  for (const l of proyectos) if (!porId.has(l.id)) porId.set(l.id, l);
  const scoreProy = (t: T) => Math.max(0, ...t.labels.map((id) => porId.get(id)?.score ?? 0));
  // ⚠️ Prioridades responde «¿qué hago AHORA?», así que lo BLOQUEADO no entra. Su score no
  // se toca —en el Kanban sigue donde estaba—: es que hoy no se puede empezar. Lo que sí
  // sube es lo que las DESTRABA, por la urgencia heredada.
  const pendientesTodas = conFin.filter((t) => abierta(t) && (incluirBloqueadas || !estaBloqueada(t.id, estDeps)) && (!filtro || filtro.tarea(t)));
  // EL NORTE DE ESTA VISTA. Sin filtro es el Objetivo Principal; con filtro, el mejor
  // proyecto que lo pasa, con el mismo criterio. ⚠️ `objetivoPrincipal` NO cambia con el
  // filtro, y es a propósito: es el norte del TABLERO, no el de la vista. (Hasta el 16/10/2026
  // este comentario decía que decidía la columna de cada tarjeta del Kanban; las columnas
  // pasaron a ser el estado ese día, y `displayPrio` ya ignoraba el norte.)
  const objetivoVista = filtro ? elegirObjetivo(porScore.filter(filtro.proyecto)) : objetivoPrincipal;
  const topVistaId = objetivoVista?.id ?? null;
  // ⚠️ MANDA LA BANDA, Y EL PROYECTO TOP DESEMPATA ADENTRO DE ELLA. Antes entraban primero
  // todas las del proyecto top y una tarea floja del norte (prioridad 20) le ganaba a una
  // fuerte de otro proyecto (medido el 25/09/2026). La banda es la del Kanban
  // (`prioFromScore`), sobre el score EFECTIVO (la urgencia heredada de lo que destraba).
  const urg = (t: T) => estDeps.urgencia[t.id] ?? t.score;
  const banda = (t: T) => PRIOS.indexOf(prioFromScore(urg(t)));   // 0 = alta … 3 = a futuro
  const esDelTop = (t: T) => (topVistaId ? t.labels.includes(topVistaId) : false);
  const prioridades = [...pendientesTodas]
    .sort((a, b) => banda(a) - banda(b) || Number(esDelTop(b)) - Number(esDelTop(a)) || scoreProy(b) - scoreProy(a) || urg(b) - urg(a))
    .slice(0, max);

  return { estDeps, objetivoPrincipal, objetivoVista, prioridades, candidatas: pendientesTodas.length };
}
