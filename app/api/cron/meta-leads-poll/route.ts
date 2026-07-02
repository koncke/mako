// =============================================================================
// Cron: polling diario de leads de Meta (red de seguridad del webhook)
// =============================================================================
// El webhook de Meta (app/api/webhooks/meta-leads) recibe leads en tiempo
// real. Este cron lo respalda: una vez por día repasa los formularios de la
// página y trae los leads recientes. Como upsertLeadFromMeta deduplica por
// meta_lead_id, repasar no duplica nada.
//
// También sirve de BACKFILL inicial: GET ?dias=90 trae toda la ventana de
// 90 días que Meta retiene. La lógica vive en lib/meta-leads.ts (pollMetaLeads)
// y la comparte la extracción del onboarding.
//
// Auth: Bearer ${CRON_SECRET} (mismo patrón que meta-daily).
// =============================================================================

import type { NextRequest } from 'next/server';
import { pollMetaLeads } from '@/lib/meta-leads';
import { correrPorWorkspace } from '@/lib/cron-workspaces';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  const dias = Math.max(1, Number(request.nextUrl.searchParams.get('dias') ?? 7));
  const tStart = Date.now();

  const workspaces = await correrPorWorkspace('meta', async () => {
    const r = await pollMetaLeads(dias);
    console.log(
      `[cron:meta-leads-poll] dias=${dias} forms=${r.forms_revisados} vistos=${r.leads_vistos} creados=${r.creados} existentes=${r.existentes} errores=${r.errores}`,
    );
    return r;
  });

  const ms = Date.now() - tStart;
  return Response.json({ ok: true, dias, workspaces, ms });
}
