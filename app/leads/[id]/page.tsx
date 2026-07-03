// =============================================================================
// /leads/[id] — detalle del lead en tabs: Resumen / Editar / Cobranza / Actividad
// =============================================================================
// Header fijo (etapa, nombre, cohorte, acciones rápidas) + tabs. La edición vive
// en la tab Editar; el modal del CRM es solo preview y linkea acá con ?tab=.

import Link from 'next/link';
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
} from '@/lib/leads';
import { deriveStageKey, stageMeta, CHIP, DEFAULT_STAGES, type Stage } from '@/lib/pipeline';
import { getPagosByLead } from '@/lib/pagos';
import { getCampaignNameMap, resolverNombreCampana } from '@/lib/queries';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { guardOnboarding } from '@/lib/tab-access';
import { buildJourney } from '@/lib/journey';
import { JourneyTimeline } from '../JourneyTimeline';
import { EditLeadForm } from './EditLeadForm';
import { CobranzaPlanCard } from './CobranzaPlanCard';
import { OrigenCard } from '../lead-view/OrigenCard';
import { QuickActions } from '../lead-view/QuickActions';
import { AuditHistory } from '../lead-view/AuditHistory';
import { ComportamientoCard } from '../lead-view/ComportamientoCard';
import { RespuestasCard } from '../lead-view/RespuestasCard';
import { LeadTabs, type LeadTabKey } from '../lead-view/LeadTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await guardOnboarding();
  const [{ id: idStr }, { tab }] = await Promise.all([params, searchParams]);
  const idNum = Number(idStr);
  if (!Number.isFinite(idNum)) notFound();

  const lead = await getLead(idNum);
  if (!lead) notFound();

  const [vslEng, pagos, campMap, stagesRaw, visitasMap] = await Promise.all([
    getVslEngagement(lead.visitor_id),
    getPagosByLead(lead.id),
    getCampaignNameMap(),
    getPipelineStages().catch(() => [] as Stage[]),
    getVisitasLandingMap([lead.visitor_id]).catch(() => new Map<string, { total_visitas: number; dias_distintos: number }>()),
  ]);
  const stages = stagesRaw.length ? stagesRaw : DEFAULT_STAGES;
  const campanaResuelta = resolverNombreCampana(lead.utm_campaign, campMap);
  const visitas = visitasMap.get(lead.visitor_id ?? '') ?? { total_visitas: 0, dias_distintos: 0 };

  const { emoji: _e, label: cohorteLabel, color: cohorteColor } = labelMadurez(estadoMadurezLead(lead));
  void _e;
  const textoJ1 = textoCohorteJ1(lead.fecha_junta_1);

  const stageKey = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const sm = stages.length ? stageMeta(stages, stageKey) : null;
  const chip = sm ? CHIP[sm.tone] || CHIP.neutral : CHIP.neutral;

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
  const cuotasPendientes = pagos.filter((p) => !p.pagado).length;

  return (
    <main style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", padding: 'clamp(20px,4vw,44px)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {/* HEADER */}
        <Link href="/leads" style={{ fontSize: 14, color: 'var(--dim)', textDecoration: 'none' }}>← Volver a Leads</Link>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: chip.bg, color: chip.fg, border: '1px solid ' + chip.bd, marginBottom: 9 }}>{sm?.label ?? lead.estado_lead}</span>
            <h1 style={{ fontSize: 'clamp(28px,6vw,42px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>{lead.nombre}</h1>
            <p style={{ marginTop: 6, fontSize: 14, color: 'var(--dim)' }}>
              {lead.empresa ?? 'Sin empresa'} · Lead #{lead.id} · creado {fmtDDMMYYYY(lead.created_at)}
            </p>
          </div>
          <div style={{ ...card, padding: '14px 18px', minWidth: 180 }}>
            <div style={sectLabel}>Cohorte</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: cohorteColor, marginTop: 4 }}>{cohorteLabel}</div>
            {textoJ1 && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3 }}>{textoJ1}</div>}
          </div>
        </div>

        <div style={{ margin: '16px 0 18px' }}>
          <QuickActions leadId={lead.id} email={lead.email} telefono={lead.telefono} />
        </div>

        {/* TABS */}
        <LeadTabs
          initial={(tab as LeadTabKey) || 'resumen'}
          badges={{ cobranza: cuotasPendientes }}
          resumen={
            <>
              <section style={card}>
                <div style={{ ...sectLabel, marginBottom: 18 }}>Recorrido del lead</div>
                <JourneyTimeline steps={journey} />
              </section>
              <OrigenCard lead={lead} vslEng={vslEng} campana={campanaResuelta} />
              <ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} />
              <RespuestasCard lead={lead} />
            </>
          }
          editar={<EditLeadForm lead={lead} stages={stages} />}
          cobranza={
            esVenta || tienePlan ? (
              <CobranzaPlanCard lead={lead} pagos={pagos} />
            ) : (
              <section style={card}>
                <div style={{ ...sectLabel, marginBottom: 10 }}>Cobranza</div>
                <p style={{ fontSize: 14, color: 'var(--faint)' }}>La cobranza se habilita cuando el lead pasa a Facturando o Ganado. Movelo de etapa desde la tab Editar.</p>
              </section>
            )
          }
          actividad={<AuditHistory leadId={lead.id} />}
        />
      </div>
    </main>
  );
}
