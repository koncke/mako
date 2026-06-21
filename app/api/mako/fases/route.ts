// =============================================================================
// /api/mako/fases — instrucción de MaKo por sección (config en app_settings)
// =============================================================================

import type { NextRequest } from 'next/server';
import { FASES, getFases, setFase } from '@/lib/mako-fases';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  try {
    return Response.json({ fases: FASES, valores: await getFases() });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { key?: string; value?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!body.key) return Response.json({ error: 'key requerido' }, { status: 400 });
  try {
    await setFase(body.key, body.value ?? '');
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}
