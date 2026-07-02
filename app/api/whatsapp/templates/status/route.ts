// =============================================================================
// API interna: status de plantillas en Meta (para notificar aprobaciones)
// =============================================================================
// Lo pollea el NotificationsProvider a nivel app: trae el status real de cada
// plantilla del WABA y, de paso, reconcilia la tabla de borradores. Liviano:
// una sola llamada a la Graph API.
// =============================================================================

import { listMetaTemplates, reconcileDrafts, explicarRechazo } from '@/lib/meta-templates';
import { integracionConectada } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Fase 1: el status vive en el WABA global del dueño → otros workspaces vacío.
  if (!(await integracionConectada('whatsapp'))) return Response.json({ ok: true, templates: [] });
  try {
    const metas = await listMetaTemplates();
    // mantener la tabla de borradores al día (best-effort, no rompe la respuesta)
    await reconcileDrafts(metas).catch(() => {});
    return Response.json({
      ok: true,
      templates: metas.map((m) => ({ name: m.name, status: m.status, motivo: m.status === 'rejected' ? explicarRechazo(m.rejectedReason) : null })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/status] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
