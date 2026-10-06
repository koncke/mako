// =============================================================================
// API: bloquear/ocultar un contacto del WhatsApp NO oficial (a nivel app/CRM).
// POST { telefono, action:'block'|'unblock'|'hide'|'unhide', leadId?, motivo? }.
// block corta el envío; hide solo lo saca del inbox/MaKo. Scopeado por ws.
// =============================================================================

import type { NextRequest } from 'next/server';
import { bloquearContacto, desbloquearContacto, ocultarContacto, mostrarContacto } from '@/lib/evolution-block';
import { sincronizarChat, borrarChat } from '@/lib/evolution-mensajes';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  let body: { telefono?: string; action?: string; leadId?: number | null; motivo?: string; chat?: string; linea?: string | null };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const telefono = String(body.telefono ?? '');
  if (!telefono.replace(/\D/g, '')) return Response.json({ ok: false, error: 'teléfono inválido' }, { status: 400 });
  const chatJid = String(body.chat ?? '') || `${telefono.replace(/\D/g, '')}@s.whatsapp.net`;
  try {
    if (body.action === 'sync-chat') {
      // De la línea de la bandeja abierta (sin línea, la de por default).
      const r = await sincronizarChat(chatJid, typeof body.linea === 'string' && body.linea ? body.linea : null);
      return Response.json({ ok: true, ...r });
    }
    if (body.action === 'clear-chat') {
      // Borrar el historial de una conversación es destructivo e irreversible:
      // pide admin, igual que su ruta hermana. Ocultar y bloquear no, porque los
      // usa cualquiera que atienda chats.
      const rol = await getRolWsEfectivo();
      if (rol !== 'admin') {
        return Response.json({ ok: false, error: 'Solo el administrador puede borrar el historial de una conversación.' }, { status: 403 });
      }
      const n = await borrarChat(chatJid, typeof body.linea === 'string' && body.linea ? body.linea : null);
      return Response.json({ ok: true, borrados: n });
    }
    if (body.action === 'block') {
      const sesion = await getUsuarioActual().catch(() => null);
      await bloquearContacto(telefono, { leadId: body.leadId ?? null, motivo: body.motivo, por: sesion?.email });
      return Response.json({ ok: true, bloqueado: true });
    }
    if (body.action === 'unblock') {
      await desbloquearContacto(telefono);
      return Response.json({ ok: true, bloqueado: false });
    }
    if (body.action === 'hide') {
      const sesion = await getUsuarioActual().catch(() => null);
      await ocultarContacto(telefono, { leadId: body.leadId ?? null, por: sesion?.email });
      return Response.json({ ok: true, oculto: true });
    }
    if (body.action === 'unhide') {
      await mostrarContacto(telefono);
      return Response.json({ ok: true, oculto: false });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/block] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
