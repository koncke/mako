// =============================================================================
// /api/onboarding/tono — el tono/personalidad del creador (humaniza los guiones)
// =============================================================================
// GET  → { ok, tono }  ·  POST { tono } → guarda (normalizado contra el catálogo).
// Piso: admin del workspace; el dueño (sin impersonar) → OWNER_WS — mismo guard
// que el resto del onboarding (resolverWsAdmin).

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getTono, setTono } from '@/lib/tono-store';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, tono: await getTono() }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { tono?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, tono: await setTono(body.tono) }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}
