// =============================================================================
// API: onboarding de una tab (regla: toda tab tiene onboarding)
// =============================================================================
// GET  ?tab=setting|whatsapp|email → { estado, def }: en qué paso quedó y
//      cuáles son los pasos. El default es el Chatbot, que es el recorrido
//      completo; WhatsApp y Email piden solo su tramo.
// POST → { action:'paso', paso, done? }   → marca un paso (cierra la tab en el último)
//        { action:'reabrir' }             → rehacer el onboarding desde cero
// Guard: admin del workspace (el onboarding configura envíos reales).
// Molde: la action 'paso' de /api/onboarding.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getEstadoTab, marcarPasoTab, reabrirOnboardingTab, tabOnboardingDef } from '@/lib/tab-onboarding-state';

export const dynamic = 'force-dynamic';

const TABS_VALIDAS = new Set(['setting', 'whatsapp', 'email']);
/** El default es el recorrido completo del Chatbot. */
const tabDe = (v: string | null): string => (v && TABS_VALIDAS.has(v) ? v : 'setting');
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<Response | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar esta tab.' }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  const TAB = tabDe(new URL(req.url).searchParams.get('tab'));
  try {
    // `guiaVoz`: ¿el negocio ya tiene «Tu forma de escribir»? Lo pregunta el lienzo al
    // prender «Lo adapta MaKo» (#745): el tilde del paso no lo dice, porque se marca
    // aunque no se haya escrito ninguna guía. `null` = no se pudo leer (no se abre nada).
    const guiaVoz = TAB === 'setting'
      ? await import('@/lib/nutricion-generator').then((m) => m.hayVozGuiaEstricto()).catch(() => null)
      : null;
    return Response.json({ ok: true, estado: await getEstadoTab(TAB), def: tabOnboardingDef(TAB), guiaVoz });
  } catch (e) {
    console.error(`[api:setting/onboarding GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  let body: { action?: string; paso?: unknown; done?: unknown; tab?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const TAB = tabDe(typeof body.tab === 'string' ? body.tab : null);

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
