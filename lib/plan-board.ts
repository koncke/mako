// =============================================================================
// plan-board — el tablero /plan del dueño, ahora en Supabase (mig 0093)
// =============================================================================
// Reemplaza el localStorage + el parche bandeja/ops/snapshot. Implementa el CRUD
// que consume el Repo del board (app/plan/board/types.ts) contra plan_tareas /
// plan_proyectos. El board /plan es el ROADMAP DE LA AGENCIA → SIEMPRE OWNER_WS
// (el super-admin sin impersonar cae a ws -1; acá forzamos el workspace del dueño).
// getTenantDb auto-scopea por workspace_id (TENANT_TABLES), así que las queries no
// lo tocan a mano. Mapeo 1:1 con BoardTask/Label (jsonb para checklist/historial/fuente).

import 'server-only';
import { getTenantDb, runWithWorkspace, getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import type { BoardTask, Label, Prio, Actor, Check, Hist, Fuente, GuardPatch, GuardProjPatch, GuardResult } from '@/app/plan/board/types';
import { scoreFromPrio, prioFromScore, curveTaskScores, sanearHist } from '@/app/plan/board/types';
import { sanearDep, puedeDepender, resolverDeps, estaBloqueada, type Dep, type EntidadDep, type ClaseDep } from '@/app/plan/board/dependencias';
import { diasQuieta, diasAlDeadline, ajusteTemporal, empujeDeadline, castigoQuietud } from '@/app/plan/board/envejecer';
import { quarterDeFecha } from '@/app/plan/board/cuando';
// «Se repite para siempre» (mig 0163). El predicado y el filtro salen de un módulo de
// datos y NO se reescriben acá: es la misma regla que aplican las pantallas y el test.
import { esRecurrente, sinRecurrentes, soloRecurrentes, llevaDeadline, recurrenciaDe } from '@/lib/plan-recurrentes';
import { puntuarNuevas, describirProyectosNuevos, asignarTareasAProyectos, puntuarProyectos, type ProyParaPuntuar } from '@/lib/mako-guardian';
import { desempatar } from '@/app/plan/board/metodologia';
import { checklistsParaTareas } from '@/lib/checklist-coach';
import { CATALOGO_PROYECTOS, delCatalogo, canonNombre, nucleo } from '@/lib/plan-proyectos-catalogo';
import { faseNegocioTexto } from '@/lib/fase-store';
import { objetivosContextoTexto } from '@/lib/objectives';

export type Row = Record<string, unknown>;

// El board /plan es el ROADMAP DEL SUPER-ADMIN y vive en SU workspace. Antes se
// forzaba OWNER_WS porque el admin no tenía espacio propio y caía al del dueño; ahora
// que lo tiene, usamos el workspace del request (web: el suyo; doer: el del grupo).
// OWNER_WS queda solo de red para contextos sin workspace (cron/boot).
// Se EXPORTA porque la regla es fácil de escribir al revés y ya pasó: el Roadmap
// de /admin/dev arrancó con `runWithWorkspace(OWNER_WS)` copiado de memoria, y las
// 121 áreas se pintaron «Cerrado» con cero tareas — leía el workspace equivocado y
// no fallaba, devolvía vacío. Quien necesite leer el board del dueño usa esto.
export const enPlan = async <T,>(fn: () => Promise<T>): Promise<T> =>
  runWithWorkspace((await getWorkspaceActual()) ?? OWNER_WS, fn);

// id string estable para tareas/proyectos nuevos (el board usa ids de texto).
const genId = (p: string): string => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const int = (v: unknown, d = 0): number => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };
const optInt = (v: unknown): number | undefined => { if (v == null) return undefined; const n = Math.round(Number(v)); return Number.isFinite(n) ? n : undefined; };
const optFuente = (v: unknown): Fuente | undefined => (v && typeof v === 'object' && (v as Fuente).tipo ? (v as Fuente) : undefined);

/**
 * EL QUARTER VA DONDE PASAN TODAS LAS ESCRITURAS, no en el formulario.
 *
 * «Te había pedido antes que si ya tiene deadline con fecha, que se ponga automáticamente
 * el Quarter» (24/09/2026), y la primera vez se escribió SOLO en el handler del navegador
 * (`useBoard.setDeadline`). Con eso, todo deadline que pone el server —el Perro al
 * priorizar, una reunión al crear la tarea, un lote— seguía naciendo sin Quarter, que es
 * justamente el camino por el que entra la mayoría. Acá lo hereda cualquier escritura
 * futura sin que nadie se acuerde.
 *
 * ⚠️ SÓLO RELLENA LO VACÍO. Un Quarter elegido a mano no se pisa: son dos preguntas
 * distintas —cuándo VENCE y para cuándo se PLANIFICÓ— y hay casos legítimos en que no
 * coinciden. Cuando no coinciden, la pantalla AVISA; corregir sería decidir por la
 * persona.
 */
const quarterEfectivo = (deadline: string | undefined, quarter: string | undefined): string | null =>
  quarter || quarterDeFecha(deadline || '') || null;

// ── row ⇄ modelo ─────────────────────────────────────────────────────────────
/** ⚠️ EXPORTADOS (26/09/2026) para que Customer Success lea filas sueltas sin escribir
 *  su propio mapper. El tablero ya tiene SEIS lugares donde un campo se puede olvidar
 *  (ver AGENTS.md); un séptimo y un octavo en otra carpeta serían los que se queden
 *  viejos primero, y el modo de falla es que la ficha de un cliente muestre una tarjeta
 *  a la que le falta un campo, sin ningún error. */
export function rowToTask(r: Row): BoardTask {
  return {
    id: str(r.id), num: int(r.num), emoji: str(r.emoji, '📌'), title: str(r.title, 'Tarea'),
    detalle: str(r.detalle), priority: str(r.priority, 'media') as Prio,
    score: int(r.score), scoreBase: optInt(r.score_base) ?? int(r.score), scoreRazon: r.score_razon ? str(r.score_razon) : undefined,
    deadlineRazon: r.deadline_razon ? str(r.deadline_razon) : undefined, notas: str(r.notas),
    haceloEn: r.hacelo_en ? str(r.hacelo_en) : undefined,
    impacto: optInt(r.impacto), esfuerzo: optInt(r.esfuerzo),
    progress: int(r.progress), deadline: str(r.deadline), quarter: r.quarter ? str(r.quarter) : undefined,
    labels: asArr<unknown>(r.labels).map(String), checklist: asArr<Check>(r.checklist),
    historial: sanearHist(r.historial), origen: str(r.origen, 'user') as Actor,
    creadaEn: Date.parse(str(r.created_at)) || undefined,
    fuente: optFuente(r.fuente), enPrioridad: !!r.en_prioridad, scoreManual: !!r.score_manual,
    // ⚠️ VA EN LOS DOS MAPPERS, Y SI FALTA EN ÉSTE ES DESTRUCTIVO. El valor saldría de la
    // base como `undefined` en memoria y el próximo guardado del navegador es un
    // `upsert(taskToRow(t))` de la FILA ENTERA (`:254`, `:962`): `!!undefined → false`
    // BORRA la columna. Es el bug que `guardarPlanProyecto` documenta y cura sacando el
    // score del payload del cliente — acá no aplica esa cura porque `recurrente` lo decide
    // una PERSONA, no el server, así que tiene que poder viajar de ida y de vuelta.
    recurrente: !!r.recurrente,
    // ⚠️ SE LEE POR `recurrenciaDe` Y NO POR `recurrenciaOk` SUELTO (mig 0167). La
    // invariante «una recurrencia sin `recurrente` no existe» se aplica también en la
    // LECTURA: una fila que quedó con las dos cosas desalineadas —escrita antes de esta
    // migración, o por un script— entraría al navegador afirmando «cada semana» sobre una
    // tarea con deadline, y el próximo guardado la devolvería a la base tal cual. Saneando
    // también en la LECTURA, una RRULE rota en la columna entra como `null` en vez de dejar
    // la tarjeta sin dibujarse.
    // DE QUIÉN es (mig 0172). Va en los DOS mappers por la misma razón destructiva que
    // `recurrente` documenta arriba: el guardado es un `upsert` de la fila ENTERA, así que
    // un campo que no se lee vuelve como `undefined` y el próximo save lo manda como `null`,
    // borrando la asignación sin que nadie toque nada.
    clienteLeadId: optInt(r.cliente_lead_id) ?? null,
    clienteNombre: r.cliente_nombre ? str(r.cliente_nombre) : null,
    recurrencia: recurrenciaDe({ recurrente: !!r.recurrente, recurrencia: r.recurrencia }),
  };
}
function taskToRow(t: BoardTask): Row {
  return {
    id: t.id, num: t.num, emoji: t.emoji || '📌', title: t.title || 'Tarea', detalle: t.detalle || '',
    // `score_base` viaja SIEMPRE en el round-trip para que un guardado del navegador no
    // lo borre. Cae al `score` solo cuando la fila todavía no lo tiene (tarea nueva).
    priority: t.priority, score: int(t.score), score_base: int(t.scoreBase ?? t.score), score_razon: t.scoreRazon ?? null,
    deadline_razon: t.deadlineRazon ?? null, notas: t.notas ?? '', hacelo_en: t.haceloEn ?? null,
    impacto: t.impacto ?? null, esfuerzo: t.esfuerzo ?? null, progress: int(t.progress),
    // ⚠️ UNA RECURRENTE NO LLEVA FECHA, Y EL CORTE VA ACÁ (mig 0163). «Lo que se repite no
    // vence»: una fecha en una tarea sin fin es la del próximo ciclo, no un deadline — y
    // río abajo esa fecha se convierte en un empuje de +25 en el reparto, en un «vencida»
    // en el aviso de WhatsApp y en un trimestre derivado, tres afirmaciones falsas sobre lo
    // mismo. Se corta en el MAPPER y no en el formulario por la lección que pagó el Quarter
    // el 24/09/2026: la regla vivía en `useBoard.setDeadline`, o sea en el único camino que
    // pasa por el navegador, y todo deadline que pone el SERVER —el Perro, una reunión, un
    // lote— pasaba de largo. Por acá pasan TODAS las escrituras.
    deadline: llevaDeadline(t) ? (t.deadline || '') : '',
    quarter: llevaDeadline(t) ? quarterEfectivo(t.deadline, t.quarter) : null,
    labels: t.labels ?? [], checklist: t.checklist ?? [], historial: t.historial ?? [],
    origen: t.origen || 'user', fuente: t.fuente ?? null, en_prioridad: !!t.enPrioridad, score_manual: !!t.scoreManual,
    // DE QUIÉN es (mig 0172). El id es LA CLAVE y el nombre una etiqueta: se escriben
    // juntos para que el chip se pueda pintar sin ir a buscar `leads` en cada carga.
    // `?? null` y no `|| null`: acá `null` y `undefined` significan lo mismo —nadie— y el
    // que llega al `upsert` tiene que ser `null` para que Postgres borre la asignación.
    cliente_lead_id: t.clienteLeadId ?? null,
    cliente_nombre: t.clienteNombre ?? null,
    recurrente: esRecurrente(t),
    // ⚠️ LA RECURRENCIA REEMPLAZA A LA FECHA, Y SE CORTA EN EL MISMO CHOKE POINT (0167).
    // Las dos líneas de arriba borran deadline y quarter cuando algo se repite; ésta hace
    // lo simétrico: si NO se repite, no hay recurrencia que guardar. `recurrenciaDe` es la
    // invariante en una función —no un `esRecurrente(t) ? … : null` escrito acá— porque la
    // aplican los cuatro mappers de las dos mitades del tablero y tienen que decir lo
    // mismo. Y además CANONIZA la RRULE, así que la misma repetición se guarda con el mismo
    // string venga del desplegable, del diálogo personalizado, de un modelo o de un lote.
    recurrencia: recurrenciaDe(t),
    orden: t.num, updated_at: new Date().toISOString(),
  };
}
export function rowToLabel(r: Row): Label {
  return {
    id: str(r.id), pid: r.pid ? str(r.pid) : undefined, emoji: str(r.emoji, '📁'),
    name: str(r.name, 'Proyecto'), color: str(r.color, '#2F6FED'), score: int(r.score, 50),
    scoreRazon: r.score_razon ? str(r.score_razon) : undefined, impacto: optInt(r.impacto),
    esfuerzo: optInt(r.esfuerzo), deadline: r.deadline ? str(r.deadline) : undefined,
    quarter: r.quarter ? str(r.quarter) : undefined,
    detalle: str(r.detalle), notas: str(r.notas), historial: sanearHist(r.historial), fuente: optFuente(r.fuente),
    escalon: optInt(r.escalon), desbloquea: r.desbloquea ? str(r.desbloquea) : undefined,
    scoreManual: !!r.score_manual,
    // ⚠️ VA EN LOS DOS MAPPERS, Y SI FALTA EN ÉSTE ES DESTRUCTIVO — la misma trampa que
    // `rowToTask` documenta para las tareas (mig 0163). `crearPlanProyecto` y
    // `guardarPlanBulk` mandan `labelToRow(l)` de la FILA ENTERA: un `undefined` en memoria
    // sale como `false` y BORRA la columna. `guardarPlanProyecto` saca del payload lo que
    // decide el server (score, impacto…), y `recurrente` NO está ahí a propósito: lo decide
    // una PERSONA, así que tiene que poder viajar de ida y de vuelta.
    recurrente: !!r.recurrente,
    // DE QUIÉN es (mig 0172). Va en los DOS mappers por la misma razón destructiva que
    // `recurrente` documenta arriba: el guardado es un `upsert` de la fila ENTERA, así que
    // un campo que no se lee vuelve como `undefined` y el próximo save lo manda como `null`,
    // borrando la asignación sin que nadie toque nada.
    clienteLeadId: optInt(r.cliente_lead_id) ?? null,
    clienteNombre: r.cliente_nombre ? str(r.cliente_nombre) : null,
    // Misma invariante y mismo saneo en la lectura que en `rowToTask` (mig 0167).
    recurrencia: recurrenciaDe({ recurrente: !!r.recurrente, recurrencia: r.recurrencia }),
  };
}
function labelToRow(l: Label, orden = 0): Row {
  return {
    id: l.id, pid: l.pid ?? null, emoji: l.emoji || '📁', name: l.name || 'Proyecto', color: l.color || '#2F6FED',
    score: int(l.score, 50), score_razon: l.scoreRazon ?? null, impacto: l.impacto ?? null, esfuerzo: l.esfuerzo ?? null,
    // ⚠️ UN PROYECTO QUE SE REPITE NO LLEVA FECHA, Y EL CORTE VA ACÁ (mig 0164). Mismo
    // choke point y misma lección que `taskToRow`: la regla no puede vivir en el handler del
    // formulario porque por acá pasan también el Perro, la extracción de una reunión y un
    // lote, y ninguno de esos tres abre el navegador. Río abajo una fecha en algo sin fin se
    // convierte en un «atrasado» en el WhatsApp de vencimientos y en un trimestre derivado,
    // dos afirmaciones falsas sobre lo mismo.
    deadline: llevaDeadline(l) ? (l.deadline || '') : '',
    quarter: llevaDeadline(l) ? quarterEfectivo(l.deadline, l.quarter) : null,
    detalle: l.detalle || '', notas: l.notas ?? '', historial: l.historial ?? [], fuente: l.fuente ?? null,
    escalon: l.escalon ?? null, desbloquea: l.desbloquea ?? null, score_manual: !!l.scoreManual,
    // DE QUIÉN es (mig 0172). El id es LA CLAVE y el nombre una etiqueta: se escriben
    // juntos para que el chip se pueda pintar sin ir a buscar `leads` en cada carga.
    // `?? null` y no `|| null`: acá `null` y `undefined` significan lo mismo —nadie— y el
    // que llega al `upsert` tiene que ser `null` para que Postgres borre la asignación.
    cliente_lead_id: l.clienteLeadId ?? null,
    cliente_nombre: l.clienteNombre ?? null,
    recurrente: esRecurrente(l),
    // Lo mismo que en `taskToRow`, un nivel más arriba (mig 0167).
    recurrencia: recurrenciaDe(l),
    orden, updated_at: new Date().toISOString(),
  };
}

// ── carga ────────────────────────────────────────────────────────────────────
export async function listPlanBoard(): Promise<{ tareas: BoardTask[]; proyectos: Label[]; deps: Dep[] }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const [t, p, d] = await Promise.all([
      db.from('plan_tareas').select('*').order('orden', { ascending: true }).order('num', { ascending: true }),
      db.from('plan_proyectos').select('*').order('orden', { ascending: true }),
      db.from('plan_dependencias').select('entidad, de_id, a_id, clase, razon, origen, confianza'),
    ]);
    if (t.error) throw new Error(`listPlanBoard tareas: ${t.error.message}`);
    if (p.error) throw new Error(`listPlanBoard proyectos: ${p.error.message}`);
    // Las aristas NO son un error fatal: si la tabla todavía no existe en un entorno, el
    // tablero tiene que dibujarse igual. Lo que no puede es dibujarse con la mitad de las
    // dependencias y no decirlo — por eso el error va al log, no a un catch mudo.
    if (d.error) console.error(`[plan-board] dependencias: ${d.error.message}`);
    return {
      tareas: (t.data ?? []).map(rowToTask),
      proyectos: (p.data ?? []).map(rowToLabel),
      deps: (d.data ?? []).map(sanearDep).filter((x): x is Dep => x != null),
    };
  });
}

// ── Dependencias ─────────────────────────────────────────────────────────────
// Viven en su propia tabla (mig 0140) y NO adentro de la fila de la tarea, por una razón
// que ya costó caro en otro lado: `guardarPlanTarea` upsertea la FILA ENTERA desde el
// estado del navegador en cada autosave. Un campo nuevo en la fila que una pestaña con
// estado viejo no conozca se pisa solo, sin error y sin build roto.

/** Todas las aristas del workspace, saneadas. */
export async function listDependencias(): Promise<Dep[]> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('plan_dependencias').select('entidad, de_id, a_id, clase, razon, origen, confianza');
    if (error) throw new Error(`listDependencias: ${error.message}`);
    return (data ?? []).map(sanearDep).filter((x): x is Dep => x != null);
  });
}

/**
 * Agrega «`deId` no puede empezar hasta que `aId` termine».
 *
 * ⚠️ EL GUARD DE CICLO CORRE ACÁ Y NO SOLO EN LA PANTALLA. El modal no es la única puerta:
 * están /api/agente/plan, WhatsApp y los scripts. Un chequeo que vive únicamente en el
 * componente es un chequeo que el próximo canal no tiene.
 */
export async function agregarDependencia(d: {
  entidad: EntidadDep; deId: string; aId: string; clase?: ClaseDep; razon?: string; origen?: Actor; confianza?: 'alta' | 'media';
}): Promise<{ ok: true } | { ok: false; error: string; camino?: string[] }> {
  return enPlan(async () => {
    const limpia = sanearDep(d);
    if (!limpia) return { ok: false as const, error: 'Falta alguna de las dos puntas, o son la misma.' };
    const previas = await listDependencias();
    const ver = puedeDepender(previas, limpia.entidad, limpia.deId, limpia.aId);
    if (!ver.ok) return { ok: false as const, error: 'Sería un círculo: eso ya espera a esto.', camino: ver.camino };
    const db = await getTenantDb();
    const { error } = await db.from('plan_dependencias').upsert({
      entidad: limpia.entidad, de_id: limpia.deId, a_id: limpia.aId, clase: limpia.clase,
      razon: limpia.razon, origen: limpia.origen, confianza: limpia.confianza ?? null,
    }, { onConflict: 'workspace_id,entidad,de_id,a_id' });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
}

export async function borrarDependencia(entidad: EntidadDep, deId: string, aId: string): Promise<void> {
  return enPlan(async () => {
    const db = await getTenantDb();
    await db.from('plan_dependencias').delete().eq('entidad', entidad).eq('de_id', deId).eq('a_id', aId);
  });
}

/**
 * Barre las aristas que apuntan a algo que ya no existe.
 *
 * Existe porque NO hay foreign key posible: la PK de plan_tareas es compuesta y la tabla
 * mezcla ids de dos tablas, así que no hay `on delete cascade`. El resolvedor ya ignora los
 * punteros muertos —el tablero nunca se rompe—, pero dejarlos para siempre es acumular
 * basura que después nadie sabe interpretar. Corre después de cada borrado.
 */
export async function limpiarDependenciasColgadas(): Promise<number> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const [t, p, d] = await Promise.all([
      db.from('plan_tareas').select('id'),
      db.from('plan_proyectos').select('id'),
      db.from('plan_dependencias').select('entidad, de_id, a_id'),
    ]);
    const vivosT = new Set((t.data ?? []).map((r) => str((r as Row).id)));
    const vivosP = new Set((p.data ?? []).map((r) => str((r as Row).id)));
    const muertas = (d.data ?? []).filter((r) => {
      const row = r as Row, vivos = str(row.entidad) === 'proyecto' ? vivosP : vivosT;
      return !vivos.has(str(row.de_id)) || !vivos.has(str(row.a_id));
    });
    for (const m of muertas) {
      const row = m as Row;
      await db.from('plan_dependencias').delete().eq('entidad', str(row.entidad)).eq('de_id', str(row.de_id)).eq('a_id', str(row.a_id));
    }
    if (muertas.length) console.log(`[plan-board] dependencias colgadas barridas: ${muertas.length}`);
    return muertas.length;
  });
}

/** true si el board del dueño todavía NO fue migrado (0 tareas y 0 proyectos). */
export async function planVacio(): Promise<boolean> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { count } = await db.from('plan_tareas').select('id', { count: 'exact', head: true });
    return (count ?? 0) === 0;
  });
}

/** Próximo #num libre (autoritativo, server-side) para tareas nuevas (MaKo o UI). */
async function proximoNum(db: Awaited<ReturnType<typeof getTenantDb>>): Promise<number> {
  const { data } = await db.from('plan_tareas').select('num').order('num', { ascending: false }).limit(1);
  const max = data && data.length ? int((data[0] as { num: number }).num) : 0;
  return max + 1;
}

/** El número P# más alto usado por los proyectos (0 si ninguno). El pid VISIBLE (P1,
 *  P2…) es estable y distinto del id-slug; los proyectos nuevos deben recibir el
 *  siguiente. Antes NO se asignaba → los proyectos de MaKo nacían sin P# (bug). */
const pidNum = (pid?: string | null): number => { const m = /^P(\d+)$/i.exec((pid ?? '').trim()); return m ? parseInt(m[1], 10) : 0; };
const maxPid = (proyectos: Array<{ pid?: string }>): number => proyectos.reduce((m, p) => Math.max(m, pidNum(p.pid)), 0);

// ── tareas ─────────────────────────────────────────────────────────────────
export async function crearPlanTarea(draft: BoardTask): Promise<BoardTask> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const tarea: BoardTask = { ...draft, id: genId('t'), num: await proximoNum(db) };
    const { error } = await db.from('plan_tareas').insert(taskToRow(tarea));
    if (error) throw new Error(`crearPlanTarea: ${error.message}`);
    return tarea;
  });
}
export async function guardarPlanTarea(t: BoardTask): Promise<void> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { error } = await db.from('plan_tareas').upsert(taskToRow(t), { onConflict: 'workspace_id,id' });
    if (error) throw new Error(`guardarPlanTarea: ${error.message}`);
  });
}
export async function borrarPlanTarea(id: string): Promise<void> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { error } = await db.from('plan_tareas').delete().eq('id', id);
    if (error) throw new Error(`borrarPlanTarea: ${error.message}`);
    // Sin FK no hay cascade: las aristas que apuntaban acá quedan colgadas. El resolvedor
    // las ignora, así que el tablero no se rompe — pero se barren igual para que nadie
    // tenga que interpretar basura dentro de tres meses.
    await borrarAristasDe('tarea', id);
  });
}

/** Borra TODA arista que entre o salga de un id. Se llama después de cada borrado. */
async function borrarAristasDe(entidad: EntidadDep, id: string): Promise<void> {
  const db = await getTenantDb();
  await Promise.all([
    db.from('plan_dependencias').delete().eq('entidad', entidad).eq('de_id', id),
    db.from('plan_dependencias').delete().eq('entidad', entidad).eq('a_id', id),
  ]);
}

// ── proyectos ────────────────────────────────────────────────────────────────
export async function crearPlanProyecto(draft: Label): Promise<Label> {
  return enPlan(async () => {
    const db = await getTenantDb();
    // pid VISIBLE (P#) estable: si el draft no lo trae, tomamos el siguiente libre.
    let pid = draft.pid;
    if (!pid) {
      const { data } = await db.from('plan_proyectos').select('pid');
      pid = `P${maxPid((data ?? []) as Array<{ pid?: string }>) + 1}`;
    }
    const proj: Label = { ...draft, pid, id: draft.id && !draft.id.startsWith('tmp') ? draft.id : genId('p') };
    const { error } = await db.from('plan_proyectos').insert(labelToRow(proj));
    if (error) throw new Error(`crearPlanProyecto: ${error.message}`);
    return proj;
  });
}
/**
 * Guardar un proyecto desde el navegador NO TOCA EL SCORE. Nunca.
 *
 * Esto era un upsert de la fila ENTERA armada con el estado de la pestaña, así que una
 * pestaña abierta hace media hora que renombraba un proyecto o le cambiaba el emoji
 * escribía además el `score`, el `score_razon` y el `score_manual` que tenía en memoria —
 * pisando con datos viejos la corrida de las 9:10 y, peor, un debate que el dueño acababa
 * de ganar. Nada de eso se veía: el rename funcionaba perfecto.
 *
 * Desde la mig 0144 el número lo escribe SIEMPRE el server (`lib/plan-reprio.ts` cuando el
 * dueño lo discute, `priorizarProyectosOwner` cuando lo decide el Perro), y por columna
 * puntual. El navegador ya no tiene por qué mandarlo, así que no se lo deja mandar: un
 * camino que no existe no se puede olvidar de cerrar.
 */
export async function guardarPlanProyecto(l: Label): Promise<void> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { score, score_razon, score_manual, impacto, esfuerzo, ...campos } = labelToRow(l);
    void score; void score_razon; void score_manual; void impacto; void esfuerzo;
    const { error } = await db.from('plan_proyectos').upsert(campos, { onConflict: 'workspace_id,id' });
    if (error) throw new Error(`guardarPlanProyecto: ${error.message}`);
  });
}
/** Borra el proyecto y lo saca del array `labels` de las tareas que lo tenían. */
export async function borrarPlanProyecto(id: string): Promise<void> {
  return enPlan(async () => {
    const db = await getTenantDb();
      // ⚠️ `contains` SOBRE UNA COLUMNA `jsonb` LLEVA JSON, NO UN ARRAY DE JS. supabase-js
      // serializa `[x]` como el literal de array de Postgres (`{x}`) y Postgres contesta
      // «invalid input syntax for type json» — o sea que la consulta FALLA ENTERA. Y como
      // acá se ignora el `error`, `data` viene `null`, el `?? []` lo vuelve vacío y el
      // bucle no hace nada: el borrado reporta éxito y deja las tareas apuntando a un
      // proyecto que ya no existe. Medido el 26/09/2026: cero filas colgadas en el ws1,
      // porque el NAVEGADOR las limpia por su cuenta antes de guardar — o sea que este
      // guard del server nunca corrió, y sólo iba a hacer falta el día que borre otro
      // camino (MaKo, un script, la API).
    const { data } = await db.from('plan_tareas').select('id, labels').contains('labels', JSON.stringify([id]));
    await Promise.all((data ?? []).map((r) => {
      const labels = asArr<unknown>((r as { labels: unknown }).labels).map(String).filter((x) => x !== id);
      return db.from('plan_tareas').update({ labels, updated_at: new Date().toISOString() }).eq('id', (r as { id: string }).id);
    }));
    const { error } = await db.from('plan_proyectos').delete().eq('id', id);
    if (error) throw new Error(`borrarPlanProyecto: ${error.message}`);
    await borrarAristasDe('proyecto', id);
  });
}

// ── MaKo agrega tareas (reemplaza la bandeja localStorage) ───────────────────
// De la fuente sale el ACTOR del historial y la etiqueta "— <desde>", igual que lo
// hacía construirInbox en el board: WhatsApp/Fathom/MaKo = 'ia', Claude Code = 'code'.
function desdeDeFuente(f?: Fuente): { actor: Actor; desde: string } {
  const tipo = f?.tipo ?? 'whatsapp';
  const actor: Actor = tipo === 'claude-code' ? 'code' : 'ia';
  const base = tipo === 'whatsapp' ? 'WhatsApp' : tipo === 'claude-code' ? 'Claude Code' : tipo === 'fathom' ? 'Fathom' : 'MaKo';
  return { actor, desde: f?.etiqueta ? `${base} · ${f.etiqueta}` : base };
}

// `fuente` POR TAREA: dos tareas del mismo lote pueden apuntar a MINUTOS distintos de
// la misma reunión (…?timestamp=754), que es lo que hace clickeable el chip del detalle.
/**
 * El detalle final de una tarjeta: lo que escribió/dictó el dueño + lo que le agregó el
 * Perro, sin perder nada. Tres casos, en este orden:
 *   · no había nada del dueño → el del Perro;
 *   · el Perro lo ABSORBIÓ (arranca igual) → el del Perro, que es el ampliado;
 *   · el Perro escribió otra cosa → los dos, el del dueño PRIMERO.
 * El chequeo es por el arranque normalizado, no por el texto entero: el modelo corrige
 * una tilde o una coma y una comparación exacta diría "no lo absorbió" siempre.
 */
import { fusionarDetalle, pasosComoBullets } from './detalle-fusion';
import { evaluarDetalle, TOPE_DETALLE } from './detalle-contrato';
export { fusionarDetalle };

/**
 * Marca hecha una tarea del board del dueño SIN borrarla, dejando la evidencia.
 * `parcial` = «está a medias»: no cierra, sube el avance a la mitad y suma la
 * evidencia al detalle. Perder ese matiz —tratar «a medias» como «no»— tira a la
 * basura el trabajo de verificar, y tratarlo como «sí» esconde lo que falta.
 */
/** Devuelve `true` solo si tocó una fila. Devolvía `void`, y el llamador sumaba al
 *  contador igual: con un id inventado la pantalla decía «cerré 1» sin haber cerrado
 *  nada. Un contador que miente sobre un cierre es peor que no tenerlo, porque el
 *  dueño deja de revisar. */
export async function cerrarPlanTareaOwner(id: string, evidencia: string, parcial = false): Promise<boolean> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_tareas').select('*').eq('id', id).limit(1);
    const fila = (data ?? [])[0] as Row | undefined;
    if (!fila) { console.warn(`[plan-board] cerrar: no existe ${id}`); return false; }
    const t = rowToTask(fila);
    const texto = (parcial ? `MaKo la dejó a medias: ${evidencia}` : `MaKo la marcó hecha: ${evidencia}`).slice(0, 240);
    const hist: Hist[] = [{ id: genId('h'), ts: Date.now(), actor: 'ia' as Actor, text: texto }, ...(t.historial ?? [])].slice(0, 40);
    const patch: Row = { historial: hist, updated_at: new Date().toISOString() };
    if (parcial) {
      patch.progress = Math.max(50, t.progress);
      patch.detalle = fusionarDetalle(t.detalle ?? '', evidencia);
    } else {
      patch.progress = 100;
      // La checklist se tilda entera: dejar ítems abiertos en una tarjeta al 100%
      // hace que el avance del proyecto y el de la tarjeta digan cosas distintas.
      patch.checklist = (t.checklist ?? []).map((c) => ({ ...c, done: true }));
    }
    const { error } = await db.from('plan_tareas').update(patch).eq('id', id);
    if (error) throw new Error(`cerrarPlanTareaOwner: ${error.message}`);
    return true;
  });
}

/**
 * ⚠️ `recurrente` VIAJA DESDE EL ALTA, y no es un detalle: mientras el único camino fue un
 * interruptor en el detalle, una reunión extraída metía «Reunión semanal con Esquer» como
 * tarea normal, el Perro le ponía score y deadline, se llevaba un puesto del ranking y
 * titilaba pidiendo una fecha que nunca iba a tener. O sea que el síntoma que la feature
 * vino a eliminar seguía entrando por la puerta principal todos los días.
 *
 * ⚠️ Y UNA RECURRENTE NACE SIN FECHA, acá mismo. No alcanza con que `taskToRow` la borre
 * después: si el deadline llega hasta el objeto en memoria, el Perro lo ve en la misma
 * corrida y razona con él. Se corta en el alta, que es donde entra.
 */
export type NuevaTareaPlan = { titulo: string; prioridad?: Prio; proyecto?: string; deadline?: string; detalle?: string; fuente?: Fuente; recurrente?: boolean };

/** MaKo agrega tareas al board del dueño DIRECTO a la DB (antes iban a la bandeja
 *  localStorage, que el server no podía tocar). Resuelve/crea el proyecto por nombre,
 *  pone score inicial por prioridad (después el Perro las re-puntúa), firma el historial
 *  con la fuente y devuelve los ids para armar los deep-links (?tarea=<id>). */
export async function agregarTareasPlanOwner(items: NuevaTareaPlan[], fuente?: Fuente): Promise<{ ids: string[]; nums: number[]; proyectoIds: string[] }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { actor, desde } = desdeDeFuente(fuente);
    const fu: Fuente = fuente ?? { tipo: 'whatsapp' };
    const ahora = Date.now();
    const validos = items.filter((it) => (it.titulo || '').trim());
    if (!validos.length) return { ids: [], nums: [], proyectoIds: [] };

    // 1. proyectos existentes (resolver por nombre) + crear los que falten (dedupe).
    const { data: projRows } = await db.from('plan_proyectos').select('*');
    const proyectos = (projRows ?? []).map(rowToLabel);
    // La clave es el NÚCLEO del nombre, no el nombre crudo: «CRM», «Feature: CRM» y
    // «feature: crm» tienen que caer todos en el mismo proyecto. Con `.toLowerCase()`
    // pelado, el primer ruteo que devolviera el nombre sin prefijo abría un gemelo.
    const byName = new Map(proyectos.map((p) => [nucleo(p.name), p.id]));
    const idsExist = new Set(proyectos.map((p) => p.id)); // MaKo a veces pasa el id/slug del proyecto existente
    const resolverProy = (nombre?: string): string | undefined => { const n = nombre?.trim(); if (!n) return undefined; return byName.get(nucleo(n)) ?? (idsExist.has(n) ? n : undefined); };

    // 1a. RUTEO POR TAREA (el Perro, ANTES de crear), contra una lista CERRADA: los
    // proyectos que ya están en el tablero + el catálogo de proyectos grandes
    // (lib/plan-proyectos-catalogo.ts). El modelo ya no puede devolver "es nuevo": elige
    // uno de la lista y listo. Antes el default era "nuevo" y en dos semanas nacieron 24
    // proyectos, tres de ellos sobre Instagram.
    const cuentaPorProy = new Map<string, number>();
    {
      const { data: tRows } = await db.from('plan_tareas').select('labels');
      for (const r of (tRows ?? []) as Array<{ labels: unknown }>) {
        for (const l of asArr<unknown>(r.labels).map(String)) cuentaPorProy.set(l, (cuentaPorProy.get(l) ?? 0) + 1);
      }
    }
    // Un solo menú: lo que ya existe manda (con su descripción y su tamaño), y el catálogo
    // aporta los que todavía no se crearon. Sin repetir el que ya está en el tablero.
    const yaEnTablero = new Set(proyectos.map((p) => nucleo(p.name)));
    const destinos = [
      ...proyectos.map((p) => ({ nombre: p.name, que: delCatalogo(p.name)?.que || p.detalle || '', n: cuentaPorProy.get(p.id) ?? 0 })),
      ...CATALOGO_PROYECTOS.filter((c) => !yaEnTablero.has(nucleo(c.nombre))).map((c) => ({ nombre: c.nombre, que: c.que })),
    ];
    const ruteo: Record<number, string> = {}; // índice de tarea → NOMBRE del proyecto destino
    const propuestosPorElPerro = new Map<string, { nombre: string; que: string; porQue: string }>();
    const noSeAbrio: (string | undefined)[] = validos.map(() => undefined); // índice → por qué NO nació su proyecto
    if (destinos.length) {
      const r = await asignarTareasAProyectos(
        // El DETALLE va: sin él el ruteador ve una lista de títulos sueltos y manda
        // «Diseñar el módulo de Diagnóstico» a Onboarding porque suena parecido.
        validos.map((it) => ({ titulo: it.titulo.trim(), grupo: it.proyecto?.trim(), detalle: it.detalle })),
        destinos,
        'Rutear tareas nuevas a proyectos',
      ).catch((e) => { console.error('[plan-board] asignarTareasAProyectos:', e instanceof Error ? e.message : String(e)); return { asign: [] as Array<{ i: number; destino: string }>, nuevos: [] as Array<{ nombre: string; que: string; porQue: string; tareas: number[] }>, rechazos: [] as Array<{ nombre: string; motivo: string; tareas: number[] }> }; });
      for (const a of r.asign) ruteo[a.i] = a.destino;
      // EL RECHAZO SE CUENTA. Cuando el Perro decide no abrir un proyecto, la tarea igual
      // aterriza en algún lado y esa decisión desaparecía: el motivo iba a un
      // `console.warn` y nada más. Ya sabemos cuánto vale eso — el warn estaba puesto y
      // los cinco proyectos del 11-12/8 nacieron igual. Ahora va al historial de cada
      // tarjeta afectada, que es donde el dueño lo puede leer y discutir.
      for (const x of (r.rechazos ?? [])) {
        for (const i of (x.tareas ?? [])) {
          if (i >= 0 && i < noSeAbrio.length) noSeAbrio[i] = `MaKo no abrió «${x.nombre}»: ${x.motivo}`;
        }
      }
      // Los índices que vinieron con el proyecto nuevo MANDAN sobre `asign`: si el
      // modelo propuso «Mindset» para las tareas 0,1,2 pero en `asign` las mandó a tres
      // lugares distintos, el proyecto nacía vacío y las tareas se desparramaban igual.
      for (const n of (r.nuevos ?? [])) for (const i of (n.tareas ?? [])) ruteo[i] = n.nombre;
      // Los proyectos que el Perro pidió abrir porque nada de la lista los cubría.
      // Vienen con su descripción y su porqué: se guardan para que el proyecto nuevo
      // nazca explicándose solo, igual que uno del catálogo.
      for (const n of (r.nuevos ?? [])) propuestosPorElPerro.set(nucleo(n.nombre), n);
    }

    // 2. proyecto RESUELTO de cada tarea: el destino que eligió el Perro (o, si el ruteo
    // falló entero, el grupo que propuso MaKo). Si ese destino todavía no está en el
    // tablero se crea UNA vez, con el emoji y la descripción del catálogo.
    const nuevosProy: Label[] = [];
    const ruteadasA = new Map<string, string[]>(); // id de proyecto existente → títulos ruteados
    const sinProyecto: string[] = []; // índice → por qué se quedó sin proyecto (va al historial)
    let siguientePid = maxPid(proyectos) + 1; // P# estable para cada proyecto nuevo
    const motivoSin: (string | undefined)[] = validos.map(() => undefined);
    const projDeTarea: (string | undefined)[] = validos.map((it, i) => {
      const nombre = (ruteo[i] || it.proyecto?.trim() || '').trim();
      if (!nombre) return undefined;
      const exist = resolverProy(nombre);
      if (exist) {
        const l = ruteadasA.get(exist) ?? []; l.push(it.titulo.trim()); ruteadasA.set(exist, l);
        return exist;
      }
      const k = nucleo(nombre);
      let nid = byName.get(k);
      if (!nid) {
        const cat = delCatalogo(nombre);
        const delPerro = propuestosPorElPerro.get(k);
        // ⛔ LA COMPUERTA. Un proyecto se crea desde DOS fuentes y ninguna más: el
        // catálogo, o el Perro habiéndolo propuesto y pasado sus cuatro barreras.
        //
        // Lo que se cierra acá (11-12/8/2026, cinco proyectos en dos días: «Feature:
        // Landing», «Feature: Content Machine», «Feature: Historia del Usuario»,
        // «Feature: Focus Tracker», «Feature: Funnel de Venta», con UNA tarea cada uno):
        // `nombre` sale de `ruteo[i] || it.proyecto`, y esa segunda mitad es el nombre
        // CRUDO que escribió MaKo en la tool de WhatsApp. Cuando el Perro rechazaba la
        // propuesta, la tarea perdía su `ruteo[i]`… y el fallback la mandaba a crear
        // EXACTAMENTE el proyecto recién rechazado. Los cinco tienen el mismo renglón en
        // su historial —«Creó el proyecto — WhatsApp»—, que es la rama de acá abajo
        // donde no hay ni catálogo ni aval: la firma del agujero.
        //
        // Un `console.warn` no alcanzaba y la prueba está en la fecha: el warn ya estaba
        // y los cinco nacieron igual, porque nadie lee los logs de Vercel. Ahora la
        // tarea entra SIN proyecto y con el motivo en su historial, que se ve en la app.
        // Un huérfano visible se arregla en diez segundos; un proyecto de más ensucia el
        // tablero para siempre y nadie se entera de que nació mal.
        if (!cat && !delPerro) {
          const porQue = `No se creó el proyecto «${nombre.slice(0, 60)}»: no está en el catálogo y el Perro no lo avaló. La tarea entra sin proyecto — asignala a mano.`;
          motivoSin[i] = porQue;
          sinProyecto.push(`«${it.titulo.trim().slice(0, 40)}» → pedía «${nombre.slice(0, 40)}»`);
          return undefined;
        }
        nid = genId('p');
        byName.set(k, nid);
        // El historial dice de dónde salió el proyecto, y en el caso más delicado —el
        // que abrió el Perro— dice ADEMÁS por qué ninguno de los que había servía. Sin
        // ese renglón, un proyecto nuevo es una decisión que nadie puede discutir.
        const porQueNacio = cat ? `Creó el proyecto (está en el catálogo) — ${desde}`
          : `MaKo abrió este proyecto: ${delPerro!.porQue} — ${desde}`;
        nuevosProy.push({
          // El nombre que se GUARDA es el canónico del catálogo: si el modelo dijo
          // «CRM», el proyecto se llama «Feature: CRM». El prefijo no depende de que
          // el modelo se acuerde de escribirlo.
          id: nid, pid: `P${siguientePid++}`, emoji: cat?.emoji ?? '🗂', name: canonNombre(nombre).slice(0, 120),
          color: '#2F6FED', score: 50, detalle: cat?.que ?? delPerro?.que ?? '', fuente: fu,
          historial: [{ id: genId('h'), ts: ahora, actor, text: porQueNacio.slice(0, 300) }],
        });
      }
      return nid;
    });
    if (sinProyecto.length) {
      console.warn(`[plan-board] ${sinProyecto.length} tarea(s) entran SIN proyecto (nombre inventado, sin catálogo ni aval del Perro) — ${desde}: ${sinProyecto.join(' · ')}`);
    }
    if (nuevosProy.length) {
      const base = proyectos.length;
      const { error } = await db.from('plan_proyectos').insert(nuevosProy.map((l, i) => labelToRow(l, base + i)));
      if (error) throw new Error(`agregarTareasPlanOwner proyectos: ${error.message}`);
    }
    // RASTRO en cada proyecto existente que recibió tareas ruteadas (regla del historial,
    // auditable/reversible): "MaKo ruteó N tareas acá en vez de crear un proyecto nuevo".
    for (const [pid, tits] of ruteadasA) {
      const p = proyectos.find((x) => x.id === pid);
      if (!p) continue;
      const texto = `MaKo ruteó ${tits.length} tarea${tits.length > 1 ? 's' : ''} aquí (en vez de crear un proyecto nuevo): ${tits.map((t) => `«${t.slice(0, 40)}»`).join(', ')}`.slice(0, 300);
      const hist = [{ id: genId('h'), ts: ahora, actor, text: texto }, ...(p.historial ?? [])].slice(0, 40);
      await db.from('plan_proyectos').update({ historial: hist, updated_at: new Date().toISOString() }).eq('id', pid)
        .then(({ error }) => { if (error) console.error('[plan-board] historial ruteo:', error.message); });
    }

    // 3. tareas: #num autoritativo (server) + score inicial por prioridad.
    const start = await proximoNum(db);
    const tareas: BoardTask[] = validos.map((it, i) => {
      const prio: Prio = it.prioridad ?? 'media';
      const projId = projDeTarea[i];
      return {
        id: genId('t'), num: start + i, emoji: '📌', title: it.titulo.trim().slice(0, 200),
        detalle: it.detalle?.slice(0, TOPE_DETALLE) ?? '', priority: prio, score: scoreFromPrio[prio], progress: 0,
        deadline: it.deadline || '', labels: projId ? [projId] : [], checklist: [],
        // Las decisiones de ruteo que NO se ven en el resultado van en el historial DE LA
        // TARJETA, que es donde el dueño las va a leer. En un log de Vercel no las ve
        // nadie: `noSeAbrio` es el proyecto que el Perro decidió no abrir y por qué,
        // `motivoSin` es la tarea que quedó sin proyecto porque nadie avaló el nombre.
        historial: [
          { id: genId('h'), ts: ahora, actor, text: `Creó la tarjeta — ${desde}` },
          ...(noSeAbrio[i] ? [{ id: genId('h'), ts: ahora, actor, text: noSeAbrio[i]!.slice(0, 300) }] : []),
          ...(motivoSin[i] ? [{ id: genId('h'), ts: ahora, actor, text: motivoSin[i]!.slice(0, 300) }] : []),
        ],
        origen: actor, fuente: it.fuente ?? fu, enPrioridad: false,
        recurrente: !!it.recurrente,
      };
    });
    const { error } = await db.from('plan_tareas').insert(tareas.map(taskToRow));
    if (error) throw new Error(`agregarTareasPlanOwner tareas: ${error.message}`);

    /**
     * ⚠️ UNA TAREA QUE NACE RECURRENTE ARRASTRA A SU PROYECTO, igual que cuando se marca a
     * mano (`useBoard.setRecurrente`). Va acá y no sólo en el navegador porque por este
     * camino entran la extracción de una reunión, WhatsApp y los lotes — que es por donde
     * entra la MAYORÍA. Sin esto la regla valdría sólo para lo que alguien tilde a mano, o
     * sea casi nada, y un «Reunión semanal con Esquer» dejaría a su proyecto compitiendo.
     *
     * Sólo hacia ARRIBA y sólo al MARCAR: un proyecto recurrente sí puede tener tareas con
     * fin, y que una tarea deje de repetirse no dice nada de las otras del mismo proyecto.
     */
    const proyDeRecurrentes = [...new Set(tareas.filter(esRecurrente).flatMap((t) => t.labels))];
    if (proyDeRecurrentes.length) {
      const { error: e2 } = await db.from('plan_proyectos')
        .update({ recurrente: true, deadline: '', quarter: null })
        .in('id', proyDeRecurrentes).eq('recurrente', false);
      // No tira: la tarea YA se creó y perder el arrastre es recuperable con un click,
      // mientras que reventar acá dejaría la carga a medias sin decir cuál se guardó.
      if (e2) console.error('[plan-board] arrastre recurrente al proyecto:', e2.message);
    }

    return { ids: tareas.map((t) => t.id), nums: tareas.map((t) => t.num), proyectoIds: nuevosProy.map((p) => p.id) };
  });
}

export type AmpliarTareaPlan = { id: string; titulo?: string; detalle?: string; fuente?: Fuente };

/**
 * AMPLIAR una tarjeta que YA EXISTE, en vez de crear una segunda igual.
 *
 * Es la salida al caso más común de cargar reuniones en serie: la misma tarea se habla
 * en tres llamadas seguidas. Antes la fila que el Perro marcaba como repetida nacía
 * destildada pero se podía tildar igual, así que el tablero terminaba con la misma
 * tarea escrita tres veces y tres scores distintos. Ahora ese contexto no se pierde ni
 * se duplica: se SUMA a la tarjeta que ya está.
 *
 * Lo que se toca:
 *   · `detalle` → se fusiona (fusionarDetalle: lo viejo primero, nunca se pisa);
 *   · `historial` → queda el rastro con de qué reunión salió lo nuevo.
 * Lo que NO se toca: score, prioridad, deadline, notas y proyecto. Amplíar es agregar
 * contexto, no re-decidir la tarea — para eso está el debate con el Perro.
 */
export async function ampliarTareasPlanOwner(items: AmpliarTareaPlan[], fuente?: Fuente): Promise<{ n: number; patches: GuardPatch[] }> {
  return enPlan(async () => {
    const validos = items.filter((it) => it.id && (it.detalle || '').trim());
    if (!validos.length) return { n: 0, patches: [] };
    const db = await getTenantDb();
    const { actor, desde } = desdeDeFuente(fuente);
    const ahora = Date.now();
    const { data } = await db.from('plan_tareas').select('id, title, detalle, checklist, historial, fuente').in('id', validos.map((v) => v.id));
    const filas = (data ?? []) as Array<{ id: string; title: string; detalle: string; checklist: unknown; historial: unknown; fuente: unknown }>;
    const porId = new Map(filas.map((f) => [f.id, f]));

    const patches: GuardPatch[] = [];
    let n = 0;
    for (const it of validos) {
      const f = porId.get(it.id);
      if (!f) { console.warn(`[plan-board] ampliar: la tarea ${it.id} no existe`); continue; }
      const actual = str(f.detalle);
      // ⚠️ ACÁ SE EXTRAÍAN LAS VIÑETAS DEL TEXTO NUEVO A LA CHECKLIST. Ya no: las viñetas
      // se quedan donde ya estaban —adentro del detalle fusionado—, que es donde viven los
      // pasos desde que las checklists salieron del producto (22/09/2026).
      const fusionado = fusionarDetalle(actual, (it.detalle ?? '').trim());
      // ⚠️ EL TOPE SE APLICA ANTES DE DECIDIR, NO DESPUÉS. `fusionarDetalle` pega lo nuevo
      // AL FINAL, así que en una tarjeta que ya está en el tope el `slice` se lleva puesto
      // exactamente lo que se venía a agregar: la comparación contra el texto SIN recortar
      // daba «cambió», se escribía un detalle idéntico al que ya estaba, y el historial
      // decía «MaKo le sumó contexto». O sea: la reunión se perdía y la tarjeta afirmaba
      // que la había incorporado. Medido el 23/09/2026: 6 tarjetas del tablero clavadas en
      // 6000 caracteres, y toda ampliación siguiente moría así, en silencio.
      const detalleFinal = fusionado.slice(0, TOPE_DETALLE);
      const afuera = fusionado.length - detalleFinal.length;
      if (detalleFinal === actual) {
        // No entró NADA. Si fue por el tope, queda escrito: un descarte sin rastro hace
        // indistinguibles «no llegó» de «lo tiramos nosotros», y acá lo que se pierde es
        // el contexto de una reunión que ya no se puede volver a extraer.
        if (afuera > 0) {
          const aviso: Hist = { id: genId('h'), ts: ahora, actor, text: `MaKo NO pudo sumar contexto: la tarjeta está en el tope de ${TOPE_DETALLE} caracteres y quedaron ${afuera} afuera. Acorta el detalle y vuelve a cargarla — ${desde}`.slice(0, 220) };
          const hist = [aviso, ...sanearHist(f.historial)].slice(0, 40);
          const { error: e2 } = await db.from('plan_tareas').update({ historial: hist, updated_at: new Date().toISOString() }).eq('id', it.id);
          if (e2) console.error(`[plan-board] ampliar ${it.id} (aviso de tope): ${e2.message}`);
          else patches.push({ id: it.id, historialEntry: aviso });
          console.warn(`[plan-board] ampliar ${it.id}: no entró (tope ${TOPE_DETALLE}, ${afuera} caracteres afuera)`);
        }
        continue;
      }
      // Entró, pero puede haber entrado A MEDIAS: el historial lo dice con el número.
      const entrada: Hist = { id: genId('h'), ts: ahora, actor, text: (afuera > 0
        ? `MaKo le sumó contexto y entró INCOMPLETO: quedaron ${afuera} caracteres afuera por el tope de ${TOPE_DETALLE} — ${desde}`
        : `MaKo le sumó contexto (no la duplicó) — ${desde}`).slice(0, 220) };
      const historial = [entrada, ...sanearHist(f.historial)].slice(0, 40);
      const { error } = await db.from('plan_tareas').update({
        detalle: detalleFinal, historial, updated_at: new Date().toISOString(),
      }).eq('id', it.id);
      if (error) { console.error(`[plan-board] ampliar ${it.id}: ${error.message}`); continue; }
      n++;
      patches.push({ id: it.id, detalle: detalleFinal, historialEntry: entrada });
    }
    return { n, patches };
  });
}

/** El Perro Guardián trabaja lo RECIÉN creado (server-side, no depende del navegador):
 *  (1) puntúa las tareas nuevas ubicándolas en la pirámide + les arma la checklist;
 *  (2) a los proyectos nuevos les pone emoji + descripción + score distinto (antes
 *  quedaban 📁/50/sin detalle). NO re-puntúa el resto. Devuelve el conteo por columna +
 *  cuántos proyectos trabajó (o null). Queda en el historial de IA (feature mako-guardian). */
/**
 * RE-REPARTE EL TABLERO ENTERO. Cero tokens: es aritmética.
 *
 * El problema que resuelve, medido sobre el tablero real: de 550 tareas abiertas, solo 20
 * tenían algún re-puntaje del Perro. El 96% conservaba el número del día que nació —
 * comparado contra un tablero que ya no existe— y cada lote nuevo entraba anclado a la
 * punta: la semana en curso promediaba 67 contra 40-47 de las anteriores. Con eso la
 * vista Prioridades deja de ser fiel, que es exactamente como lo reportó el dueño.
 *
 * La idea: el modelo NO tiene que re-puntuar nada. Lo único que hace es UBICAR lo nuevo
 * (eso ya lo hacía). El reparto de los números lo hace el servidor con `curveTaskScores`,
 * que conserva el ORDEN y solo redistribuye la escala en la pirámide 93→76 / 72→51 /
 * 48→26 / 23→2. Por eso re-priorizar 1.000 tareas cuesta lo mismo que re-priorizar 10:
 * una query, un sort y un update. Lo caro es preguntarle a un modelo, no ordenar.
 *
 * ⚠️ NO deshace empates y no pretende hacerlo: con 550 tareas y ~92 valores posibles, los
 * empates son inevitables y NO son el problema — el Perro empata a propósito cuando dos
 * tarjetas son el mismo trabajo («Mismo trabajo que "Investigar competencia: X"», 5 de
 * ellas en 62). Lo que esto arregla es la DISTRIBUCIÓN: que la pirámide tenga fondo.
 *
 * ⚠️ Y NO cambia el orden que decidió nadie: preserva el ranking tal cual está. Solo mueve
 * la regla de tres.
 *
 * ⚠️ LO FIJADO A MANO NO SE TOCA, Y HASTA EL 23/09/2026 SÍ SE TOCABA. El comentario de
 * arriba decía «incluida cualquier corrección a mano del dueño» y el código no miraba
 * `score_manual` (mig 0143) en ningún lado: a una tarjeta que el dueño había fijado en 90
 * se le sumaba el empuje del deadline y el castigo por quietud, y después la curva le
 * reescribía el número. O sea que el candado que la pantalla anuncia («la fijaste a mano:
 * MaKo ya no la toca») era cierto para los proyectos y mentira para las tareas — y la
 * forma en que fallaba es la peor: el número se movía solo, de a poco, todos los días.
 * Acá esas tarjetas entran al reparto con su número tal cual (para que las otras se
 * ordenen ALREDEDOR de ellas) y salen sin que se les escriba nada.
 */
export async function recurvarPlanOwner(): Promise<{ movidas: number; total: number; conDeadline: number; quietas: number; frenadas: number; fijadas: number; repetidas: number }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const ahora = Date.now();
    const [tRes, dRes] = await Promise.all([
      // ⚠️ `recurrente` VA EN ESTA LISTA porque este `select` enumera columnas a mano: lo
      // que no se nombra acá no llega, y el filtro de abajo daría `false` para todas.
      db.from('plan_tareas').select('id, num, score, score_base, score_manual, progress, labels, deadline, historial, created_at, recurrente').order('num', { ascending: true }),
      db.from('plan_dependencias').select('entidad, de_id, a_id, clase, razon, origen, confianza'),
    ]);
    const deps = (dRes.data ?? []).map(sanearDep).filter((x): x is Dep => x != null);
    /**
     * ⚠️ LAS QUE SE REPITEN NO SE REPARTEN. ES LA RAZÓN DE SER DE LA 0163.
     *
     * Éste es el único cron que toca el orden del tablero, y le hace tres cosas a cada
     * tarea que las tres MIENTEN sobre una recurrente:
     *  · `empujeDeadline` le suma +25 por «vencida» — no puede vencer;
     *  · `castigoQuietud` le resta hasta 20 por «30 días sin que nadie la mencione» — ése
     *    es su estado NORMAL, así que la hundiría sola hasta el piso. Eso «funciona» por
     *    accidente y es la peor forma de resolverlo: el número se mueve solo, de a poco,
     *    todos los días, y nadie puede explicar por qué;
     *  · `curveTaskScores` le reasigna un número por RANKING, o sea le da un puesto en una
     *    pirámide donde no compite y se lo saca a algo que sí tiene un fin.
     *
     * ⚠️ PERO SÍ ENTRAN A `resolverDeps`, y eso NO es una excepción: es lo que hace que la
     * respuesta sea una sola. El grafo necesita saber que un proyecto TIENE trabajo —
     * aunque sea trabajo que se repite— para no tratarlo como vacío, y esa pregunta la
     * contesta `dependencias.ts` en un solo lugar para los dos que lo llaman (acá y el
     * board, que le pasa el tablero entero). El que decide quién compite ahí adentro es
     * `esRecurrente`, no quién llama: dos universos distintos para el mismo grafo son dos
     * respuestas distintas a «¿este proyecto está terminado?».
     */
    const abiertas = (tRes.data ?? []).map((r) => r as Row).filter((r) => int(r.progress) < 100).map((row) => {
      const recurrente = !!row.recurrente;
      // La BASE es el juicio, no el número que se muestra: leer `score` acá sería leer la
      // salida de la corrida anterior y el ajuste se sumaría a sí mismo cada vez.
      const base = optInt(row.score_base) ?? int(row.score);
      const dl = recurrente ? null : diasAlDeadline(str(row.deadline) || undefined, ahora);
      const q = diasQuieta(sanearHist(row.historial), str(row.created_at), ahora);
      // Una decisión de una persona no la ajusta el tiempo: el que la fijó ya sabía cuándo
      // vencía y hace cuánto no se tocaba. Sin este corte, el candado se filtraba igual por
      // el delta aunque después no se escribiera el número. Una recurrente sale por la
      // misma puerta y por otro motivo: el tiempo no le pasa.
      const manual = row.score_manual === true;
      const aj = manual || recurrente ? { delta: 0, razon: '' } : ajusteTemporal({ quieta: q, alDeadline: dl });
      return {
        id: str(row.id), num: int(row.num), score: Math.max(1, Math.min(100, base + aj.delta)),
        progress: int(row.progress), labels: asArr<unknown>(row.labels).map(String),
        mostrado: int(row.score), dl, quieta: q, razon: aj.razon, manual, recurrente,
      };
    });
    const filas = sinRecurrentes(abiertas);
    // Se CUENTAN, no sólo se saltean: una exclusión que funciona y una que nadie disparó se
    // ven exactamente iguales en el log si no hay un número al lado.
    const repetidas = soloRecurrentes(abiertas).length;
    // ⚠️ EL UMBRAL DE `curveTaskScores` (n < 20) SE MIDE SOBRE LAS QUE COMPITEN, A PROPÓSITO.
    // Es el `n` honesto: si un tablero tiene 25 abiertas y 8 se repiten, las que se reparten
    // son 17 y forzarles una pirámide de cuatro bandas es destruir el único juicio que hay
    // (la autopsia del umbral está en `curveTaskScores`, app/plan/board/types.ts). Medirlo
    // sobre el total daría una pirámide repartida entre menos tarjetas de las que la
    // justifican — el reparto tiene que depender de cuánto hay que repartir.
    if (filas.length < 20) return { movidas: 0, total: filas.length, conDeadline: 0, quietas: 0, frenadas: 0, fijadas: 0, repetidas };

    // El ORDEN lo fija el grafo de dependencias sobre los scores ya ajustados por tiempo, y
    // `curveTaskScores` solo reparte los números sobre ese orden. Importa que sea en este
    // orden: la urgencia heredada tiene que mirar la prioridad REAL de hoy, no la de antes
    // de que se venciera un deadline.
    // `abiertas` y no `filas`: el grafo tiene que VER las recurrentes para saber que un
    // proyecto está vivo, y quien no compite lo decide él (`est.orden` ya viene sin ellas).
    const est = resolverDeps({ tareas: abiertas, deps });
    const curva = curveTaskScores(est.orden.map((t) => ({ id: t.id, score: est.urgencia[t.id] ?? t.score })));
    const cambian = filas.filter((t) => !t.manual && curva[t.id] != null && curva[t.id] !== t.mostrado);
    // De a tandas: 550 updates sueltos en paralelo saturan el pool de conexiones.
    const TANDA = 40;
    for (let i = 0; i < cambian.length; i += TANDA) {
      await Promise.all(cambian.slice(i, i + TANDA).map((t) =>
        db.from('plan_tareas').update({ score: curva[t.id], priority: prioFromScore(curva[t.id]) }).eq('id', t.id).then(() => undefined),
      ));
    }
    // Sin historial por tarjeta a propósito: son 500 entradas que dicen todas lo mismo y
    // taparían el rastro que sí importa (quién la movió y por qué). El reparto no cambia
    // el orden, así que no hay ninguna decisión nueva que auditar.
    const conDeadline = filas.filter((t) => empujeDeadline(t.dl) > 0).length;
    const quietas = filas.filter((t) => castigoQuietud(t.quieta) > 0).length;
    const frenadas = filas.filter((t) => estaBloqueada(t.id, est)).length;
    const fijadas = filas.filter((t) => t.manual).length;
    if (cambian.length || fijadas || repetidas) console.log(`[plan-board] recurvar: ${cambian.length}/${filas.length} movidas · ${conDeadline} por fecha · ${quietas} por quietud · ${frenadas} frenadas · ${fijadas} fijadas a mano (intactas) · ${repetidas} que se repiten (fuera del reparto)`);
    return { movidas: cambian.length, total: filas.length, conDeadline, quietas, frenadas, fijadas, repetidas };
  });
}

// ⛔ ACÁ VIVÍA `recurvarProyectosOwner`, y se BORRÓ junto con `scoreProyectoDerivado`
// (app/plan/board/types.ts, donde está la autopsia completa). Derivaba el score de un
// proyecto de sus tareas con `max + densidad`, o sea reemplazaba el juicio del Perro por una
// cuenta — exactamente lo que la metodología del Perro prohíbe en tres reglas distintas.
//
// Lo que TIENE que ir en su lugar: una corrida del Perro que JUZGUE los proyectos con
// GUARDIAN_SYSTEM_TEMPLATE (la escalera del dinero, la fase del negocio, la pirámide) y
// escriba una razón que COMPARE contra otro proyecto nombrado. Mientras eso no exista, los
// proyectos conservan el último score que les puso el Perro: quedarse quieto es peor que
// estar al día, pero es infinitamente mejor que escribir un número inventado todos los días.

export async function priorizarNuevasOwner(ids: string[], proyectoIds: string[] = [], contexto = ''): Promise<GuardResult | null> {
  return enPlan(async () => {
    if (!ids.length && !proyectoIds.length) return null;
    // EL NORTE DEL NEGOCIO va SIEMPRE adelante del contexto. Sin esto el Perro puntúa
    // (y ahora también fecha) mirando solo el resto del tablero, que es una referencia
    // circular: ordena bien entre sí cosas que quizá no son de esta fase. El
    // diagnóstico dice cuál es el cuello de hoy y qué lo destraba — es lo que distingue
    // "importante" de "importante AHORA".
    // Y con el norte va EL OBJETIVO DEL TRIMESTRE. La fase dice en qué etapa está
    // el negocio; el objetivo dice a qué se comprometió ESTOS 90 días y cuánto le
    // falta. Sin eso el Perro puede poner arriba algo importante que no mueve la
    // aguja de lo que hay que cumplir ahora. La capacidad entra por el mismo lado:
    // una tarea de conseguir más clientes con el cupo lleno no es prioritaria, es
    // contraproducente.
    const [norte, objetivos] = await Promise.all([
      faseNegocioTexto().catch(() => ''),
      objetivosContextoTexto().catch(() => ''),
    ]);
    const brief = [norte, objetivos, contexto.trim()].filter(Boolean).join('\n\n');
    const db = await getTenantDb();
    const idSet = new Set(ids);
    const projSet = new Set(proyectoIds);
    const [tRes, pRes] = await Promise.all([
      // `recurrente` va en la lista: este `select` enumera columnas y lo que no se nombra
      // no llega — abajo decide quién se puntúa y quién es la vara contra la que se puntúa.
      db.from('plan_tareas').select('id, title, detalle, score, score_manual, progress, labels, historial, deadline, recurrente'),
      db.from('plan_proyectos').select('id, name, score'),
    ]);
    const filasT = (tRes.data ?? []) as Array<{ id: string; title: string; detalle: string; score: number; score_manual: boolean; progress: number; labels: unknown; historial: unknown; deadline: string | null; recurrente: boolean }>;
    const filasP = (pRes.data ?? []) as Array<{ id: string; name: string; score: number }>;
    const nombreProy = new Map(filasP.map((p) => [p.id, str(p.name)]));

    // `proyecto` va con el NOMBRE (el Perro tiene que poder razonar "esto es del
    // Objetivo Principal"; con el id leía "p1m2x3k"). El id queda aparte para agrupar.
    const nuevas = filasT.filter((r) => idSet.has(r.id)).map((r) => {
      const pid = asArr<unknown>(r.labels).map(String)[0] ?? undefined;
      return {
        id: r.id, titulo: str(r.title, 'Tarea'), detalle: str(r.detalle), proyectoId: pid,
        proyecto: pid ? (nombreProy.get(pid) ?? pid) : undefined,
        deadline: str(r.deadline), historial: sanearHist(r.historial),
        // Si la persona le puso el número al crearla, ESE manda: el Perro le escribe la
        // descripción igual, pero no le toca la prioridad (mig 0143).
        scoreManual: !!r.score_manual,
        // Misma idea, otra razón: a una recurrente el Perro le escribe la descripción y la
        // rutea a su proyecto, pero no le pone número ni fecha (mig 0163).
        recurrente: !!r.recurrente,
      };
    });
    /**
     * ⚠️ LAS QUE SE REPITEN SALEN POR LAS DOS PUNTAS, y las dos importan.
     *
     * · No se PUNTÚAN: `puntuarNuevas` devuelve un score 1-100 y una fecha, y las dos cosas
     *   son mentiras sobre algo sin fin. Además cuestan tokens por una respuesta que no se
     *   va a escribir.
     * · No son la VARA: si entran en `existentes`, siguen definiendo la pirámide contra la
     *   que se mide todo lo demás — el Perro compara lo nuevo contra «[85] Reunión de los
     *   miércoles» y ancla el tablero entero a un número que no significa nada.
     *
     * Lo que SÍ conservan es el ruteo a proyecto y la descripción: rutear no es puntuar
     * (una recurrente igual pertenece a un cliente o a un proyecto), y una tarjeta sin
     * detalle es igual de inútil se repita o no.
     */
    const paraPuntuar = sinRecurrentes(nuevas);
    const existentesT = sinRecurrentes(filasT.filter((r) => !idSet.has(r.id) && int(r.progress) < 100)).map((r) => ({ titulo: str(r.title), score: int(r.score), deadline: str(r.deadline) }));
    const proyNuevos = filasP.filter((p) => projSet.has(p.id)).map((p) => ({ id: p.id, nombre: str(p.name, 'Proyecto') }));
    const existentesP = filasP.filter((p) => !projSet.has(p.id)).map((p) => ({ nombre: str(p.name), score: int(p.score) }));
    const tareasPorProy = proyNuevos.map((p) => {
      const titulos = nuevas.filter((n) => n.proyectoId === p.id).map((n) => n.titulo);
      return `[${p.id}] ${p.nombre}: ${titulos.join('; ') || '(sin tareas)'}`;
    }).join('\n');

    // ⚠️ LAS QUE NACEN SIN PROYECTO SE RUTEAN ACÁ, y es la MISMA función que usa la carga
    // de una reunión (`asignarTareasAProyectos`): «es mejor que MaKo - Perro guardián le
    // asigne la prioridad y el proyecto correspondiente y le escriba la descripción, si eso
    // ya se hace hoy en día… reutilizar la lógica» (23/09/2026). Hasta hoy el alta manual
    // era el ÚNICO camino que no ruteaba: la tarea quedaba «sin proyecto» para siempre, o
    // se le pedía a la persona que eligiera de una lista de 70 antes de escribir el título.
    //
    // La lista de destinos es CERRADA (el catálogo + lo que ya existe): es lo que impide
    // que el Perro abra un proyecto con el nombre que se le ocurra. Acá NO puede crear
    // ninguno — para eso está el alta de proyecto, que es una decisión.
    const sinProyecto = nuevas.filter((n) => !n.proyectoId);
    const destinos = sinProyecto.length
      ? (() => {
          const cuentaPorProy = new Map<string, number>();
          for (const r of filasT) for (const l of asArr<unknown>(r.labels).map(String)) cuentaPorProy.set(l, (cuentaPorProy.get(l) ?? 0) + 1);
          const yaEnTablero = new Set(filasP.map((p) => nucleo(str(p.name))));
          return [
            ...filasP.map((p) => ({ nombre: str(p.name), que: delCatalogo(str(p.name))?.que || '', n: cuentaPorProy.get(p.id) ?? 0 })),
            ...CATALOGO_PROYECTOS.filter((c) => !yaEnTablero.has(nucleo(c.nombre))).map((c) => ({ nombre: c.nombre, que: c.que })),
          ];
        })()
      : [];

    // 4 llamadas al Perro en paralelo (score tareas · checklists · proyectos · ruteo). Gemini gratis.
    const [scoreRes, checklistRes, proyRes, ruteoRes] = await Promise.all([
      paraPuntuar.length ? puntuarNuevas(paraPuntuar, existentesT, brief, 'Priorización de tareas nuevas', { conCapacidades: false }) : Promise.resolve({ tareas: [] as { id: string; score: number; razon: string; impacto?: number; esfuerzo?: number; deadline?: string; deadlineRazon?: string; haceloEn?: string }[], faltantes: [] as string[] }),
      nuevas.length ? checklistsParaTareas(nuevas.map((n) => ({ id: n.id, titulo: n.titulo, detalle: n.detalle })), contexto, 'Descripción + checklists de tareas nuevas') : Promise.resolve({} as Record<string, { detalle: string; items: string[] }>),
      proyNuevos.length ? describirProyectosNuevos(proyNuevos, existentesP, tareasPorProy, brief, 'Proyectos nuevos: emoji + detalle + score') : Promise.resolve({ proyectos: [] as { id: string; score: number; emoji: string; detalle: string; razon: string; impacto?: number; esfuerzo?: number }[] }),
      sinProyecto.length && destinos.length
        ? asignarTareasAProyectos(sinProyecto.map((n) => ({ titulo: n.titulo, detalle: n.detalle })), destinos, 'Rutear una tarea nueva a su proyecto')
          .catch((e) => { console.error('[plan-board] rutear alta:', e instanceof Error ? e.message : String(e)); return { asign: [] as Array<{ i: number; destino: string }> }; })
        : Promise.resolve({ asign: [] as Array<{ i: number; destino: string }> }),
    ]);

    // De vuelta a ids. Sólo lo que resuelve a un proyecto QUE EXISTE: un nombre que no
    // matchea no abre nada —ese es el bug de los 24 proyectos inventados— y la tarea se
    // queda sin proyecto, que es un estado honesto y visible.
    const porNombre = new Map(filasP.map((p) => [nucleo(str(p.name)), p.id]));
    const ruteado = new Map<string, string>();
    for (const a of (ruteoRes.asign ?? [])) {
      const n = sinProyecto[a.i];
      const pid = n ? porNombre.get(nucleo(str(a.destino))) : undefined;
      if (n && pid) ruteado.set(n.id, pid);
    }

    const cuenta: Record<Prio, number> = { alta: 0, media: 0, baja: 0, futuro: 0 };
    const byId = new Map(scoreRes.tareas.map((t) => [t.id, t]));
    const ahora = Date.now();
    // Lo que el Perro dejó escrito, para DEVOLVERLO. Sin esto el board del navegador
    // sigue con el estado viejo y el próximo saveTask (upsert de la fila entera) borra
    // score, razón, detalle y checklist recién puestos.
    const patches: GuardPatch[] = [];
    await Promise.all(nuevas.map((n) => {
      const g = byId.get(n.id);
      const enr = checklistRes[n.id];
      const patch: Row = { updated_at: new Date().toISOString() };
      const out: GuardPatch = { id: n.id };
      // `esRecurrente` es la SEGUNDA capa: arriba ya no se le pidió score al modelo, pero
      // un id que vuelve de un JSON no es un dato hasta que el código lo comprueba — y lo
      // que se escribiría acá es justo lo que la 0163 vino a que no exista (un número de
      // ranking y una fecha de vencimiento sobre algo que no termina nunca).
      if (g && !n.scoreManual && !esRecurrente(n)) {
        const prio = prioFromScore(g.score);
        cuenta[prio]++;
        // `score_base` es EL JUICIO del Perro (mig 0141). `score` se pisa después en el
        // reparto; la base no la toca nadie más.
        patch.score = g.score; patch.score_base = g.score; patch.score_razon = g.razon || null; patch.impacto = g.impacto ?? null; patch.esfuerzo = g.esfuerzo ?? null; patch.priority = prio;
        Object.assign(out, { score: g.score, scoreRazon: g.razon || '', impacto: g.impacto, esfuerzo: g.esfuerzo, priority: prio });
        // LA FECHA la pone el Perro, pero NUNCA pisa una que ya esté: si la tarea vino
        // con deadline (lo dijo la reunión, lo puso el dueño), esa manda. Una prioridad
        // sin fecha es una intención — por eso la propone él y no se espera a que
        // alguien la complete a mano.
        if (g.haceloEn) { patch.hacelo_en = g.haceloEn; Object.assign(out, { haceloEn: g.haceloEn }); }
        if (g.deadline && !n.deadline) {
          patch.deadline = g.deadline; patch.deadline_razon = g.deadlineRazon || null;
          Object.assign(out, { deadline: g.deadline, deadlineRazon: g.deadlineRazon || '' });
        }
      }
      // LO QUE DIJO EL DUEÑO NO SE PISA. Antes esto era `patch.detalle = enr.detalle`: el
      // Perro veía 220 caracteres del audio, escribía 2-4 frases prolijas y REEMPLAZABA el
      // contexto entero. El dueño mandaba tres minutos de audio y en la tarjeta le quedaba
      // un párrafo genérico. Ahora el texto original manda; la versión del Perro solo entra
      // si no había nada, y si la escribió sin absorber lo que ya estaba, se suma abajo.
      //
      // ⚠️ PERO SI EL DETALLE YA VIENE CON EL MOLDE, EL COACH NO ESCRIBE NADA.
      //
      // Medido el 11/8: 37 de 73 tarjetas nuevas tenían el molde escrito DOS VECES, y el
      // 85% de las del último día. La causa es la combinación de dos cosas razonables por
      // separado: el trabajo del coach es REESCRIBIR el detalle, así que su texto nunca
      // conserva el arranque del original — y `fusionarDetalle`, al no reconocerlo, hace
      // lo único que le queda: concatenar.
      //
      // Y no alcanzaba con pisar: el bloque del coach PIERDE contenido. En #669 el
      // original decía «limitar el desarrollo a un porcentaje del Cloud de Mauricio» y su
      // versión decía «en la cuenta de Claude de Mauricio» — lo contrario de lo acordado.
      // Pisar traía de vuelta el bug viejo; concatenar deja la tarjeta diciendo las dos
      // cosas. La salida es no elegir entre dos textos malos: si el detalle que ya está
      // cumple el contrato, está bien y no hay nada que optimizar. Del coach se toman solo
      // los PASOS, que es lo que de verdad agrega.
      //
      // ⚠️ Y esos pasos YA NO SON UNA CHECKLIST: van como viñetas adentro del detalle
      // (`pasosComoBullets`). Las checklists se sacaron del producto el 22/09/2026 —«que
      // no existan checklists… de última un bullet point»— y con ellas el % por tarea.
      const proyRuteado = ruteado.get(n.id);
      if (proyRuteado) { patch.labels = [proyRuteado]; out.labels = [proyRuteado]; }
      const yaTieneMolde = evaluarDetalle(n.detalle ?? '').conForma;
      const base = yaTieneMolde ? (n.detalle ?? '') : fusionarDetalle(n.detalle, enr?.detalle ?? '');
      const detalleFinal = pasosComoBullets(base, enr?.items ?? []);
      if (detalleFinal && detalleFinal !== n.detalle) { patch.detalle = detalleFinal; out.detalle = detalleFinal; }
      if (Object.keys(patch).length <= 1) return Promise.resolve(undefined); // solo updated_at
      // RASTRO: toda pasada de la IA por una tarjeta queda en el historial (regla del
      // dueño). Antes el Perro puntuaba en silencio y la tarjeta no decía quién la movió.
      // El historial dice lo que PASÓ, no lo que el modelo contestó: si la prioridad la
      // fijó la persona, el Perro no la movió y la entrada no puede decir que sí.
      // El historial dice lo que PASÓ, no lo que el modelo contestó. Para una recurrente
      // «MaKo la priorizó» sería falso de la forma más cara: afirmaría que tiene un puesto.
      const texto = g && !n.scoreManual && !esRecurrente(n)
        ? `MaKo la priorizó — score ${g.score} (${g.razon || 'sin razón'})`.slice(0, 220)
        : 'MaKo le escribió la descripción';
      const entrada: Hist = { id: genId('h'), ts: ahora, actor: 'ia', text: texto };
      patch.historial = [entrada, ...n.historial].slice(0, 40);
      out.historialEntry = entrada;
      patches.push(out);
      return db.from('plan_tareas').update(patch).eq('id', n.id).then(() => undefined);
    }));

    const proyectosPatch: GuardProjPatch[] = proyRes.proyectos.map((p) => ({
      id: p.id, score: p.score, scoreRazon: p.razon || '', impacto: p.impacto, esfuerzo: p.esfuerzo,
      emoji: p.emoji || '📁', detalle: p.detalle || '',
    }));
    await Promise.all(proyectosPatch.map((p) =>
      db.from('plan_proyectos').update({ score: p.score, score_razon: p.scoreRazon || null, impacto: p.impacto ?? null, esfuerzo: p.esfuerzo ?? null, emoji: p.emoji, detalle: p.detalle, updated_at: new Date().toISOString() }).eq('id', p.id).then(() => undefined),
    ));

    // Y RECIÉN AHÍ, el reparto: lo nuevo ya está ubicado, así que la pirámide se rehace
    // sobre el tablero completo. Es la mitad que faltaba — el Perro ubicaba lo nuevo y
    // nadie volvía a mirar lo viejo.
    const recurva = await recurvarPlanOwner().catch((e) => { console.error('[plan-board] recurvar:', e instanceof Error ? e.message : String(e)); return { movidas: 0, total: 0 }; });
    // Y el Perro vuelve a JUZGAR los proyectos, no solo los que acaban de nacer: entró
    // trabajo nuevo, así que la comparación ENTRE proyectos cambió. Esto es lo que no
    // existía —un proyecto se puntuaba el día que se creaba y nadie lo volvía a mirar
    // nunca—, y por eso el ranking que el dueño veía era el de aquel día.
    await priorizarProyectosOwner('Entraron tareas nuevas al plan')
      .catch((e) => console.error('[plan-board] priorizar proyectos:', e instanceof Error ? e.message : String(e)));

    return { tareas: cuenta, proyectos: proyectosPatch.length, patches, proyectosPatch, sinPuntuar: scoreRes.faltantes.length, recurvadas: recurva.movidas };
  });
}

/** BULK: sube/actualiza todo de una (para la MIGRACIÓN desde localStorage). */
export async function guardarPlanBulk(tareas: BoardTask[], proyectos: Label[]): Promise<{ tareas: number; proyectos: number }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    if (proyectos.length) {
      const { error } = await db.from('plan_proyectos').upsert(proyectos.map((l, i) => labelToRow(l, i)), { onConflict: 'workspace_id,id' });
      if (error) throw new Error(`guardarPlanBulk proyectos: ${error.message}`);
    }
    if (tareas.length) {
      const { error } = await db.from('plan_tareas').upsert(tareas.map(taskToRow), { onConflict: 'workspace_id,id' });
      if (error) throw new Error(`guardarPlanBulk tareas: ${error.message}`);
    }
    return { tareas: tareas.length, proyectos: proyectos.length };
  });
}

/**
 * EL PERRO JUZGA TODOS LOS PROYECTOS. Es lo que reemplaza a la fórmula que se revirtió.
 *
 * Lo que cambia respecto de lo que había, y es todo lo que importa:
 *
 * 1. **Se juzgan los que YA EXISTEN, no solo los nuevos.** Antes un proyecto se puntuaba el
 *    día que nacía y nadie lo volvía a mirar: el negocio cambiaba de fase, entraban clientes,
 *    se terminaba media hoja de ruta, y el ranking seguía siendo el de aquel día.
 * 2. **El modelo recibe con qué juzgar.** Antes veía `{ id, nombre }` — dos palabras. Ahora
 *    le llega el resumen de qué es y qué le falta, cuánto trabajo abierto tiene, una muestra
 *    PAREJA de sus tareas (no el top: el top hace pensar en el máximo, que es justo el error
 *    anterior) y su score actual para la regla de estabilidad.
 * 3. **Con la metodología COMPLETA.** El prompt viejo de proyectos no tenía la escalera del
 *    dinero, ni impacto/esfuerzo en días, ni la regla de lo roto frente a un cliente, ni el
 *    formato obligatorio de la razón. Ahora las interpola de `lib/mako-guardian.ts`, que es
 *    la única copia.
 * 4. **Y la salida se AUDITA antes de escribirse** (`auditarSalidaDelPerro`): empates, rango
 *    amontonado, razones que no comparan, y la correlación con el tamaño. Si rompe una regla
 *    dura, se le dice qué rompió y se reintenta una vez.
 *
 * ⚠️ El desempate es `desempatar`, NO `spreadProjScores`. Aquel reparte 100/99/97/96… y con
 * eso el número guardado deja de ser el juicio y pasa a ser la posición en el ranking — la
 * razón diría «95» y la pantalla mostraría otra cosa. Ver el comentario de `desempatar`.
 */
export async function priorizarProyectosOwner(motivo?: string): Promise<{
  movidos: number; total: number; norte: string; repetidos?: number; fallas?: string; error?: string;
}> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const [tRes, pRes] = await Promise.all([
      // `recurrente` va en la lista (este `select` enumera columnas): sin él, el Perro
      // juzga un proyecto por trabajo que nunca se cierra.
      db.from('plan_tareas').select('title, progress, score, labels, recurrente'),
      // Y acá lo MISMO un nivel más arriba (mig 0164): sin la columna, el proyecto que se
      // repite entra al ranking y `esRecurrente` contesta false para todos.
      db.from('plan_proyectos').select('id, name, detalle, score, historial, score_manual, recurrente'),
    ]);
    const todosLosProyectos = (pRes.data ?? []).map((r) => ({
      id: str((r as Row).id), name: str((r as Row).name, 'Proyecto'),
      detalle: str((r as Row).detalle), score: int((r as Row).score),
      historial: sanearHist((r as Row).historial),
      manual: !!(r as Row).score_manual,
      recurrente: !!(r as Row).recurrente,
    }));
    /**
     * ⚠️ EL RANKING ES SÓLO DE LO QUE TERMINA (mig 0164), Y ES LA RAZÓN DE SER DE LA MARCA.
     *
     * Esta lista ordena por «qué mueve la aguja PRIMERO», o sea por qué conviene terminar
     * antes. Un proyecto que se repite para siempre no tiene un «antes»: no se puede
     * adelantar ni atrasar, y el número que se le ponga no significa nada. Dejarlo adentro
     * cuesta tres cosas medibles, no una:
     *
     *  1. `desempatar` reparte una escalera CONTIGUA (100..2 sin huecos): cada recurrente
     *     adentro se lleva un escalón y empuja un escalón para abajo a todo lo que sí tiene
     *     un fin — o sea, cambia el orden de lo que compite sin que nadie lo haya decidido.
     *  2. El «norte» sale del más alto de esta lista. Un Customer Success arriba de todo
     *     convierte el objetivo principal del tablero en una rutina.
     *  3. `noRankeaPorTamano` (app/plan/board/metodologia.ts) audita la correlación con el
     *     tamaño, y un contenedor de puras recurrentes es el más grande y el más quieto.
     *
     * NO ARRASTRA A SUS TAREAS: sus tareas con fin siguen compitiendo por su cuenta en
     * `recurvarPlanOwner` y en `priorizarNuevasOwner`, y es lo correcto — «armar el
     * documento de onboarding de Vertice» se cierra una sola vez viva donde viva. El corte
     * es del CONTENEDOR.
     *
     * Su score viejo NO se toca ni se pone en cero: ponerle 0 lo mandaría al fondo del
     * tablero como si estuviera abandonado, que es la mentira simétrica. Se lo deja donde
     * está y se lo saca de la competencia; quién lo pinta y dónde es problema de la
     * pantalla, no de esta función.
     */
    const proyectos = sinRecurrentes(todosLosProyectos);
    const repetidos = todosLosProyectos.length - proyectos.length;
    if (proyectos.length < 2) return { movidos: 0, total: proyectos.length, norte: '', repetidos };

    const tareas = (tRes.data ?? []).map((r) => ({
      titulo: str((r as Row).title), progress: int((r as Row).progress),
      score: int((r as Row).score), labels: asArr<unknown>((r as Row).labels).map(String),
      recurrente: !!(r as Row).recurrente,
    }));

    const payload: ProyParaPuntuar[] = proyectos.map((p) => {
      const suyas = tareas.filter((t) => t.labels.includes(p.id));
      /**
       * ⚠️ `abiertas` CUENTA LO QUE SE PUEDE TERMINAR, y `repetidas` va aparte.
       *
       * Si las recurrentes se suman a `abiertas`, el Perro juzga el proyecto por trabajo
       * que nunca se cierra: un cliente que se atiende todas las semanas se ve «con 12
       * tareas abiertas» para siempre y el tamaño lo empuja hacia arriba — que es
       * exactamente lo que `noRankeaPorTamano` (app/plan/board/metodologia.ts) audita, y
       * que lee `nTareas` de ESTE campo.
       *
       * Pero restarlas y callarlas es la otra mitad del error: el proyecto de puras
       * recurrentes le llegaría al modelo como `abiertas: 0, hechas: 0, tareas: []`, o sea
       * indistinguible de uno abandonado, y lo mandaría al fondo del ranking. Por eso el
       * conteo viaja adentro del `resumen`, que es texto que el modelo ya lee y entiende
       * sin que haya que enseñarle un campo nuevo.
       */
      const abiertas = sinRecurrentes(suyas).filter((t) => t.progress < 100);
      const repetidas = soloRecurrentes(suyas).length;
      // MUESTRA PAREJA, no el top. Mandar las 5 mejores le enseña al modelo a mirar el
      // máximo — que es exactamente el sesgo que produjo el bug anterior. Salteado sobre el
      // orden por score, ve de qué se trata el proyecto de punta a punta.
      const orden = abiertas.slice().sort((a, b) => b.score - a.score);
      const paso = Math.max(1, Math.ceil(orden.length / 5));
      return {
        id: p.id, nombre: p.name,
        resumen: resumenDeProyecto(p.detalle, repetidas),
        // `hechas` sale de `suyas` SIN las recurrentes: contarlas como hechas es la otra
        // mentira posible («este cliente ya está atendido del todo»), y una recurrente no
        // está ni hecha ni pendiente — está en marcha.
        abiertas: abiertas.length, hechas: sinRecurrentes(suyas).length - abiertas.length,
        tareas: orden.filter((_, i) => i % paso === 0).slice(0, 5).map((t) => t.titulo.slice(0, 120)),
        scoreActual: p.score || undefined,
        // Un score que el dueño le ganó al Perro discutiendo NO es un score cualquiera. Sin
        // esta marca, la corrida de mañana lo pisa sin saber que estaba pisando una decisión
        // — y la regla de ESTABILIDAD del prompt es prosa, que ya sabemos cuánto vale sola.
        ...(p.manual ? { loDecidioElDueno: true as const } : {}),
      };
    });

    // El norte del negocio primero: sin eso el Perro ordena mirando solo el tablero, que es
    // una referencia circular. El diagnóstico dice cuál es el cuello de HOY, y es lo que
    // distingue «importante» de «importante AHORA».
    // Mismo par que en `priorizarNuevasOwner`: la fase (en qué etapa está) y el
    // objetivo del Q (a qué se comprometió). Van juntos, o el Perro ordena bien
    // entre sí cosas que no mueven lo que hay que cumplir este trimestre.
    const [norteP, objetivosP] = await Promise.all([
      faseNegocioTexto().catch(() => ''),
      objetivosContextoTexto().catch(() => ''),
    ]);
    const contexto = [norteP, objetivosP].filter(Boolean).join('\n\n');
    const rawR = await puntuarProyectos(payload, contexto, motivo || 'Priorizar los proyectos del plan');
    // ⚠️ LO QUE VUELVE DEL MODELO SE FILTRA CONTRA LO QUE SE LE MANDÓ. Al payload sólo
    // entraron los que compiten, así que un id que no esté en `proyectos` es un id
    // inventado o el de un recurrente que el modelo arrastró de una corrida anterior — y
    // abajo se ESCRIBE por id. Sin esta línea, el guard de arriba se aplica al prompt y no
    // a la escritura, que es la mitad que importa.
    const r = { ...rawR, proyectos: rawR.proyectos.filter((p) => proyectos.some((x) => x.id === p.id)) };
    if (r.error || !r.proyectos.length) {
      return { movidos: 0, total: proyectos.length, norte: '', repetidos, error: r.error ?? 'El Perro no devolvió nada.' };
    }

    // ⚠️ EL DESEMPATE VA CONTRA TODOS LOS PROYECTOS QUE COMPITEN, no solo contra los que el
    // Perro devolvió. Si el modelo puntúa 66 de 71, los otros 5 conservan su score viejo — y
    // un score nuevo puede caer justo encima de uno de esos. Medido en la primera corrida:
    // 5 empates que `desempatar` no veía porque no estaban en la lista. Los recurrentes NO
    // entran: su score no es un puesto, así que un «empate» contra ellos no es un empate.
    const sinTocar = proyectos.filter((p) => !r.proyectos.some((x) => x.id === p.id));
    const limpio = desempatar([
      ...r.proyectos.map((p) => ({ id: p.id, titulo: '', score: p.score })),
      ...sinTocar.map((p) => ({ id: p.id, titulo: '', score: p.score })),
    ]);
    const ahora = new Date().toISOString();
    const cambian = r.proyectos.filter((p) => (limpio[p.id] ?? p.score) !== (proyectos.find((x) => x.id === p.id)?.score ?? -1));

    const TANDA = 20;
    for (let i = 0; i < r.proyectos.length; i += TANDA) {
      await Promise.all(r.proyectos.slice(i, i + TANDA).map((p) => {
        const antes = proyectos.find((x) => x.id === p.id);
        // ⛔ EL CANDADO: si el dueño fijó ese número discutiéndolo, el Perro puede PROPONER
        // moverlo —queda en la razón, que él lee— pero no lo escribe. Es «un canal PROPONE,
        // una persona confirma» aplicado al número que gobierna la pantalla entera.
        const score = antes?.manual ? antes.score : (limpio[p.id] ?? p.score);
        const razon = antes?.manual && p.score !== antes.score
          ? `Lo fijaste tú en ${antes.score}. MaKo lo pondría en ${p.score}: ${p.razon}`
          : p.razon;
        // Historial SOLO cuando el número se movió, y con la razón adentro: es lo único que
        // hace auditable un ranking que decidió una IA, y la regla de la casa dice que todo
        // lo que toca la IA deja rastro. 71 entradas idénticas diciendo «no cambió» taparían
        // justo el rastro que sirve.
        const hist = antes && antes.score !== score
          ? [{ id: genId('h'), ts: Date.now(), actor: 'ia' as Actor, text: `MaKo lo repriorizó — ${antes.score} → ${score} · ${p.razon.slice(0, 200)}` }, ...antes.historial].slice(0, 40)
          : antes?.historial;
        return db.from('plan_proyectos').update({
          score, score_razon: razon || null, impacto: p.impacto ?? null, esfuerzo: p.esfuerzo ?? null,
          escalon: p.escalon ?? null, desbloquea: p.desbloquea ?? null,
          historial: hist, updated_at: ahora,
        }).eq('id', p.id).then(() => undefined);
      }));
    }

    // Y si el desempate movió a uno que el Perro NO tocó, ese también se escribe: si no, el
    // empate que se acaba de resolver en memoria sigue vivo en la base.
    await Promise.all(sinTocar.filter((p) => !p.manual && (limpio[p.id] ?? p.score) !== p.score).map((p) =>
      db.from('plan_proyectos').update({ score: limpio[p.id], updated_at: ahora }).eq('id', p.id).then(() => undefined)));

    const norteId = Object.entries(limpio).sort((a, b) => b[1] - a[1])[0]?.[0];
    const nombreNorte = proyectos.find((x) => x.id === norteId)?.name ?? '';
    // `repetidos` se LOGEA, no se calla: un guard que funciona y uno que nadie disparó se
    // ven iguales si no se cuentan — la misma razón por la que `recurvarPlanOwner` cuenta
    // las `fijadas` que respetó.
    console.log(`[plan-board] proyectos priorizados: ${cambian.length}/${proyectos.length} movidos · norte → «${nombreNorte}»${repetidos ? ` · ${repetidos} fuera del ranking porque se repiten` : ''}${r.fallas ? `\n${r.fallas}` : ''}`);
    return { movidos: cambian.length, total: proyectos.length, norte: nombreNorte, repetidos, fallas: r.fallas };
  });
}

/**
 * De qué se trata un proyecto, en 400 caracteres.
 *
 * Se queda con «Qué falta» y «Por qué importa» del molde, que son las dos partes que dicen
 * si esto mueve la aguja HOY. «Qué es» y «Qué ya está» describen el pasado y ocupan lugar.
 * Si el detalle no tiene el molde (los «Cliente: NOMBRE» no lo tienen), va el arranque
 * crudo: es mejor que nada, y nada es lo que el modelo tenía antes.
 */
/**
 * @param repetidas cuántas de sus tareas SE REPITEN para siempre (mig 0163).
 *
 * ⚠️ VA EN EL RESUMEN Y NO EN UN CAMPO NUEVO, a propósito. `abiertas` cuenta sólo lo que
 * tiene fin, así que sin esta línea un proyecto de puras recurrentes —el cliente al que se
 * le atiende todas las semanas— le llega al Perro como `abiertas: 0, hechas: 0` y se lee
 * igual que uno abandonado: lo mandaría al fondo del ranking justo por estar activo. Un
 * número suelto en el JSON el modelo lo tendría que adivinar; una frase la entiende.
 */
function resumenDeProyecto(detalle: string, repetidas = 0): string | undefined {
  const d = (detalle ?? '').trim();
  const repite = repetidas > 0
    ? `En marcha: ${repetidas} ${repetidas === 1 ? 'tarea que se repite' : 'tareas que se repiten'} para siempre (no tienen fin, no cuentan como trabajo abierto).`
    : '';
  if (!d) return repite || undefined;
  const partes: string[] = [];
  for (const titulo of ['Qué falta', 'Por qué importa']) {
    const re = new RegExp(`\\*\\*${titulo}\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`);
    const m = d.match(re);
    if (m?.[1]?.trim()) partes.push(`${titulo}: ${m[1].trim().replace(/\s+/g, ' ')}`);
  }
  const base = partes.join(' · ') || d.replace(/\s+/g, ' ');
  // El recorte se aplica al DETALLE, no al conjunto: si el resumen ya viene en el tope, lo
  // que se perdería es justo la línea nueva. Es el mismo error que `ampliarTareasPlanOwner`
  // pagó con el `slice` después de fusionar.
  return repite ? `${base.slice(0, 400 - repite.length - 3)} · ${repite}` : base.slice(0, 400);
}
