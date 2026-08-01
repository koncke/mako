// =============================================================================
// API: prueba de vida del canal (paso ① del onboarding de Setting)
// =============================================================================
// Regla de la metodología: guardar la credencial NO es estar conectado. El paso
// cierra cuando llega un mensaje de verdad. Reusa el OTP por WhatsApp que ya usa
// el onboarding global (lib/mako-grupo.ts).
//
// POST { action:'enviar' }            → manda el código al WhatsApp del dueño
//      { action:'verificar', codigo } → lo valida
// Guard: admin del workspace.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { enviarCodigoVerificacion, verificarCodigoContacto } from '@/lib/mako-grupo';
import { getContactoReportes } from '@/lib/perfil';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar esta tab.' }, { status: 403 });
  }
  let body: { action?: string; codigo?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'enviar') {
      const contacto = await getContactoReportes();
      if (!contacto.telefono) {
        return Response.json({ ok: false, error: 'Cargá tu teléfono en Perfil para que te llegue el código.' }, { status: 400 });
      }
      const r = await enviarCodigoVerificacion(ws, contacto.telefono, contacto.nombre || 'MaKo');
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      return Response.json({ ok: true, yaVerificado: r.yaVerificado });
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
