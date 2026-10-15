// =============================================================================
// /api/chats/hilo — el hilo de UN contacto de la tab Chats
// =============================================================================
// GET ?clave=<clave> → { ok, chat, mensajes, borradores, fallas }
//   · mensajes: los de TODAS sus identidades (WhatsApp en cada línea, Instagram, Messenger) + sus notas del
//     lead (`tipo: 'comentario'`) + los eventos (`chat_eventos` y los cambios de etapa/asignado del historial),
//     del más viejo al más nuevo.
//   · `chat.clave` puede no ser la pedida: una persona de Instagram que ya tiene lead vuelve como `lead:<id>`
//     (la pantalla lo nota y llama a `onClaveCambio`).
//   · `fallas` (extensión del contrato §2.2): las fuentes del hilo que no se pudieron leer.
//
// La pantalla lo sondea cada 8 s con la conversación abierta. La clave viene del navegador: se valida
// (`parsearClave`) y todo se lee con el scope del workspace (getTenantDb), así que una clave de otro negocio
// devuelve un hilo vacío.

import { NextResponse, type NextRequest } from 'next/server';
import { puertaChats, hiloDeChat } from '@/lib/chats';
import { parsearClave } from '@/lib/chats-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);
  const clave = req.nextUrl.searchParams.get('clave') ?? '';
  if (!parsearClave(clave)) return err(400, 'Conversación inválida.');
  try {
    const h = await hiloDeChat(clave, { usuario: puerta.yo });
    return NextResponse.json({ ok: true, chat: h.chat, mensajes: h.mensajes, borradores: h.borradores, fallas: h.fallas });
  } catch (e) {
    console.error(`[api:chats/hilo] ${clave}: ${msg(e)}`);
    return err(500, 'No pude leer la conversación.');
  }
}
