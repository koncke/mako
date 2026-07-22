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
import { getTenantDb, runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import type { BoardTask, Label, Prio, Actor, Check, Hist, Fuente } from '@/app/plan/board/types';
import { scoreFromPrio, prioFromScore } from '@/app/plan/board/types';
import { puntuarNuevas, describirProyectosNuevos } from '@/lib/mako-guardian';
import { checklistsParaTareas } from '@/lib/checklist-coach';

type Row = Record<string, unknown>;

// El board es el de la agencia: forzamos OWNER_WS para todas las operaciones.
const enPlan = <T,>(fn: () => Promise<T>): Promise<T> => runWithWorkspace(OWNER_WS, fn);

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
    detalle: str(r.detalle), historial: asArr<Hist>(r.historial), fuente: optFuente(r.fuente),
  };
}
function labelToRow(l: Label, orden = 0): Row {
  return {
    id: l.id, pid: l.pid ?? null, emoji: l.emoji || '📁', name: l.name || 'Proyecto', color: l.color || '#2F6FED',
    score: int(l.score, 50), score_razon: l.scoreRazon ?? null, impacto: l.impacto ?? null, esfuerzo: l.esfuerzo ?? null,
    deadline: l.deadline || '', detalle: l.detalle || '', historial: l.historial ?? [], fuente: l.fuente ?? null,
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
    const proj: Label = { ...draft, id: draft.id && !draft.id.startsWith('tmp') ? draft.id : genId('p') };
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

export type NuevaTareaPlan = { titulo: string; prioridad?: Prio; proyecto?: string; deadline?: string; detalle?: string };

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
    const byName = new Map(proyectos.map((p) => [p.name.trim().toLowerCase(), p.id]));
    const idsExist = new Set(proyectos.map((p) => p.id)); // MaKo a veces pasa el id/slug del proyecto existente
    const resolverProy = (nombre?: string): string | undefined => { const n = nombre?.trim(); if (!n) return undefined; return byName.get(n.toLowerCase()) ?? (idsExist.has(n) ? n : undefined); };
    const nuevosProy: Label[] = [];
    for (const it of validos) {
      const nombre = it.proyecto?.trim();
      if (!nombre) continue;
      const k = nombre.toLowerCase();
      if (byName.has(k) || idsExist.has(nombre)) continue; // ya existe (por nombre o por id) → no duplicar
      const id = genId('p');
      byName.set(k, id);
      nuevosProy.push({ id, emoji: '📁', name: nombre.slice(0, 120), color: '#2F6FED', score: 50, detalle: '', fuente: fu, historial: [{ id: genId('h'), ts: ahora, actor, text: `Creó el proyecto — ${desde}` }] });
    }
    if (nuevosProy.length) {
      const base = proyectos.length;
      const { error } = await db.from('plan_proyectos').insert(nuevosProy.map((l, i) => labelToRow(l, base + i)));
      if (error) throw new Error(`agregarTareasPlanOwner proyectos: ${error.message}`);
    }

    // 2. tareas: #num autoritativo (server) + score inicial por prioridad.
    const start = await proximoNum(db);
    const tareas: BoardTask[] = validos.map((it, i) => {
      const prio: Prio = it.prioridad ?? 'media';
      const projId = resolverProy(it.proyecto);
      return {
        id: genId('t'), num: start + i, emoji: '📌', title: it.titulo.trim().slice(0, 200),
        detalle: it.detalle?.slice(0, 600) ?? '', priority: prio, score: scoreFromPrio[prio], progress: 0,
        deadline: it.deadline || '', labels: projId ? [projId] : [], checklist: [],
        historial: [{ id: genId('h'), ts: ahora, actor, text: `Creó la tarjeta — ${desde}` }],
        origen: actor, fuente: fu, enPrioridad: false,
      };
    });
    const { error } = await db.from('plan_tareas').insert(tareas.map(taskToRow));
    if (error) throw new Error(`agregarTareasPlanOwner tareas: ${error.message}`);
    return { ids: tareas.map((t) => t.id), nums: tareas.map((t) => t.num), proyectoIds: nuevosProy.map((p) => p.id) };
  });
}

/** El Perro Guardián trabaja lo RECIÉN creado (server-side, no depende del navegador):
 *  (1) puntúa las tareas nuevas ubicándolas en la pirámide + les arma la checklist;
 *  (2) a los proyectos nuevos les pone emoji + descripción + score distinto (antes
 *  quedaban 📁/50/sin detalle). NO re-puntúa el resto. Devuelve el conteo por columna +
 *  cuántos proyectos trabajó (o null). Queda en el historial de IA (feature mako-guardian). */
export async function priorizarNuevasOwner(ids: string[], proyectoIds: string[] = [], contexto = ''): Promise<{ tareas: Record<Prio, number>; proyectos: number } | null> {
  return enPlan(async () => {
    if (!ids.length && !proyectoIds.length) return null;
    const db = await getTenantDb();
    const idSet = new Set(ids);
    const projSet = new Set(proyectoIds);
    const [tRes, pRes] = await Promise.all([
      db.from('plan_tareas').select('id, title, detalle, score, progress, labels'),
      db.from('plan_proyectos').select('id, name, score'),
    ]);
    const filasT = (tRes.data ?? []) as Array<{ id: string; title: string; detalle: string; score: number; progress: number; labels: unknown }>;
    const filasP = (pRes.data ?? []) as Array<{ id: string; name: string; score: number }>;

    const nuevas = filasT.filter((r) => idSet.has(r.id)).map((r) => ({
      id: r.id, titulo: str(r.title, 'Tarea'), detalle: str(r.detalle),
      proyecto: asArr<unknown>(r.labels).map(String)[0] ?? undefined,
    }));
    const existentesT = filasT.filter((r) => !idSet.has(r.id) && int(r.progress) < 100).map((r) => ({ titulo: str(r.title), score: int(r.score) }));
    const proyNuevos = filasP.filter((p) => projSet.has(p.id)).map((p) => ({ id: p.id, nombre: str(p.name, 'Proyecto') }));
    const existentesP = filasP.filter((p) => !projSet.has(p.id)).map((p) => ({ nombre: str(p.name), score: int(p.score) }));
    const tareasPorProy = proyNuevos.map((p) => {
      const titulos = nuevas.filter((n) => n.proyecto === p.id).map((n) => n.titulo);
      return `[${p.id}] ${p.nombre}: ${titulos.join('; ') || '(sin tareas)'}`;
    }).join('\n');

    // 3 llamadas al Perro en paralelo (score tareas · checklists · proyectos). Gemini gratis.
    const [scoreRes, checklistRes, proyRes] = await Promise.all([
      nuevas.length ? puntuarNuevas(nuevas, existentesT, contexto, 'Priorización de tareas nuevas') : Promise.resolve({ tareas: [] as { id: string; score: number; razon: string; impacto?: number; esfuerzo?: number }[] }),
      nuevas.length ? checklistsParaTareas(nuevas.map((n) => ({ id: n.id, titulo: n.titulo, detalle: n.detalle })), 'Descripción + checklists de tareas nuevas') : Promise.resolve({} as Record<string, { detalle: string; items: string[] }>),
      proyNuevos.length ? describirProyectosNuevos(proyNuevos, existentesP, tareasPorProy, contexto, 'Proyectos nuevos: emoji + detalle + score') : Promise.resolve({ proyectos: [] as { id: string; score: number; emoji: string; detalle: string; razon: string; impacto?: number; esfuerzo?: number }[] }),
    ]);

    const cuenta: Record<Prio, number> = { alta: 0, media: 0, baja: 0, futuro: 0 };
    const byId = new Map(scoreRes.tareas.map((t) => [t.id, t]));
    await Promise.all(nuevas.map((n) => {
      const g = byId.get(n.id);
      const enr = checklistRes[n.id];
      const patch: Row = { updated_at: new Date().toISOString() };
      if (g) {
        const prio = prioFromScore(g.score);
        cuenta[prio]++;
        patch.score = g.score; patch.score_razon = g.razon || null; patch.impacto = g.impacto ?? null; patch.esfuerzo = g.esfuerzo ?? null; patch.priority = prio;
      }
      if (enr?.detalle) patch.detalle = enr.detalle; // descripción sólida del Perro (pisa la fina de MaKo)
      if (enr?.items.length) patch.checklist = enr.items.map((text): Check => ({ id: genId('c'), text, done: false }));
      if (Object.keys(patch).length <= 1) return Promise.resolve(undefined); // solo updated_at
      return db.from('plan_tareas').update(patch).eq('id', n.id).then(() => undefined);
    }));

    await Promise.all(proyRes.proyectos.map((p) =>
      db.from('plan_proyectos').update({ score: p.score, score_razon: p.razon || null, impacto: p.impacto ?? null, esfuerzo: p.esfuerzo ?? null, emoji: p.emoji || '📁', detalle: p.detalle || '', updated_at: new Date().toISOString() }).eq('id', p.id).then(() => undefined),
    ));

    return { tareas: cuenta, proyectos: proyRes.proyectos.length };
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
