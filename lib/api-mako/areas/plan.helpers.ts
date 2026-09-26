// =============================================================================
// api-mako/areas/plan.helpers — el tablero del workspace, en UNA forma
// =============================================================================
// Hay DOS tableros con tablas e ids distintos: el del super-admin (plan_tareas /
// plan_proyectos, ids string, #num, dependencias) y el de cada cliente
// (experimento_tareas / tarea_categorias, ids number). Las lecturas del área `plan`
// hablan de «la tarea» sin importar cuál es: esto los lee y los normaliza.
//
// ⚠️ QUÉ TABLERO SE DECIDE POR CAPA (`superadmin`), NO por `ws === OWNER_WS`. El ws 1
// es Mauricio, un CLIENTE: con el criterio viejo se le devolvía plan_tareas vacío sin
// error. Es el mismo criterio que app/api/agente/plan/route.ts (usaPlanBoard) y que
// lib/plan-propuesta.ts (aplicarPropuestas). La tool heredada `ver_plan`
// (lib/mako-tools.ts) TODAVÍA usa el viejo: el runner de plan.run.ts la corre solo
// cuando los dos criterios coinciden, y si no contesta desde leerTablero.
//
// ⚠️ listPlanBoard y listTareas no paginan: PostgREST corta en 1000 filas sin avisar.
// `recortado` lo dice cuando se llega justo al tope, para que el runner lo declare.
// =============================================================================

import 'server-only';
import { getWorkspace, getTenantDb } from '@/lib/workspace';
import { AREA_GLOSARIO } from '@/lib/glosario';
import { listPlanBoard } from '@/lib/plan-board';
import { listTareas, listCategorias } from '@/lib/todo';
import { APP_BASE_URL } from '@/lib/app-url';
import type { Dep } from '@/app/plan/board/dependencias';
// «Se repite para siempre» (mig 0163): el predicado sale del módulo de datos, no se
// reescribe acá. Sin `server-only`, así que se puede importar desde cualquier lado.
import { esRecurrente } from '@/lib/plan-recurrentes';

export type ItemChecklist = { id: string; text: string; done: boolean };
export type EntradaHistorial = { ts: number; actor: string; text: string };

export type TareaPlan = {
  id: string;
  /** #N visible: solo en el tablero del super-admin. */
  num: number | null;
  titulo: string;
  detalle: string;
  score: number;
  prioridad: string;
  avance: number;
  deadline: string | null;
  proyectoId: string | null;
  /** TODOS los labels (proyectos) de la tarea: resolverDeps los recorre todos. */
  labels: string[];
  checklist: ItemChecklist[];
  notas: string;
  scoreRazon: string | null;
  deadlineRazon: string | null;
  quarter: string | null;
  historial: EntradaHistorial[];
  fuente: { tipo: string; etiqueta?: string; url?: string } | null;
  enPrioridad: boolean;
  /**
   * true = se repite para siempre (mig 0163). No compite en el ranking, no lleva deadline
   * y no cuenta para el avance de su proyecto.
   *
   * ⚠️ VIAJA MARCADA, NO ESCONDIDA. Un agente que no las ve propone CREARLAS de nuevo —
   * «habría que armar un seguimiento diario a los leads»— sobre algo que ya está pasando
   * todos los días. Lo que no puede es ocupar los lugares de una lista ordenada por score.
   */
  recurrente: boolean;
};

export type ProyectoPlan = {
  id: string;
  /** P# visible: solo en el tablero del super-admin. */
  pid: string | null;
  nombre: string;
  emoji: string;
  detalle: string;
  score: number;
  scoreRazon: string | null;
  deadline: string | null;
  /** true/false solo en el tablero del super-admin; null = ese dato no existe en el
   *  tablero de un cliente (null ≠ «no lo fijó»). */
  scoreManual: boolean | null;
  historial: EntradaHistorial[];
};

export type Tablero = {
  /** `plan` = tablero del super-admin; `todo` = tablero de un cliente. */
  board: 'plan' | 'todo';
  tareas: TareaPlan[];
  proyectos: ProyectoPlan[];
  deps: Dep[];
  /** true si alguna lectura llegó justo a 1000 filas: puede faltar el resto. */
  recortado: boolean;
};

const TOPE_FILAS = 1000;

/** ¿Este workspace usa el tablero del super-admin (plan_tareas)? Por CAPA. */
export async function usaPlanBoard(ws: number): Promise<boolean> {
  return (await getWorkspace(ws))?.capa === 'superadmin';
}

export const linkTarea = (id: string): string => `${APP_BASE_URL}/plan?tarea=${encodeURIComponent(id)}`;
export const linkProyecto = (id: string): string => `${APP_BASE_URL}/plan?proyecto=${encodeURIComponent(id)}`;
export const linkBorrador = (id: string): string => `${APP_BASE_URL}/plan/revisar/${encodeURIComponent(id)}`;

const hist = (h: ReadonlyArray<{ ts: number; actor: string; text: string }> | undefined): EntradaHistorial[] =>
  (h ?? []).map((e) => ({ ts: Number(e.ts) || 0, actor: String(e.actor), text: String(e.text) }));

/** El tablero del workspace en curso (el runner ya corre adentro de su workspace). */
export async function leerTablero(ws: number): Promise<Tablero> {
  if (await usaPlanBoard(ws)) {
    const b = await listPlanBoard();
    return {
      board: 'plan',
      tareas: b.tareas.map((t) => ({
        id: t.id, num: t.num, titulo: t.title, detalle: t.detalle ?? '', score: t.score, prioridad: t.priority,
        avance: t.progress ?? 0, deadline: t.deadline || null, proyectoId: t.labels[0] ?? null, labels: [...t.labels],
        checklist: (t.checklist ?? []).map((c) => ({ id: c.id, text: c.text, done: !!c.done })),
        notas: t.notas ?? '', scoreRazon: t.scoreRazon ?? null, deadlineRazon: t.deadlineRazon ?? null,
        quarter: t.quarter ?? null, historial: hist(t.historial), fuente: t.fuente ?? null, enPrioridad: !!t.enPrioridad,
        recurrente: esRecurrente(t),
      })),
      proyectos: b.proyectos.map((p) => ({
        id: p.id, pid: p.pid ?? null, nombre: p.name, emoji: p.emoji, detalle: p.detalle ?? '', score: p.score,
        scoreRazon: p.scoreRazon ?? null, deadline: p.deadline || null, scoreManual: !!p.scoreManual, historial: hist(p.historial),
      })),
      deps: b.deps,
      recortado: b.tareas.length >= TOPE_FILAS || b.proyectos.length >= TOPE_FILAS,
    };
  }
  const [tareas, cats] = await Promise.all([listTareas(), listCategorias()]);
  return {
    board: 'todo',
    tareas: tareas.map((t) => ({
      id: String(t.id), num: null, titulo: t.titulo, detalle: t.detalle ?? '', score: t.score, prioridad: t.prioridad,
      avance: t.progreso ?? 0, deadline: t.deadline ?? null, proyectoId: t.categorias[0] != null ? String(t.categorias[0]) : null,
      labels: t.categorias.map(String),
      checklist: (t.checklist ?? []).map((c) => ({ id: c.id, text: c.text, done: !!c.done })),
      notas: '', scoreRazon: t.score_razon ?? null, deadlineRazon: null, quarter: t.quarter ?? null,
      historial: hist(t.historial), fuente: t.fuente ?? null, enPrioridad: !!t.en_prioridad,
      // ⚠️ EL CAST ES UN PUENTE Y SE SACA. `lib/todo.ts` (el tablero del CLIENTE) todavía no
      // declara `recurrente` en su `Tarea`, así que sin esto no compila; la columna SÍ está
      // en `experimento_tareas` desde la 0163. En cuanto el tipo lo tenga, queda
      // `esRecurrente(t)` a secas — y hasta entonces la respuesta acá es `false`, que es la
      // segura: una recurrente del cliente sigue compitiendo, no desaparece.
      recurrente: esRecurrente(t as unknown as { recurrente?: boolean }),
    })),
    proyectos: cats.map((c) => ({
      id: String(c.id), pid: null, nombre: c.nombre, emoji: c.emoji, detalle: c.detalle ?? '', score: c.prioridad,
      scoreRazon: c.score_razon ?? null, deadline: c.deadline ?? null, scoreManual: null, historial: hist(c.historial),
    })),
    deps: [],
    recortado: tareas.length >= TOPE_FILAS || cats.length >= TOPE_FILAS,
  };
}

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Una tarea por id, por #num («#412» o «412» en el tablero del super-admin). */
export function buscarTarea(tab: Tablero, id: string | null, num: number | null): TareaPlan | null {
  const limpio = (id ?? '').trim();
  if (limpio) {
    const directa = tab.tareas.find((t) => t.id === limpio);
    if (directa) return directa;
    const m = /^#?(\d+)$/.exec(limpio);
    if (m && tab.board === 'plan') return tab.tareas.find((t) => t.num === Number(m[1])) ?? null;
    return null;
  }
  if (num != null && tab.board === 'plan') return tab.tareas.find((t) => t.num === num) ?? null;
  return null;
}

/** Un proyecto por id, por P# o por nombre exacto (sin acentos ni mayúsculas). */
export function buscarProyecto(tab: Tablero, ref: string): ProyectoPlan | null {
  const r = ref.trim();
  if (!r) return null;
  return tab.proyectos.find((p) => p.id === r)
    ?? tab.proyectos.find((p) => p.pid != null && p.pid.toLowerCase() === r.toLowerCase())
    ?? tab.proyectos.find((p) => norm(p.nombre) === norm(r))
    ?? null;
}

/** La forma corta de una tarea para las listas: lo que se necesita para decidir. */
export function tareaCompacta(t: TareaPlan, nombreProyecto: Map<string, string>) {
  return {
    id: t.id, ...(t.num != null ? { num: t.num } : {}), titulo: t.titulo, score: t.score, prioridad: t.prioridad,
    avance_pct: t.avance, deadline: t.deadline, proyecto: t.proyectoId ? nombreProyecto.get(t.proyectoId) ?? null : null,
    // ⚠️ LA MARCA VIAJA, Y CON SU EXPLICACIÓN. Lo único que un modelo sabe de esta tarea es
    // este JSON: sin la nota, ve `score: 85` al lado de `se_repite: true` y no tiene forma
    // de saber que ese número no significa nada acá. Y el campo sólo aparece cuando es
    // true: una clave `se_repite: false` en las 300 tareas normales es ruido en el prompt.
    ...(esRecurrente(t) ? { se_repite: true, se_repite_nota: 'Se repite para siempre (la reunión semanal, el seguimiento diario). No compite en el ranking ni lleva deadline: su score y su prioridad no se leen. Ya existe, no hay que volver a crearla.' } : {}),
    link: linkTarea(t.id),
  };
}

export const nombresDeProyectos = (tab: Tablero): Map<string, string> => new Map(tab.proyectos.map((p) => [p.id, p.nombre]));

/** Por HTTP (un token en la máquina de un tercero) no salen nombres de personas ni
 *  links a grabaciones: devuelve `undefined` (la clave desaparece del JSON). Una sola
 *  regla para todas las lecturas del área. */
export const soloFueraDeHttp = <T>(canal: string, valor: T): T | undefined => (canal === 'http' ? undefined : valor);

/** La fuente de una tarea sin el link (Fathom con ?timestamp) cuando sale por HTTP. */
export const fuenteParaCanal = (canal: string, f: TareaPlan['fuente']): TareaPlan['fuente'] =>
  f && canal === 'http' ? { tipo: f.tipo, ...(f.etiqueta ? { etiqueta: f.etiqueta } : {}) } : f;

/** Los términos del glosario de ESTE workspace (id incluido, para cambiar uno en vez
 *  de duplicarlo). Deuda: lib/glosario.ts solo expone el texto armado, que además lee
 *  con getSupabaseServer y suma el ws 1, así que no sirve para decidir «ya existe acá». */
export async function terminosDelGlosario(): Promise<Array<{ id: number; titulo: string; cuerpo: string }>> {
  const { data, error } = await (await getTenantDb())
    .from('mako_knowledge').select('id, titulo, cuerpo').eq('area', AREA_GLOSARIO).limit(1000);
  if (error) throw new Error(`glosario: ${error.message}`);
  return (data ?? []) as Array<{ id: number; titulo: string; cuerpo: string }>;
}
