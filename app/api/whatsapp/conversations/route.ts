// =============================================================================
// API interna: lista de conversaciones de WhatsApp (Chatwoot) para la tab /whatsapp
// =============================================================================
// Proxy server-side a Chatwoot (el token nunca llega al cliente). Mismo nivel de
// exposición que el resto del dashboard (protegido a nivel Vercel).
// =============================================================================

import { listConversations } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const conversaciones = await listConversations();
    return Response.json({ ok: true, conversaciones });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/conversations] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
