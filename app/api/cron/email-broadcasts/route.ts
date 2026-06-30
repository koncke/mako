// =============================================================================
// Cron: broadcasts de email programados
// =============================================================================
// Procesa los broadcasts en estado 'programado' cuya fecha ya venció y los envía
// por Resend. SOLO procesa con envío real habilitado (EMAIL_SEND_ENABLED=true);
// si está apagado, deja los programados intactos para que salgan cuando se active
// (no los "quema" como simulado). ?force=1 procesa igual (modo simulado, para
// probar la máquina a mano). Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { procesarBroadcastsProgramados } from '@/lib/email-marketing';
import { EMAIL_SEND_ENABLED } from '@/lib/resend';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const unauth = checkAuth(request);
  if (unauth) return unauth;

  const force = new URL(request.url).searchParams.get('force') === '1';
  if (!EMAIL_SEND_ENABLED && !force) {
    return Response.json({ ok: true, modo: 'skip', motivo: 'EMAIL_SEND_ENABLED apagado (los programados esperan)' });
  }

  const tStart = Date.now();
  try {
    const r = await procesarBroadcastsProgramados();
    return Response.json({ ok: true, modo: EMAIL_SEND_ENABLED ? 'envío real' : 'simulado', ...r, ms: Date.now() - tStart });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:email-broadcasts] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
