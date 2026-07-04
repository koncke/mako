// =============================================================================
// /leads/[id] — detalle del lead en tabs: Resumen / Editar / Cobranza / Actividad
// =============================================================================
// Header fijo (etapa, nombre, cohorte, acciones rápidas) + tabs. La edición vive
// en la tab Editar; el modal del CRM es solo preview y linkea acá con ?tab=.

import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import {
  getLead,
  getPipelineStages,
  estadoMadurezLead,
  labelMadurez,
  textoCohorteJ1,
  getVslEngagement,
  getVisitasLandingMap,
  getTrackingEvents,
  getLeadRespuestas,
} from '@/lib/leads';
import { deriveStageKey, stageMeta, DEFAULT_STAGES, type Stage } from '@/lib/pipeline';
import { getPagosByLead } from '@/lib/pagos';
import { getCampaignNameMap, resolverNombreCampana, getAdNameMap, resolverNombreAd } from '@/lib/queries';
import { guardOnboarding } from '@/lib/tab-access';
import { buildJourney } from '@/lib/journey';
import { JourneyTimeline } from '../JourneyTimeline';
import { DealDetailsCard } from './DealDetailsCard';
import { LeadDetailBody, BackButton } from './LeadDetailBody';
import { OrigenCard } from '../lead-view/OrigenCard';
import { InfoPrincipalCard } from '../lead-view/InfoPrincipalCard';
import { AuditHistory } from '../lead-view/AuditHistory';
import { ComportamientoCard } from '../lead-view/ComportamientoCard';
import { ReunionesCard } from '../lead-view/ReunionesCard';
import { ChatCard } from '../lead-view/ChatCard';
import { GeneratedInsightCard } from '../lead-view/GeneratedInsightCard';
import { getUltimoInsightGenerado, faltantesParaInsights } from '@/lib/lead-insights';
import { faltantesDeLead } from '@/lib/leads';
import { TrackingTimelineCard } from '../lead-view/TrackingTimelineCard';
import { getLeadInsights } from '../actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; edit?: string }> }) {
  await guardOnboarding();
  const [{ id: idStr }, { tab, edit }] = await Promise.all([params, searchParams]);
  const idNum = Number(idStr);
  if (!Number.isFinite(idNum)) notFound();

  const lead = await getLead(idNum);
  if (!lead) notFound();

  const [vslEng, pagos, campMap, adMap, stagesRaw, visitasMap, insights, trackingEventos] = await Promise.all([
    getVslEngagement(lead.visitor_id),
    getPagosByLead(lead.id),
    getCampaignNameMap(),
    getAdNameMap().catch(() => ({} as Record<string, string>)),
    getPipelineStages().catch(() => [] as Stage[]),
    getVisitasLandingMap([lead.visitor_id]).catch(() => new Map<string, { total_visitas: number; dias_distintos: number }>()),
    getLeadInsights(idNum),
    getTrackingEvents(lead.visitor_id),
  ]);
  const [respuestas, insightGen] = await Promise.all([getLeadRespuestas(lead), getUltimoInsightGenerado(lead.id)]);
  const stages = stagesRaw.length ? stagesRaw : DEFAULT_STAGES;
  const campanaResuelta = resolverNombreCampana(lead.utm_campaign, campMap);
  const adResuelto = resolverNombreAd(lead.meta_ad_id ?? null, lead.meta_ad_name ?? null, adMap);
  const visitas = visitasMap.get(lead.visitor_id ?? '') ?? { total_visitas: 0, dias_distintos: 0 };

  const { emoji: _e, label: cohorteLabel, color: cohorteColor } = labelMadurez(estadoMadurezLead(lead));
  void _e;
  const textoJ1 = textoCohorteJ1(lead.fecha_junta_1);

  const stageKey = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const sm = stages.length ? stageMeta(stages, stageKey) : null;

  const journey = buildJourney({
    createdISO: lead.created_at,
    fechaAgenda: lead.fecha_agenda,
    fechaJ1: lead.fecha_junta_1,
    asistioJ1: lead.asistio_j1,
    fechaJ2: lead.fecha_junta_2,
    asistioJ2: lead.asistio_j2,
    fechaConfirmacion: lead.fecha_confirmacion,
    fechaPrimerPago: lead.fecha_primer_pago ?? null,
    fechaCierre: lead.fecha_cierre,
    estadoLead: lead.estado_lead,
    monto: lead.monto_cierre_usd ?? 0,
    hoyISO: new Date().toISOString().slice(0, 10),
  });

  const esVenta = lead.estado_lead === 'ganado' || stageKey === 'facturando';
  const tienePlan = pagos.length > 0 || !!lead.cobro_inicial_usd || (lead.total_cuotas ?? 0) > 0;

  // "Datos sin marcar": todo lo que la etapa actual adeuda (posible de conseguir).
  const faltantes = faltantesDeLead(lead, pagos.length > 0 ? true : undefined);
  const cuotasPendientes = pagos.filter((p) => !p.pagado).length;

  return (
    <main style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", padding: 'clamp(20px,4vw,44px)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <BackButton />
        {/* HEADER (nombre + chip + Editar) y tabs viven en LeadDetailBody; la
            cohorte pasó adentro de Información principal. */}
        <LeadDetailBody
          lead={lead}
          stages={stages}
          pagos={pagos}
          initialTab={tab}
          initialEdit={edit === '1'}
          nombre={lead.nombre}
          empresa={lead.empresa}
          createdISO={lead.created_at}
          stageLabel={sm?.label ?? lead.estado_lead}
          chipTone={sm?.tone ?? 'neutral'}
          faltantes={faltantes}
          tabs={[
            {
              key: 'resumen', label: 'Overview',
              content: (
                <>
                  {faltantes.length > 0 && (
                    <section style={{ ...card, borderColor: 'var(--bad)', background: 'var(--bad-bg)' }}>
                      <div style={{ ...sectLabel, color: 'var(--bad)', marginBottom: 10 }}>Datos sin marcar</div>
                      <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: '0 0 10px' }}>Faltan datos posibles de conseguir para esta etapa. Tocá <b>Solucionar</b> (arriba, al lado del nombre) para completarlos con el asistente.</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {faltantes.map((f) => (
                          <span key={f.id} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bad)', background: 'var(--surface)', border: '1px solid #EBBFBC', borderRadius: 999, padding: '4px 11px' }}>{f.label}</span>
                        ))}
                      </div>
                    </section>
                  )}
                  <InfoPrincipalCard
                    leadId={lead.id}
                    nombre={lead.nombre}
                    empresa={lead.empresa}
                    email={lead.email}
                    telefono={lead.telefono}
                    direccion={lead.deal_fiscal?.domicilio ?? null}
                    cohorte={lead.fecha_junta_1 ? { label: cohorteLabel, color: cohorteColor, texto: textoJ1 } : null}
                  />
                  <section style={card}>
                    <div style={{ ...sectLabel, marginBottom: 18 }}>Recorrido del lead</div>
                    <JourneyTimeline steps={journey} />
                  </section>
                </>
              ),
            },
            {
              key: 'comportamiento', label: 'Tracking',
              content: (
                <>
                  <OrigenCard lead={lead} vslEng={vslEng} campana={campanaResuelta} adNombre={adResuelto} />
                  <ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} />
                  <TrackingTimelineCard eventos={trackingEventos} />
                </>
              ),
            },
            { key: 'reuniones', label: 'Meetings', content: <ReunionesCard lead={lead} respuestas={respuestas} /> },
            { key: 'chat', label: 'Chat', content: <ChatCard leadId={lead.id} /> },
            {
              key: 'insights', label: 'Insights', badge: insights.length,
              content: (
                <GeneratedInsightCard
                  lead={lead}
                  stages={stages}
                  tienePlan={pagos.length > 0}
                  inicial={insightGen}
                  faltantesIniciales={faltantesParaInsights(lead, pagos.length > 0)}
                  llamadas={insights.map((i) => ({ tipo: i.tipo, fecha: i.started_at, url: i.share_url }))}
                />
              ),
            },
            {
              key: 'cobranza', label: 'Deal Details', badge: cuotasPendientes,
              content: esVenta || tienePlan ? (
                <DealDetailsCard lead={lead} pagos={pagos} />
              ) : (
                <section style={card}>
                  <div style={{ ...sectLabel, marginBottom: 10 }}>Deal Details</div>
                  <p style={{ fontSize: 14, color: 'var(--faint)' }}>El deal se habilita cuando el lead pasa a Facturando o Ganado (cambiando la etapa arriba).</p>
                </section>
              ),
            },
            { key: 'actividad', label: 'Change History', content: <AuditHistory leadId={lead.id} stages={stages} /> },
          ]}
        />
      </div>
    </main>
  );
}
