// =============================================================================
// /leads — CRM (rediseño Marketing OS): Kanban + Tabla + ficha en modal
// =============================================================================

import { listLeads, getPipelineStages, getFunnelTransitions, type Lead } from '@/lib/leads';
import { generateFunnel, DEFAULT_PIPELINE, type FunnelTransition } from '@/lib/pipeline';
import {
  getCampaignNameMap,
  getJuntasProximas,
  getPendientesDeMarcar,
  type JuntaProxima,
  type PendienteItem,
} from '@/lib/queries';
import { hoyEnTijuana } from '@/lib/date-utils';
import { guardOnboarding } from '@/lib/tab-access';
import { CrmBoard, type CrmLead, type CrmJunta, type CrmMarcar } from './CrmBoard';
import { mapToCrmLead } from './crm-map';
import { getEquipoAction, type MiembroEquipo } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeadsPage() {
  await guardOnboarding();
  const hoy = hoyEnTijuana();

  let leads: Lead[] = [];
  let campMap: Record<string, string> = {};
  let juntasRaw: JuntaProxima[] = [];
  let pendientesRaw: PendienteItem[] = [];
  let stages: Awaited<ReturnType<typeof getPipelineStages>> | undefined;
  let transitions: FunnelTransition[] = generateFunnel(DEFAULT_PIPELINE).transitions;
  let errorMsg: string | null = null;

  try {
    // getPipelineStages ahora va en la misma ola (antes serializaba al frente).
    let stagesRaw: Awaited<ReturnType<typeof getPipelineStages>> | undefined;
    let transitionsRaw: FunnelTransition[] | undefined;
    [leads, campMap, juntasRaw, pendientesRaw, stagesRaw, transitionsRaw] = await Promise.all([
      listLeads(),
      getCampaignNameMap().catch(() => ({}) as Record<string, string>),
      getJuntasProximas(hoy, 3).catch(() => [] as JuntaProxima[]),
      getPendientesDeMarcar(hoy).then((p) => p.items).catch(() => [] as PendienteItem[]),
      getPipelineStages().catch(() => undefined),
      getFunnelTransitions().catch(() => undefined),
    ]);
    stages = stagesRaw;
    if (transitionsRaw) transitions = transitionsRaw;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }
  if (!stages) {
    stages = generateFunnel(DEFAULT_PIPELINE).stages;
  }

  const telById = new Map(leads.map((l) => [l.id, l.telefono]));

  const validStageKeys = new Set(stages.map((s) => s.key));
  const crmLeads: CrmLead[] = leads.map((l) => mapToCrmLead(l, campMap, validStageKeys));

  const juntas: CrmJunta[] = juntasRaw.map((j) => ({
    id: `${j.lead_id}-${j.tipo}`,
    leadId: j.lead_id,
    when: `${j.tipo === 'J1' ? 'R1' : 'R2'} · ${j.dia}`,
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
    tipo: p.tipo,
    soloEdit: p.soloEdit,
    solTab: p.solTab,
    faltantes: p.faltantes,
  }));

  const equipo = await getEquipoAction().catch(() => [] as MiembroEquipo[]);

  // Valores de Setter/Closer ya usados (para sugerirlos de un clic en "Marcar en lote").
  const usados = (pick: (l: Lead) => string | null | undefined) =>
    [...new Set(leads.map((l) => pick(l)?.trim()).filter((s): s is string => !!s))];
  const settersUsados = usados((l) => l.setter);
  const closersUsados = usados((l) => l.closer);

  return (
    <CrmBoard
      leads={crmLeads}
      stages={stages}
      juntas={juntas}
      marcar={marcar}
      transitions={transitions}
      total={leads.length}
      errorMsg={errorMsg}
      hoy={hoy}
      equipo={equipo}
      settersUsados={settersUsados}
      closersUsados={closersUsados}
    />
  );
}
