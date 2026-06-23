// =============================================================================
// API interna: mensajes mergeados de una lista de conversaciones (un hilo por
// persona, juntando los contactos duplicados de Chatwoot)
// =============================================================================
// GET ?ids=1,2,3 → todos los mensajes de esas conversaciones, cronológicos.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getMessagesForConvs } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ids = (new URL(req.url).searchParams.get('ids') || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return Response.json({ ok: true, mensajes: [] });
  try {
    const mensajes = await getMessagesForConvs(ids);
    return Response.json({ ok: true, mensajes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/thread] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
