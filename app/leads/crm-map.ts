// =============================================================================
// crm-map — Lead (Supabase) → CrmLead (view-model del CRM)
// =============================================================================
// Extraído de /leads/page.tsx para que tanto la página del CRM como la server
// action getCrmLeadAction (modal de edición in-place) armen el MISMO view-model.

import { resolverNombreCampana } from '@/lib/queries';
import { deriveStageKey } from '@/lib/pipeline';
import type { Lead, VslEngagement } from '@/lib/leads';
import type { CrmLead } from './CrmBoard';

export type VisitasMap = Map<string, { total_visitas: number; dias_distintos: number }>;
export type VslMap = Map<string, VslEngagement>;

/** Canal real de adquisición (no hardcodeado). */
function channelOf(l: Lead): string {
  if (l.meta_lead_id || l.meta_ad_id) return 'Meta · Instant Form';
  if (l.utm_campaign?.trim()) return 'Campaña web';
  return 'Directo / orgánico';
}

export function origenLegible(lead: Lead, campMap: Record<string, string>): string {
  const nombreMeta = lead.meta_ad_name?.trim() || lead.meta_campaign_name?.trim();
  if (nombreMeta) return nombreMeta;
  if (lead.utm_campaign?.trim()) {
    const r = resolverNombreCampana(lead.utm_campaign, campMap);
    if (r.texto) return r.texto;
  }
  if (lead.meta_lead_id || lead.meta_ad_id) return 'Meta · sin nombre';
  return 'Directo';
}

export function fmtDay(s: string | null): string | null {
  if (!s) return null;
  const d = s.length <= 10 ? new Date(`${s}T00:00:00Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function calendlyDe(l: Lead): { q: string; a: string }[] {
  const pairs: Array<[string, string | null]> = [
    ['¿A qué te dedicás?', l.respuesta_objetivo],
    ['Facturación mensual actual', l.respuesta_facturacion],
    ['Colaboradores', l.respuesta_colaboradores],
    ['¿Cuándo querés empezar?', l.respuesta_cuando_empezar],
    ['¿Listo para invertir?', l.respuesta_inversion],
    ['¿Sos el decisor?', l.respuesta_decisor],
  ];
  return pairs.filter(([, a]) => !!a && a.trim()).map(([q, a]) => ({ q, a: a as string }));
}

export function mapToCrmLead(l: Lead, campMap: Record<string, string>, visitasMap: VisitasMap, validStageKeys?: Set<string>, vslMap?: VslMap): CrmLead {
  const vsl = vslMap?.get(l.visitor_id ?? '');
  // Etapa efectiva: el override manual SOLO si sigue existiendo en el funnel
  // actual; si el override quedó huérfano (etapa eliminada del funnel), se ignora
  // y se usa la etapa derivada de los campos del lead.
  const override = l.pipeline_stage;
  const derived = deriveStageKey(l);
  const stage = override && (!validStageKeys || validStageKeys.has(override)) ? override : derived;
  return {
    id: l.id,
    derivedStage: derived,   // posición REAL en el funnel (ignora override manual) — la usa el worklist
    name: l.nombre,
    email: l.email ?? '',
    company: l.empresa ?? 'Sin empresa',
    origin: origenLegible(l, campMap),
    stage,
    created: fmtDay(l.created_at) ?? '—',
    monto: l.monto_cierre_usd ?? 0,
    totalCobrado: l.total_cobrado_usd ?? 0,
    agenda: fmtDay(l.fecha_agenda) ?? fmtDay(l.fecha_junta_1),
    j2: fmtDay(l.fecha_junta_2),
    fechaJ1: l.fecha_junta_1 ?? l.fecha_agenda,
    fechaJ2: l.fecha_junta_2,
    phone: l.telefono ?? '—',
    telefonoNorm: l.telefono_normalizado ?? null,
    estadoLead: l.estado_lead,
    asistioJ1: l.asistio_j1,
    asistioJ2: l.asistio_j2,
    calificado: l.calificado,
    closer: l.closer ?? '',
    setter: l.setter ?? '',
    fathom: (l.fathom_links as { label: string; url: string }[] | null) ?? [],
    motivo: l.motivo_perdida ?? '',
    calendly: calendlyDe(l),
    landingVisitas: visitasMap.get(l.visitor_id ?? '')?.total_visitas ?? 0,
    landingDias: visitasMap.get(l.visitor_id ?? '')?.dias_distintos ?? 0,
    originChannel: channelOf(l),
    vslPlays: vsl?.plays ?? 0,
    vslMaxPct: vsl && !vsl.sin_datos ? vsl.max_pct : null,
    confirmacion: fmtDay(l.fecha_confirmacion),
    cierre: fmtDay(l.fecha_cierre),
    // Fechas crudas (ISO) para construir la línea de tiempo del recorrido.
    createdISO: l.created_at,
    agendaISO: l.fecha_agenda,
    confirmacionISO: l.fecha_confirmacion,
    primerPagoISO: l.fecha_primer_pago ?? null,
    cierreISO: l.fecha_cierre,
  };
}
