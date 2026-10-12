// =============================================================================
// hoy — el tablero contado para el TELÉFONO: prioridades, hoy, esta semana y alertas
// =============================================================================
// MaKo Mobile (docs/diseno-mako-mobile.md, fila «Plan»): «Hoy / Esta semana / Prioridades
// (la MISMA función que el tablero de escritorio, extraída) + marcar hecha con Deshacer».
// Esto es la cuenta; la lectura vive en `lib/plan-hoy.ts` y la escritura en
// `lib/plan-marcar.ts`.
//
// PURO: sin `server-only` ni `'use client'`. Lo importan el server (`lib/plan-hoy.ts`,
// `lib/plan-marcar.ts`), las pantallas de /m (los TIPOS) y los tests.
//
// ⚠️ NO HAY UNA DEFINICIÓN NUEVA DE NADA. Cada pregunta sale de la función que ya la
// contestaba en otro lado, y por eso esto es corto:
//   · prioridades  → `prioridadesDelTablero` (la vista Prioridades del escritorio)
//   · hoy / semana → `cuandoDe` (el filtro «Cuándo» del tablero: lo vencido cuenta como
//                    hoy, la semana es hoy + 6)
//   · qué compite  → `sinRecurrentes` + avance < 100 (las plantillas que se repiten no
//                    compiten; sus INSTANCIAS entran solas por su deadline)
//   · la banda     → `prioFromScore(score)`, la columna del Kanban (`displayPrio`)
//   · proyectos que deben fecha → `clasificarVencimientos` (el aviso de WhatsApp)
//   · paradas      → `diasQuieta` (el mismo reloj que castiga el score en el reparto)
//   · altas sin fecha → `altaIncompleta` (el ⚠ de la tarjeta)
//
// ⚠️ LOS ÍTEMS VIAJAN COMPACTOS. El tablero entero lleva detalles de hasta 6.000
// caracteres y el historial de cada tarjeta: al teléfono va lo que dibuja una fila.
// =============================================================================

import { type BoardTask, type Check, type Hist, type Label, type Prio, HIST_CAP, altaIncompleta, prioFromScore } from './types';
import { estaBloqueada, type Dep } from './dependencias';
import { cuandoDe, type Cuando } from './cuando';
import { diasQuieta } from './envejecer';
import { prioridadesDelTablero } from './prioridades';
import { esRecurrente, sinRecurrentes, soloRecurrentes } from '@/lib/plan-recurrentes';
import { clasificarVencimientos, type ProyectoConFecha, type ResumenVencimientos } from '@/lib/plan-vencimientos';

/** Una fila del teléfono. Nada de detalle ni de historial. */
export type ItemPlan = {
  id: string;
  /** El #N visible. SÓLO en el tablero del dueño: en el del cliente el «número» es el id
   *  de la base, y un id en pantalla es jerga. */
  num?: number;
  titulo: string;
  /**
   * El primer proyecto de la tarea que existe en el tablero, o null (sin proyecto). `color` es el
   * del proyecto en el tablero (el punto de la fila en el teléfono: app/m/plan/formato.ts →
   * colorProyecto, que sólo acepta un hex).
   */
  proyecto: { nombre: string; emoji: string; color: string } | null;
  /** `YYYY-MM-DD` o null. */
  deadline: string | null;
  cuando: Cuando;
  /** La columna del Kanban (`displayPrio`): lo que la persona ya ve en el escritorio. */
  banda: Prio;
  /** true = es la instancia de una tarea que se repite (la crea el cron con su fecha). */
  esInstancia: boolean;
  vencida: boolean;
  /** El path de escritorio, SIN `?ws=`: lo pone quien navega (`linkApp`/`conWs`). */
  linkEscritorio: string;
};

/** Un proyecto que debe fecha: la fila de `clasificarVencimientos`, tal cual. */
export type FilaVencimiento = ResumenVencimientos['atrasados'][number];

export type AlertasPlan = {
  /** Abiertas con deadline anterior a hoy (ya están en `hoy`, marcadas `vencida`). */
  vencidas: number;
  /** Proyectos con la fecha pasada y algo vivo adentro, del más atrasado al menos. */
  proyectosAtrasados: FilaVencimiento[];
  /** Proyectos que vencen en los próximos `VENTANA_DIAS` (5). */
  proyectosPorVencer: FilaVencimiento[];
  /** Abiertas que nadie tocó en `DIAS_PARADA` días o más (lo que hace MaKo no cuenta). */
  paradas: number;
  /** Alta, abierta y sin deadline: el ⚠ de la tarjeta. */
  altasSinFecha: number;
  /** Frenadas por una dependencia abierta. Sólo existe en el tablero del dueño. */
  bloqueadas: number;
};

export type HoyDelTablero = {
  /** El norte del tablero (el Objetivo Principal de la vista Prioridades). */
  objetivo: { id: string; nombre: string; emoji: string } | null;
  /** Las 5 de «¿qué hago ahora?», en el orden del escritorio. */
  prioridades: ItemPlan[];
  /**
   * Vencidas + vencen hoy (y un Quarter pasado sin deadline: `cuandoDe` lo manda acá),
   * SIN las que ya están en `prioridades`: Today pinta las dos listas juntas y una tarea
   * no puede salir dos veces en la misma pantalla.
   */
  hoy: ItemPlan[];
  /** Vencen entre mañana y hoy + 6. Todas, estén o no en `prioridades`. */
  semana: ItemPlan[];
  /** Cuántas compiten (abiertas y con fin). 0 con tareas cargadas = todo hecho. */
  abiertas: number;
  alertas: AlertasPlan;
};

/**
 * Desde cuántos días sin tocar una tarea cuenta como parada. Es el `DIAS_PARADA_NOTORIA` de
 * la API (lib/api-mako/areas/plan.helpers.ts, que es server-only y no se puede importar
 * acá) y el día en que `castigoQuietud` empieza a bajarle el score: antes de eso no pasó
 * nada que valga una alerta.
 */
export const DIAS_PARADA = 30;

/**
 * Los proyectos con fecha, con lo que arrastran: la entrada de `clasificarVencimientos`.
 *
 * Es la misma cuenta que `vencimientosDelPlan` (lib/plan-avisos.ts) hace adentro para el
 * WhatsApp: sin los proyectos que se repiten (no vencen), y con las recurrentes de cada
 * uno contadas APARTE de las abiertas — sumadas mentirían «3 tareas abiertas» sobre la
 * reunión semanal; ignoradas, un proyecto de puras recurrentes dejaría de avisar.
 */
export function proyectosConFecha(proyectos: Label[], tareas: BoardTask[]): ProyectoConFecha[] {
  return sinRecurrentes(proyectos).map((p) => {
    const suyas = tareas.filter((t) => t.labels.includes(p.id) && t.progress < 100);
    return { nombre: p.name, deadline: p.deadline ?? '', abiertas: sinRecurrentes(suyas).length, recurrentes: soloRecurrentes(suyas).length };
  });
}

export type EntradaHoy = {
  /** TODAS las tareas del tablero (las mismas que recibe `BoardShell`). */
  tareas: BoardTask[];
  proyectos: Label[];
  deps: Dep[];
  /** `YYYY-MM-DD` en la zona del NEGOCIO (`hoyEnWorkspace`), nunca la del dispositivo. */
  hoy: string;
  /** Epoch ms para contar los días sin tocar. Default: `Date.now()`. */
  ahora?: number;
  /** Cuál tablero: decide si el #N viaja. Default `cliente` (no lo manda). */
  tablero?: 'dueno' | 'cliente';
};

export function hoyDelTablero(e: EntradaHoy): HoyDelTablero {
  const { tareas, proyectos, deps, hoy } = e;
  const ahora = e.ahora ?? Date.now();
  const conNum = e.tablero === 'dueno';
  const prio = prioridadesDelTablero({ tareas, proyectos, deps });
  const est = prio.estDeps;

  const porId = new Map<string, Label>();
  for (const l of proyectos) if (!porId.has(l.id)) porId.set(l.id, l);
  const item = (t: BoardTask): ItemPlan => {
    const dl = (t.deadline ?? '').trim() || null;
    const p = t.labels.map((id) => porId.get(id)).find((x): x is Label => !!x) ?? null;
    return {
      id: t.id,
      ...(conNum && Number.isFinite(t.num) && t.num > 0 ? { num: t.num } : {}),
      titulo: t.title,
      proyecto: p ? { nombre: p.name, emoji: p.emoji, color: p.color } : null,
      deadline: dl,
      cuando: cuandoDe(t, hoy),
      banda: prioFromScore(t.score),
      esInstancia: t.fuente?.tipo === 'recurrente',
      vencida: !!dl && dl < hoy,
      linkEscritorio: `/plan?tarea=${encodeURIComponent(t.id)}`,
    };
  };
  // Lo vencido primero (lo más viejo arriba), lo de hoy después; empatada la fecha, la de
  // mayor score. Sin fecha (un Quarter pasado) va al final de su lista.
  const porFecha = (a: BoardTask, b: BoardTask) => {
    const da = (a.deadline ?? '').trim(), db = (b.deadline ?? '').trim();
    if (!da !== !db) return da ? -1 : 1;
    return da.localeCompare(db) || b.score - a.score;
  };

  const compite = sinRecurrentes(tareas).filter((t) => t.progress < 100);
  const enPrio = new Set(prio.prioridades.map((t) => t.id));
  const hoyLista = compite.filter((t) => cuandoDe(t, hoy) === 'hoy' && !enPrio.has(t.id)).sort(porFecha);
  const semana = compite.filter((t) => cuandoDe(t, hoy) === 'semana').sort(porFecha);
  const venc = clasificarVencimientos(proyectosConFecha(proyectos, tareas), hoy);
  const obj = prio.objetivoPrincipal;

  return {
    objetivo: obj ? { id: obj.id, nombre: obj.name, emoji: obj.emoji } : null,
    prioridades: prio.prioridades.map(item),
    hoy: hoyLista.map(item),
    semana: semana.map(item),
    abiertas: compite.length,
    alertas: {
      vencidas: compite.filter((t) => { const dl = (t.deadline ?? '').trim(); return !!dl && dl < hoy; }).length,
      proyectosAtrasados: venc.atrasados,
      proyectosPorVencer: venc.porVencer,
      paradas: compite.filter((t) => diasQuieta(t.historial, t.creadaEn, ahora) >= DIAS_PARADA).length,
      altasSinFecha: compite.filter(altaIncompleta).length,
      bloqueadas: compite.filter((t) => estaBloqueada(t.id, est)).length,
    },
  };
}

// ── Marcar hecha ─────────────────────────────────────────────────────────────────
// La CUENTA del gesto, pura para que tenga test. La escritura (releer la fila fresca y
// guardarla por el camino de cada tablero) está en `lib/plan-marcar.ts`.

/** Lo que el Deshacer del teléfono manda de vuelta: lo que devolvió el marcado. */
export type DeshacerMarca = { prev: number; entryId: string };

/**
 * Lo que contesta la server action. `prev` = el avance de ANTES (lo que el Deshacer
 * devuelve); `entryId` = la entrada de historial que escribió (la que el Deshacer saca).
 * `yaEstaba` = no había nada que cambiar y NO se escribió: no se ofrece Deshacer.
 */
export type ResultadoMarcar =
  | { ok: true; prev: number; entryId: string; yaEstaba?: true }
  | { ok: false; error: string };

/** Lo mínimo de una tarea para marcarla: el avance, la checklist, el historial. */
type Marcable = { progress: number; checklist: Check[]; historial: Hist[]; recurrente?: boolean };

export type CambioMarca =
  | { ok: true; progress: number; checklist: Check[]; historial: Hist[]; checklistCambio: boolean; prev: number; entryId: string; yaEstaba?: true }
  | { ok: false; error: string };

export const TEXTO_COMPLETADA = 'Marcó como completada';
export const TEXTO_REABIERTA = 'Reabrió la tarea';

const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * El estado nuevo de una tarea al marcarla hecha, reabrirla o deshacer eso.
 *
 * ⚠️ ES LA SEMÁNTICA DE `useBoard.toggleDone`, Y TIENE QUE SERLO: el historial que escribe
 * el teléfono lo lee y lo DESHACE el escritorio (`undoHist`). Por eso:
 *   · con checklist, se tildan (o destildan) TODOS sus ítems y la entrada guarda la
 *     checklist de antes (`undo: { field: 'checklist', prev }`), como `setChecklist`;
 *   · sin checklist, la entrada guarda el avance de antes (`undo: { field: 'progress' }`).
 * El texto, el actor (`user`: lo hizo una PERSONA) y el tope (`HIST_CAP`) son los del
 * tablero.
 *
 * Deshacer (`deshacer` presente) NO escribe una entrada nueva: saca la que se escribió
 * —«un cambio deshecho no es historia», el criterio de `undoHist`— y devuelve el avance y
 * la checklist de antes. El avance sale de la ENTRADA cuando la entrada lo guarda (es el
 * dato del server, no lo que manda el teléfono); con checklist, de `deshacer.prev`.
 *
 * ⚠️ UNA PLANTILLA QUE SE REPITE NO SE COMPLETA: no tiene avance ni fin. Lo que se cierra
 * es su INSTANCIA, que es una tarea normal (`fuente.tipo === 'recurrente'`).
 */
export function cambioAlMarcar(t: Marcable, hecha: boolean, opts: { deshacer?: DeshacerMarca; ahora: number; nuevoId: string }): CambioMarca {
  if (esRecurrente(t)) return { ok: false, error: 'Se repite: no se completa' };
  const historial = t.historial ?? [];
  const checklist = t.checklist ?? [];
  const { deshacer } = opts;

  if (deshacer) {
    const entrada = historial.find((h) => h.id === deshacer.entryId);
    if (!deshacer.entryId || !entrada) return { ok: false, error: 'Ya no se puede deshacer' };
    const undo = entrada.undo;
    const antesChecklist = undo?.field === 'checklist' && Array.isArray(undo.prev) ? (undo.prev as Check[]) : null;
    const prevDeLaEntrada = undo?.field === 'progress' && typeof undo.prev === 'number' && Number.isFinite(undo.prev) ? undo.prev : null;
    const prevPedido = Number.isFinite(deshacer.prev) ? deshacer.prev : null;
    const avance = prevDeLaEntrada ?? prevPedido;
    if (avance == null) return { ok: false, error: 'Ya no se puede deshacer' };
    return {
      ok: true,
      progress: pct(avance),
      checklist: antesChecklist ?? checklist,
      historial: historial.filter((h) => h.id !== deshacer.entryId),
      checklistCambio: !!antesChecklist,
      prev: t.progress,
      entryId: '',
    };
  }

  const hechaAhora = t.progress >= 100;
  if (hecha === hechaAhora) return { ok: true, progress: t.progress, checklist, historial, checklistCambio: false, prev: t.progress, entryId: '', yaEstaba: true };
  const texto = hecha ? TEXTO_COMPLETADA : TEXTO_REABIERTA;
  const conChecklist = checklist.length > 0;
  const entrada: Hist = {
    id: opts.nuevoId, ts: opts.ahora, actor: 'user', text: texto,
    undo: conChecklist ? { field: 'checklist', prev: checklist } : { field: 'progress', prev: t.progress },
  };
  return {
    ok: true,
    // Con checklist el avance DERIVA de ella (todo tildado = 100, nada = 0): es lo que
    // hace `setChecklist`, y así la tarjeta y su checklist no dicen cosas distintas.
    progress: hecha ? 100 : 0,
    checklist: conChecklist ? checklist.map((c) => ({ ...c, done: hecha })) : checklist,
    historial: [entrada, ...historial].slice(0, HIST_CAP),
    checklistCambio: conChecklist,
    prev: t.progress,
    entryId: entrada.id,
  };
}
