// =============================================================================
// /api/metodo/verificar — "Probar conexión" de una integración (super admin)
// =============================================================================
// POST { servicio, valores? } → delega en lib/metodo-verificar.ts (compartida
// con el wizard de onboarding). Los valores enviados pisan a los guardados/env,
// así se puede probar ANTES de guardar.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { verificarServicio } from '@/lib/metodo-verificar';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: { servicio?: string; valores?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  const resultado = await verificarServicio(body.servicio ?? '', body.valores && typeof body.valores === 'object' ? body.valores : {});
  if (resultado.error === 'servicio inválido') return NextResponse.json(resultado, { status: 400 });
  return NextResponse.json(resultado);
}
