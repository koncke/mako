// =============================================================================
// API interna: mensajes de una conversación de WhatsApp + responder texto libre
// =============================================================================
// GET  → lista de mensajes de la conversación.
// POST → manda un mensaje de texto (solo válido dentro de la ventana de 24h del
//        lead; fuera de eso WhatsApp exige template — usar el motor de nutrición).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getMessages, sendText } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const convId = Number(id);
  if (!Number.isFinite(convId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }
  try {
    const mensajes = await getMessages(convId);
    return Response.json({ ok: true, mensajes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/messages GET] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const convId = Number(id);
  if (!Number.isFinite(convId)) {
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
  const res = await sendText(convId, content);
  return Response.json(res, { status: res.ok ? 200 : 500 });
}
