// =============================================================================
// /api/ia-permiso — lo que la persona decidió sobre mandarle sus datos a una IA de terceros (Apple 5.1.2(i), 3/11/2026)
// =============================================================================
// GET → { preguntar, permitido }. POST { decision: 'si' | 'no' }. De la PERSONA de la sesión: el `?ws=` de la pestaña no decide.
// El corte de verdad no está acá: está en las puertas de la capa de IA (lib/ia-permiso.ts).

import type { NextRequest } from 'next/server';
import { estadoPermisoIa, guardarPermisoIa } from '@/lib/ia-permiso';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const e = await estadoPermisoIa();
    return e ? Response.json({ ok: true, ...e }) : Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  } catch (err) {
    console.error('[ia-permiso] no pude leer:', err instanceof Error ? err.message : String(err));
    return Response.json({ ok: false, error: 'No pudimos leer tu permiso.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { decision?: unknown } | null;
  if (body?.decision !== 'si' && body?.decision !== 'no') return Response.json({ ok: false, error: 'decisión inválida' }, { status: 400 });
  try {
    const ok = await guardarPermisoIa(body.decision);
    return ok ? Response.json({ ok: true }) : Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  } catch (err) {
    console.error('[ia-permiso] no pude guardar:', err instanceof Error ? err.message : String(err));
    return Response.json({ ok: false, error: 'No pudimos guardar tu permiso.' }, { status: 500 });
  }
}
