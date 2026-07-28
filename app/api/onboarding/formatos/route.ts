// =============================================================================
// /api/onboarding/formatos — los ÁNGULOS = formatos de creativo (biblioteca + recos)
// =============================================================================
// GET  → { biblioteca (fija), recomendaciones (de MaKo), tieneRazones }
// POST → action 'generar' (MaKo elige de la biblioteca los mejores para el negocio).
// La biblioteca NO es editable (la definimos nosotros); solo se regeneran las recos.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getAngulosVenta } from '@/lib/angulos-venta';
import { BIBLIOTECA_ANGULOS, getRecomendaciones, setRecomendaciones, recomendarFormatos } from '@/lib/angulos-formatos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function estado() {
  const [recomendaciones, razones] = await Promise.all([getRecomendaciones(), getAngulosVenta()]);
  return { biblioteca: BIBLIOTECA_ANGULOS, recomendaciones, tieneRazones: razones.length > 0 };
}

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, ...(await estado()) }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  try { await req.json(); } catch { /* sin body necesario */ }

  return runWithWorkspace(ws, async () => {
    try {
      const r = await recomendarFormatos();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
      await setRecomendaciones(r.recomendaciones);
      return Response.json({ ok: true, ...(await estado()), uso: r.uso });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
