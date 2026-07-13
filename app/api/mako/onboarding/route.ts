// =============================================================================
// /api/mako/onboarding — perfil del negocio (esquema editable + respuestas)
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getSchema, saveSchema, getAnswers, saveAnswers, type Group } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// El perfil del negocio (alimenta el contexto de MaKo y el brief de campañas) es
// config admin-only: solo el admin del workspace (patrón /api/mako/voz).
async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ error: 'Solo el admin del workspace puede tocar el perfil del negocio.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloAdmin();
  if (g) return g;
  try {
    const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
    return Response.json({ schema, answers });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
  let body: { action?: string; schema?: Group[]; answers?: Record<string, string> };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  try {
    if (body.action === 'schema') {
      if (!Array.isArray(body.schema)) return Response.json({ error: 'schema inválido' }, { status: 400 });
      await saveSchema(body.schema);
      return Response.json({ ok: true });
    }
    if (body.action === 'answers') {
      await saveAnswers(body.answers ?? {});
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'action inválida' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}
