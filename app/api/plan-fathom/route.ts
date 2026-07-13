// =============================================================================
// /api/plan-fathom — extraer tareas del plan desde una reunión de Fathom (G3)
// =============================================================================
// POST { action:'reuniones' }                         → { ok, reuniones:[…] }
// POST { action:'extraer', recordingId, proyectos:[{id,emoji,nombre}], uso? }
//                                                      → { ok, tareas:[…], usage? }
// Solo super-admin: usa la Fathom key de la agencia (la misma del Closing Analyst)
// y alimenta el PlanBoard (localStorage). El transcript es contenido no confiable.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { listReunionesRecientes, extraerTareasDeReunion, type ProyectoRef } from '@/lib/plan-fathom';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  // Cualquier usuario logueado puede extraer de SU Fathom: la key sale de
  // credWs('FATHOM_API_KEY') que ya está scopeada por workspace (el dueño usa la de
  // la agencia; cada cliente, la suya). Si el workspace no tiene key, falla lindo.
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  let body: { action?: string; recordingId?: number; proyectos?: ProyectoRef[]; uso?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const uso = String(body.uso ?? '').trim() || undefined;

  try {
    if (body.action === 'reuniones') {
      const reuniones = await listReunionesRecientes(30);
      return Response.json({ ok: true, reuniones });
    }
    if (body.action === 'extraer') {
      const recordingId = Number(body.recordingId);
      if (!Number.isFinite(recordingId)) return Response.json({ ok: false, error: 'Falta la reunión.' }, { status: 400 });
      const proyectos = Array.isArray(body.proyectos)
        ? body.proyectos.filter((p): p is ProyectoRef => !!p && typeof p.id === 'string').map((p) => ({ id: String(p.id), emoji: String(p.emoji ?? ''), nombre: String(p.nombre ?? '') }))
        : [];
      const out = await extraerTareasDeReunion(recordingId, proyectos, uso);
      return Response.json({ ok: true, ...out });
    }
    return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:plan-fathom] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
