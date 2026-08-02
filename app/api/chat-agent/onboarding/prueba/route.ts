// =============================================================================
// API: prueba de vida del canal (paso ① del onboarding de Setting)
// =============================================================================
// Regla de la metodología: guardar la credencial NO es estar conectado. El paso
// cierra cuando llega un mensaje de verdad. Reusa el OTP por WhatsApp que ya usa
// el onboarding global (lib/mako-grupo.ts).
//
// POST { action:'enviar', telefono? }  → manda el código por WhatsApp. El destino
//      se resuelve solo: el número que el cliente acaba de vincular por QR (es el
//      teléfono que tiene en la mano), y si no hay, el de su perfil. `telefono`
//      solo hace falta cuando no hay ninguno de los dos.
//      { action:'verificar', codigo } → lo valida
// Guard: admin del workspace.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { enviarCodigoVerificacion, verificarCodigoContacto } from '@/lib/mako-grupo';
import { getContactoReportes } from '@/lib/perfil';
import { getInstanciaRow } from '@/lib/evolution';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar esta tab.' }, { status: 403 });
  }
  let body: { action?: string; codigo?: unknown; telefono?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'enviar') {
      const contacto = await getContactoReportes();
      // Orden de resolución. Primero el número recién vinculado por QR: es el
      // teléfono que el cliente tiene en la mano en este mismo momento, y
      // mandarlo ahí prueba el canal sin pedirle un dato más. Mandarlo a otra
      // tab a cargar el teléfono, en cambio, corta el recorrido a la mitad.
      const escrito = typeof body.telefono === 'string' ? body.telefono.replace(/\D/g, '') : '';
      let destino = escrito;
      if (!destino) {
        try { destino = (await getInstanciaRow())?.numero?.replace(/\D/g, '') ?? ''; } catch { destino = ''; }
      }
      if (!destino) destino = (contacto.telefono ?? '').replace(/\D/g, '');
      if (!destino) {
        return Response.json({ ok: false, error: 'sin-numero', necesitaNumero: true }, { status: 400 });
      }
      const r = await enviarCodigoVerificacion(ws, destino, contacto.nombre || 'MaKo');
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      return Response.json({ ok: true, yaVerificado: r.yaVerificado, destino });
    }
    if (body.action === 'verificar') {
      const r = await verificarCodigoContacto(ws, String(body.codigo ?? ''));
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:setting/onboarding/prueba] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
