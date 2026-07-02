// =============================================================================
// API interna: bloquear / desbloquear un contacto de WhatsApp (Chatwoot)
// =============================================================================
// POST { blocked: boolean, leadId?: number }
//  - bloquea/desbloquea el contacto en Chatwoot (no le llegan más mensajes).
//  - refleja en el lead: bloquear → estado "descalificado" (+ columna Descalificado);
//    desbloquear → vuelve a "abierto".
// =============================================================================

import type { NextRequest } from 'next/server';
import { blockContact, contactoEnInboxWA } from '@/lib/chatwoot';
import { setPipelineStage, updateLead } from '@/lib/leads';
import { getSupabaseServer } from '@/lib/supabase';
import { integracionConectada } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';

const MOTIVO_BLOQUEO = 'Bloqueado en WhatsApp';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Fase 1: WhatsApp (Chatwoot) es la integración global del dueño. Escritura →
  // solo el dueño puede bloquear/desbloquear contactos.
  if (!(await integracionConectada('whatsapp'))) {
    return Response.json({ ok: false, error: 'solo el workspace dueño puede operar WhatsApp por ahora' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const contactId = Number(id);
  if (!Number.isFinite(contactId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }

  let body: { blocked?: unknown; leadId?: unknown; motivo?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  const blocked = body.blocked === true;
  const leadId = Number(body.leadId);
  const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : MOTIVO_BLOQUEO;

  try {
    if (!(await contactoEnInboxWA(contactId))) {
      return Response.json({ ok: false, error: 'contacto no pertenece al inbox de WhatsApp' }, { status: 403 });
    }

    const r = await blockContact(contactId, blocked);
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });

    // Reflejar en el lead (si lo matcheamos).
    if (Number.isFinite(leadId) && leadId > 0) {
      try {
        const supabase = getSupabaseServer();
        const { data } = await supabase
          .from('leads')
          .select('estado_lead')
          .eq('id', leadId)
          .maybeSingle();
        const estado = (data as { estado_lead?: string } | null)?.estado_lead;
        if (blocked) {
          // Solo descalificamos si el lead estaba ABIERTO (en juego). No pisamos
          // ganados/perdidos/descalificados ni su motivo histórico.
          if (estado === 'abierto') {
            await setPipelineStage(leadId, 'descal', { motivo });
          }
        } else if (estado === 'descalificado') {
          // Desbloquear: lo devolvemos a "abierto" (el bloqueo es lo que descalifica acá).
          await updateLead(leadId, { estado_lead: 'abierto', motivo_perdida: null });
          await supabase.from('leads').update({ pipeline_stage: null }).eq('id', leadId);
        }
      } catch (e) {
        console.error(`[api:whatsapp/contacts block] lead sync: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return Response.json({ ok: true, blocked });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/contacts block] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
