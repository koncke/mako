// =============================================================================
// /api/mako/prompts — prompts de MaKo (núcleo fijo + módulos versionados)
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import { MAKO_NUCLEO, getPrompts, savePrompt, restorePrompt } from '@/lib/mako-prompts';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Config del cerebro de MaKo: solo el admin del workspace (patrón /api/mako/voz).
// Sin esto, un closer/setter podía reescribir la persona/modos vía fetch directo.
async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ error: 'Solo el admin del workspace puede tocar la config de MaKo.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloAdmin();
  if (g) return g;
  try {
    return Response.json({ nucleo: MAKO_NUCLEO, modos: await getPrompts() });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
  let body: { action?: string; modo?: string; text?: string; ts?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!body.modo) return Response.json({ error: 'modo requerido' }, { status: 400 });
  try {
    if (body.action === 'save') {
      await savePrompt(body.modo, body.text ?? '');
      return Response.json({ ok: true });
    }
    if (body.action === 'restore') {
      if (!body.ts) return Response.json({ error: 'ts requerido' }, { status: 400 });
      await restorePrompt(body.modo, body.ts);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'action inválida' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}
