// =============================================================================
// /api/chats/social — contestar a mano por Instagram o Messenger desde la tab Chats
// =============================================================================
// POST { convId: number, texto } → { ok, mensaje: MensajeChat }
//                                · { ok: false, error, terminal? } — `terminal`: reintentar no lo arregla (la
//                                  ventana de 24 h se cerró, o Meta dijo que no).
//
// Todo lo del canal (por dónde sale, la clave de idempotencia, la fila `saliente`) vive en lib/canal-zernio.ts
// (`enviarManualSocial`), que es del CANAL (tests/sin-instagram.test.ts). Sólo texto en v1, y sin `HUMAN_AGENT`
// (decisión 4 de docs/diseno-chats.md).
//
// Quién puede: cualquier rol con la tab, como el envío manual de WhatsApp (`POST /api/whatsapp/evolution/mensajes`
// no mira el rol). La ruta vieja de Instagram dejaba a admin y setter; Chats es de closer y setter además del
// admin, y contestar es el trabajo de quien atiende la conversación.

import { NextResponse } from 'next/server';
import { puertaChats } from '@/lib/chats';
import { enviarManualSocial } from '@/lib/canal-zernio';
import { TOPE_TEXTO_SOCIAL } from '@/lib/canal-social';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Zernio corta a los 20 s (lib/zernio.ts); esto es el margen. */
export const maxDuration = 30;

const err = (status: number, error: string, extra?: Record<string, unknown>) => NextResponse.json({ ok: false, error, ...extra }, { status });

export async function POST(req: Request) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const convId = Number(body?.convId);
  const texto = typeof body?.texto === 'string' ? body.texto.trim() : '';
  if (!Number.isSafeInteger(convId) || convId <= 0) return err(400, 'Falta la conversación.');
  if (!texto) return err(400, 'Mensaje vacío.');
  if (texto.length > TOPE_TEXTO_SOCIAL) return err(400, `Máximo ${TOPE_TEXTO_SOCIAL} caracteres.`);
  const r = await enviarManualSocial({ convId, texto });
  if (r.ok) return NextResponse.json({ ok: true, mensaje: r.mensaje });
  // Una regla de Meta (terminal) no es una caída: 422. Lo demás (Zernio o la base), 502.
  return err(r.terminal ? 422 : 502, r.error, r.terminal ? { terminal: true } : undefined);
}
