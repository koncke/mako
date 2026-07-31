// =============================================================================
// /api/onboarding/personalidad — el quiz de personalidad de voz del creador
// =============================================================================
// GET → { ok, personalidad, total } (para retomar donde quedó).
// POST:
//  · { action:'pregunta', idx }              → la pregunta idx PERSONALIZADA al
//    negocio real vía IA (fallback: la estática — nunca se traba).
//  · { action:'responder', key, rasgo, texto } → guarda UNA respuesta (merge).
//  · { action:'muletillas', muletillas }     → guarda el campo libre.
//  · { action:'reiniciar' }                  → borra todo para re-hacer el quiz.
// Piso: admin del workspace (resolverWsAdmin), como el resto del onboarding.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { PERSONALIDAD_PREGUNTAS } from '@/lib/personalidad';
import { getPersonalidad, setPersonalidad, personalizarPregunta } from '@/lib/personalidad-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, personalidad: await getPersonalidad(), total: PERSONALIDAD_PREGUNTAS.length }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { action?: string; idx?: unknown; key?: unknown; rasgo?: unknown; texto?: unknown; muletillas?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      if (body.action === 'pregunta') {
        const idx = Number(body.idx);
        if (!Number.isInteger(idx) || idx < 0 || idx >= PERSONALIDAD_PREGUNTAS.length) {
          return Response.json({ ok: false, error: 'pregunta inválida' }, { status: 400 });
        }
        return Response.json({ ok: true, pregunta: await personalizarPregunta(idx), idx, total: PERSONALIDAD_PREGUNTAS.length });
      }
      if (body.action === 'responder') {
        const actual = await getPersonalidad();
        const personalidad = await setPersonalidad({
          ...actual,
          respuestas: { ...actual.respuestas, [s(body.key)]: { rasgo: s(body.rasgo), texto: s(body.texto) } },
        });
        return Response.json({ ok: true, personalidad });
      }
      if (body.action === 'muletillas') {
        const actual = await getPersonalidad();
        const personalidad = await setPersonalidad({ ...actual, muletillas: s(body.muletillas) });
        return Response.json({ ok: true, personalidad });
      }
      if (body.action === 'reiniciar') {
        const personalidad = await setPersonalidad({ respuestas: {}, muletillas: '' });
        return Response.json({ ok: true, personalidad });
      }
      return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
