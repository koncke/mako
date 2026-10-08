// =============================================================================
// API interna: broadcasts de email para la tab /email
// =============================================================================
// GET    → { broadcasts, segmentos, segmentoCounts }
// POST   → crear broadcast. Body: { asunto?, preheader?, cuerpo?, segmento? } → { id }
// PATCH  → editar / programar / enviar / prueba.
//          Body: { id, ...campos } | { id, action:'enviar' }
//               | { id, action:'programar', programado_at } | { id, action:'prueba', email }
// DELETE → ?id=N  (borra el broadcast)
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  getBroadcasts, crearBroadcast, actualizarBroadcast, eliminarBroadcast,
  enviarBroadcast, enviarBroadcastPrueba, segmentosDisponibles, contarTodosSegmentos, esSegmentoValido,
} from '@/lib/email-marketing';
import { getRolWsEfectivo } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Enviar/programar dispara emails a leads: misma regla que la config (solo el
// admin del workspace), aunque el resto de la tab sea visible para el setter.
async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin puede enviar o programar broadcasts.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    // Los segmentos fijos más uno por etiqueta del CRM (mig 0224): el desplegable del editor sale de acá.
    const segmentos = await segmentosDisponibles();
    const [broadcasts, segmentoCounts] = await Promise.all([getBroadcasts(), contarTodosSegmentos(segmentos)]);
    return Response.json({ ok: true, broadcasts, segmentos, segmentoCounts });
  } catch (e) {
    console.error(`[api:email/broadcasts GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { asunto?: string; preheader?: string; cuerpo?: string; segmento?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  try {
    const id = await crearBroadcast(body);
    return Response.json({ ok: true, id });
  } catch (e) {
    console.error(`[api:email/broadcasts POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: { id?: unknown; action?: unknown; asunto?: string; preheader?: string | null; cuerpo?: string; segmento?: string; programado_at?: string | null; email?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });

  try {
    if (body.action === 'enviar') {
      const g = await soloAdmin();
      if (g) return g;
      const res = await enviarBroadcast(id);
      if (!res.ok) return Response.json({ ...res, ok: false, error: res.error ?? 'no se pudo enviar' }, { status: 400 });
      return Response.json({ ...res, ok: true });
    }
    if (body.action === 'prueba') {
      const email = String(body.email ?? '').trim();
      if (!email || !email.includes('@')) return Response.json({ ok: false, error: 'email de prueba inválido' }, { status: 400 });
      const res = await enviarBroadcastPrueba(id, email);
      if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });
      return Response.json({ ok: true });
    }
    if (body.action === 'programar') {
      const g = await soloAdmin();
      if (g) return g;
      const at = String(body.programado_at ?? '');
      if (!at || Number.isNaN(Date.parse(at))) return Response.json({ ok: false, error: 'fecha de programación inválida' }, { status: 400 });
      await actualizarBroadcast(id, { programado_at: at, estado: 'programado' });
      return Response.json({ ok: true });
    }
    if (body.segmento !== undefined && !esSegmentoValido(body.segmento)) {
      return Response.json({ ok: false, error: 'segmento inválido' }, { status: 400 });
    }
    await actualizarBroadcast(id, {
      asunto: body.asunto, preheader: body.preheader, cuerpo: body.cuerpo,
      segmento: body.segmento, programado_at: body.programado_at, estado: body.action === 'cancelar' ? 'borrador' : undefined,
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[api:email/broadcasts PATCH] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  try {
    await eliminarBroadcast(id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[api:email/broadcasts DELETE] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
