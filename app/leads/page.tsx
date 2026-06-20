// =============================================================================
// /leads — CRM (rediseño Marketing OS): Kanban + Tabla + ficha en modal
// =============================================================================

import { listLeads, getPipelineStages, getVisitasLandingMap, type Lead } from '@/lib/leads';
import {
  getCampaignNameMap,
  getJuntasProximas,
  getPendientesDeMarcar,
  type JuntaProxima,
  type PendienteItem,
} from '@/lib/queries';
import { hoyEnTijuana } from '@/lib/date-utils';
import { CrmBoard, type CrmLead, type CrmJunta, type CrmMarcar } from './CrmBoard';
import { mapToCrmLead } from './crm-map';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeadsPage() {
  const hoy = hoyEnTijuana();

  let leads: Lead[] = [];
  let campMap: Record<string, string> = {};
  let juntasRaw: JuntaProxima[] = [];
  let pendientesRaw: PendienteItem[] = [];
  let stages: Awaited<ReturnType<typeof getPipelineStages>> | undefined;
  let errorMsg: string | null = null;

  try {
    // getPipelineStages ahora va en la misma ola (antes serializaba al frente).
    let stagesRaw: Awaited<ReturnType<typeof getPipelineStages>> | undefined;
    [leads, campMap, juntasRaw, pendientesRaw, stagesRaw] = await Promise.all([
      listLeads(),
      getCampaignNameMap().catch(() => ({}) as Record<string, string>),
      getJuntasProximas(hoy, 3).catch(() => [] as JuntaProxima[]),
      getPendientesDeMarcar(hoy).then((p) => p.items).catch(() => [] as PendienteItem[]),
      getPipelineStages().catch(() => undefined),
    ]);
    stages = stagesRaw;
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

  const crmLeads: CrmLead[] = leads.map((l) => mapToCrmLead(l, campMap, visitasMap));

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
