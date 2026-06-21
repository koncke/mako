// =============================================================================
// /api/mako/prompts — prompts de MaKo (núcleo fijo + módulos versionados)
// =============================================================================

import type { NextRequest } from 'next/server';
import { MAKO_NUCLEO, getPrompts, savePrompt, restorePrompt } from '@/lib/mako-prompts';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  try {
    return Response.json({ nucleo: MAKO_NUCLEO, modos: await getPrompts() });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
