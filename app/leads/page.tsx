// =============================================================================
// /leads — CRM (rediseño Marketing OS): Kanban + Tabla + ficha en modal
// =============================================================================

import { listLeads, getPipelineStages, getVisitasLandingMap, type Lead } from '@/lib/leads';
import {
  getCampaignNameMap,
  resolverNombreCampana,
  getJuntasProximas,
  getPendientesDeMarcar,
  type JuntaProxima,
  type PendienteItem,
} from '@/lib/queries';
import { hoyEnTijuana } from '@/lib/date-utils';
import { pipelineStageOf } from '@/lib/pipeline';
import { CrmBoard, type CrmLead, type CrmJunta, type CrmMarcar } from './CrmBoard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function origenLegible(lead: Lead, campMap: Record<string, string>): string {
  const nombreMeta = lead.meta_ad_name?.trim() || lead.meta_campaign_name?.trim();
  if (nombreMeta) return nombreMeta;
  if (lead.utm_campaign?.trim()) {
    const r = resolverNombreCampana(lead.utm_campaign, campMap);
    if (r.texto) return r.texto;
  }
  if (lead.meta_lead_id || lead.meta_ad_id) return 'Meta · sin nombre';
  return 'Directo';
}

function fmtDay(s: string | null): string | null {
  if (!s) return null;
  const d = s.length <= 10 ? new Date(`${s}T00:00:00Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

function calendlyDe(l: Lead): { q: string; a: string }[] {
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

export default async function LeadsPage() {
  const hoy = hoyEnTijuana();

  let leads: Lead[] = [];
  let campMap: Record<string, string> = {};
  let juntasRaw: JuntaProxima[] = [];
  let pendientesRaw: PendienteItem[] = [];
  let stages = await getPipelineStages().catch(() => undefined);
  let errorMsg: string | null = null;

  try {
    [leads, campMap, juntasRaw, pendientesRaw] = await Promise.all([
      listLeads(),
      getCampaignNameMap().catch(() => ({}) as Record<string, string>),
      getJuntasProximas(hoy, 3).catch(() => [] as JuntaProxima[]),
      getPendientesDeMarcar(hoy).then((p) => p.items).catch(() => [] as PendienteItem[]),
    ]);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }
  if (!stages) {
    const { DEFAULT_STAGES } = await import('@/lib/pipeline');
    stages = DEFAULT_STAGES;
  }

  const visitasMap = await getVisitasLandingMap(leads.map((l) => l.visitor_id)).catch(
    () => new Map<string, { total_visitas: number; dias_distintos: number }>(),
  );

  const telById = new Map(leads.map((l) => [l.id, l.telefono]));

  const crmLeads: CrmLead[] = leads.map((l) => ({
    id: l.id,
    name: l.nombre,
    email: l.email ?? '',
    company: l.empresa ?? 'Sin empresa',
    origin: origenLegible(l, campMap),
    stage: pipelineStageOf(l),
    created: fmtDay(l.created_at) ?? '—',
    monto: l.monto_cierre_usd ?? 0,
    totalCobrado: l.total_cobrado_usd ?? 0,
    agenda: fmtDay(l.fecha_agenda) ?? fmtDay(l.fecha_junta_1),
    j2: fmtDay(l.fecha_junta_2),
    phone: l.telefono ?? '—',
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
  }));

  const juntas: CrmJunta[] = juntasRaw.map((j) => ({
    id: `${j.lead_id}-${j.tipo}`,
    leadId: j.lead_id,
    when: `${j.tipo} · ${j.dia}`,
    warn: j.vsl_estado === 'sin_ver',
    warnText: 'agendó sin ver el VSL',
    name: j.nombre,
    company: j.empresa ?? 'Sin empresa',
    phone: telById.get(j.lead_id) ?? '—',
    goal: j.respuestas.objetivo ?? '—',
  }));

  const marcar: CrmMarcar[] = pendientesRaw.map((p) => ({
    id: `${p.lead_id}-${p.tipo}`,
    leadId: p.lead_id,
    name: p.lead_nombre,
    company: crmLeads.find((c) => c.id === p.lead_id)?.company ?? '',
    message: p.mensaje,
  }));

  return (
    <CrmBoard
      leads={crmLeads}
      stages={stages}
      juntas={juntas}
      marcar={marcar}
      total={leads.length}
      errorMsg={errorMsg}
    />
  );
}
