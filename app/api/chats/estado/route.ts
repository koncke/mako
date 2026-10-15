// =============================================================================
// /api/chats/estado — cerrar, reabrir, posponer, reanudar y marcar leída una conversación
// =============================================================================
// POST { clave, accion: 'cerrar'|'reabrir'|'posponer'|'reanudar'|'leido', hasta?: ISO, nota?: string } → { ok }
//   · cerrar/reabrir/posponer/reanudar escriben `chat_estado` + un `chat_eventos` con el NOMBRE de quien lo hizo
//     (`cambiarEstadoChat`, lib/chats.ts). `hasta` es obligatorio para posponer (futuro, hasta un año); `nota`
//     es la nota de cierre («Cerrar con nota»).
//   · leido escribe `chat_leidos` de ESTA persona (`marcarChatLeido`).
//
// Cualquier rol con la tab (closer y setter también): cerrar una conversación es trabajo de quien la atiende.
// El estado que se ve lo recalcula la lectura (`estadoEfectivo`): un mensaje nuevo del contacto reabre sola una
// cerrada, sin que nada escriba acá.

import { NextResponse } from 'next/server';
import { puertaChats, cambiarEstadoChat, marcarChatLeido, ACCIONES_ESTADO_CHAT, POSPONER_MAX_MS, TOPE_NOTA_CIERRE, type AccionEstadoChat } from '@/lib/chats';
import { parsearClave } from '@/lib/chats-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: Request) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const clave = typeof body?.clave === 'string' ? body.clave : '';
  if (!parsearClave(clave)) return err(400, 'Conversación inválida.');
  const accion = body?.accion;
  try {
    if (accion === 'leido') {
      await marcarChatLeido(clave, puerta.yo.id);
      return NextResponse.json({ ok: true });
    }
    if (!ACCIONES_ESTADO_CHAT.includes(accion as AccionEstadoChat)) return err(400, 'Acción inválida.');
    const hasta = typeof body?.hasta === 'string' ? body.hasta : undefined;
    if (accion === 'posponer') {
      const t = hasta ? Date.parse(hasta) : NaN;
      if (!Number.isFinite(t) || t <= Date.now()) return err(400, 'Elige una fecha futura.');
      if (t - Date.now() > POSPONER_MAX_MS) return err(400, 'Hasta un año, como mucho.');
    }
    const nota = typeof body?.nota === 'string' ? body.nota.trim() : '';
    if (nota.length > TOPE_NOTA_CIERRE) return err(400, 'La nota es muy larga.');
    await cambiarEstadoChat(clave, accion as AccionEstadoChat, { actor: puerta.yo.nombre, hasta, nota });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[api:chats/estado] ${clave} ${String(accion)}: ${msg(e)}`);
    return err(500, 'No se guardó.');
  }
}
