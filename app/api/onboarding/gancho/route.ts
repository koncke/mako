// =============================================================================
// /api/onboarding/gancho — el elemento TANGIBLE de la oferta (genera FOMO)
// =============================================================================
// GET  → { ganchos, tieneBrief }
// POST → action 'generar' (MaKo los propone desde el brief) | 'guardar' (edición).
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getAnswers } from '@/lib/onboarding';
import { generarGanchos, getGanchos, setGanchos, type Gancho } from '@/lib/gancho';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function estado() {
  const [ganchos, answers] = await Promise.all([getGanchos(), getAnswers()]);
  return { ganchos, tieneBrief: Object.values(answers).some((v) => (v ?? '').trim()) };
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
  let body: { action?: string; ganchos?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      if (body.action === 'guardar') {
        const arr = Array.isArray(body.ganchos) ? body.ganchos : [];
        const limpio: Gancho[] = arr
          .map((g) => { const o = (g ?? {}) as Record<string, unknown>; return { id: s(o.id) || randomUUID(), nombre: s(o.nombre), tipo: s(o.tipo), queEs: s(o.queEs), fomo: s(o.fomo) }; })
          .filter((g) => g.nombre);
        await setGanchos(limpio);
        return Response.json({ ok: true, ...(await estado()) });
      }
      const r = await generarGanchos();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
      await setGanchos(r.ganchos);
      return Response.json({ ok: true, ...(await estado()), uso: r.uso });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
