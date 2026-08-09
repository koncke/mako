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
import { scoreFromPrio, prioFromScore } from '@/app/plan/board/types';
import { puntuarNuevas, describirProyectosNuevos, asignarTareasAProyectos } from '@/lib/mako-guardian';
import { checklistsParaTareas } from '@/lib/checklist-coach';
import { CATALOGO_PROYECTOS, delCatalogo, canonNombre, nucleo } from '@/lib/plan-proyectos-catalogo';
import { faseNegocioTexto } from '@/lib/fase-store';

type Row = Record<string, unknown>;

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

// ── row ⇄ modelo ─────────────────────────────────────────────────────────────
function rowToTask(r: Row): BoardTask {
  return {
    id: str(r.id), num: int(r.num), emoji: str(r.emoji, '📌'), title: str(r.title, 'Tarea'),
    detalle: str(r.detalle), priority: str(r.priority, 'media') as Prio,
    score: int(r.score), scoreRazon: r.score_razon ? str(r.score_razon) : undefined,
    deadlineRazon: r.deadline_razon ? str(r.deadline_razon) : undefined, notas: str(r.notas),
    haceloEn: r.hacelo_en ? str(r.hacelo_en) : undefined,
    impacto: optInt(r.impacto), esfuerzo: optInt(r.esfuerzo),
    progress: int(r.progress), deadline: str(r.deadline),
    labels: asArr<unknown>(r.labels).map(String), checklist: asArr<Check>(r.checklist),
    historial: asArr<Hist>(r.historial), origen: str(r.origen, 'user') as Actor,
    fuente: optFuente(r.fuente), enPrioridad: !!r.en_prioridad,
  };
}
function taskToRow(t: BoardTask): Row {
  return {
    id: t.id, num: t.num, emoji: t.emoji || '📌', title: t.title || 'Tarea', detalle: t.detalle || '',
    priority: t.priority, score: int(t.score), score_razon: t.scoreRazon ?? null,
    deadline_razon: t.deadlineRazon ?? null, notas: t.notas ?? '', hacelo_en: t.haceloEn ?? null,
    impacto: t.impacto ?? null, esfuerzo: t.esfuerzo ?? null, progress: int(t.progress),
    deadline: t.deadline || '', labels: t.labels ?? [], checklist: t.checklist ?? [], historial: t.historial ?? [],
    origen: t.origen || 'user', fuente: t.fuente ?? null, en_prioridad: !!t.enPrioridad,
    orden: t.num, updated_at: new Date().toISOString(),
  };
}
function rowToLabel(r: Row): Label {
  return {
    id: str(r.id), pid: r.pid ? str(r.pid) : undefined, emoji: str(r.emoji, '📁'),
    name: str(r.name, 'Proyecto'), color: str(r.color, '#2F6FED'), score: int(r.score, 50),
    scoreRazon: r.score_razon ? str(r.score_razon) : undefined, impacto: optInt(r.impacto),
    esfuerzo: optInt(r.esfuerzo), deadline: r.deadline ? str(r.deadline) : undefined,
    detalle: str(r.detalle), notas: str(r.notas), historial: asArr<Hist>(r.historial), fuente: optFuente(r.fuente),
  };
}
function labelToRow(l: Label, orden = 0): Row {
  return {
    id: l.id, pid: l.pid ?? null, emoji: l.emoji || '📁', name: l.name || 'Proyecto', color: l.color || '#2F6FED',
    score: int(l.score, 50), score_razon: l.scoreRazon ?? null, impacto: l.impacto ?? null, esfuerzo: l.esfuerzo ?? null,
    deadline: l.deadline || '', detalle: l.detalle || '', notas: l.notas ?? '', historial: l.historial ?? [], fuente: l.fuente ?? null,
    orden, updated_at: new Date().toISOString(),
  };
}

// ── carga ────────────────────────────────────────────────────────────────────
export async function listPlanBoard(): Promise<{ tareas: BoardTask[]; proyectos: Label[] }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const [t, p] = await Promise.all([
      db.from('plan_tareas').select('*').order('orden', { ascending: true }).order('num', { ascending: true }),
      db.from('plan_proyectos').select('*').order('orden', { ascending: true }),
    ]);
    if (t.error) throw new Error(`listPlanBoard tareas: ${t.error.message}`);
    if (p.error) throw new Error(`listPlanBoard proyectos: ${p.error.message}`);
    return { tareas: (t.data ?? []).map(rowToTask), proyectos: (p.data ?? []).map(rowToLabel) };
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
  });
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
export async function guardarPlanProyecto(l: Label): Promise<void> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { error } = await db.from('plan_proyectos').upsert(labelToRow(l), { onConflict: 'workspace_id,id' });
    if (error) throw new Error(`guardarPlanProyecto: ${error.message}`);
  });
}
/** Borra el proyecto y lo saca del array `labels` de las tareas que lo tenían. */
export async function borrarPlanProyecto(id: string): Promise<void> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_tareas').select('id, labels').contains('labels', [id]);
    await Promise.all((data ?? []).map((r) => {
      const labels = asArr<unknown>((r as { labels: unknown }).labels).map(String).filter((x) => x !== id);
      return db.from('plan_tareas').update({ labels, updated_at: new Date().toISOString() }).eq('id', (r as { id: string }).id);
    }));
    const { error } = await db.from('plan_proyectos').delete().eq('id', id);
    if (error) throw new Error(`borrarPlanProyecto: ${error.message}`);
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
import { fusionarDetalle } from './detalle-fusion';
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

export type NuevaTareaPlan = { titulo: string; prioridad?: Prio; proyecto?: string; deadline?: string; detalle?: string; fuente?: Fuente };

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
    if (destinos.length) {
      const r = await asignarTareasAProyectos(
        // El DETALLE va: sin él el ruteador ve una lista de títulos sueltos y manda
        // «Diseñar el módulo de Diagnóstico» a Onboarding porque suena parecido.
        validos.map((it) => ({ titulo: it.titulo.trim(), grupo: it.proyecto?.trim(), detalle: it.detalle })),
        destinos,
        'Rutear tareas nuevas a proyectos',
      ).catch((e) => { console.error('[plan-board] asignarTareasAProyectos:', e instanceof Error ? e.message : String(e)); return { asign: [] as Array<{ i: number; destino: string }>, nuevos: [] as Array<{ nombre: string; que: string; porQue: string; tareas: number[] }> }; });
      for (const a of r.asign) ruteo[a.i] = a.destino;
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
    let siguientePid = maxPid(proyectos) + 1; // P# estable para cada proyecto nuevo
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
        nid = genId('p');
        byName.set(k, nid);
        // El historial dice de dónde salió el proyecto, y en el caso más delicado —el
        // que abrió el Perro— dice ADEMÁS por qué ninguno de los que había servía. Sin
        // ese renglón, un proyecto nuevo es una decisión que nadie puede discutir.
        const porQueNacio = cat ? `Creó el proyecto (está en el catálogo) — ${desde}`
          : delPerro ? `MaKo abrió este proyecto: ${delPerro.porQue} — ${desde}`
            : `Creó el proyecto — ${desde}`;
        nuevosProy.push({
          // El nombre que se GUARDA es el canónico del catálogo: si el modelo dijo
          // «CRM», el proyecto se llama «Feature: CRM». El prefijo no depende de que
          // el modelo se acuerde de escribirlo.
          id: nid, pid: `P${siguientePid++}`, emoji: cat?.emoji ?? (delPerro ? '🗂' : '📁'), name: canonNombre(nombre).slice(0, 120),
          color: '#2F6FED', score: 50, detalle: cat?.que ?? delPerro?.que ?? '', fuente: fu,
          historial: [{ id: genId('h'), ts: ahora, actor, text: porQueNacio.slice(0, 300) }],
        });
        if (!cat && !delPerro) console.warn(`[plan-board] proyecto FUERA del catálogo y sin justificar: «${nombre}» — ${desde}`);
      }
      return nid;
    });
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
      const texto = `MaKo ruteó ${tits.length} tarea${tits.length > 1 ? 's' : ''} acá (en vez de crear un proyecto nuevo): ${tits.map((t) => `«${t.slice(0, 40)}»`).join(', ')}`.slice(0, 300);
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
        detalle: it.detalle?.slice(0, 6000) ?? '', priority: prio, score: scoreFromPrio[prio], progress: 0,
        deadline: it.deadline || '', labels: projId ? [projId] : [], checklist: [],
        historial: [{ id: genId('h'), ts: ahora, actor, text: `Creó la tarjeta — ${desde}` }],
        origen: actor, fuente: it.fuente ?? fu, enPrioridad: false,
      };
    });
    const { error } = await db.from('plan_tareas').insert(tareas.map(taskToRow));
    if (error) throw new Error(`agregarTareasPlanOwner tareas: ${error.message}`);
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
 *   · `checklist` → se agregan solo los pasos que todavía no estaban;
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

    // Un paso de checklist no se repite: el mismo texto sin acentos ni signos ya está.
    const claveCheck = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

    const patches: GuardPatch[] = [];
    let n = 0;
    for (const it of validos) {
      const f = porId.get(it.id);
      if (!f) { console.warn(`[plan-board] ampliar: la tarea ${it.id} no existe`); continue; }
      const detalleFinal = fusionarDetalle(str(f.detalle), (it.detalle ?? '').trim());
      const checkPrevia = asArr<Check>(f.checklist);
      const vistas = new Set(checkPrevia.map((c) => claveCheck(c.text)));
      // Pasos nuevos: SOLO las líneas que el texto nuevo trae como viñeta. Si el
      // detalle es prosa (lo normal en una reunión), la checklist no se toca.
      const nuevosPasos = (it.detalle ?? '').split('\n')
        .filter((l) => /^\s*[-*·•]\s+\S/.test(l))
        .map((l) => l.replace(/^\s*[-*·•]\s+/, '').trim())
        .filter((l) => l.length > 6 && l.length < 160 && !vistas.has(claveCheck(l)))
        .filter((l, i, arr) => arr.findIndex((x) => claveCheck(x) === claveCheck(l)) === i);
      const checklist = nuevosPasos.length
        ? [...checkPrevia, ...nuevosPasos.map((text): Check => ({ id: genId('c'), text, done: false }))]
        : checkPrevia;

      if (detalleFinal === str(f.detalle) && checklist.length === checkPrevia.length) continue;
      const entrada: Hist = { id: genId('h'), ts: ahora, actor, text: `MaKo le sumó contexto (no la duplicó) — ${desde}`.slice(0, 220) };
      const historial = [entrada, ...asArr<Hist>(f.historial)].slice(0, 40);
      const { error } = await db.from('plan_tareas').update({
        detalle: detalleFinal.slice(0, 6000), checklist, historial, updated_at: new Date().toISOString(),
      }).eq('id', it.id);
      if (error) { console.error(`[plan-board] ampliar ${it.id}: ${error.message}`); continue; }
      n++;
      patches.push({ id: it.id, detalle: detalleFinal.slice(0, 6000), checklist, historialEntry: entrada });
    }
    return { n, patches };
  });
}

/** El Perro Guardián trabaja lo RECIÉN creado (server-side, no depende del navegador):
 *  (1) puntúa las tareas nuevas ubicándolas en la pirámide + les arma la checklist;
 *  (2) a los proyectos nuevos les pone emoji + descripción + score distinto (antes
 *  quedaban 📁/50/sin detalle). NO re-puntúa el resto. Devuelve el conteo por columna +
 *  cuántos proyectos trabajó (o null). Queda en el historial de IA (feature mako-guardian). */
export async function priorizarNuevasOwner(ids: string[], proyectoIds: string[] = [], contexto = ''): Promise<GuardResult | null> {
  return enPlan(async () => {
    if (!ids.length && !proyectoIds.length) return null;
    // EL NORTE DEL NEGOCIO va SIEMPRE adelante del contexto. Sin esto el Perro puntúa
    // (y ahora también fecha) mirando solo el resto del tablero, que es una referencia
    // circular: ordena bien entre sí cosas que quizá no son de esta fase. El
    // diagnóstico dice cuál es el cuello de hoy y qué lo destraba — es lo que distingue
    // "importante" de "importante AHORA".
    const norte = await faseNegocioTexto().catch(() => '');
    const brief = [norte, contexto.trim()].filter(Boolean).join('\n\n');
    const db = await getTenantDb();
    const idSet = new Set(ids);
    const projSet = new Set(proyectoIds);
    const [tRes, pRes] = await Promise.all([
      db.from('plan_tareas').select('id, title, detalle, score, progress, labels, historial, deadline'),
      db.from('plan_proyectos').select('id, name, score'),
    ]);
    const filasT = (tRes.data ?? []) as Array<{ id: string; title: string; detalle: string; score: number; progress: number; labels: unknown; historial: unknown; deadline: string | null }>;
    const filasP = (pRes.data ?? []) as Array<{ id: string; name: string; score: number }>;
    const nombreProy = new Map(filasP.map((p) => [p.id, str(p.name)]));

    // `proyecto` va con el NOMBRE (el Perro tiene que poder razonar "esto es del
    // Objetivo Principal"; con el id leía "p1m2x3k"). El id queda aparte para agrupar.
    const nuevas = filasT.filter((r) => idSet.has(r.id)).map((r) => {
      const pid = asArr<unknown>(r.labels).map(String)[0] ?? undefined;
      return {
        id: r.id, titulo: str(r.title, 'Tarea'), detalle: str(r.detalle), proyectoId: pid,
        proyecto: pid ? (nombreProy.get(pid) ?? pid) : undefined,
        deadline: str(r.deadline), historial: asArr<Hist>(r.historial),
      };
    });
    const existentesT = filasT.filter((r) => !idSet.has(r.id) && int(r.progress) < 100).map((r) => ({ titulo: str(r.title), score: int(r.score), deadline: str(r.deadline) }));
    const proyNuevos = filasP.filter((p) => projSet.has(p.id)).map((p) => ({ id: p.id, nombre: str(p.name, 'Proyecto') }));
    const existentesP = filasP.filter((p) => !projSet.has(p.id)).map((p) => ({ nombre: str(p.name), score: int(p.score) }));
    const tareasPorProy = proyNuevos.map((p) => {
      const titulos = nuevas.filter((n) => n.proyectoId === p.id).map((n) => n.titulo);
      return `[${p.id}] ${p.nombre}: ${titulos.join('; ') || '(sin tareas)'}`;
    }).join('\n');

    // 3 llamadas al Perro en paralelo (score tareas · checklists · proyectos). Gemini gratis.
    const [scoreRes, checklistRes, proyRes] = await Promise.all([
      nuevas.length ? puntuarNuevas(nuevas, existentesT, brief, 'Priorización de tareas nuevas', { conCapacidades: false }) : Promise.resolve({ tareas: [] as { id: string; score: number; razon: string; impacto?: number; esfuerzo?: number; deadline?: string; deadlineRazon?: string; haceloEn?: string }[], faltantes: [] as string[] }),
      nuevas.length ? checklistsParaTareas(nuevas.map((n) => ({ id: n.id, titulo: n.titulo, detalle: n.detalle })), contexto, 'Descripción + checklists de tareas nuevas') : Promise.resolve({} as Record<string, { detalle: string; items: string[] }>),
      proyNuevos.length ? describirProyectosNuevos(proyNuevos, existentesP, tareasPorProy, brief, 'Proyectos nuevos: emoji + detalle + score') : Promise.resolve({ proyectos: [] as { id: string; score: number; emoji: string; detalle: string; razon: string; impacto?: number; esfuerzo?: number }[] }),
    ]);

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
      if (g) {
        const prio = prioFromScore(g.score);
        cuenta[prio]++;
        patch.score = g.score; patch.score_razon = g.razon || null; patch.impacto = g.impacto ?? null; patch.esfuerzo = g.esfuerzo ?? null; patch.priority = prio;
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
      const detalleFinal = fusionarDetalle(n.detalle, enr?.detalle ?? '');
      if (detalleFinal && detalleFinal !== n.detalle) { patch.detalle = detalleFinal; out.detalle = detalleFinal; }
      if (enr?.items.length) {
        const checklist = enr.items.map((text): Check => ({ id: genId('c'), text, done: false }));
        patch.checklist = checklist; out.checklist = checklist;
      }
      if (Object.keys(patch).length <= 1) return Promise.resolve(undefined); // solo updated_at
      // RASTRO: toda pasada de la IA por una tarjeta queda en el historial (regla del
      // dueño). Antes el Perro puntuaba en silencio y la tarjeta no decía quién la movió.
      const texto = g
        ? `MaKo la priorizó — score ${g.score} (${g.razon || 'sin razón'})`.slice(0, 220)
        : 'MaKo le escribió la descripción y la checklist';
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

    return { tareas: cuenta, proyectos: proyectosPatch.length, patches, proyectosPatch, sinPuntuar: scoreRes.faltantes.length };
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
