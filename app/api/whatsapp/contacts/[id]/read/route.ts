// =============================================================================
// API interna: marcar como leídas las conversaciones de un contacto (Chatwoot)
// =============================================================================
// POST → update_last_seen en todas las conversaciones del contacto (limpia el
// unread_count que se ve como el círculo con número en la lista de chats).
// =============================================================================

import type { NextRequest } from 'next/server';
import { markContactRead, contactoEnInboxWA } from '@/lib/chatwoot';
import { esWorkspaceDueno } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Fase 1: marcar leído escribe sobre el inbox de WhatsApp global del dueño.
  if (!(await esWorkspaceDueno())) return Response.json({ ok: false, error: 'solo el workspace dueño (Fase 1)' }, { status: 403 });
  const { id } = await ctx.params;
  const contactId = Number(id);
  if (!Number.isFinite(contactId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }
  try {
    if (!(await contactoEnInboxWA(contactId))) {
      return Response.json({ ok: false, error: 'contacto no pertenece al inbox' }, { status: 403 });
    }
    await markContactRead(contactId);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/contacts read] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
