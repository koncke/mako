// =============================================================================
// Cron: polling de leads de Meta, cada 10 minutos (red de seguridad del webhook)
// =============================================================================
// El webhook de Meta (app/api/webhooks/meta-leads) recibe leads en tiempo
// real, PERO SÓLO si la página está suscripta a nuestra app. Este cron lo
// respalda: repasa los formularios de la página y trae los leads recientes.
// Como upsertLeadFromMeta deduplica por meta_lead_id, repasar no duplica nada.
//
// Corre cada 10 minutos desde el 08/10/2026 (antes, una vez por día): para una
// página sin suscribir es el ÚNICO camino, y un lead tardaba hasta 19 horas en
// aparecer en el CRM. Las reglas —qué ventana y qué lead deja para el webhook—
// viven en lib/meta-leads-poll-reglas.ts, con el porqué y lo medido.
//
// También sirve de BACKFILL inicial: GET ?dias=90 trae toda la ventana de
// 90 días que Meta retiene. La lógica vive en lib/meta-leads.ts (pollMetaLeads)
// y la comparte la extracción del onboarding.
//
// Auth: Bearer ${CRON_SECRET} (mismo patrón que meta-daily).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { pollMetaLeads } from '@/lib/meta-leads';
import { correrPorWorkspace } from '@/lib/cron-workspaces';
import { ventanaDelPoll } from '@/lib/meta-leads-poll-reglas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;

  const dias = ventanaDelPoll(new Date(), request.nextUrl.searchParams.get('dias'));
  const tStart = Date.now();

  const workspaces = await correrPorWorkspace('meta', async () => {
    const r = await pollMetaLeads(dias);
    console.log(
      `[cron:meta-leads-poll] dias=${dias} forms=${r.forms_revisados} vistos=${r.leads_vistos} creados=${r.creados} existentes=${r.existentes} del_webhook=${r.del_webhook} errores=${r.errores}`,
    );
    return r;
  });

  const ms = Date.now() - tStart;
  return Response.json({ ok: true, dias, workspaces, ms });
}
