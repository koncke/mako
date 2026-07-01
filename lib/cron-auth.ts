// =============================================================================
// cron-auth — verificación del Bearer de Vercel Cron (CRON_SECRET)
// =============================================================================
// Mismo patrón que los crons existentes: Vercel firma el request con
// `Authorization: Bearer ${CRON_SECRET}`. Sin el secret en env, fail-closed.
// =============================================================================

import type { NextRequest } from 'next/server';

export function checkCronAuth(req: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: 'CRON_SECRET no configurado en env' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
