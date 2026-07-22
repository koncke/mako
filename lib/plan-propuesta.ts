// =============================================================================
// plan-propuesta — el BORRADOR que MaKo deja para revisar en la app (mig 0094)
// =============================================================================
// MaKo (WhatsApp) arma un borrador (tareas + preguntas con opciones) en vez del
// ida-y-vuelta frágil por chat. El dueño O EL CLIENTE abre /plan/revisar/<id>,
// responde de a 1 pregunta (WizardShell) y confirma → se crean las tareas.
// WORKSPACE-AWARE (impacta a TODOS, no solo al dueño): el borrador vive en el ws
// de quien lo crea/mira. Al aplicar: dueño (OWNER_WS) → plan_tareas + Perro;
// cliente → su board (lib/todo). Nunca forzamos OWNER_WS.

import 'server-only';
import { getTenantDb, runWithWorkspace, getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { agregarTareasPlanOwner, priorizarNuevasOwner, borrarPlanTarea } from '@/lib/plan-board';
import { crearTarea, crearCategoria, listCategorias, borrarTarea, type Prioridad } from '@/lib/todo';
import type { Prio, Fuente, FuenteTipo } from '@/app/plan/board/types';

type Row = Record<string, unknown>;
const wsActual = async (): Promise<number> => (await getWorkspaceActual()) ?? OWNER_WS;
const enWs = async <T,>(fn: () => Promise<T>): Promise<T> => runWithWorkspace(await wsActual(), fn);
const genId = (p: string): string => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];

export type PropuestaTarea = { titulo: string; proyecto?: string; deadline?: string; detalle?: string; prioridad?: Prio };
export type PropuestaPregunta = { pregunta: string; opciones: string[] };
export type PropuestaEliminar = { id: string; titulo?: string; motivo?: string };
export type Propuesta = { id: string; estado: 'pendiente' | 'aplicada' | 'descartada'; resumen: string; origen?: string; tareas: PropuestaTarea[]; preguntas: PropuestaPregunta[]; eliminar: PropuestaEliminar[]; createdAt: string };

function limpiarTarea(t: unknown): PropuestaTarea | null {
  if (!t || typeof t !== 'object') return null;
  const o = t as Record<string, unknown>;
  const titulo = str(o.titulo).trim().slice(0, 200);
  if (!titulo) return null;
  return {
    titulo,
    proyecto: o.proyecto ? str(o.proyecto).trim().slice(0, 120) : undefined,
    deadline: typeof o.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : undefined,
    detalle: o.detalle ? str(o.detalle).slice(0, 600) : undefined,
    prioridad: PRIOS.includes(o.prioridad as Prio) ? (o.prioridad as Prio) : undefined,
  };
}
function limpiarEliminar(e: unknown): PropuestaEliminar | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const id = str(o.id).trim().slice(0, 80);
  if (!id) return null;
  return { id, titulo: o.titulo ? str(o.titulo).slice(0, 200) : undefined, motivo: o.motivo ? str(o.motivo).slice(0, 300) : undefined };
}
// Acepta {pregunta, opciones} o (compat) una nota-string suelta.
function limpiarPregunta(p: unknown): PropuestaPregunta | null {
  if (typeof p === 'string') return p.trim() ? { pregunta: p.trim().slice(0, 300), opciones: [] } : null;
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const pregunta = str(o.pregunta).trim().slice(0, 300);
  if (!pregunta) return null;
  return { pregunta, opciones: asArr<unknown>(o.opciones).map((x) => str(x).trim()).filter(Boolean).slice(0, 5) };
}

/** Crea el borrador en el workspace actual. Devuelve el id (para el link /plan/revisar/<id>). */
export async function crearPropuesta(draft: { tareas: PropuestaTarea[]; preguntas?: PropuestaPregunta[]; eliminar?: PropuestaEliminar[]; resumen?: string; origen?: string }): Promise<string> {
  return enWs(async () => {
    const db = await getTenantDb();
    const tareas = asArr<unknown>(draft.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    const preguntas = asArr<unknown>(draft.preguntas).map(limpiarPregunta).filter((p): p is PropuestaPregunta => !!p).slice(0, 5);
    const eliminar = asArr<unknown>(draft.eliminar).map(limpiarEliminar).filter((e): e is PropuestaEliminar => !!e).slice(0, 30);
    const id = genId('prop');
    const { error } = await db.from('plan_propuestas').insert({
      id, estado: 'pendiente', origen: draft.origen ?? 'whatsapp', resumen: (draft.resumen ?? '').slice(0, 300),
      tareas, notas: preguntas, eliminar, // `notas` guarda {pregunta,opciones}; `eliminar` = {id,titulo,motivo}
    });
    if (error) throw new Error(`crearPropuesta: ${error.message}`);
    return id;
  });
}

export async function getPropuesta(id: string): Promise<Propuesta | null> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    const r = data as Row;
    return {
      id: str(r.id), estado: (str(r.estado, 'pendiente') as Propuesta['estado']),
      resumen: str(r.resumen), origen: r.origen ? str(r.origen) : undefined,
      tareas: asArr<unknown>(r.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t),
      preguntas: asArr<unknown>(r.notas).map(limpiarPregunta).filter((p): p is PropuestaPregunta => !!p),
      eliminar: asArr<unknown>(r.eliminar).map(limpiarEliminar).filter((e): e is PropuestaEliminar => !!e),
      createdAt: str(r.created_at),
    };
  });
}

/** Aplica el borrador: crea las tareas y marca 'aplicada'. Dueño → plan_tareas + Perro;
 *  cliente → su board (lib/todo). `tareasEditadas` = lo que quedó en la revisión. */
export async function aplicarPropuesta(id: string, tareasEditadas?: PropuestaTarea[], eliminarIds?: string[]): Promise<{ ok: boolean; ids: string[]; borradas: number; error?: string } | null> {
  return enWs(async () => {
    const ws = await wsActual();
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('estado, origen').eq('id', id).maybeSingle();
    if (!data) return null;
    const estado = str((data as Row).estado, 'pendiente');
    if (estado !== 'pendiente') return { ok: false, ids: [], borradas: 0, error: `La propuesta ya fue ${estado}.` };
    const prop = await getPropuesta(id);
    const base = (tareasEditadas ?? prop?.tareas ?? []).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    // Solo se borran los ids que el dueño/cliente CONFIRMÓ (subset de los que MaKo propuso).
    const propuestos = new Set((prop?.eliminar ?? []).map((e) => e.id));
    const aBorrar = (eliminarIds ?? [...propuestos]).map(String).filter((x) => propuestos.has(x));
    if (!base.length && !aBorrar.length) return { ok: false, ids: [], borradas: 0, error: 'No hay nada para crear ni borrar.' };

    let ids: string[] = [];
    if (ws === OWNER_WS) {
      // DUEÑO: board rico en plan_tareas + Perro (prioriza + checklists + proyectos).
      if (base.length) {
        const fuenteTipo = (['whatsapp', 'fathom', 'mako', 'archivo', 'claude-code'].includes(str((data as Row).origen)) ? str((data as Row).origen) : 'whatsapp') as FuenteTipo;
        const r = await agregarTareasPlanOwner(base.map((t) => ({ titulo: t.titulo, prioridad: t.prioridad, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle })), { tipo: fuenteTipo } as Fuente);
        ids = r.ids;
        await priorizarNuevasOwner(r.ids, r.proyectoIds).catch((e) => { console.error('[plan-propuesta] priorizar:', e instanceof Error ? e.message : String(e)); return null; });
      }
      for (const eid of aBorrar) await borrarPlanTarea(eid).catch((e) => console.error('[plan-propuesta] borrar owner:', e instanceof Error ? e.message : String(e)));
    } else {
      // CLIENTE: su board va por lib/todo (crea la categoría si falta). Ya estamos en su ws.
      if (base.length) {
        const cats = await listCategorias().catch(() => [] as Array<{ id: number; nombre: string }>);
        const byName = new Map(cats.map((c) => [c.nombre.trim().toLowerCase(), c.id]));
        for (const t of base) {
          try {
            let catId: number | undefined;
            if (t.proyecto) {
              const nombre = t.proyecto.slice(0, 40).trim();
              const k = nombre.toLowerCase();
              catId = byName.get(k);
              if (catId == null) { const c = await crearCategoria(nombre, '#2F6FED'); catId = c.id; byName.set(k, c.id); }
            }
            const tarea = await crearTarea({ titulo: t.titulo, prioridad: (t.prioridad ?? 'media') as Prioridad, deadline: t.deadline ?? null, detalle: t.detalle ?? null, categorias: catId != null ? [catId] : [], origen: 'mako' });
            ids.push(String(tarea.id));
          } catch (e) { console.error('[plan-propuesta] crearTarea cliente:', e instanceof Error ? e.message : String(e)); }
        }
        if (!ids.length) return { ok: false, ids: [], borradas: 0, error: 'No pude crear ninguna tarea.' };
      }
      for (const eid of aBorrar) { const n = Number(eid); if (Number.isFinite(n)) await borrarTarea(n).catch((e) => console.error('[plan-propuesta] borrar cliente:', e instanceof Error ? e.message : String(e))); }
    }
    await db.from('plan_propuestas').update({ estado: 'aplicada', applied_at: new Date().toISOString() }).eq('id', id);
    return { ok: true, ids, borradas: aBorrar.length };
  });
}

export async function descartarPropuesta(id: string): Promise<boolean> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { error } = await db.from('plan_propuestas').update({ estado: 'descartada' }).eq('id', id).eq('estado', 'pendiente');
    return !error;
  });
}
