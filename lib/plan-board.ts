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
import { CATALOGO_PROYECTOS, delCatalogo } from '@/lib/plan-proyectos-catalogo';

type Row = Record<string, unknown>;

// El board /plan es el ROADMAP DEL SUPER-ADMIN y vive en SU workspace. Antes se
// forzaba OWNER_WS porque el admin no tenía espacio propio y caía al del dueño; ahora
// que lo tiene, usamos el workspace del request (web: el suyo; doer: el del grupo).
// OWNER_WS queda solo de red para contextos sin workspace (cron/boot).
const enPlan = async <T,>(fn: () => Promise<T>): Promise<T> =>
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
export function fusionarDetalle(original: string, delPerro: string): string {
  const o = (original ?? '').trim();
  const p = (delPerro ?? '').trim();
  if (!p) return o;
  if (!o) return p;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const cabeza = norm(o).slice(0, 60);
  if (cabeza.length >= 20 && norm(p).includes(cabeza)) return p;
  return `${o}\n\n${p}`;
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
    const byName = new Map(proyectos.map((p) => [p.name.trim().toLowerCase(), p.id]));
    const idsExist = new Set(proyectos.map((p) => p.id)); // MaKo a veces pasa el id/slug del proyecto existente
    const resolverProy = (nombre?: string): string | undefined => { const n = nombre?.trim(); if (!n) return undefined; return byName.get(n.toLowerCase()) ?? (idsExist.has(n) ? n : undefined); };

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
    const yaEnTablero = new Set(proyectos.map((p) => p.name.trim().toLowerCase()));
    const destinos = [
      ...proyectos.map((p) => ({ nombre: p.name, que: delCatalogo(p.name)?.que || p.detalle || '', n: cuentaPorProy.get(p.id) ?? 0 })),
      ...CATALOGO_PROYECTOS.filter((c) => !yaEnTablero.has(c.nombre.toLowerCase())).map((c) => ({ nombre: c.nombre, que: c.que })),
    ];
    const ruteo: Record<number, string> = {}; // índice de tarea → NOMBRE del proyecto destino
    if (destinos.length) {
      const r = await asignarTareasAProyectos(
        validos.map((it) => ({ titulo: it.titulo.trim(), grupo: it.proyecto?.trim() })),
        destinos,
        'Rutear tareas nuevas a proyectos',
      ).catch((e) => { console.error('[plan-board] asignarTareasAProyectos:', e instanceof Error ? e.message : String(e)); return { asign: [] as Array<{ i: number; destino: string }> }; });
      for (const a of r.asign) ruteo[a.i] = a.destino;
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
      const k = nombre.toLowerCase();
      let nid = byName.get(k);
      if (!nid) {
        const cat = delCatalogo(nombre);
        nid = genId('p');
        byName.set(k, nid);
        nuevosProy.push({
          id: nid, pid: `P${siguientePid++}`, emoji: cat?.emoji ?? '📁', name: nombre.slice(0, 120),
          color: '#2F6FED', score: 50, detalle: cat?.que ?? '', fuente: fu,
          historial: [{ id: genId('h'), ts: ahora, actor, text: cat ? `Creó el proyecto (está en el catálogo) — ${desde}` : `Creó el proyecto — ${desde}` }],
        });
        if (!cat) console.warn(`[plan-board] proyecto FUERA del catálogo: «${nombre}» — ${desde}`);
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

/** El Perro Guardián trabaja lo RECIÉN creado (server-side, no depende del navegador):
 *  (1) puntúa las tareas nuevas ubicándolas en la pirámide + les arma la checklist;
 *  (2) a los proyectos nuevos les pone emoji + descripción + score distinto (antes
 *  quedaban 📁/50/sin detalle). NO re-puntúa el resto. Devuelve el conteo por columna +
 *  cuántos proyectos trabajó (o null). Queda en el historial de IA (feature mako-guardian). */
export async function priorizarNuevasOwner(ids: string[], proyectoIds: string[] = [], contexto = ''): Promise<GuardResult | null> {
  return enPlan(async () => {
    if (!ids.length && !proyectoIds.length) return null;
    const db = await getTenantDb();
    const idSet = new Set(ids);
    const projSet = new Set(proyectoIds);
    const [tRes, pRes] = await Promise.all([
      db.from('plan_tareas').select('id, title, detalle, score, progress, labels, historial'),
      db.from('plan_proyectos').select('id, name, score'),
    ]);
    const filasT = (tRes.data ?? []) as Array<{ id: string; title: string; detalle: string; score: number; progress: number; labels: unknown; historial: unknown }>;
    const filasP = (pRes.data ?? []) as Array<{ id: string; name: string; score: number }>;
    const nombreProy = new Map(filasP.map((p) => [p.id, str(p.name)]));

    // `proyecto` va con el NOMBRE (el Perro tiene que poder razonar "esto es del
    // Objetivo Principal"; con el id leía "p1m2x3k"). El id queda aparte para agrupar.
    const nuevas = filasT.filter((r) => idSet.has(r.id)).map((r) => {
      const pid = asArr<unknown>(r.labels).map(String)[0] ?? undefined;
      return {
        id: r.id, titulo: str(r.title, 'Tarea'), detalle: str(r.detalle), proyectoId: pid,
        proyecto: pid ? (nombreProy.get(pid) ?? pid) : undefined,
        historial: asArr<Hist>(r.historial),
      };
    });
    const existentesT = filasT.filter((r) => !idSet.has(r.id) && int(r.progress) < 100).map((r) => ({ titulo: str(r.title), score: int(r.score) }));
    const proyNuevos = filasP.filter((p) => projSet.has(p.id)).map((p) => ({ id: p.id, nombre: str(p.name, 'Proyecto') }));
    const existentesP = filasP.filter((p) => !projSet.has(p.id)).map((p) => ({ nombre: str(p.name), score: int(p.score) }));
    const tareasPorProy = proyNuevos.map((p) => {
      const titulos = nuevas.filter((n) => n.proyectoId === p.id).map((n) => n.titulo);
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

    return { tareas: cuenta, proyectos: proyectosPatch.length, patches, proyectosPatch };
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
