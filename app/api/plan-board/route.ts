// =============================================================================
// /api/plan-board — tablero /plan del dueño (agencia), ahora en Supabase (mig 0093)
// =============================================================================
// GET  → { tareas, proyectos, vacio }
// POST { action: 'crear-tarea'|'guardar-tarea'|'borrar-tarea'
//               |'crear-proyecto'|'guardar-proyecto'|'borrar-proyecto'
//               |'migrar'|'repriorizar'|'repriorizar-estado', ... }
// Guardado a SUPER-ADMIN: es el board de la agencia (OWNER_WS lo fuerza la capa).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  listPlanBoard, planVacio, crearPlanTarea, guardarPlanTarea, borrarPlanTarea,
  crearPlanProyecto, guardarPlanProyecto, borrarPlanProyecto, guardarPlanBulk,
  priorizarNuevasOwner, ampliarTareasPlanOwner, moverPlanTarea,
  agregarDependencia, borrarDependencia, listDependencias,
} from '@/lib/plan-board';
import type { BoardTask, Label, Fuente, Hist } from '@/app/plan/board/types';
import { esEstado } from '@/lib/todo-estados';
import type { EntidadDep, ClaseDep } from '@/app/plan/board/dependencias';
import { proponerTareasParaProyecto } from '@/lib/plan-proyecto-vacio';
import { fijarPrioridadAMano, devolverPrioridadAlPerro } from '@/lib/plan-reprio';
import { accionDelTablero } from '@/lib/plan-repriorizar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// 'priorizar-nuevas' dispara 3 llamadas al Perro en paralelo (score + checklists +
// proyectos). Con el default de Vercel (10s) el request moría por timeout y las tareas
// quedaban con el score que adivinó la extracción — en silencio. Mismo valor que
// /api/mako-guardian y /api/checklist-coach.
export const maxDuration = 120;

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const [{ tareas, proyectos, deps }, vacio] = await Promise.all([listPlanBoard(), planVacio()]);
    return NextResponse.json({ ok: true, tareas, proyectos, deps, vacio });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const inicio = Date.now();
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action ?? '');

  try {
    // «RE-PRIORIZAR TODO» (16/10/2026): arrancar y el sondeo del avance. La misma función que la
    // ruta del cliente; acá sólo se dice qué tablero es. El reloj del `after()` es el de esta ruta.
    const rp = await accionDelTablero('dueno', action, body, {
      inicio, relojMs: (maxDuration - 10) * 1000,
      actor: async () => sesion.nombre || sesion.email || '',
    });
    if (rp) return NextResponse.json(rp, { status: rp.ok ? 200 : 400 });
    // Un proyecto VACÍO no es poco importante: le falta trabajo. MaKo intuye qué tareas
    // tendría y deja un BORRADOR — nunca escribe tareas directo, que es la regla de la
    // casa y acá pesa doble: lo propuesto sale de una intuición sobre un nombre.
    if (action === 'proponer-tareas-proyecto') {
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const r = await proponerTareasParaProyecto(id);
      return 'error' in r
        ? NextResponse.json({ ok: false, error: r.error }, { status: 200 })
        : NextResponse.json({ ok: true, propuestaId: r.id, n: r.n });
    }

    // ── Dependencias (mig 0140) ──
    // El guard de ciclo corre en `agregarDependencia`, del lado del server, y NO solo en el
    // modal: esta ruta no es la única puerta (están /api/agente/plan, WhatsApp y los
    // scripts), y un chequeo que vive en un componente es un chequeo que el próximo canal
    // no tiene.
    if (action === 'dep-add') {
      const entidad = (String(body.entidad ?? 'tarea') === 'proyecto' ? 'proyecto' : 'tarea') as EntidadDep;
      const deId = String(body.deId ?? ''), aId = String(body.aId ?? '');
      if (!deId || !aId) return NextResponse.json({ ok: false, error: 'faltan las dos puntas' }, { status: 400 });
      const r = await agregarDependencia({
        entidad, deId, aId,
        clase: (String(body.clase ?? 'bloquea') === 'ordena' ? 'ordena' : 'bloquea') as ClaseDep,
        razon: String(body.razon ?? ''), origen: 'user',
      });
      // El rechazo viaja con el CAMINO: la pantalla puede decir la cadena entera en vez de
      // un «no se puede» que obliga a adivinar.
      return NextResponse.json(r.ok ? { ok: true, deps: await listDependencias() } : { ...r }, { status: r.ok ? 200 : 409 });
    }
    if (action === 'dep-del') {
      const entidad = (String(body.entidad ?? 'tarea') === 'proyecto' ? 'proyecto' : 'tarea') as EntidadDep;
      await borrarDependencia(entidad, String(body.deId ?? ''), String(body.aId ?? ''));
      return NextResponse.json({ ok: true, deps: await listDependencias() });
    }

    if (action === 'crear-tarea') {
      const t = body.tarea as BoardTask | undefined;
      if (!t?.title?.trim()) return NextResponse.json({ ok: false, error: 'falta el título' }, { status: 400 });
      return NextResponse.json({ ok: true, tarea: await crearPlanTarea(t) });
    }
    if (action === 'guardar-tarea') {
      const t = body.tarea as BoardTask | undefined;
      if (!t?.id) return NextResponse.json({ ok: false, error: 'falta la tarea' }, { status: 400 });
      // El último avance que la base le confirmó a la pestaña (16/10/2026): ver `guardarPlanTarea`.
      const progresoGuardado = typeof body.progresoGuardado === 'number' && Number.isFinite(body.progresoGuardado) ? body.progresoGuardado : undefined;
      await guardarPlanTarea(t, { progresoGuardado });
      return NextResponse.json({ ok: true });
    }
    // MOVER EN EL KANBAN (16/10/2026): la capacidad `mover` de `repoPlan`. Escribe por columna
    // (estado, lugar y lo que se acomoda solo), nunca la fila entera: ver `moverPlanTarea`.
    // Un estado que no existe es un 400, no «Por iniciar».
    if (action === 'mover-tarea') {
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const estado: unknown = body.estado;
      if (!esEstado(estado)) return NextResponse.json({ ok: false, error: 'estado inválido' }, { status: 400 });
      const orden = body.orden != null && Number.isFinite(Number(body.orden)) ? Number(body.orden) : undefined;
      // `undefined` = «no me dijeron» (conserva el motivo si ya estaba atorada); `null` lo borra.
      const motivo = body.motivo === null ? null : typeof body.motivo === 'string' ? body.motivo : undefined;
      const historial = Array.isArray(body.historial) ? (body.historial as Hist[]) : undefined;
      // El avance de ANTES: sólo lo manda el «Deshacer» de un mover (`trasMover`, 16/10/2026).
      const progreso = typeof body.progreso === 'number' && Number.isFinite(body.progreso) ? body.progreso : undefined;
      const r = await moverPlanTarea(id, estado, orden, { motivo, historial, progreso });
      return r.ok ? NextResponse.json({ ok: true, tarea: r.tarea }) : NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    }
    if (action === 'borrar-tarea') {
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarPlanTarea(id);
      return NextResponse.json({ ok: true });
    }
    if (action === 'crear-proyecto') {
      const p = body.proyecto as Label | undefined;
      if (!p?.name?.trim()) return NextResponse.json({ ok: false, error: 'falta el nombre' }, { status: 400 });
      return NextResponse.json({ ok: true, proyecto: await crearPlanProyecto(p) });
    }
    if (action === 'guardar-proyecto') {
      const p = body.proyecto as Label | undefined;
      if (!p?.id) return NextResponse.json({ ok: false, error: 'falta el proyecto' }, { status: 400 });
      await guardarPlanProyecto(p);
      return NextResponse.json({ ok: true });
    }
    if (action === 'borrar-proyecto') {
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarPlanProyecto(id);
      return NextResponse.json({ ok: true });
    }
    // ── LA PRIORIDAD A MANO ──
    // Antes el único camino al score era la audiencia con el Perro, y eso trabó una sesión
    // entera («no hay maleabilidad»). El debate sigue existiendo como opción; esto es la
    // persona decidiendo, que es lo que AGENTS.md pone por encima: la IA propone, la
    // persona cambia. Escribe el server, por columna, con la misma cascada y las mismas
    // auditorías — el navegador sigue sin tener un camino a `score`.
    if (action === 'prioridad-manual') {
      const entidad = body.entidad === 'proyecto' ? 'proyecto' : 'tarea';
      const id = String(body.id ?? '');
      const score = Number(body.score);
      if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
      if (!Number.isFinite(score)) return NextResponse.json({ ok: false, error: 'score requerido' }, { status: 400 });
      // Los dos opcionales se SANEAN acá y no se confía en su forma: son ids y números que
      // escribe el navegador. Lo que se corre lo decide el server; esto sólo dice dónde se
      // soltó, o qué corrimiento se está deshaciendo.
      const idONull = (v: unknown) => (typeof v === 'string' && v ? v : null);
      const l = body.lugar as { arriba?: unknown; abajo?: unknown } | undefined;
      const lugar = l && typeof l === 'object' ? { arriba: idONull(l.arriba), abajo: idONull(l.abajo) } : undefined;
      const deshacer = Array.isArray(body.deshacer)
        ? (body.deshacer as Array<{ id?: unknown; antes?: unknown; despues?: unknown }>).slice(0, 200)
          .filter((c) => typeof c?.id === 'string' && Number.isFinite(Number(c.antes)) && Number.isFinite(Number(c.despues)))
          .map((c) => ({ id: String(c.id), antes: Math.round(Number(c.antes)), despues: Math.round(Number(c.despues)) }))
        : undefined;
      const r = await fijarPrioridadAMano({ entidad, itemId: id, score, lugar, deshacer });
      return NextResponse.json(r.ok ? { ok: true, score: r.score, antes: r.antes, movidos: r.movidos, reprioId: r.reprioId } : { ok: false, error: r.error });
    }
    if (action === 'prioridad-al-perro') {
      const entidad = body.entidad === 'proyecto' ? 'proyecto' : 'tarea';
      const id = String(body.id ?? '');
      if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
      const r = await devolverPrioridadAlPerro(entidad, id);
      return NextResponse.json(r);
    }
    if (action === 'priorizar-nuevas') {
      // El PERRO GUARDIÁN (server-side, con persistencia) puntúa tareas nuevas ya creadas,
      // las ubica en la pirámide existente, describe proyectos nuevos y arma checklists.
      // Es el MISMO trato que reciben las tareas de WhatsApp → unifica todos los orígenes
      // (Fathom, archivo, alta manual): quien crea las tareas llama acá con sus ids.
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String).filter(Boolean) : [];
      const proyectoIds = Array.isArray(body.proyectoIds) ? (body.proyectoIds as unknown[]).map(String).filter(Boolean) : [];
      const contexto = typeof body.contexto === 'string' ? body.contexto : '';
      if (!ids.length) return NextResponse.json({ ok: false, error: 'faltan ids' }, { status: 400 });
      const r = await priorizarNuevasOwner(ids, proyectoIds, contexto);
      // `patches` vuelve al board para que aplique score/razón/detalle/checklist sin
      // recargar (y no los pise con su estado viejo en el próximo guardado).
      return NextResponse.json({ ok: true, conteo: r, patches: r?.patches ?? [], proyectosPatch: r?.proyectosPatch ?? [] });
    }
    if (action === 'ampliar-tareas') {
      // AMPLIAR lo que ya existe en vez de duplicarlo: cargar tres reuniones seguidas
      // sobre el mismo tema dejaba la misma tarea escrita tres veces con tres scores.
      const items = Array.isArray(body.items)
        ? (body.items as Array<{ id?: unknown; detalle?: unknown }>)
          .map((it) => ({ id: String(it.id ?? ''), detalle: String(it.detalle ?? '') }))
          .filter((it) => it.id && it.detalle.trim())
        : [];
      if (!items.length) return NextResponse.json({ ok: false, error: 'faltan items' }, { status: 400 });
      const r = await ampliarTareasPlanOwner(items, body.fuente as Fuente | undefined);
      return NextResponse.json({ ok: true, n: r.n, patches: r.patches });
    }
    if (action === 'migrar') {
      const tareas = (body.tareas as BoardTask[] | undefined) ?? [];
      const proyectos = (body.proyectos as Label[] | undefined) ?? [];
      const r = await guardarPlanBulk(tareas, proyectos);
      return NextResponse.json({ ok: true, migrado: r });
    }
    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
