// =============================================================================
// Cron: borra los turnos de la PC del cliente de más de un día, y los códigos viejos (diario)
// =============================================================================
// Un turno guarda el system con datos del negocio, la conversación y lo que leyeron sus herramientas (leads, teléfonos):
// no se guarda para siempre (revisión del Cerebro, 21/10/2026). Las herramientas se van con su turno (`on delete
// cascade`, mig 0320). Las reglas viven en lib/ia-pc.ts → `purgarTurnosViejos`.
//
//   GET /api/cron/ia-pc-purga            → borra lo de más de 24 h
//   GET /api/cron/ia-pc-purga?seco=1     → sólo cuenta, NO borra

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { purgarTurnosViejos } from '@/lib/ia-pc';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  try {
    const r = await purgarTurnosViejos({ seco: req.nextUrl.searchParams.get('seco') === '1' });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
