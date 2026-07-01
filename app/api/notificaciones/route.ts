// =============================================================================
// /api/notificaciones — feed del centro de notificaciones (campanita)
// =============================================================================
// GET  → { items, unread }. ?no_leidas=1 filtra; ?limit=N acota.
// POST → { action: 'marcar', id } | { action: 'marcar_todas' }.
// =============================================================================

import type { NextRequest } from 'next/server';
import { listNotificaciones, contarNoLeidas, marcarLeida, marcarTodasLeidas } from '@/lib/notificaciones';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const soloNoLeidas = req.nextUrl.searchParams.get('no_leidas') === '1';
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 30;
  const [items, unread] = await Promise.all([
    listNotificaciones({ limit, soloNoLeidas }),
    contarNoLeidas(),
  ]);
  return Response.json({ ok: true, items, unread });
}

export async function POST(req: NextRequest) {
  let body: { action?: string; id?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  try {
    if (body.action === 'marcar_todas') {
      await marcarTodasLeidas();
      return Response.json({ ok: true });
    }
    if (body.action === 'marcar' && typeof body.id === 'number') {
      await marcarLeida(body.id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'acción no reconocida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
