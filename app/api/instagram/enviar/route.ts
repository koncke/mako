// =============================================================================
// API: enviar un borrador de DM de Instagram con 1 clic
// =============================================================================
// POST { id, texto? } → manda la fila de ig_mensajes estado='borrador' por
// Zernio (sendDm) y la marca 'enviado' / 'error' con el error de Zernio
// visible. `texto` es la versión EDITADA por el humano en la bandeja (contrato
// con app/instagram/InboxDms.tsx): se pisa en la fila ANTES de enviar, con el
// mismo guard .eq('estado','borrador') del claim — ignorarlo mandaría el texto
// viejo descartando la corrección en silencio.
// Mismo patrón que la bandeja del WhatsApp no oficial
// (app/api/whatsapp/evolution/borradores): claim idempotente en la base
// (.eq('estado','borrador')) — un doble clic no manda dos veces.
//
// Fuera de la ventana de 24h de Meta el envío sale con tag HUMAN_AGENT: acá
// SIEMPRE hay una persona confirmando (es el único camino que lo permite; el
// automático muere en el guard de ventana de lib/ig-chatbot.ts).
//
// Guard de rol: enviar un DM a un lead real es una acción outward-facing —
// admin y setter, igual que el simulador del Chatbot.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { enviarBorradorIg } from '@/lib/ig-chatbot';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || (rol !== 'admin' && rol !== 'setter')) {
    return Response.json({ ok: false, error: 'Sin acceso para enviar DMs en este workspace.' }, { status: 403 });
  }

  let body: { id?: unknown; texto?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  const texto = typeof body.texto === 'string' ? body.texto.trim() : null;
  if (body.texto !== undefined && !texto) {
    return Response.json({ ok: false, error: 'El mensaje no puede salir vacío.' }, { status: 400 });
  }

  try {
    // La edición del humano se persiste ANTES del envío, solo si el borrador
    // sigue pendiente (mismo guard que el claim: si otro clic ya lo tomó, acá
    // no se pisa nada y enviarBorradorIg reporta que ya no está pendiente).
    if (texto) {
      const db = await getTenantDb();
      const { error: errTxt } = await db
        .from('ig_mensajes')
        .update({ texto })
        .eq('id', id)
        .eq('estado', 'borrador');
      if (errTxt) return Response.json({ ok: false, error: `No pude guardar tu edición: ${errTxt.message}` }, { status: 500 });
    }
    const sesion = await getUsuarioActual();
    // permitirFueraDeVentana: true — la persona que clickeó ES la confirmación;
    // enviarBorradorIg aplica solo el tag HUMAN_AGENT cuando la ventana venció.
    const r = await enviarBorradorIg(id, sesion?.email ?? 'setter', { permitirFueraDeVentana: true });
    if (!r.ok) {
      // El error de Zernio ya quedó visible en la fila (estado='error'); acá
      // vuelve además al cliente para el toast. 502 = falló aguas arriba.
      return Response.json({ ok: false, error: r.error }, { status: 502 });
    }
    return Response.json({ ok: true, messageId: r.messageId });
  } catch (e) {
    console.error(`[api:instagram/enviar POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
