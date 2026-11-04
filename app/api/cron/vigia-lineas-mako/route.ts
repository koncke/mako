// =============================================================================
// GET /api/cron/vigia-lineas-mako — si se cae una línea de Martín, avisa por la otra
// =============================================================================
// Cada 3 minutos (vercel.json). Lo que decide está en lib/lineas-de-mako.ts.
// El mail de la voz de MaKo sigue aparte, cada 10 minutos, en /api/cron/alerta-critica.
//
// Auth por CRON_SECRET (`checkCronAuth`, primera sentencia), como todo /api/cron.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { vigilarLineasDeMako } from '@/lib/lineas-de-mako-vigilante';

export const dynamic = 'force-dynamic';
// Cada envío tiene un tope de 30 s en `evFetch`, y en el peor caso se prueban dos rutas y el mail.
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const fail = checkCronAuth(request);
  if (fail) return fail;

  try {
    const r = await vigilarLineasDeMako();
    if (r.error) console.error(`[cron:vigia-lineas-mako] ${r.error}`);
    // Se logea sólo cuando pasa algo: este cron corre 480 veces por día.
    for (const l of r.lineas) {
      if (l.que !== 'nada' || l.reabierta || l.error) {
        console.log(`[cron:vigia-lineas-mako] ${l.rol} ${l.instancia} ${l.estado ?? '?'}/${l.codigo ?? '-'} ${l.sondeo} → ${l.que}${l.reabierta ? ' (reabierta)' : ''}${l.llego === undefined ? '' : l.llego ? ` (por ${l.por})` : ' (NO llegó)'}${l.error ? ` — ${l.error}` : ''}`);
      }
    }
    return Response.json({ ok: !r.error, ...r });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:vigia-lineas-mako] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
