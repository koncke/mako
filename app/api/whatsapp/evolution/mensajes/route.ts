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
import { jidToNumero, fetchProfilePic, fetchMediaBase64, listarLineas } from '@/lib/evolution';
import { rotuloLinea } from '@/lib/lineas-whatsapp';

export const dynamic = 'force-dynamic';

const MAX_ARCHIVO = 4 * 1024 * 1024; // 4 MB — bajo el límite de body de Vercel (4.5MB)
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── La media sale con un tipo de una LISTA BLANCA, o sale para descargar ──────────────────────
// ⚠️ EL MIMETYPE LO ELIGE QUIEN MANDA EL MENSAJE, y acá quien manda es CUALQUIER LEAD que le
//    escribe al negocio. Servido verbatim desde nuestro origen, un documento declarado `text/html`
//    o `image/svg+xml` se abría («Abrir en pestaña nueva») como una página de hola-mako.com y corría
//    su <script> con la sesión del admin, closer o setter que lo abría (auditoría de seguridad,
//    14/10/2026). Pasa por acá cuando la media no está en el bucket (el sync guarda `media_path:
//    null`). El bucket ya fijaba octet-stream para un documento (lib/evolution-mensajes.ts); este
//    proxy no. Sale con su tipo SÓLO imagen raster, audio, video y PDF; lo demás, para descargar.
// ⚠️ GEMELO EXACTO del bloque de app/api/admin/mako-chats/media/route.ts (allá está el porqué
//    entero). Un route.ts no puede exportar nada que no sea de Next, y tests/seguridad-xss.test.ts
//    compara los dos códigos: si uno cambia solo, se pone rojo.
const MIME_EN_LINEA = /^(?:image\/(?:jpe?g|png|gif|webp|avif|bmp|heic|heif)|audio\/[a-z0-9][a-z0-9.+-]*|video\/[a-z0-9][a-z0-9.+-]*|application\/pdf)$/;
const EXTENSION_DESCARGA = new Map<string, string>([
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.ms-powerpoint', 'ppt'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  ['text/plain', 'txt'],
  ['text/csv', 'csv'],
  ['application/zip', 'zip'],
]);
function cabecerasDeMedia(mimetype: unknown, largo: number): Record<string, string> {
  const tipo = String(mimetype ?? '').split(';')[0].trim().toLowerCase();
  const comunes = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600', 'Content-Length': String(largo) };
  if (MIME_EN_LINEA.test(tipo)) return { 'Content-Type': tipo, ...comunes };
  const ext = EXTENSION_DESCARGA.get(tipo);
  return { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="adjunto${ext ? `.${ext}` : ''}"`, ...comunes };
}

export async function GET(req: NextRequest) {
  const chat = req.nextUrl.searchParams.get('chat');
  const avatar = req.nextUrl.searchParams.get('avatar');
  const resumen = req.nextUrl.searchParams.get('resumen');
  const buscar = req.nextUrl.searchParams.get('buscar');
  const media = req.nextUrl.searchParams.get('media');
  const avatarimg = req.nextUrl.searchParams.get('avatarimg');
  // La bandeja de UN número (varias líneas por negocio). Sin `linea`, todo el espejo.
  // El filtro corre con el scope del workspace, así que una línea ajena devuelve vacío.
  const linea = req.nextUrl.searchParams.get('linea') || null;
  try {
    // Las líneas del negocio para el desplegable de la bandeja. Acá y no en /api/whatsapp/evolution
    // (sólo admin) porque la bandeja la usa todo el equipo. Sólo el rótulo, el estado y cuál es la
    // de por default: el número completo y la gestión de la línea siguen siendo del admin.
    if (req.nextUrl.searchParams.get('lineas') === '1') {
      const lineas = await listarLineas();
      return Response.json({ ok: true, lineas: lineas.map((l, i) => ({ linea: l.instance_name, rotulo: rotuloLinea(l, i), estado: l.estado, esDefault: l.es_default })) });
    }
    if (avatarimg) {
      // Proxy de la foto de perfil: la bajamos del CDN de WhatsApp del lado del
      // servidor (el <img> directo daba 403 por Referer/expiración) y la servimos.
      const url = await fetchProfilePic(avatarimg);
      if (!url) return new Response('sin foto', { status: 404, headers: { 'Cache-Control': 'private, max-age=1800' } });
      try {
        const rp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!rp.ok) return new Response('no', { status: 404, headers: { 'Cache-Control': 'private, max-age=600' } });
        return new Response(Buffer.from(await rp.arrayBuffer()), {
          headers: { 'Content-Type': rp.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
        });
      } catch { return new Response('no', { status: 404, headers: { 'Cache-Control': 'private, max-age=600' } }); }
    }
    if (media) {
      // Proxy de media: baja el base64 del mensaje desde Evolution y lo sirve
      // (así imágenes/audios/PDF se ven aunque no estén bajados al bucket).
      const r = await fetchMediaBase64(chat ?? '', media, req.nextUrl.searchParams.get('fromMe') === '1', linea);
      if (!r) return new Response('media no disponible', { status: 404 });
      // Nunca `r.mimetype` derecho a la cabecera: ver `cabecerasDeMedia`.
      const bytes = Buffer.from(r.base64, 'base64');
      return new Response(bytes, { headers: cabecerasDeMedia(r.mimetype, bytes.length) });
    }
    if (avatar) {
      const url = await fetchProfilePic(avatar);
      return Response.json({ ok: true, url });
    }
    if (chat) {
      const mensajes = await getMensajesDeChat(chat, 300, linea);
      return Response.json({ ok: true, mensajes });
    }
    if (buscar) {
      // Buscar cualquier lead del CRM para traerlo al inbox (#2).
      const conversaciones = await buscarLeadsComoPlaceholders(buscar);
      return Response.json({ ok: true, conversaciones });
    }
    if (resumen) {
      // Fast-path del polling global de notificaciones (una sola query, sin enriquecer).
      const conversaciones = await getResumenNoOficial(600, linea);
      return Response.json({ ok: true, conversaciones });
    }
    const conversaciones = await getConversacionesNoOficial(600, req.nextUrl.searchParams.get('ocultos') === '1', linea);
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

  let body: { chat?: string; telefono?: string; texto?: string; leadId?: number | null; linea?: string | null };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const texto = String(body.texto ?? '').trim();
  const telefono = String(body.telefono ?? '').replace(/\D/g, '') || jidToNumero(body.chat ?? null) || '';
  if (!texto) return Response.json({ ok: false, error: 'texto vacío' }, { status: 400 });
  if (!telefono) return Response.json({ ok: false, error: 'destino inválido' }, { status: 400 });
  try {
    // Se contesta por la línea de la bandeja abierta: el contacto le escribió a ESE número.
    const r = await enviarYEspejar({ telefono, texto, chatJid: body.chat ?? null, leadId: body.leadId ?? null, linea: typeof body.linea === 'string' && body.linea ? body.linea : null });
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
  const linea = String(form.get('linea') ?? '') || null;
  if (!telefono) return Response.json({ ok: false, error: 'destino inválido' }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ ok: false, error: 'falta el archivo' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return Response.json({ ok: false, error: 'archivo vacío' }, { status: 400 });
  if (buf.length > MAX_ARCHIVO) return Response.json({ ok: false, error: 'archivo muy grande (máx 4 MB por ahora)' }, { status: 400 });
  const base64 = buf.toString('base64');
  const mimetype = file.type || 'application/octet-stream';
  try {
    if (tipo === 'audio' || mimetype.startsWith('audio/')) {
      const r = await enviarAudioYEspejar({ telefono, base64, mimetype, leadId, linea });
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
      return Response.json({ ok: true, chatJid: r.chatJid ?? null });
    }
    const mediaTipo: 'image' | 'video' | 'document' =
      mimetype.startsWith('image/') ? 'image' : mimetype.startsWith('video/') ? 'video' : 'document';
    const r = await enviarMediaYEspejar({ telefono, media: { base64, mimetype, fileName: file.name || 'archivo', tipo: mediaTipo }, caption, leadId, linea });
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
    return Response.json({ ok: true, chatJid: r.chatJid ?? null });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/mensajes POST media] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
