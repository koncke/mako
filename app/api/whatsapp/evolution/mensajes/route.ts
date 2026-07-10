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
import { getConversacionesNoOficial, getResumenNoOficial, getMensajesDeChat, buscarLeadsComoPlaceholders } from '@/lib/evolution-mensajes';
import { enviarYEspejar, enviarMediaYEspejar, enviarAudioYEspejar } from '@/lib/evolution-envio';
import { jidToNumero, fetchProfilePic } from '@/lib/evolution';

export const dynamic = 'force-dynamic';

const MAX_ARCHIVO = 4 * 1024 * 1024; // 4 MB — bajo el límite de body de Vercel (4.5MB)
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const chat = req.nextUrl.searchParams.get('chat');
  const avatar = req.nextUrl.searchParams.get('avatar');
  const resumen = req.nextUrl.searchParams.get('resumen');
  const buscar = req.nextUrl.searchParams.get('buscar');
  try {
    if (avatar) {
      const url = await fetchProfilePic(avatar);
      return Response.json({ ok: true, url });
    }
    if (chat) {
      const mensajes = await getMensajesDeChat(chat);
      return Response.json({ ok: true, mensajes });
    }
    if (buscar) {
      // Buscar cualquier lead del CRM para traerlo al inbox (#2).
      const conversaciones = await buscarLeadsComoPlaceholders(buscar);
      return Response.json({ ok: true, conversaciones });
    }
    if (resumen) {
      // Fast-path del polling global de notificaciones (una sola query, sin enriquecer).
      const conversaciones = await getResumenNoOficial();
      return Response.json({ ok: true, conversaciones });
    }
    const conversaciones = await getConversacionesNoOficial();
    return Response.json({ ok: true, conversaciones });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/mensajes] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

// Envío manual (setter/admin escribe a un lead por el no oficial, con anti-ban).
// JSON → texto; multipart/form-data → media (imagen/doc) o nota de voz (audio).
// Manual = el humano lo mandó → directo (la regla anti-ban del PDF es solo para
// los envíos AUTOMÁTICOS del motor).
export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) return postMedia(req);

  let body: { chat?: string; telefono?: string; texto?: string; leadId?: number | null };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const texto = String(body.texto ?? '').trim();
  const telefono = String(body.telefono ?? '').replace(/\D/g, '') || jidToNumero(body.chat ?? null) || '';
  if (!texto) return Response.json({ ok: false, error: 'texto vacío' }, { status: 400 });
  if (!telefono) return Response.json({ ok: false, error: 'destino inválido' }, { status: 400 });
  try {
    const r = await enviarYEspejar({ telefono, texto, chatJid: body.chat ?? null, leadId: body.leadId ?? null });
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
    return Response.json({ ok: true, chatJid: r.chatJid ?? null });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/mensajes POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

async function postMedia(req: NextRequest): Promise<Response> {
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ ok: false, error: 'form inválido' }, { status: 400 }); }
  const chat = String(form.get('chat') ?? '') || null;
  const telefono = String(form.get('telefono') ?? '').replace(/\D/g, '') || jidToNumero(chat) || '';
  const tipo = String(form.get('tipo') ?? '');
  const caption = String(form.get('caption') ?? '').trim();
  const leadRaw = form.get('leadId');
  const leadId = leadRaw != null && String(leadRaw) ? Number(leadRaw) : null;
  const file = form.get('archivo');
  if (!telefono) return Response.json({ ok: false, error: 'destino inválido' }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ ok: false, error: 'falta el archivo' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return Response.json({ ok: false, error: 'archivo vacío' }, { status: 400 });
  if (buf.length > MAX_ARCHIVO) return Response.json({ ok: false, error: 'archivo muy grande (máx 4 MB por ahora)' }, { status: 400 });
  const base64 = buf.toString('base64');
  const mimetype = file.type || 'application/octet-stream';
  try {
    if (tipo === 'audio' || mimetype.startsWith('audio/')) {
      const r = await enviarAudioYEspejar({ telefono, base64, mimetype, leadId });
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, chatJid: r.chatJid ?? null });
    }
    const mediaTipo: 'image' | 'video' | 'document' =
      mimetype.startsWith('image/') ? 'image' : mimetype.startsWith('video/') ? 'video' : 'document';
    const r = await enviarMediaYEspejar({ telefono, media: { base64, mimetype, fileName: file.name || 'archivo', tipo: mediaTipo }, caption, leadId });
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
    return Response.json({ ok: true, chatJid: r.chatJid ?? null });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/mensajes POST media] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
