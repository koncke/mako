// =============================================================================
// /leads/[id] — vista detalle + edición de lead (rediseño claro)
// =============================================================================

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
  type VslEngagement,
  type Lead,
} from '@/lib/leads';
import { deriveStageKey, stageMeta, CHIP, DEFAULT_STAGES, type Stage } from '@/lib/pipeline';
import { getPagosByLead } from '@/lib/pagos';
import { getCampaignNameMap, resolverNombreCampana } from '@/lib/queries';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { guardOnboarding } from '@/lib/tab-access';
import { buildJourney } from '@/lib/journey';
import { JourneyTimeline } from '../JourneyTimeline';
import { EditLeadForm } from './EditLeadForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await guardOnboarding();
  const { id: idStr } = await params;
  const idNum = Number(idStr);
  if (!Number.isFinite(idNum)) notFound();

  const lead = await getLead(idNum);
  if (!lead) notFound();

  const [vslEng, pagos, campMap, stagesRaw] = await Promise.all([
    getVslEngagement(lead.visitor_id),
    getPagosByLead(lead.id),
    getCampaignNameMap(),
    getPipelineStages().catch(() => [] as Stage[]),
  ]);
  const stages = stagesRaw.length ? stagesRaw : DEFAULT_STAGES;
  const campanaResuelta = resolverNombreCampana(lead.utm_campaign, campMap);

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
  });

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
          {/* RECORRIDO */}
          <section style={card}>
            <div style={{ ...sectLabel, marginBottom: 18 }}>Recorrido del lead</div>
            <JourneyTimeline steps={journey} />
          </section>

          {/* ORIGEN Y COMPORTAMIENTO */}
          <OrigenCard lead={lead} vslEng={vslEng} campana={campanaResuelta} />

          {/* EDITOR COMPLETO (etapa + secciones por status + plan de pagos + barra fija) */}
          <EditLeadForm lead={lead} stages={stages} pagos={pagos} />
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OrigenCard — de dónde vino el lead y si vio el VSL
// ─────────────────────────────────────────────────────────────────────────────
function labelOrigen(origen: string | null): { texto: string; color: string } {
  switch (origen) {
    case 'instant_form': return { texto: 'Instant Form (Meta)', color: 'var(--accent)' };
    case 'calendly': return { texto: 'Calendly', color: 'var(--good)' };
    default: return { texto: 'Orgánico / manual', color: 'var(--dim)' };
  }
}

function OrigenCard({ lead, vslEng, campana }: { lead: Lead; vslEng: VslEngagement; campana: { texto: string | null; tooltip: string | null } }) {
  const tieneAtribucion = lead.origen_lead || lead.meta_campaign_name || lead.meta_adset_name || lead.meta_ad_name || lead.utm_campaign || lead.utm_source;
  const tieneComportamiento = lead.visitor_id !== null;
  const vio = vslEng.plays > 0;
  const agendoSinVerVsl = lead.fecha_agenda !== null && tieneComportamiento && !vio;

  if (!tieneAtribucion && !tieneComportamiento) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 8 }}>Origen del lead</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin datos de origen. Lead anterior al tracking, manual, o llegó sin UTMs ni instant form.</p>
      </section>
    );
  }

  const origen = labelOrigen(lead.origen_lead);
  const filas: Array<{ label: string; value: string | null }> = [
    { label: 'Campaña', value: lead.meta_campaign_name ?? campana.texto },
    { label: 'Adset (Meta)', value: lead.meta_adset_name },
    { label: 'Anuncio (Meta)', value: lead.meta_ad_name },
    { label: 'UTM source', value: lead.utm_source },
  ].filter((f) => f.value);

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 16 }}>Origen del lead</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 6 }}>Atribución</div>
          <div style={{ fontSize: 16, color: origen.color, fontWeight: 600, marginBottom: 10 }}>{origen.texto}</div>
          {filas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filas.map((f) => (
                <div key={f.label} style={{ fontSize: 14 }}>
                  <span style={{ color: 'var(--dim)' }}>{f.label}: </span>
                  <span style={{ color: 'var(--ink)' }}>{f.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin campaña ni UTMs registrados.</p>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 6 }}>Comportamiento</div>
          {tieneComportamiento ? (
            <>
              <div style={{ fontSize: 16, marginBottom: 8 }}>
                <span style={{ color: 'var(--dim)' }}>Vio el VSL: </span>
                <span style={{ color: vio ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>
                  {vio ? (vslEng.max_pct !== null ? `Sí — hasta el ${vslEng.max_pct}%` : `Sí — ${vslEng.plays} ${vslEng.plays === 1 ? 'vez' : 'veces'}`) : 'No'}
                </span>
              </div>
              {agendoSinVerVsl && (
                <div style={{ borderRadius: 11, padding: '12px 14px', marginTop: 8, background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-fill)', fontSize: 13.5, lineHeight: 1.5 }}>
                  Agendó sin ver el VSL — se saltó el filtro. Probablemente llegue a R1 con menos contexto: dedicá 5 min extra a explicar el modelo antes de calificar.
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin tracking de visitante (agendó antes del tracking del VSL, o llegó por instant form sin pasar por la landing).</p>
          )}
        </div>
      </div>
    </section>
  );
}
