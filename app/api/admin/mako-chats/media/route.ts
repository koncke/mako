// =============================================================================
// /api/admin/mako-chats/media — proxy de la media de un mensaje de grupo
// =============================================================================
// Solo admin. GET ?jid=&id=&fromMe= → trae los bytes de la media desde Evolution
// (getBase64FromMediaMessage de la instancia de voz) y los sirve same-origin, así
// el <img>/<audio>/<video>/<a> del hilo los carga sin exponer la API key.

import { type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { fetchMediaGrupoMaKo } from '@/lib/mako-chat';

export const dynamic = 'force-dynamic';

// ── La media sale con un tipo de una LISTA BLANCA, o sale para descargar ──────────────────────
// ⚠️ EL MIMETYPE LO ELIGE QUIEN MANDA EL MENSAJE. WhatsApp transporta el que puso el cliente del
//    remitente y Evolution lo devuelve tal cual. Servido verbatim desde NUESTRO origen, un documento
//    declarado `text/html` o `image/svg+xml` mandado a un grupo con la línea de MaKo se abría («Abrir
//    en pestaña nueva» de BurbujaHilo) como una página de hola-mako.com y corría su <script> con la
//    sesión del super admin (auditoría de seguridad, 14/10/2026). No lo cortaba nada: el CSP global no
//    tiene script-src, y `nosniff` no frena un tipo DECLARADO. lib/evolution-mensajes.ts ya lo sabía
//    para el bucket («no confiamos en el mimetype del payload — un contacto podría spoofearlo»); este
//    proxy no.
//    Sale con su tipo SÓLO lo que el hilo dibuja en un <img>/<audio>/<video> o lo que el navegador
//    muestra sin correr nada nuestro: imagen raster, audio, video y PDF. Todo lo demás sale como bytes
//    para DESCARGAR (`application/octet-stream` + `attachment`), con la extensión de su tipo si es un
//    documento conocido, para que la computadora lo abra con su programa. El tipo se reescribe sin
//    parámetros (`audio/ogg; codecs=opus` → `audio/ogg`, que se reproduce igual): nada del remitente
//    se copia a una cabecera.
// ⚠️ GEMELO EXACTO del bloque de app/api/whatsapp/evolution/mensajes/route.ts (la bandeja tiene el
//    mismo proxy). Un route.ts no puede exportar nada que no sea de Next, así que el bloque está dos
//    veces, y tests/seguridad-xss.test.ts compara los dos códigos: si uno cambia solo, se pone rojo.
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
  if (!(await getSesionAdmin())) return new Response('solo admin', { status: 403 });
  const url = new URL(req.url);
  const jid = url.searchParams.get('jid') || '';
  const id = url.searchParams.get('id') || '';
  const fromMe = url.searchParams.get('fromMe') === '1';
  if (!jid || !id) return new Response('faltan jid o id', { status: 400 });

  const media = await fetchMediaGrupoMaKo(jid, id, fromMe);
  if (!media) return new Response('media no disponible', { status: 404 });

  const bytes = Buffer.from(media.base64, 'base64');
  // Nunca `media.mimetype` derecho a la cabecera: ver `cabecerasDeMedia`.
  return new Response(bytes, { headers: cabecerasDeMedia(media.mimetype, bytes.length) });
}
