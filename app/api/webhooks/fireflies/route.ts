// =============================================================================
// Webhook: Fireflies.ai → la reunión se transcribió (meeting.transcribed)
// =============================================================================
// Fireflies avisa `{ event: 'meeting.transcribed', meeting_id, timestamp }` (Webhooks V2, docs.fireflies.ai, medido el
// 26/10/2026): SÓLO el id, sin decir de quién es. Lo firma con `X-Hub-Signature: sha256=<hex>` = HMAC-SHA256 del cuerpo
// crudo con el «Signing Secret» que la persona carga en Fireflies y pega en MaKo (FIREFLIES_WEBHOOK_SECRET).
// De quién es: el negocio cuyo secreto verifica la firma (lib/grabadores/ruteo-por-firma.ts). Sin firma válida, de
// nadie: 401. La reunión se pide entera por la API con la clave de ese negocio (`leerYTerminar`).
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { negocioPorFirma } from '@/lib/grabadores/ruteo-por-firma';
import { firmaFirefliesValida } from '@/lib/grabadores/firmas';
import { leerYTerminar } from '@/lib/grabadores/al-terminar';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Los eventos que dicen «terminó y está la transcripción»: el de V2 y el de V1 (deprecado, pero puede seguir llegando). */
const TRANSCRIBIO = new Set(['meeting.transcribed', 'Transcription completed']);

export async function POST(request: NextRequest) {
  const tStart = Date.now();
  const raw = await request.text();
  const firma = (request.headers.get('x-hub-signature') ?? '').trim();

  let destino: { ws: number } | null;
  try {
    destino = firma ? await negocioPorFirma('FIREFLIES_WEBHOOK_SECRET', (secreto) => firmaFirefliesValida(raw, firma, secreto)) : null;
  } catch (err) {
    return responderFalloDeRuteo('fireflies', err, null);
  }
  if (!destino) {
    console.warn(`[webhook:fireflies] firma ${firma ? 'que no verifica ningún secreto' : 'ausente'} — rechazado`);
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }

  let body: { event?: unknown; eventType?: unknown; meeting_id?: unknown; meetingId?: unknown };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    body = parsed as typeof body;
  } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const evento = String(body.event ?? body.eventType ?? '');
  if (!TRANSCRIBIO.has(evento)) return Response.json({ ok: true, ignored: `evento ${evento || '—'}` });
  const id = String(body.meeting_id ?? body.meetingId ?? '').slice(0, 200);
  if (!id) return Response.json({ ok: true, ignored: 'sin id de reunión' });

  const ws = destino.ws;
  after(() => leerYTerminar(ws, { grabador: 'fireflies', id }, { hasta: tStart + 280_000, log: '[webhook:fireflies]' }));
  return Response.json({ ok: true, recibido: id, ms: Date.now() - tStart });
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'fireflies webhook', usage: 'POST firmado con X-Hub-Signature' });
}
