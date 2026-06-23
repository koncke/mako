// =============================================================================
// API interna: contactos de WhatsApp (Chatwoot) para el inbox de /whatsapp
// =============================================================================
// Agrupa las conversaciones de Chatwoot POR CONTACTO (Chatwoot crea varias
// conversaciones por persona — recordatorios de n8n, etc.) → un hilo por
// persona. Enriquecido con el lead que matchea por teléfono (empresa, etapa
// del funnel, id para el link al CRM).
// =============================================================================

import { listConversations } from '@/lib/chatwoot';
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function digits(p: string | null): string {
  return (p || '').replace(/\D/g, '');
}

type LeadRow = {
  id: number; nombre: string | null; empresa: string | null; telefono_normalizado: string | null;
  estado_lead: string | null; fecha_agenda: string | null; fecha_junta_1: string | null;
  fecha_junta_2: string | null; asistio_j1: boolean | null; asistio_j2: boolean | null;
  calificado: boolean | null; fecha_confirmacion: string | null; fecha_primer_pago: string | null;
  cerro: boolean | null; visitor_id: string | null; meta_lead_id: string | null;
};

// Etapa del funnel para mostrar/filtrar en el inbox.
function derivarEtapa(l: LeadRow): { key: string; label: string } {
  if (l.fecha_primer_pago) return { key: 'cliente', label: 'Cliente' };
  if (l.fecha_confirmacion && l.cerro !== true) return { key: 'por-cobrar', label: 'Por cobrar' };
  if (l.asistio_j2 === false) return { key: 'no-show', label: 'No-show' };
  if (l.fecha_junta_2 || l.asistio_j2 === true) return { key: 'j2', label: 'En J2' };
  if (l.asistio_j1 === true) return { key: 'post-j1', label: 'Post J1' };
  if (l.asistio_j1 === false) return { key: 'no-show', label: 'No-show' };
  if (l.fecha_agenda) return { key: 'agendo', label: 'Agendó' };
  if (l.visitor_id) return { key: 'vio-vsl', label: 'Vio VSL' };
  if (l.meta_lead_id) return { key: 'form', label: 'Form' };
  return { key: 'abierto', label: 'Abierto' };
}

export async function GET() {
  try {
    const convs = await listConversations(200);

    // Lead por teléfono (best-effort: dígitos completos o últimos 10).
    const supabase = getSupabaseServer();
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, nombre, empresa, telefono_normalizado, estado_lead, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, calificado, fecha_confirmacion, fecha_primer_pago, cerro, visitor_id, meta_lead_id')
      .not('telefono_normalizado', 'is', null);
    const leadByPhone = new Map<string, LeadRow>();
    for (const l of (leadsData ?? []) as LeadRow[]) {
      const d = digits(l.telefono_normalizado);
      if (!d) continue;
      leadByPhone.set(d, l);
      if (d.length >= 10) leadByPhone.set(d.slice(-10), l);
    }

    // Agrupar por contacto.
    type Acc = {
      contactId: number; contacto: string; telefono: string | null;
      primaryConvId: number; ultimoMensaje: string | null; ultimaActividad: number;
      sinLeer: number; ventanaAbierta: boolean;
    };
    const porContacto = new Map<number, Acc>();
    for (const c of convs) {
      const key = c.contactId || c.id; // fallback si no vino contactId
      const prev = porContacto.get(key);
      const act = c.ultimaActividad ?? 0;
      if (!prev) {
        porContacto.set(key, {
          contactId: key, contacto: c.contacto, telefono: c.telefono,
          primaryConvId: c.id, ultimoMensaje: c.ultimoMensaje, ultimaActividad: act, sinLeer: c.sinLeer,
          ventanaAbierta: c.puedeResponder,
        });
      } else {
        prev.sinLeer += c.sinLeer;
        prev.ventanaAbierta = prev.ventanaAbierta || c.puedeResponder;
        if (act >= prev.ultimaActividad) {
          prev.ultimaActividad = act;
          prev.ultimoMensaje = c.ultimoMensaje;
          prev.primaryConvId = c.id;
          if (c.telefono) prev.telefono = c.telefono;
        }
      }
    }

    const contactos = [...porContacto.values()]
      .sort((a, b) => b.ultimaActividad - a.ultimaActividad)
      .map((ct) => {
        const d = digits(ct.telefono);
        const lead = leadByPhone.get(d) ?? (d.length >= 10 ? leadByPhone.get(d.slice(-10)) : undefined);
        const etapa = lead ? derivarEtapa(lead) : null;
        return {
          contactId: ct.contactId,
          primaryConvId: ct.primaryConvId,
          contacto: ct.contacto,
          telefono: ct.telefono,
          ultimoMensaje: ct.ultimoMensaje,
          ultimaActividad: ct.ultimaActividad,
          sinLeer: ct.sinLeer,
          ventanaAbierta: ct.ventanaAbierta,
          leadId: lead?.id ?? null,
          empresa: lead?.empresa ?? null,
          estadoLead: lead?.estado_lead ?? null,
          etapaKey: etapa?.key ?? null,
          etapaLabel: etapa?.label ?? null,
        };
      });

    return Response.json({ ok: true, contactos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/conversations] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
