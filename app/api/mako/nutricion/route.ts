// =============================================================================
// API: MaKo escribe la nutrición (F3.2 generar / F3.4 aprobar) — admin del ws
// =============================================================================
// GET  → { secuencias } (todas las secuencias del workspace con sus pasos)
// POST → { action:'generar', secuenciaId }          → preview del copy escrito por MaKo
//        { action:'aplicar', secuenciaId, pasos }   → persiste el copy aprobado
// Guard: admin del workspace + workspace CONCRETO (no impersonar → no hay voz/perfil
// del cliente y escribiría en el vacío). Igual criterio que /api/mako/voz.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getSecuenciasConStats, type PasoSecuencia } from '@/lib/nutricion';
import { generarSecuencia, aplicarSecuencia } from '@/lib/nutricion-generator';
import { estadoPlantillasSecuencia } from '@/lib/nutricion-plantillas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Admin del workspace, sobre un workspace concreto (no admin-sin-impersonar). */
async function guard(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede generar la nutrición.' }, { status: 403 });
  }
  if ((await getWorkspaceActual()) == null) {
    return Response.json({ ok: false, error: 'Entra al workspace del cliente (impersonando) para que MaKo escriba su nutrición.' }, { status: 400 });
  }
  return null;
}

export async function GET() {
  const g = await guard();
  if (g) return g;
  try {
    const secuencias = await getSecuenciasConStats();
    return Response.json({ ok: true, secuencias });
  } catch (e) {
    console.error(`[api:mako/nutricion GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  let body: { action?: string; secuenciaId?: number; orden?: number; pasos?: PasoSecuencia[] };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    const secuenciaId = Number(body.secuenciaId);
    if (!Number.isFinite(secuenciaId)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });

    if (body.action === 'generar') {
      const r = await generarSecuencia(secuenciaId);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      return Response.json({ ok: true, secuenciaId: r.secuenciaId, nombre: r.nombre, pasos: r.pasos, previos: r.previos, uso: r.uso });
    }
    if (body.action === 'aplicar') {
      if (!Array.isArray(body.pasos)) return Response.json({ ok: false, error: 'faltan los pasos a guardar' }, { status: 400 });
      await aplicarSecuencia(secuenciaId, body.pasos);
      return Response.json({ ok: true });
    }
    if (body.action === 'plantilla') {
      // ⛔ Convertía el copy de un paso del WhatsApp OFICIAL en plantilla de Meta y la mandaba a
      // aprobar, con la cuenta de WhatsApp Business del inbox de Chatwoot. Chatwoot se borró el
      // 09/10/2026: no hay a qué cuenta mandarla. Antes de esto contestaba «Conecta WhatsApp
      // (Meta) primero», que manda a conectar algo que ya no existe. Pendiente: sacar la acción
      // (y lib/nutricion-plantillas.ts) con el resto de las plantillas de Meta.
      return Response.json({ ok: false, error: 'Las plantillas de Meta salían por el WhatsApp oficial, que ya no existe.' }, { status: 400 });
    }
    if (body.action === 'estado-plantillas') {
      const estados = await estadoPlantillasSecuencia(secuenciaId);
      return Response.json({ ok: true, estados });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:mako/nutricion POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 400 });
  }
}
