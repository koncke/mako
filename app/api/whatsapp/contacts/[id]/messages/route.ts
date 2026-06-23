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
import { getContactMessages, sendToContact, sendTemplateToContact, contactoEnInboxWA } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

// El contactId viene crudo de la URL: validamos server-side que el contacto sea
// del inbox de WhatsApp antes de leer/escribir (ver contactoEnInboxWA). Devuelve
// la Response a cortar, o null si el contacto es legítimo.
async function bloquearSiFueraDelInbox(contactId: number): Promise<Response | null> {
  try {
    if (await contactoEnInboxWA(contactId)) return null;
    return Response.json({ ok: false, error: 'contacto fuera del inbox de WhatsApp' }, { status: 403 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/contacts messages guard] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const contactId = Number(id);
  if (!Number.isFinite(contactId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }
  const bloqueo = await bloquearSiFueraDelInbox(contactId);
  if (bloqueo) return bloqueo;
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
  const bloqueo = await bloquearSiFueraDelInbox(contactId);
  if (bloqueo) return bloqueo;
  let body: {
    content?: unknown;
    templateName?: unknown;
    category?: unknown;
    language?: unknown;
    bodyParams?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  // Modo plantilla (fuera de la ventana de 24h).
  if (typeof body.templateName === 'string' && body.templateName) {
    const content = typeof body.content === 'string' ? body.content : '';
    const bodyParams =
      body.bodyParams && typeof body.bodyParams === 'object'
        ? (body.bodyParams as Record<string, string>)
        : {};
    const res = await sendTemplateToContact(contactId, {
      name: body.templateName,
      category: typeof body.category === 'string' ? body.category : 'marketing',
      language: typeof body.language === 'string' ? body.language : 'es_MX',
      bodyParams,
      content,
    });
    return Response.json(res, { status: res.ok ? 200 : 500 });
  }

  // Modo texto libre (dentro de la ventana de 24h).
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    return Response.json({ ok: false, error: 'content vacío' }, { status: 400 });
  }
  const res = await sendToContact(contactId, content);
  return Response.json(res, { status: res.ok ? 200 : 500 });
}
