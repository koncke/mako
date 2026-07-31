// =============================================================================
// /api/admin/guion-angulos — el catálogo de ángulos de guion, editable
// =============================================================================
// Solo super-admin. El catálogo es GLOBAL de la plataforma (todos los workspaces
// generan guiones con la misma biblioteca): el override pisa por completo los
// defaults de lib/guion-angulos.ts y vive en app_settings del OWNER_WS.
//
// GET  → { ok, angulos, esOverride }
// POST → { action:'guardar', angulos } | { action:'reset' }

import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getAngulosGuion, setAngulosGuion, resetAngulosGuion } from '@/lib/guion-angulos-store';
import { ANGULOS_GUION_DEFAULT } from '@/lib/guion-angulos';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  if (!(await getSesionAdmin())) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const angulos = await getAngulosGuion();
    return Response.json({ ok: true, angulos, esOverride: angulos !== ANGULOS_GUION_DEFAULT });
  } catch (e) {
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: { action?: string; angulos?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  try {
    if (body.action === 'reset') {
      const angulos = await resetAngulosGuion();
      return Response.json({ ok: true, angulos, esOverride: false });
    }
    const angulos = await setAngulosGuion(body.angulos);
    return Response.json({ ok: true, angulos, esOverride: true });
  } catch (e) {
    return Response.json({ ok: false, error: msg(e) }, { status: 422 });
  }
}
