// =============================================================================
// /leads/[id] — vista detalle + edición de lead
// =============================================================================

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getLead,
  estadoMadurezLead,
  labelMadurez,
  textoCohorteJ1,
  getVslEngagement,
  type VslEngagement,
  type Lead,
} from '@/lib/leads';
import { getPagosByLead } from '@/lib/pagos';
import { getCampaignNameMap, resolverNombreCampana } from '@/lib/queries';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { EditLeadForm } from './EditLeadForm';
import { CobranzaPlanCard } from './CobranzaPlanCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fmtFechaLarga(yyyy_mm_dd: string | null): string {
  // Convención del proyecto: fecha completa en pantalla → dd/mm/aaaa.
  return fmtDDMMYYYY(yyyy_mm_dd);
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const idNum = Number(idStr);
  if (!Number.isFinite(idNum)) notFound();

  const lead = await getLead(idNum);
  if (!lead) notFound();

  // Los 3 son independientes del lead ya cargado → en paralelo (antes: 3 awaits seriales).
  //  - vslEng: comportamiento VSL (Fase 7)
  //  - pagos: plan de pagos / cuotas (Fase 8-bis)
  //  - campMap: nombre de campaña desde el ID de utm_campaign (v3 Fase B bug 2)
  const [vslEng, pagos, campMap] = await Promise.all([
    getVslEngagement(lead.visitor_id),
    getPagosByLead(lead.id),
    getCampaignNameMap(),
  ]);
  const campanaResuelta = resolverNombreCampana(lead.utm_campaign, campMap);

  const estado = estadoMadurezLead(lead);
  const { emoji, label, color } = labelMadurez(estado);

  // Texto informativo de la cohorte. J1 futura → "faltan X días para J1"
  // (nunca "−X días desde J1"). Fase 8.
  const textoJ1 = textoCohorteJ1(lead.fecha_junta_1);

  return (
    <main className="min-h-screen w-full px-6 py-8 md:px-12 md:py-12 bg-[var(--bg)] text-[var(--text)]">
      {/* HEADER */}
      <header className="mb-8">
        <Link href="/leads" className="text-base" style={{ color: 'var(--text-dim)' }}>
          ← Leads
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1
              className="text-[46px] md:text-[62px] tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}
            >
              {lead.nombre}
            </h1>
            <p className="mt-1 text-base" style={{ color: 'var(--text-dim)' }}>
              {lead.empresa ?? 'Sin empresa'} · Lead #{lead.id} · Creado{' '}
              {fmtFechaLarga(lead.created_at.slice(0, 10))}
            </p>
          </div>

          {/* Badge cohorte */}
          <div
            className="rounded-lg px-4 py-3 border"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              Cohorte
            </div>
            <div className="text-2xl mt-1 flex items-center gap-2">
              <span>{emoji}</span>
              <span style={{ color, fontWeight: 600 }}>{label}</span>
            </div>
            {textoJ1 && (
              <div className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                {textoJ1}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ORIGEN Y COMPORTAMIENTO (read-only, Fase 7) */}
      <div className="mb-6">
        <OrigenCard lead={lead} vslEng={vslEng} campana={campanaResuelta} />
      </div>

      {/* FORM */}
      <EditLeadForm lead={lead} />

      {/* PLAN DE PAGOS / CUOTAS (Fase 8-bis) */}
      <div className="mt-6">
        <CobranzaPlanCard lead={lead} pagos={pagos} />
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OrigenCard — de dónde vino el lead y si vio el VSL (Fase 7)
// ─────────────────────────────────────────────────────────────────────────────

function labelOrigen(origen: string | null): { texto: string; color: string } {
  switch (origen) {
    case 'instant_form':
      return { texto: '📋 Instant Form (Meta)', color: 'var(--accent-yellow)' };
    case 'calendly':
      return { texto: '📅 Calendly', color: 'var(--accent-green)' };
    default:
      return { texto: 'Orgánico / manual', color: 'var(--text-dim)' };
  }
}

function OrigenCard({
  lead,
  vslEng,
  campana,
}: {
  lead: Lead;
  vslEng: VslEngagement;
  campana: { texto: string | null; tooltip: string | null };
}) {
  const tieneAtribucion =
    lead.origen_lead ||
    lead.meta_campaign_name ||
    lead.meta_adset_name ||
    lead.meta_ad_name ||
    lead.utm_campaign ||
    lead.utm_source;
  const tieneComportamiento = lead.visitor_id !== null;
  const vio = vslEng.plays > 0;

  // Señal clave recalibrada (v3 Fase A): agendó Y tiene visitor con 0 plays.
  // Sin visitor_id no afirmamos nada (mostramos "sin datos de VSL").
  const agendoSinVerVsl =
    lead.fecha_agenda !== null && tieneComportamiento && !vio;

  if (!tieneAtribucion && !tieneComportamiento) {
    return (
      <section
        className="rounded-xl border p-6 md:p-8"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        <h2
          className="text-[28px] mb-2"
          style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}
        >
          Origen del lead
        </h2>
        <p className="text-base" style={{ color: 'var(--text-pending)' }}>
          Sin datos de origen. Lead anterior al tracking, manual, o llegó sin
          UTMs ni instant form.
        </p>
      </section>
    );
  }

  const origen = labelOrigen(lead.origen_lead);

  const filas: Array<{ label: string; value: string | null }> = [
    // Campaña: nombre Meta directo, o el utm_campaign resuelto a nombre (v3 Fase B).
    { label: 'Campaña', value: lead.meta_campaign_name ?? campana.texto },
    { label: 'Adset (Meta)', value: lead.meta_adset_name },
    { label: 'Anuncio (Meta)', value: lead.meta_ad_name },
    { label: 'UTM source', value: lead.utm_source },
  ].filter((f) => f.value);

  return (
    <section
      className="rounded-xl border p-6 md:p-8"
      style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
    >
      <h2
        className="text-[28px] mb-4"
        style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}
      >
        Origen del lead
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ATRIBUCIÓN */}
        <div>
          <div
            className="text-sm uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-dim)' }}
          >
            Atribución
          </div>
          <div className="text-lg mb-3" style={{ color: origen.color, fontWeight: 600 }}>
            {origen.texto}
          </div>
          {filas.length > 0 ? (
            <div className="space-y-2">
              {filas.map((f) => (
                <div key={f.label} className="text-base">
                  <span style={{ color: 'var(--text-dim)' }}>{f.label}: </span>
                  <span style={{ color: 'var(--text)' }}>{f.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-base" style={{ color: 'var(--text-pending)' }}>
              Sin campaña ni UTMs registrados.
            </p>
          )}
        </div>

        {/* COMPORTAMIENTO */}
        <div>
          <div
            className="text-sm uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-dim)' }}
          >
            Comportamiento
          </div>
          {tieneComportamiento ? (
            <>
              <div className="text-lg mb-2">
                <span style={{ color: 'var(--text-dim)' }}>Vio el VSL: </span>
                <span
                  style={{
                    color: vio ? 'var(--accent-green)' : 'var(--accent-orange)',
                    fontWeight: 600,
                  }}
                >
                  {vio
                    ? vslEng.max_pct !== null
                      ? `Sí — vio hasta el ${vslEng.max_pct}%`
                      : `Sí — ${vslEng.plays} ${vslEng.plays === 1 ? 'vez' : 'veces'}`
                    : 'No'}
                </span>
              </div>
              {agendoSinVerVsl && (
                <div
                  className="rounded-lg px-4 py-3 text-base mt-3"
                  style={{
                    background: '#2a1410',
                    color: 'var(--accent-orange)',
                    border: '1px solid var(--accent-orange)',
                  }}
                >
                  ⚠️ Agendó SIN ver el VSL — se saltó el filtro. Probablemente
                  llegue a R1 con menos contexto: dedica 5 min extra a explicar
                  el modelo antes de calificar.
                </div>
              )}
            </>
          ) : (
            <p className="text-base" style={{ color: 'var(--text-pending)' }}>
              Sin tracking de visitante (agendó antes del tracking del VSL, o
              llegó por instant form sin pasar por la landing).
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
