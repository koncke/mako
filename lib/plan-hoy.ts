// =============================================================================
// plan-hoy — la LECTURA del plan para el teléfono (MaKo Mobile: Today y /m/plan)
// =============================================================================
// No es una lectura nueva del tablero: junta las dos que alimentan a `BoardShell` y le
// pasa el resultado a la cuenta pura (`app/plan/board/hoy.ts`).
//
//   · CUÁL tablero → `tableroActual()`, la misma regla que /plan (por SESIÓN: un admin
//     mirando a un cliente ve el tablero del cliente).
//   · dueño        → `listPlanBoard()` (plan_tareas + plan_proyectos + dependencias).
//   · cliente      → `listTareas()` + `listCategorias()` pasados por `toBoard`/`toLabel`,
//                    los mappers del tablero del cliente.
//   · «hoy»        → `hoyEnWorkspace()`, la fecha en la zona del NEGOCIO. ⚠️ El escritorio
//                    usa la del dispositivo (`hoyISO`, piezas.tsx): cerca de la medianoche
//                    los dos pueden no coincidir en qué vence hoy.
//
// ⚠️ NO COPIA LO QUE /plan HACE AL LEER. `app/plan/page.tsx` siembra el tablero vacío y
// autocompleta tareas por señales en cada carga: una lectura que escribe. Desde el teléfono
// no se decide eso; acá sólo se lee.
//
// ⚠️ SIN PAGINAR, COMO EL TABLERO: `listPlanBoard` y `listTareas` cortan en 1000 filas sin
// avisar. `recortado` lo dice cuando una lectura llega justo al tope.
//
// ⚠️ NO SIRVE SIN SESIÓN (un cron, un push): `tableroActual` lee la cookie. Ahí va
// `tableroDeCapa` + `runWithWorkspace` (molde: app/api/cron/plan-recurvar).
// =============================================================================

import 'server-only';
import { tableroActual } from '@/lib/tablero-actual';
import { hoyEnWorkspace } from '@/lib/timezone';
import { listPlanBoard } from '@/lib/plan-board';
import { listTareas, listCategorias } from '@/lib/todo';
import { estaPendiente } from '@/lib/todo-estados';
import { listPropuestasPendientes } from '@/lib/plan-propuesta';
import { toBoard, toLabel } from '@/app/plan/board/desde-todo';
import { hoyDelTablero, type HoyDelTablero } from '@/app/plan/board/hoy';
import type { BoardTask, Label } from '@/app/plan/board/types';
import type { Dep } from '@/app/plan/board/dependencias';

/** Un borrador del plan que espera que alguien lo confirme en /plan/revisar. */
export type BorradorPlan = {
  id: string;
  /** Lo que el borrador dice de sí mismo (el resumen, o la reunión de la que salió). */
  titulo: string;
  /** Tareas para cargar que son TUYAS (las de otra persona esperan a esa persona). */
  tareas: number;
  /** Tareas que MaKo propone cerrar. */
  cierres: number;
  /** El path de escritorio, SIN `?ws=`. */
  linkEscritorio: string;
};

export type PlanHoy = HoyDelTablero & {
  tablero: 'dueno' | 'cliente';
  /** `YYYY-MM-DD` en la zona del negocio: la fecha contra la que se contó todo. */
  fecha: string;
  /**
   * Los borradores pendientes. `null` = NO SE PUDO LEER, que no es «no hay»: la pantalla
   * no dibuja la alerta en vez de afirmar que no hay nada para confirmar.
   */
  borradores: BorradorPlan[] | null;
  /** true si una lectura llegó justo a 1000 filas: puede faltar el resto. */
  recortado: boolean;
};

const TOPE_FILAS = 1000;

/** El plan de quien mira, contado para el teléfono. Tira si el tablero no se pudo leer. */
export async function leerPlanHoy(): Promise<PlanHoy> {
  const que = await tableroActual();
  const [fecha, tablero, borradores] = await Promise.all([hoyEnWorkspace(), leerTablero(que), leerBorradores()]);
  return {
    ...hoyDelTablero({ ...tablero, hoy: fecha, tablero: que }),
    tablero: que,
    fecha,
    borradores,
    recortado: tablero.recortado,
  };
}

/**
 * El tablero de quien mira, ya mapeado (las dos mitades: dueño y cliente). Lo usa también el Calendario
 * (lib/calendario.ts) para los deadlines: una segunda lectura del tablero es la que se olvida de sacar `no_cumple`.
 * Tira si el tablero no se pudo leer.
 */
export async function tableroDelPlan(): Promise<{ que: 'dueno' | 'cliente'; tareas: BoardTask[]; proyectos: Label[]; recortado: boolean }> {
  const que = await tableroActual();
  const t = await leerTablero(que);
  return { que, tareas: t.tareas, proyectos: t.proyectos, recortado: t.recortado };
}

async function leerTablero(que: 'dueno' | 'cliente'): Promise<{ tareas: BoardTask[]; proyectos: Label[]; deps: Dep[]; recortado: boolean }> {
  if (que === 'dueno') {
    const b = await listPlanBoard();
    return { ...b, recortado: b.tareas.length >= TOPE_FILAS || b.proyectos.length >= TOPE_FILAS };
  }
  const [ts, cs] = await Promise.all([listTareas(), listCategorias()]);
  return {
    // ⚠️ `no_cumple` SE SACA ANTES DE `toBoard`, que pierde el estado: una tarea que el
    // criterio no dejó pasar NO es un pendiente (lib/todo-estados.ts), y después del mapper
    // ya no hay forma de reconocerla. Lo hacen igual /general, mako-tools y /api/agente/plan.
    // ⚠️ `creadaEn` se suma acá porque `toBoard` no lo trae (el escritorio del cliente no lo
    // usa) y sin él «parada» mediría desde la última entrada de una persona o desde ahora:
    // una tarea vieja que nadie tocó nunca contaría como recién nacida. Es lo mismo que
    // hace la API (`leerTablero`, plan.helpers.ts). Es una lectura: no vuelve a la base.
    tareas: ts
      .filter((t) => estaPendiente(t.estado) || t.estado === 'hecho')
      .map((t) => ({ ...toBoard(t), creadaEn: Date.parse(String(t.created_at ?? '')) || undefined })),
    proyectos: cs.map(toLabel),
    deps: [],
    recortado: ts.length >= TOPE_FILAS || cs.length >= TOPE_FILAS,
  };
}

async function leerBorradores(): Promise<BorradorPlan[] | null> {
  try {
    // El default de listPropuestasPendientes es 8: llamada sin tope, «8 borradores» mentía
    // sobre workspaces con 133 (medido el 11/10/2026 en ws1).
    const ps = await listPropuestasPendientes(200);
    return ps.map((p) => ({
      id: p.id,
      titulo: (p.resumen || p.fuenteTitulo || '').trim(),
      tareas: p.tareas.filter((t) => !t.esDeOtro).length,
      cierres: p.cerrar?.length ?? 0,
      linkEscritorio: `/plan/revisar/${encodeURIComponent(p.id)}`,
    }));
  } catch (e) {
    console.error('[plan-hoy] borradores:', e instanceof Error ? e.message : e);
    return null;
  }
}
