// =============================================================================
// API interna: templates aprobados del inbox de WhatsApp (para el composer)
// =============================================================================
// Se usan para escribirle a un contacto FUERA de la ventana de 24h (WhatsApp
// solo permite plantillas aprobadas en ese caso).
// =============================================================================

import { getApprovedTemplates } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const templates = await getApprovedTemplates();
    return Response.json({ ok: true, templates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
