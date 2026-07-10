// =============================================================================
// API: bloquear/desbloquear un contacto del WhatsApp NO oficial (a nivel app/CRM).
// POST { telefono, action:'block'|'unblock', leadId?, motivo? }. Scopeado por ws.
// =============================================================================

import type { NextRequest } from 'next/server';
import { bloquearContacto, desbloquearContacto } from '@/lib/evolution-block';
import { getUsuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  let body: { telefono?: string; action?: string; leadId?: number | null; motivo?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const telefono = String(body.telefono ?? '');
  if (!telefono.replace(/\D/g, '')) return Response.json({ ok: false, error: 'teléfono inválido' }, { status: 400 });
  try {
    if (body.action === 'block') {
      const sesion = await getUsuarioActual().catch(() => null);
      await bloquearContacto(telefono, { leadId: body.leadId ?? null, motivo: body.motivo, por: sesion?.email });
      return Response.json({ ok: true, bloqueado: true });
    }
    if (body.action === 'unblock') {
      await desbloquearContacto(telefono);
      return Response.json({ ok: true, bloqueado: false });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:whatsapp/evolution/block] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
