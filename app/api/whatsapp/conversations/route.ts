// =============================================================================
// API interna: lista de conversaciones de WhatsApp (Chatwoot) para /whatsapp
// =============================================================================
// Proxy server-side a Chatwoot (el token nunca llega al cliente) + enriquecido
// con el lead que matchea por teléfono (empresa, estado, id para el link al CRM).
// Mismo nivel de exposición que el resto del dashboard (protegido a nivel Vercel).
// =============================================================================

import { listConversations } from '@/lib/chatwoot';
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function digits(p: string | null): string {
  return (p || '').replace(/\D/g, '');
}

export async function GET() {
  try {
    const base = await listConversations();

    // Match con leads por teléfono (best-effort: dígitos completos o últimos 10).
    const supabase = getSupabaseServer();
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, empresa, estado_lead, telefono_normalizado')
      .not('telefono_normalizado', 'is', null);

    type LeadMatch = { id: number; empresa: string | null; estado: string | null };
    const leadByPhone = new Map<string, LeadMatch>();
    for (const l of (leadsData ?? []) as Array<{
      id: number; empresa: string | null; estado_lead: string | null; telefono_normalizado: string | null;
    }>) {
      const d = digits(l.telefono_normalizado);
      if (!d) continue;
      const entry: LeadMatch = { id: l.id, empresa: l.empresa, estado: l.estado_lead };
      leadByPhone.set(d, entry);
      if (d.length >= 10) leadByPhone.set(d.slice(-10), entry);
    }

    const conversaciones = base.map((c) => {
      const d = digits(c.telefono);
      const lead =
        leadByPhone.get(d) ?? (d.length >= 10 ? leadByPhone.get(d.slice(-10)) : undefined);
      return {
        ...c,
        leadId: lead?.id ?? null,
        empresa: lead?.empresa ?? null,
        estadoLead: lead?.estado ?? null,
      };
    });

    return Response.json({ ok: true, conversaciones });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/conversations] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
