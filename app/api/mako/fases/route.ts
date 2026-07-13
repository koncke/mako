// =============================================================================
// /api/mako/fases — instrucción de MaKo por sección (config en app_settings)
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import { FASES, getFases, setFase } from '@/lib/mako-fases';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Config del cerebro de MaKo: solo el admin del workspace (patrón /api/mako/voz).
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
    return Response.json({ fases: FASES, valores: await getFases() });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
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
