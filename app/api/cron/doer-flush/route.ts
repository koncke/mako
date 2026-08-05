// =============================================================================
// Cron: destrabar los lotes de WhatsApp que quedaron a medias
// =============================================================================
// El buffer del doer (lib/mako-doer-buffer) espera a que el dueño termine de hablar
// dentro del `after()` del webhook de Evolution. Eso mantiene viva la invocación pero
// NO la hace durable: si Vercel recicla la instancia, el que estaba esperando muere y
// esos mensajes se quedan en la cola para siempre — el dueño escribió y nadie contestó,
// que es exactamente el silencio que ya nos pasó una vez con los grupos de los clientes.
//
// Este cron es la red: cada minuto busca colas con mensajes de más de 2 minutos y sin
// candado vivo, y las procesa. En el camino feliz no encuentra nada.
//
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { flushHuerfanos } from '@/lib/mako-doer-in';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const unauth = checkCronAuth(request);
  if (unauth) return unauth;
  try {
    const r = await flushHuerfanos();
    return Response.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[cron:doer-flush] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
