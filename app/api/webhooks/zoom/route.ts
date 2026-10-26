// =============================================================================
// Webhook: Zoom → la grabación en la nube y su transcripción están listas
// =============================================================================
// Zoom firma cada aviso con `x-zm-signature` = «v0=» + hex de HMAC-SHA256(«v0:<x-zm-request-timestamp>:<cuerpo>») con
// el «Secret Token» de la app (ZOOM_WEBHOOK_SECRET), y valida la dirección con `endpoint.url_validation`: hay que
// devolver `{ plainToken, encryptedToken }` (el plainToken en HMAC con el mismo secreto) en menos de 3 s, y lo vuelve
// a pedir cada 72 h (developers.zoom.us, medido el 26/10/2026). Esa validación no dice de qué cuenta es: el negocio es
// el cuyo secreto verifica la firma (lib/grabadores/ruteo-por-firma.ts), para todos los eventos por igual.
//
// La reunión NO se lee del aviso: se pide entera por la API con la app de ese negocio (`leerYTerminar`), en `after()`,
// porque Zoom corta a los 3 s y bajar la transcripción (un VTT) lleva más.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { negocioPorFirma } from '@/lib/grabadores/ruteo-por-firma';
import { firmaZoomValida, respuestaValidacionZoom } from '@/lib/grabadores/firmas';
import { leerYTerminar } from '@/lib/grabadores/al-terminar';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Un aviso más viejo que esto se rechaza (repetición): el reloj va en lo firmado. */
const TOLERANCIA_S = 300;
const LISTA = new Set(['recording.transcript_completed', 'recording.completed']);

export async function POST(request: NextRequest) {
  const tStart = Date.now();
  const raw = await request.text();
  const ts = (request.headers.get('x-zm-request-timestamp') ?? '').trim();
  const firma = (request.headers.get('x-zm-signature') ?? '').trim();
  const t = Number(ts);
  if (!firma || !Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > TOLERANCIA_S) {
    return Response.json({ ok: false, error: 'signature', message: 'sin firma o con la hora vencida' }, { status: 401 });
  }

  let destino: { ws: number; secreto: string } | null;
  try {
    destino = await negocioPorFirma('ZOOM_WEBHOOK_SECRET', (secreto) => firmaZoomValida(raw, ts, firma, secreto));
  } catch (err) {
    return responderFalloDeRuteo('zoom', err, null);
  }
  if (!destino) {
    console.warn('[webhook:zoom] la firma no verifica ningún secreto — rechazado');
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }

  let body: { event?: unknown; payload?: { plainToken?: unknown; object?: { uuid?: unknown } } };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    body = parsed as typeof body;
  } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const evento = String(body.event ?? '');
  if (evento === 'endpoint.url_validation') {
    const plainToken = typeof body.payload?.plainToken === 'string' ? body.payload.plainToken : '';
    if (!plainToken) return Response.json({ ok: false, error: 'sin plainToken' }, { status: 400 });
    return Response.json(respuestaValidacionZoom(plainToken, destino.secreto));
  }
  if (!LISTA.has(evento)) return Response.json({ ok: true, ignored: `evento ${evento || '—'}` });
  const uuid = String(body.payload?.object?.uuid ?? '').slice(0, 200);
  if (!uuid) return Response.json({ ok: true, ignored: 'sin uuid de reunión' });

  const ws = destino.ws;
  after(() => leerYTerminar(ws, { grabador: 'zoom', id: uuid }, { hasta: tStart + 280_000, log: '[webhook:zoom]' }));
  return Response.json({ ok: true, recibido: uuid, ms: Date.now() - tStart });
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'zoom webhook', usage: 'POST firmado con x-zm-signature' });
}
