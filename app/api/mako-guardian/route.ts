// =============================================================================
// /api/mako-guardian — el perro guardián puntúa el plan (score 1-100 / 1-5)
// =============================================================================
// POST { proyectos:[{id,nombre}], tareas:[{id,titulo,detalle,...}], contexto? }
//   → { ok, proyectos:[{id,score,razon}], tareas:[{id,score,razon}] }
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { puntuarPlan, debatirPrioridad, debatirFecha, debatirProyecto, decidirEliminar, buscarDuplicados, type GuardProjIn, type GuardTaskIn } from '@/lib/mako-guardian';
import { proponerReprio, aplicarReprio, deshacerReprio, clientesParaPrueba, type Pedido } from '@/lib/plan-reprio';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type DupTarea = { id: string; titulo: string; detalle?: string };
export async function POST(req: NextRequest) {
  // El guardián razona con effort 'high' y hasta 8000 tokens por pedido: sin sesión
  // es un quemador de saldo abierto a internet. Mismo gate que /api/plan-fathom.
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  let body: { action?: string; proyectos?: GuardProjIn[]; tareas?: GuardTaskIn[]; contexto?: string; tarea?: string; proyecto?: string; scoreActual?: number; argumento?: string; plan?: string; tipo?: string; que?: string; motivo?: string; otras?: DupTarea[]; fechaActual?: string; uso?: string; pedido?: Pedido; reprioId?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const uso = String(body.uso ?? '').trim() || undefined;   // razón legible para el historial de gasto

  try {
    // ── LA AUDIENCIA: el dueño pide un número y el Perro falla ──────────────────
    // Tres acciones y no una, porque aceptar mueve DECENAS de filas: proponer devuelve la
    // cascada para MIRARLA, aplicar la escribe, deshacer la revierte. La consecuencia de lo
    // irreversible se ve ANTES del click, no después.
    if (body.action === 'reprio-proponer') {
      const p = body.pedido;
      if (!p?.itemId || !p?.entidad) return Response.json({ ok: false, error: 'Falta qué se está debatiendo.' }, { status: 400 });
      const out = await proponerReprio({
        entidad: p.entidad === 'tarea' ? 'tarea' : 'proyecto',
        itemId: String(p.itemId),
        scorePedido: Number(p.scorePedido) || 0,
        motivo: String(p.motivo ?? ''),
        pruebas: Array.isArray(p.pruebas) ? p.pruebas.slice(0, 8) : [],
        respuestas: Array.isArray(p.respuestas) ? p.respuestas.slice(0, 6) : [],
      });
      return Response.json({ ok: !out.error, ...out });
    }
    if (body.action === 'reprio-clientes') {
      return Response.json({ ok: true, clientes: await clientesParaPrueba() });
    }
    if (body.action === 'reprio-aplicar') {
      const id = String(body.reprioId ?? '').trim();
      if (!id) return Response.json({ ok: false, error: 'Falta cuál aplicar.' }, { status: 400 });
      const out = await aplicarReprio(id);
      return Response.json({ ok: !out.error, ...out });
    }
    if (body.action === 'reprio-deshacer') {
      const id = String(body.reprioId ?? '').trim();
      if (!id) return Response.json({ ok: false, error: 'Falta cuál deshacer.' }, { status: 400 });
      const out = await deshacerReprio(id);
      return Response.json({ ok: !out.error, ...out });
    }
    if (body.action === 'eliminar') {
      const que = String(body.que ?? '').trim();
      const motivo = String(body.motivo ?? '').trim();
      if (!que || !motivo) return Response.json({ ok: false, error: 'Falta el elemento o el motivo.' }, { status: 400 });
      const out = await decidirEliminar(String(body.tipo ?? 'tarea'), que, motivo, String(body.plan ?? ''), uso);
      return Response.json({ ok: true, ...out });
    }
    if (body.action === 'duplicados') {
      const tarea = String(body.tarea ?? '').trim();
      if (!tarea) return Response.json({ ok: false, error: 'Falta la tarea.' }, { status: 400 });
      const out = await buscarDuplicados(tarea, Array.isArray(body.otras) ? body.otras : [], uso);
      return Response.json({ ok: true, ...out });
    }
    if (body.action === 'debatir') {
      const tarea = String(body.tarea ?? '').trim();
      const argumento = String(body.argumento ?? '').trim();
      if (!tarea || !argumento) return Response.json({ ok: false, error: 'Falta la tarea o el argumento.' }, { status: 400 });
      const out = await debatirPrioridad(tarea, Number(body.scoreActual) || 0, argumento, String(body.plan ?? ''), uso);
      return Response.json({ ok: true, ...out });
    }
    // La FECHA se debate igual que el score: el dueño argumenta, el Perro decide.
    if (body.action === 'debatir-fecha') {
      const tarea = String(body.tarea ?? '').trim();
      const argumento = String(body.argumento ?? '').trim();
      if (!tarea || !argumento) return Response.json({ ok: false, error: 'Falta la tarea o el argumento.' }, { status: 400 });
      const out = await debatirFecha(tarea, String(body.fechaActual ?? ''), Number(body.scoreActual) || 50, argumento, String(body.plan ?? ''), uso);
      return Response.json({ ok: true, ...out });
    }
    if (body.action === 'debatir-proyecto') {
      const proyecto = String(body.proyecto ?? '').trim();
      const argumento = String(body.argumento ?? '').trim();
      if (!proyecto || !argumento) return Response.json({ ok: false, error: 'Falta el proyecto o el argumento.' }, { status: 400 });
      const out = await debatirProyecto(proyecto, Number(body.scoreActual) || 50, argumento, String(body.plan ?? ''), uso);
      return Response.json({ ok: true, ...out });
    }
    // default: puntuar todo el plan
    const proyectos = Array.isArray(body.proyectos) ? body.proyectos : [];
    const tareas = Array.isArray(body.tareas) ? body.tareas : [];
    if (tareas.length === 0) return Response.json({ ok: false, error: 'No hay tareas para priorizar.' }, { status: 400 });
    const out = await puntuarPlan(proyectos, tareas, String(body.contexto ?? ''), uso);
    return Response.json({ ok: true, ...out });
  } catch (e) {
    console.error(`[api:mako-guardian] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
