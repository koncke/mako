// =============================================================================
// API: etiquetas de WhatsApp del no oficial + mapeo etapa→etiqueta (auto-etiqueta).
// GET  → { labels (catálogo), mapeo (etapa→labelId), etapas } (admin del ws).
// POST { action:'sync' }        → re-sincroniza el catálogo desde Evolution.
// POST { etapa, labelId|null }   → setea/borra el mapeo de una etapa.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getCatalogoLabels, sincronizarCatalogoLabels, getMapeoEtapaLabels, setMapeoEtapaLabel } from '@/lib/evolution-labels';
import { ETAPAS_FUNNEL } from '@/lib/wa-etapas';

export const dynamic = 'force-dynamic';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return null;
}

export async function GET() {
  const g = await soloAdmin(); if (g) return g;
  try {
    const [labels, mapeo] = await Promise.all([getCatalogoLabels(), getMapeoEtapaLabels()]);
    return Response.json({ ok: true, labels, mapeo, etapas: ETAPAS_FUNNEL });
  } catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin(); if (g) return g;
  let body: { action?: string; etapa?: string; labelId?: string | null };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  try {
    if (body.action === 'sync') {
      const labels = await sincronizarCatalogoLabels();
      return Response.json({ ok: true, labels });
    }
    if (body.etapa) {
      await setMapeoEtapaLabel(body.etapa, body.labelId ?? null);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'acción inválida' }, { status: 400 });
  } catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
}
