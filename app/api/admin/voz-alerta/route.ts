// =============================================================================
// /api/admin/voz-alerta — ¿está caída la voz de MaKo? (para AlertaVozMaKo)
// =============================================================================
// Solo admin. Mide en vivo en vez de leer lo último que guardó el cron: el cron corre cada
// 10 minutos, y una alerta que aparece —o se va— diez minutos tarde es una alerta que no se
// cree. La sonda cuesta ~250 ms, y `estadoAlertaVoz` la memoriza 30 s con una sola en vuelo:
// la piden todas las pestañas admin abiertas, una vez por minuto cada una.

import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { estadoAlertaVoz } from '@/lib/canal-vigilante';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return NextResponse.json({ ok: true, ...(await estadoAlertaVoz()) });
}
