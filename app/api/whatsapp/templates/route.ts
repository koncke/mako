// =============================================================================
// API interna: templates aprobados del inbox de WhatsApp (para el composer)
// =============================================================================
// Se usan para escribirle a un contacto FUERA de la ventana de 24h (WhatsApp
// solo permite plantillas aprobadas en ese caso). Fuente: la lista REAL de Meta
// (no la de Chatwoot, que se sincroniza tarde y se pierde las recién aprobadas).
// =============================================================================

import { getApprovedTemplates } from '@/lib/chatwoot';
import { listMetaTemplates } from '@/lib/meta-templates';
import { integracionConectada } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Fase 1: las plantillas de WhatsApp/Meta son del WABA global del dueño → vacío.
  if (!(await integracionConectada('whatsapp'))) return Response.json({ ok: true, templates: [] });
  try {
    // Meta es la fuente de verdad de las aprobadas (incluye las recién aprobadas).
    const metas = await listMetaTemplates();
    const templates = metas
      .filter((m) => m.status === 'approved')
      .map((m) => ({ name: m.name, category: m.category, language: m.language, params: m.params, body: m.body }));
    return Response.json({ ok: true, templates });
  } catch (err) {
    // Fallback a la lista sincronizada en Chatwoot si la Graph API falla.
    try {
      const templates = await getApprovedTemplates();
      return Response.json({ ok: true, templates });
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2);
      console.error(`[api:whatsapp/templates] ${err instanceof Error ? err.message : err} / ${msg}`);
      return Response.json({ ok: false, error: msg }, { status: 500 });
    }
  }
}
