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
  return new Response(bytes, {
    headers: {
      'Content-Type': media.mimetype,
      'Cache-Control': 'private, max-age=3600',
      'Content-Length': String(bytes.length),
    },
  });
}
