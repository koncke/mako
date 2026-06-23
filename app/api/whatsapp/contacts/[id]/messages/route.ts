// =============================================================================
// API interna: mensajes de un CONTACTO (merge de sus conversaciones) + responder
// =============================================================================
// GET  → todos los mensajes del contacto, cronológicos (junta las conversaciones
//        que Chatwoot haya creado para esa persona).
// POST → responde texto libre reusando la conversación abierta del contacto
//        (solo se entrega dentro de la ventana de 24h; fuera de eso WhatsApp
//        exige template — eso lo hace el motor de nutrición).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getContactMessages, sendToContact } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const contactId = Number(id);
  if (!Number.isFinite(contactId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }
  try {
    const mensajes = await getContactMessages(contactId);
    return Response.json({ ok: true, mensajes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/contacts messages GET] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const contactId = Number(id);
  if (!Number.isFinite(contactId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }
  let content = '';
  try {
    const body = (await req.json()) as { content?: unknown };
    content = typeof body.content === 'string' ? body.content.trim() : '';
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  if (!content) {
    return Response.json({ ok: false, error: 'content vacío' }, { status: 400 });
  }
  const res = await sendToContact(contactId, content);
  return Response.json(res, { status: res.ok ? 200 : 500 });
}
