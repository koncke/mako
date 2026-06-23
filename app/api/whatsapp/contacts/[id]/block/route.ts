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

export const dynamic = 'force-dynamic';

const MOTIVO_BLOQUEO = 'Bloqueado en WhatsApp';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const contactId = Number(id);
  if (!Number.isFinite(contactId)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }

  let body: { blocked?: unknown; leadId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  const blocked = body.blocked === true;
  const leadId = Number(body.leadId);

  try {
    if (!(await contactoEnInboxWA(contactId))) {
      return Response.json({ ok: false, error: 'contacto no pertenece al inbox de WhatsApp' }, { status: 403 });
    }

    const r = await blockContact(contactId, blocked);
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });

    // Reflejar en el lead (si lo matcheamos).
    if (Number.isFinite(leadId) && leadId > 0) {
      try {
        if (blocked) {
          await setPipelineStage(leadId, 'descal', { motivo: MOTIVO_BLOQUEO });
        } else {
          // Solo revertir si el bloqueo fue quien lo descalificó (marcado por el
          // motivo). Si el lead cambió de estado por otra razón, no lo tocamos.
          const supabase = getSupabaseServer();
          const { data } = await supabase
            .from('leads')
            .select('estado_lead, motivo_perdida')
            .eq('id', leadId)
            .maybeSingle();
          const l = (data ?? {}) as { estado_lead?: string; motivo_perdida?: string | null };
          if (l.estado_lead === 'descalificado' && l.motivo_perdida === MOTIVO_BLOQUEO) {
            await updateLead(leadId, { estado_lead: 'abierto', motivo_perdida: null });
            await supabase.from('leads').update({ pipeline_stage: null }).eq('id', leadId);
          }
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
