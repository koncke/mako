// =============================================================================
// Webhook: Zernio — RETIRADO (06/10/2026): contesta 200 y no procesa nada
// =============================================================================
// Instagram salió del producto por decisión de Martín («C: sacar la tab», 06/10/2026):
// la bandeja de DMs, el programador de publicaciones y el puente de los DMs al
// Chatbot. Medido ese día en producción: 0 filas en ig_conversaciones, ig_mensajes y
// contenido_posts en toda su historia.
//
// ⚠️ POR QUÉ LA RUTA SIGUE EXISTIENDO. Dos workspaces (ws11 y ws13) conectaron su
// cuenta de Zernio y la URL de este webhook puede seguir registrada del lado de
// Zernio. Un 404 o un 5xx haría que Zernio reintente (7 veces con backoff) cada
// evento, para siempre, y llenaría su panel de errores que nadie va a mirar.
//
// ⚠️ Y POR QUÉ DEJA RASTRO. Un 200 mudo hace indistinguibles «no llegó» y «lo tiramos
// nosotros» (AGENTS.md, «Una política puede RECHAZAR; no puede no dejar rastro»): el
// console.info nombra el evento y el motivo. No se guarda nada: el payload trae DMs de
// personas, y no hay pantalla que los vaya a leer.
//
// Sin verificación de firma, a propósito: la firma protegía las ESCRITURAS, y este
// handler no escribe ni lee nada. Las tablas (ig_conversaciones, ig_mensajes,
// contenido_posts, zernio_workspace) quedan en la base, sin migración de drop.

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const MOTIVO = 'Instagram se retiró del producto el 06/10/2026';

/** El nombre del evento, sólo para el rastro: recortado y sin nada que no sea un id. */
function eventoDe(raw: string): string {
  try {
    const p: unknown = JSON.parse(raw);
    const ev = p && typeof p === 'object' ? (p as { event?: unknown }).event : null;
    return typeof ev === 'string' ? ev.replace(/[^\w.:-]/g, '').slice(0, 60) || '—' : '—';
  } catch {
    return '—';
  }
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'zernio webhook', retirado: MOTIVO });
}

export async function POST(req: NextRequest) {
  const raw = await req.text().catch(() => '');
  const event = eventoDe(raw);
  console.info(`[webhook:zernio] ignorado: ${MOTIVO} (event=${event}, ${raw.length} bytes)`);
  return Response.json({ ok: true, event, ignored: 'instagram-retirado' });
}
