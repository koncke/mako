// =============================================================================
// /api/onboarding/angulos — los 3 ÁNGULOS de venta del negocio
// =============================================================================
// GET  → { angulos, tieneBrief }
// POST → action 'generar' (MaKo los encuentra desde el brief del Archivero y los
//        guarda) | 'guardar' (persiste la lista editada por el usuario).
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS. Todo
// dentro de runWithWorkspace(ws) para scopear brief + settings.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getAnswers } from '@/lib/onboarding';
import { generarAngulos, getAngulosVenta, setAngulosVenta, type AnguloVenta } from '@/lib/angulos-venta';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function estado() {
  const [angulos, answers] = await Promise.all([getAngulosVenta(), getAnswers()]);
  return { angulos, tieneBrief: Object.values(answers).some((v) => (v ?? '').trim()) };
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
  let body: { action?: string; angulos?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      if (body.action === 'guardar') {
        const arr = Array.isArray(body.angulos) ? body.angulos : [];
        const limpio: AnguloVenta[] = arr
          .map((a) => { const o = (a ?? {}) as Record<string, unknown>; return { id: s(o.id) || randomUUID(), tipo: s(o.tipo) || 'Problema', titulo: s(o.titulo), hook: s(o.hook), descripcion: s(o.descripcion) }; })
          .filter((a) => a.titulo);
        await setAngulosVenta(limpio);
        return Response.json({ ok: true, ...(await estado()) });
      }
      // default: generar
      const r = await generarAngulos();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
      await setAngulosVenta(r.angulos);
      return Response.json({ ok: true, ...(await estado()), uso: r.uso });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
