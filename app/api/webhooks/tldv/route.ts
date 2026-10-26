// =============================================================================
// Webhook: tl;dv → la reunión terminó (MeetingReady)
// =============================================================================
// tl;dv avisa `{ event: 'MeetingReady', data: { id, organizer: { email }, … } }` (doc.tldv.io, medido el 26/10/2026).
// De quién es: el ORGANIZADOR, contra `TLDV_HOST_EMAIL` (webhook_routing, servicio 'tldv'), como el `recorded_by` de
// Fathom, y con la lectura ESTRICTA (AGENTS.md: «no pude leer» no es «no es de nadie»).
//
// ⚠️ TL;DV NO FIRMA SUS AVISOS (no está documentado: sólo deja agregar headers propios). Por eso del aviso se usan DOS
// datos —el correo para saber de qué negocio es y el id de la reunión— y la reunión se pide ENTERA por la API con la
// clave de ESE negocio (lib/grabadores/al-terminar.ts, `leerYTerminar`). Un aviso falso, a lo sumo, hace leer una
// reunión que de verdad es suya; no puede meter contenido. La lectura es idempotente (el candado y la marca del Plan).
//
// tl;dv espera 10 s la respuesta: se contesta enseguida y la lectura sigue en `after()`.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { leerYTerminar } from '@/lib/grabadores/al-terminar';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const EVENTOS = new Set(['MeetingReady', 'TranscriptReady']);

export async function POST(request: NextRequest) {
  const tStart = Date.now();
  let body: { event?: unknown; data?: { id?: unknown; meetingId?: unknown; organizer?: { email?: unknown } } };
  try {
    const parsed: unknown = JSON.parse(await request.text());
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    body = parsed as typeof body;
  } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const evento = typeof body.event === 'string' ? body.event : '';
  if (!EVENTOS.has(evento)) return Response.json({ ok: true, ignored: `evento ${evento || '—'}` });
  // MeetingReady trae la reunión (`data.id`); TranscriptReady, la transcripción (`data.meetingId`) y no dice quién organizó.
  const id = String(evento === 'TranscriptReady' ? body.data?.meetingId ?? '' : body.data?.id ?? '').slice(0, 200);
  const organizador = typeof body.data?.organizer?.email === 'string' && body.data.organizer.email.length <= 300 ? body.data.organizer.email : null;
  if (!id) return Response.json({ ok: true, ignored: 'sin id de reunión' });
  if (!organizador) return Response.json({ ok: true, ignored: 'el aviso no dice quién organizó (suscribe «MeetingReady»)' });

  let ws: number | null;
  try {
    ws = await wsPorIdentificadorEstricto('tldv', organizador);
  } catch (err) {
    return responderFalloDeRuteo('tldv', err, organizador);
  }
  if (ws == null) {
    console.warn(`[webhook:tldv] sin negocio para el organizador ${organizador} — ignorado`);
    return Response.json({ ok: true, ignored: 'sin workspace' });
  }

  const wsAviso = ws;
  after(() => leerYTerminar(wsAviso, { grabador: 'tldv', id }, { hasta: tStart + 280_000, log: '[webhook:tldv]' }));
  return Response.json({ ok: true, recibido: id, ms: Date.now() - tStart });
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'tl;dv webhook', usage: 'POST con el evento MeetingReady' });
}
