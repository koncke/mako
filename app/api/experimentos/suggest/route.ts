// =============================================================================
// POST /api/experimentos/suggest — hipótesis (texto) → experimento configurado
// =============================================================================
// Body: { hipotesis: string }. MaKo lee el funnel real y devuelve una PROPUESTA
// estructurada (métrica del catálogo, dirección, ventana, objetivo, criterio).
// No crea nada: el usuario revisa y confirma con /api/experimentos action=crear.
// =============================================================================

import type { NextRequest } from 'next/server';
import { sugerirExperimento } from '@/lib/experimentos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { hipotesis?: string; contexto?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const hipotesis = (body.hipotesis ?? '').trim();
  if (!hipotesis) return Response.json({ ok: false, error: 'contá tu hipótesis' }, { status: 400 });

  try {
    const propuesta = await sugerirExperimento(hipotesis, body.contexto);
    return Response.json({ ok: true, propuesta });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
