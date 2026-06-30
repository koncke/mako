// =============================================================================
// POST /api/experimentos/ideas — MaKo propone experimentos desde el funnel
// =============================================================================
// Body opcional: { n?: number }. MaKo mira el funnel real + lo que ya corre y
// devuelve hipótesis testeables (no conclusiones). El usuario decide cuáles
// arrancar (action=crear) o guardar como propuesta (arrancar:false).
// =============================================================================

import type { NextRequest } from 'next/server';
import { idearExperimentos } from '@/lib/experimentos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let n = 3;
  try {
    const body = await req.json();
    const parsed = Number(body?.n);
    if (Number.isFinite(parsed)) n = Math.max(1, Math.min(5, parsed));
  } catch { /* sin body → 3 ideas */ }

  try {
    const ideas = await idearExperimentos(n);
    return Response.json({ ok: true, ideas });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
