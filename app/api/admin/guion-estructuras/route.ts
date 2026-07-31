// =============================================================================
// /api/admin/guion-estructuras — el catálogo de estructuras de guion, editable
// =============================================================================
// Solo super-admin. Mismo contrato que /api/admin/guion-angulos: el catálogo es
// GLOBAL de la plataforma; el override pisa por completo los defaults de
// lib/guion-estructuras.ts y vive en app_settings del OWNER_WS.
//
// GET  → { ok, estructuras }
// POST → { action:'guardar', estructuras } | { action:'reset' }

import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getEstructurasGuion, setEstructurasGuion, resetEstructurasGuion } from '@/lib/guion-estructuras-store';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  if (!(await getSesionAdmin())) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    return Response.json({ ok: true, estructuras: await getEstructurasGuion() });
  } catch (e) {
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: { action?: string; estructuras?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  try {
    if (body.action === 'reset') return Response.json({ ok: true, estructuras: await resetEstructurasGuion() });
    return Response.json({ ok: true, estructuras: await setEstructurasGuion(body.estructuras) });
  } catch (e) {
    return Response.json({ ok: false, error: msg(e) }, { status: 422 });
  }
}
