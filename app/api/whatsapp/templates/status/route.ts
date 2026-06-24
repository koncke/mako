// =============================================================================
// API interna: status de plantillas en Meta (para notificar aprobaciones)
// =============================================================================
// Lo pollea el NotificationsProvider a nivel app: trae el status real de cada
// plantilla del WABA y, de paso, reconcilia la tabla de borradores. Liviano:
// una sola llamada a la Graph API.
// =============================================================================

import { listMetaTemplates, reconcileDrafts } from '@/lib/meta-templates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metas = await listMetaTemplates();
    // mantener la tabla de borradores al día (best-effort, no rompe la respuesta)
    await reconcileDrafts(metas).catch(() => {});
    return Response.json({ ok: true, templates: metas.map((m) => ({ name: m.name, status: m.status })) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/status] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
