// =============================================================================
// /api/admin/voz-alerta — ¿está caída la voz de MaKo? (para AlertaVozMaKo)
// =============================================================================
// Solo admin. Mide en vivo en vez de leer lo último que guardó el cron: el cron corre cada
// 10 minutos, y una alerta que aparece —o se va— diez minutos tarde es una alerta que no se
// cree. La sonda cuesta ~250 ms, y `estadoAlertaVoz` memoriza 30 s lo MEDIDO con una sola
// sonda en vuelo: la piden todas las pestañas admin abiertas, una vez por minuto cada una.
// `?fresco=1` saltea el memo: lo pide la alerta cuando el panel acaba de conectar la línea,
// para no seguir en rojo un minuto sobre una línea que ya volvió.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { estadoAlertaVoz } from '@/lib/canal-vigilante';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const fresco = req.nextUrl.searchParams.get('fresco') === '1';
  return NextResponse.json({ ok: true, ...(await estadoAlertaVoz({ fresco })) });
}
