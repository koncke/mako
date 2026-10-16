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
import { wsEnContexto, getWorkspace, getTenantDb } from '@/lib/workspace';
import { AREA_GLOSARIO } from '@/lib/glosario';
import { listPlanBoard } from '@/lib/plan-board';
import { listTareas, listCategorias } from '@/lib/todo';
import { linkApp, APP_BASE_URL } from '@/lib/app-url';
import type { Dep } from '@/app/plan/board/dependencias';
// «Se repite para siempre» (mig 0163): el predicado sale del módulo de datos, no se
// reescribe acá. Sin `server-only`, así que se puede importar desde cualquier lado.
import { diasQuieta } from '@/app/plan/board/envejecer';
import { esRecurrente, textoRepeticion } from '@/lib/plan-recurrentes';
import { estadoDeAvance, type EstadoTarea } from '@/lib/todo-estados';

import { tableroDeCapa } from '../../tablero-de-capa';

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
  /**
   * LA COLUMNA DEL KANBAN (16/10/2026): por_hacer (Por iniciar) · en_curso (En proceso) ·
   * en_seguimiento (Atorada) · hecho (Completada) · no_cumple (No cumplen tu criterio). Existe
   * en las DOS mitades desde la mig 0294. Las etiquetas, en lib/todo-estados.ts.
   */
  estado: EstadoTarea;
  /** Por qué está Atorada, en una línea; null fuera de ahí o si nadie lo dijo. */
  motivoAtorada: string | null;
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
   * CUÁNDO NACIÓ (epoch ms), o null si la fila no lo trae.
   *
   * Es el insumo de «cuántos días lleva parada», que es el único eje del tiempo que un
   * agente NO puede deducir del JSON: el deadline lo ve, la quietud no. Y sin ella,
   * MaKo propone «habría que arrancar con X» sobre una tarjeta que lleva cuarenta días
   * abierta sin que nadie la toque — que es un consejo distinto.
   */
  creadaEn: number | null;
  /**
   * true = se repite para siempre (mig 0163). No compite en el ranking, no lleva deadline
   * y no cuenta para el avance de su proyecto.
   *
   * ⚠️ VIAJA MARCADA, NO ESCONDIDA. Un agente que no las ve propone CREARLAS de nuevo —
   * «habría que armar un seguimiento diario a los leads»— sobre algo que ya está pasando
   * todos los días. Lo que no puede es ocupar los lugares de una lista ordenada por score.
   */
  recurrente: boolean;
  /**
   * CUÁNDO se repite, YA EN TEXTO (mig 0167): «Cada semana, los lunes y miércoles», «Cada
   * 2 meses, el segundo martes», «Todos los días». `null` = se repite y nadie dijo cuándo.
   *
   * ⚠️ VIAJA LA FRASE Y NO LA RRULE, y es la decisión. Lo único que un agente sabe de esta
   * tarea es este JSON, y lo que va a hacer con el dato es DECÍRSELO A UNA PERSONA: con un
   * `FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2` tiene que traducir, y traducir es donde inventa
   * («cada martes del mes 2»). La frase la arma el código, con `textoRepeticion`, que es la
   * MISMA que lee la persona en la tarjeta — así el agente y la pantalla no se contradicen.
   */
  repeticion: string | null;
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
  /**
   * «Se repite para siempre» (mig 0164): Customer Success, las reuniones de marketing.
   * No entra al ranking, así que no puede ser el «objetivo principal» y su `score` no es
   * un puesto. Existe en los DOS tableros — el del dueño (`plan_proyectos`) y el del
   * cliente (`tarea_categorias`)—, por eso es `boolean` y no `boolean | null`.
   */
  recurrente: boolean;
  /** Cuándo se repite, ya en texto (mig 0167). Gemelo de `TareaPlan.repeticion`. */
  repeticion: string | null;
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
  return tableroDeCapa((await getWorkspace(ws))?.capa) === 'dueno';
}

export const linkTarea = (id: string): string => linkApp(`/plan?tarea=${encodeURIComponent(id)}`, wsEnContexto());
export const linkProyecto = (id: string): string => linkApp(`/plan?proyecto=${encodeURIComponent(id)}`, wsEnContexto());
export const linkBorrador = (id: string): string => linkApp(`/plan/revisar/${encodeURIComponent(id)}`, wsEnContexto());

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
        estado: t.estado ?? estadoDeAvance(t.progress ?? 0), motivoAtorada: t.motivoAtorada ?? null,
        avance: t.progress ?? 0, deadline: t.deadline || null, proyectoId: t.labels[0] ?? null, labels: [...t.labels],
        checklist: (t.checklist ?? []).map((c) => ({ id: c.id, text: c.text, done: !!c.done })),
        notas: t.notas ?? '', scoreRazon: t.scoreRazon ?? null, deadlineRazon: t.deadlineRazon ?? null,
        quarter: t.quarter ?? null, historial: hist(t.historial), fuente: t.fuente ?? null, enPrioridad: !!t.enPrioridad,
        creadaEn: t.creadaEn ?? null,
        recurrente: esRecurrente(t),
        repeticion: textoRepeticion(t.recurrencia),
      })),
      proyectos: b.proyectos.map((p) => ({
        id: p.id, pid: p.pid ?? null, nombre: p.name, emoji: p.emoji, detalle: p.detalle ?? '', score: p.score,
        scoreRazon: p.scoreRazon ?? null, deadline: p.deadline || null, scoreManual: !!p.scoreManual, historial: hist(p.historial),
        recurrente: esRecurrente(p),
        repeticion: textoRepeticion(p.recurrencia),
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
      estado: t.estado, motivoAtorada: t.motivo_atorada,
      avance: t.progreso ?? 0, deadline: t.deadline ?? null, proyectoId: t.categorias[0] != null ? String(t.categorias[0]) : null,
      labels: t.categorias.map(String),
      checklist: (t.checklist ?? []).map((c) => ({ id: c.id, text: c.text, done: !!c.done })),
      // ⚠️ `notas` y `deadlineRazon` estaban CLAVADOS en '' y null acá. Era cierto
      // mientras el tablero del cliente no los guardaba (#157, arreglado el 30/09/2026):
      // ahora los guarda, y dejarlos clavados sería el consumidor huérfano al revés —
      // un campo que se escribe y que MaKo no ve.
      notas: t.notas ?? '', scoreRazon: t.score_razon ?? null, deadlineRazon: t.deadline_razon ?? null, quarter: t.quarter ?? null,
      historial: hist(t.historial), fuente: t.fuente ?? null, enPrioridad: !!t.en_prioridad,
      creadaEn: Date.parse(String(t.created_at ?? '')) || null,
      // El cast que había acá era un puente hasta que `lib/todo.ts` declarara el campo, y
      // ya lo declara: `Tarea.recurrente` desde la 0163, `Categoria.recurrente` desde la
      // 0164. Un cast que sobrevive a su motivo esconde el próximo campo que falte.
      recurrente: esRecurrente(t),
      repeticion: textoRepeticion(t.recurrencia),
    })),
    proyectos: cats.map((c) => ({
      id: String(c.id), pid: null, nombre: c.nombre, emoji: c.emoji, detalle: c.detalle ?? '', score: c.prioridad,
      scoreRazon: c.score_razon ?? null, deadline: c.deadline ?? null, scoreManual: null, historial: hist(c.historial),
      recurrente: esRecurrente(c),
      repeticion: textoRepeticion(c.recurrencia),
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
/**
 * Cuántos días lleva sin que nadie la toque. Sale de `diasQuieta`, la MISMA función
 * pura que usa el reparto del servidor para castigarla en el ranking: un número que le
 * decimos a un agente y otro que mueve el score son dos números que van a divergir.
 */
export const diasParada = (t: TareaPlan, ahora = Date.now()): number =>
  diasQuieta(t.historial as Parameters<typeof diasQuieta>[0], t.creadaEn ?? undefined, ahora);

/** Desde cuándo vale la pena decirlo. Es el mismo umbral en el que `castigoQuietud`
 *  empieza a bajarle el score: antes de eso no pasó nada y el dato es ruido en el
 *  prompt, igual que `se_repite: false` en las 300 tareas normales. */
export const DIAS_PARADA_NOTORIA = 30;

export function tareaCompacta(t: TareaPlan, nombreProyecto: Map<string, string>) {
  const parada = diasParada(t);
  return {
    id: t.id, ...(t.num != null ? { num: t.num } : {}), titulo: t.titulo, score: t.score,
    // «Sin priorizar» (score 0, 16/10/2026) viaja con su nombre: con la banda del número diría
    // «futuro», que es un juicio que nadie hizo — y el agente lo repetiría como tal.
    prioridad: t.score > 0 ? t.prioridad : 'sin_priorizar',
    // La columna, sólo cuando NO es la de siempre: «Por iniciar» es lo normal de una abierta, y
    // una clave más en 300 tareas es ruido en el prompt (la misma regla que `se_repite`).
    ...(t.estado !== 'por_hacer' ? { estado: t.estado } : {}),
    ...(t.estado === 'en_seguimiento' && t.motivoAtorada ? { atorada_por: t.motivoAtorada } : {}),
    avance_pct: t.avance, deadline: t.deadline, proyecto: t.proyectoId ? nombreProyecto.get(t.proyectoId) ?? null : null,
    // ⚠️ LA MARCA VIAJA, Y CON SU EXPLICACIÓN. Lo único que un modelo sabe de esta tarea es
    // este JSON: sin la nota, ve `score: 85` al lado de `se_repite: true` y no tiene forma
    // de saber que ese número no significa nada acá. Y el campo sólo aparece cuando es
    // true: una clave `se_repite: false` en las 300 tareas normales es ruido en el prompt.
    // ⚠️ `repeticion` VIAJA PEGADA A `se_repite`, y por eso es una sola expresión. Un agente
    // que ve «se repite» y no ve cada cuánto no puede decidir NADA con eso: «la junta de los
    // miércoles» y «el seguimiento diario» se le ven idénticas cuando una pesa cinco veces
    // más que la otra. `null` es un valor y no una ausencia: dice «se repite y nadie declaró
    // el ritmo», que es algo que hay que preguntar, no adivinar.
    ...(esRecurrente(t) ? { se_repite: true, repeticion: t.repeticion, se_repite_nota: 'Se repite para siempre (la reunión semanal, el seguimiento diario). No compite en el ranking ni lleva deadline: su score y su prioridad no se leen. Ya existe, no hay que volver a crearla. `repeticion` es la frase completa de cuándo se repite («Cada semana, los lunes y miércoles»), la misma que se lee en la tarjeta; null = todavía no se dijo.' } : {}),
    // ⚠️ EL ÚNICO EJE DEL TIEMPO QUE EL AGENTE NO PUEDE DEDUCIR. El deadline viaja y se
    // lee solo; la quietud no está en ningún otro campo. Sin esto, MaKo propone «habría
    // que arrancar con X» sobre una tarjeta que lleva 40 días abierta sin que nadie la
    // toque, que es un consejo distinto — y tampoco puede contestar «¿qué está trabado?».
    // Sale recién a los 30 días, que es cuando el ranking empieza a castigarla: antes no
    // pasó nada y una clave más en 300 tareas es ruido en el prompt.
    ...(parada >= DIAS_PARADA_NOTORIA && !esRecurrente(t)
      ? { dias_sin_moverse: parada, dias_sin_moverse_nota: 'Días desde el último cambio de una PERSONA (lo que hace MaKo no cuenta). Desde los 30 el ranking le baja el score de a un punto por día, con tope 20. No es lo mismo que el deadline: una tarea sin fecha puede llevar meses parada y no aparecer en ninguna lista de vencidas.' }
      : {}),
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
