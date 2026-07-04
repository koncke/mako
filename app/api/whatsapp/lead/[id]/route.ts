// =============================================================================
// API interna: hilo de WhatsApp de UN LEAD (para la tab Chat de la ficha)
// =============================================================================
// GET → resuelve el contacto de Chatwoot por el teléfono del lead (match por
// últimos 10 dígitos, igual que el inbox) y devuelve sus mensajes mergeados.
// El lead se lee vía getTenantDb → un workspace nunca ve fichas ajenas.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getLead } from '@/lib/leads';
import { contactoIdPorTelefono, getContactMessages } from '@/lib/chatwoot';
import { integracionConectada } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Fase 1: el inbox de WhatsApp es global del dueño → otros workspaces vacío.
  if (!(await integracionConectada('whatsapp'))) {
    return Response.json({ ok: true, contactId: null, mensajes: [] });
  }
  const { id } = await ctx.params;
  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }
  try {
    const lead = await getLead(leadId);
    if (!lead) {
      return Response.json({ ok: false, error: 'lead no existe' }, { status: 404 });
    }
    const tel = lead.telefono ?? lead.telefono_normalizado;
    if (!tel) {
      return Response.json({ ok: true, contactId: null, mensajes: [], sinTelefono: true });
    }
    const contactId = await contactoIdPorTelefono(tel);
    if (!contactId) {
      return Response.json({ ok: true, contactId: null, mensajes: [] });
    }
    const mensajes = await getContactMessages(contactId);
    return Response.json({ ok: true, contactId, mensajes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/lead] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
