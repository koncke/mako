// =============================================================================
// GET /api/cron/reto-avisos — los avisos del reto de 7 días, cada hora (20/11/2026)
// =============================================================================
// Schedule (vercel.json): «2 * * * *», dos minutos después de cada hora: los días del reto se abren a la hora en punto que eligió cada
// persona (lib/reto/dias.ts, `diaAbierto`). Manda lo que decide lib/reto/avisos.ts: el día nuevo (WhatsApp de MaKo, la app, el
// teléfono y el correo), lo que falta a las 20:00 y el WhatsApp de Martín a quien dejó el reto. Antes era un correo a las 10:00 de
// Argentina para todos, desde aviso-fin-de-prueba. `?seco=1` cuenta lo que saldría, sin mandar ni guardar nada.
// =============================================================================
import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { avisarDelReto } from '@/lib/reto/avisos-salida';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (auth) return auth;
  const enSeco = req.nextUrl.searchParams.get('seco') === '1';
  try {
    const r = await avisarDelReto({ enSeco });
    if (r.manana || r.noche || r.abandono || r.errores) {
      console.log(`[cron:reto-avisos] ${r.manana} día(s) nuevo(s), ${r.noche} de las 20:00, ${r.abandono} de abandono, ${r.whatsapp} WhatsApp, ${r.errores} errores${enSeco ? ' (en seco)' : ''}`);
    }
    return Response.json({ ok: true, enSeco, ...r });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[cron:reto-avisos]', error);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
