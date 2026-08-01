// =============================================================================
// API: onboarding de la tab Setting (regla: toda tab tiene onboarding)
// =============================================================================
// GET  → { estado, def } — en qué paso quedó y cuáles son los pasos.
// POST → { action:'paso', paso, done? }   → marca un paso (cierra la tab en el último)
//        { action:'reabrir' }             → rehacer el onboarding desde cero
// Guard: admin del workspace (el onboarding configura envíos reales).
// Molde: la action 'paso' de /api/onboarding.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getEstadoTab, marcarPasoTab, reabrirOnboardingTab, tabOnboardingDef } from '@/lib/tab-onboarding-state';

export const dynamic = 'force-dynamic';

const TAB = 'setting';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<Response | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar esta tab.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await guard();
  if (g) return g;
  try {
    return Response.json({ ok: true, estado: await getEstadoTab(TAB), def: tabOnboardingDef(TAB) });
  } catch (e) {
    console.error(`[api:setting/onboarding GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  let body: { action?: string; paso?: unknown; done?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'paso') {
      const paso = String(body.paso ?? '');
      const estado = await marcarPasoTab(TAB, paso, body.done !== false);
      return Response.json({ ok: true, estado });
    }
    if (body.action === 'reabrir') {
      return Response.json({ ok: true, estado: await reabrirOnboardingTab(TAB) });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:setting/onboarding POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 400 });
  }
}
