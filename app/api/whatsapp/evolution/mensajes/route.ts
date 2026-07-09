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
import { enviarYEspejar } from '@/lib/evolution-envio';
import { jidToNumero } from '@/lib/evolution';

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

// Envío manual (setter/admin escribe a un lead por el no oficial, con anti-ban).
export async function POST(req: NextRequest) {
  let body: { chat?: string; telefono?: string; texto?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const texto = String(body.texto ?? '').trim();
  const telefono = String(body.telefono ?? '').replace(/\D/g, '') || jidToNumero(body.chat ?? null) || '';
  if (!texto) return Response.json({ ok: false, error: 'texto vacío' }, { status: 400 });
  if (!telefono) return Response.json({ ok: false, error: 'destino inválido' }, { status: 400 });
  try {
    const r = await enviarYEspejar({ telefono, texto, chatJid: body.chat ?? null });
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/mensajes POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
