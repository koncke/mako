// =============================================================================
// API interna: conversaciones/mensajes del WhatsApp NO oficial (espejo en DB)
// =============================================================================
// GET            → lista de conversaciones del canal no oficial del workspace.
// GET ?chat=<jid> → mensajes de esa conversación (con URLs firmadas de media).
// Scopeado por getTenantDb (cada rol ve solo su workspace); visible para admin/
// setter/closer que atienden los chats. Sin workspace (admin sin impersonar) →
// vacío (fail-closed del proxy tenant).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getConversacionesNoOficial, getMensajesDeChat } from '@/lib/evolution-mensajes';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const chat = req.nextUrl.searchParams.get('chat');
  try {
    if (chat) {
      const mensajes = await getMensajesDeChat(chat);
      return Response.json({ ok: true, mensajes });
    }
    const conversaciones = await getConversacionesNoOficial();
    return Response.json({ ok: true, conversaciones });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/mensajes] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
