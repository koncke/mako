// =============================================================================
// /api/onboarding/fase — el diagnóstico de fase del negocio (para la tab del hub)
// =============================================================================
// GET  → { diag }           (el diagnóstico guardado, o null si no lo hizo)
// POST → { respuestas, canal } → recomputa y guarda; devuelve { diag }.
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS. Todo
// dentro de runWithWorkspace(ws) para scopear los settings del diagnóstico.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getDiagnosticoFase, setDiagnosticoFase } from '@/lib/fase-store';
import type { CanalId } from '@/lib/fase-diagnostico';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, diag: await getDiagnosticoFase() }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { respuestas?: unknown; canal?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const respuestas = Array.isArray(body.respuestas) ? body.respuestas.map((n) => Number(n)) : [];
  const canal = (typeof body.canal === 'string' ? body.canal : undefined) as CanalId | undefined;

  return runWithWorkspace(ws, async () => {
    try {
      const diag = await setDiagnosticoFase(respuestas, canal);
      return Response.json({ ok: true, diag });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
