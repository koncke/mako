// =============================================================================
// API interna: enviar un ARCHIVO/multimedia a un contacto de WhatsApp (Chatwoot)
// =============================================================================
// POST multipart/form-data con campos:
//   - file:    el archivo (imagen, audio, video, documento)
//   - content: (opcional) texto/caption que acompaña al adjunto
// Reusa la conversación abierta del contacto. Solo llega dentro de la ventana
// de 24h (igual que el texto libre); fuera de eso WhatsApp exige plantilla.
// =============================================================================

import type { NextRequest } from 'next/server';
import { sendAttachmentToContact } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 16 * 1024 * 1024; // 16 MB — tope de media de WhatsApp

// Tipos que WhatsApp acepta. El `accept` del input es cosmético; esto es la
// barrera real (un POST directo podría mandar .exe/.svg/.html).
const DOCS_OK = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

function mimePermitido(t: string): boolean {
  if (!t) return true; // tipo desconocido (raro): que decida Meta
  const base = t.split(';')[0].trim().toLowerCase();
  if (base.startsWith('image/')) return ['image/jpeg', 'image/png', 'image/webp'].includes(base);
  if (base.startsWith('video/')) return ['video/mp4', 'video/3gpp'].includes(base);
  if (base.startsWith('audio/')) return true; // aac/mp3/ogg/amr/m4a
  return DOCS_OK.has(base);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const contactId = Number(id);
  if (!Number.isFinite(contactId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }

  // Corte temprano por Content-Length (antes de bufferear el multipart entero).
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BYTES + 1024 * 1024) {
    return Response.json({ ok: false, error: 'archivo demasiado grande (máx 16 MB)' }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: 'form inválido (se esperaba multipart)' }, { status: 400 });
  }

  const file = form.get('file');
  const contentRaw = form.get('content');
  const content = typeof contentRaw === 'string' ? contentRaw : undefined;

  if (!file || typeof file === 'string') {
    return Response.json({ ok: false, error: 'archivo faltante' }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ ok: false, error: 'archivo vacío' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: 'archivo demasiado grande (máx 16 MB)' }, { status: 413 });
  }
  if (!mimePermitido(file.type)) {
    return Response.json({ ok: false, error: 'Tipo de archivo no permitido en WhatsApp.' }, { status: 415 });
  }

  try {
    const r = await sendAttachmentToContact(contactId, file, file.name || 'archivo', content);
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/contacts attachments] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
