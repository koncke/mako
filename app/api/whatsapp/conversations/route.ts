// =============================================================================
// API interna: contactos de WhatsApp (Chatwoot) para el inbox de /whatsapp
// =============================================================================
// Agrupa las conversaciones de Chatwoot POR CONTACTO (Chatwoot crea varias
// conversaciones por persona — recordatorios de n8n, etc.) → un hilo por
// persona. Enriquecido con el lead que matchea por teléfono (empresa, etapa
// del funnel, id para el link al CRM).
// =============================================================================

import { listConversations, type ChatwootConversation } from '@/lib/chatwoot';
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
  if (l.fecha_junta_2 || l.asistio_j2 === true) return { key: 'j2', label: 'En R2' };
  if (l.asistio_j1 === true) return { key: 'post-j1', label: 'Post R1' };
  if (l.asistio_j1 === false) return { key: 'no-show', label: 'No-show' };
  if (l.fecha_agenda) return { key: 'agendo', label: 'Agendó' };
  if (l.visitor_id) return { key: 'vio-vsl', label: 'Vio VSL' };
  if (l.meta_lead_id) return { key: 'form', label: 'Form' };
  return { key: 'abierto', label: 'Abierto' };
}

export async function GET(req: Request) {
  try {
    // ?recent=1 → solo la página 1 (las 25 conversaciones más recientes). Lo usa
    // el polling: las novedades siempre suben a la página 1, así cada poll pega
    // 1 request a Chatwoot (~2.4s) en vez de 7 páginas (~5s).
    const recent = new URL(req.url).searchParams.get('recent') === '1';
    const convs = await listConversations(recent ? 1 : 200);

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
    // Agrupar por PERSONA: por los últimos 10 dígitos del teléfono (así se juntan
    // los contactos duplicados de Chatwoot con +54… vs +549…). Fallback a contactId.
    const groupKey = (c: ChatwootConversation): string => {
      const d = digits(c.telefono);
      if (d.length >= 10) return 'p' + d.slice(-10);
      if (c.contactId) return 'c' + c.contactId;
      return 'x' + c.id;
    };

    type Acc = {
      id: string; contacto: string; telefono: string | null; avatar: string | null;
      sendContactId: number; convs: Array<{ id: number; act: number }>; bloqueado: boolean;
      ultimoMensaje: string | null; ultimaActividad: number; sinLeer: number; ventanaAbierta: boolean;
    };
    const grupos = new Map<string, Acc>();
    for (const c of convs) {
      const key = groupKey(c);
      const prev = grupos.get(key);
      const act = c.ultimaActividad ?? 0;
      if (!prev) {
        grupos.set(key, {
          id: key, contacto: c.contacto, telefono: c.telefono, avatar: c.avatar,
          sendContactId: c.contactId, convs: [{ id: c.id, act }], bloqueado: c.bloqueado,
          ultimoMensaje: c.ultimoMensaje, ultimaActividad: act, sinLeer: c.sinLeer, ventanaAbierta: c.puedeResponder,
        });
      } else {
        prev.convs.push({ id: c.id, act });
        prev.sinLeer += c.sinLeer;
        prev.ventanaAbierta = prev.ventanaAbierta || c.puedeResponder;
        prev.bloqueado = prev.bloqueado || c.bloqueado;
        if (act >= prev.ultimaActividad) {
          prev.ultimaActividad = act;
          prev.ultimoMensaje = c.ultimoMensaje;
          prev.sendContactId = c.contactId || prev.sendContactId;
          if (c.telefono) prev.telefono = c.telefono;
        }
        if (!prev.avatar && c.avatar) prev.avatar = c.avatar;
        // nos quedamos con el nombre más completo
        if (c.contacto && c.contacto !== 'Sin nombre' && c.contacto.length > prev.contacto.length) prev.contacto = c.contacto;
      }
    }

    const contactos = [...grupos.values()]
      .sort((a, b) => b.ultimaActividad - a.ultimaActividad)
      .map((ct) => {
        const d = digits(ct.telefono);
        const lead = leadByPhone.get(d) ?? (d.length >= 10 ? leadByPhone.get(d.slice(-10)) : undefined);
        const etapa = lead ? derivarEtapa(lead) : null;
        return {
          id: ct.id,
          convIds: [...ct.convs].sort((a, b) => b.act - a.act).map((x) => x.id),
          sendContactId: ct.sendContactId,
          contacto: ct.contacto,
          telefono: ct.telefono,
          avatar: ct.avatar,
          bloqueado: ct.bloqueado,
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
