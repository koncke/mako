// =============================================================================
// /api/onboarding/extraccion — extracción histórica del cliente (start/tick)
// =============================================================================
// GET  → estado de la extracción + conteos reales (panel lateral del wizard).
// POST → { action: 'start' } inicializa/re-evalúa jobs (skipped si falta la
//        integración) | { action: 'tick' } corre una tanda (~240s) y devuelve
//        el estado | { action: 'retry' } revive un job en error.
// Guard: admin del cliente (o super admin impersonando). El DUEÑO (ws 1) no
// corre extracción de onboarding — su ingesta es la de los crons de siempre.

import { NextResponse, type NextRequest } from 'next/server';
import { getWorkspaceActual, getRolWsEfectivo, OWNER_WS } from '@/lib/workspace';
import { iniciarExtraccion, tickExtraccion, conteosExtraccion } from '@/lib/onboarding-extract';
import { getEstadoOnboarding, patchEstadoOnboarding, JOB_KEYS, type JobKey } from '@/lib/onboarding-state';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function guard(): Promise<NextResponse | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Solo el admin del cliente puede correr el onboarding.' }, { status: 403 });
  }
  if (ws === OWNER_WS) {
    return NextResponse.json({ ok: false, error: 'El workspace principal no corre extracción de onboarding.' }, { status: 400 });
  }
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    const [estado, conteos] = await Promise.all([getEstadoOnboarding(), conteosExtraccion()]);
    return NextResponse.json({ ok: true, extraction: estado.extraction, conteos });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  let body: { action?: string; job?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    switch (body.action) {
      case 'start': {
        const s = await iniciarExtraccion();
        return NextResponse.json({ ok: true, extraction: s.extraction });
      }
      case 'tick': {
        const s = await tickExtraccion();
        return NextResponse.json({ ok: true, extraction: s.extraction });
      }
      case 'retry': {
        const job = body.job as JobKey | undefined;
        if (!job || !JOB_KEYS.includes(job)) return NextResponse.json({ ok: false, error: 'job inválido' }, { status: 400 });
        const s = await patchEstadoOnboarding((st) => {
          const j = st.extraction.jobs[job];
          if (j.status === 'error') { j.status = 'pending'; j.error = null; }
          if (st.extraction.status === 'error') st.extraction.status = 'running';
        });
        return NextResponse.json({ ok: true, extraction: s.extraction });
      }
      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
