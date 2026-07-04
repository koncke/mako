'use client';

// =============================================================================
// LeadSheet — ficha del lead en modal: PREVIEW de solo lectura, organizada en tabs
// =============================================================================
// Tabs: Resumen / Cobranza / Actividad. La edición vive en /leads/[id] (botón
// "Editar lead →"). Los movimientos del Kanban que exigen datos usan su propio
// pop-up chico (StageMoveDialog), no esta ficha.

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { CHIP, deriveStageKey, stageMeta, type Stage } from '@/lib/pipeline';
import { buildJourney } from '@/lib/journey';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { deleteLeadInlineAction, type LeadFullData } from './actions';
import { JourneyTimeline } from './JourneyTimeline';
import { OrigenCard } from './lead-view/OrigenCard';
import { InfoPrincipalCard } from './lead-view/InfoPrincipalCard';
import { AuditHistory } from './lead-view/AuditHistory';
import { ComportamientoCard } from './lead-view/ComportamientoCard';
import { ReunionesCard } from './lead-view/ReunionesCard';
import { TrackingTimelineCard } from './lead-view/TrackingTimelineCard';
import { InsightsCard } from './lead-view/InsightsCard';
import { DealDetailsCard } from './[id]/DealDetailsCard';
import { LeadTabs } from './lead-view/LeadTabs';
import { ConfirmDialog } from '../components/ConfirmDialog';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

export function LeadSheet({ data, onClose, initialTab }: { data: LeadFullData; onClose: () => void; initialTab?: string }) {
  const { lead, stages, pagos, vslEng, campana, visitas, insights, tracking, respuestas } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // a11y de diálogo: ESC, foco al panel, focus-trap básico, scroll-lock.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevActive = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, []);

  const stageKey = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const sm: Stage | undefined = stageMeta(stages, stageKey);
  const chip = sm ? CHIP[sm.tone] || CHIP.neutral : CHIP.neutral;
  const isLost = lead.estado_lead === 'perdido' || lead.estado_lead === 'descalificado';
  const isGanado = lead.estado_lead === 'ganado';
  const monto = lead.monto_cierre_usd ?? 0;

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
    monto,
    hoyISO: new Date().toISOString().slice(0, 10),
  });

  const doDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      try { await deleteLeadInlineAction(lead.id); router.refresh(); onClose(); }
      catch { setDelErr('No se pudo borrar. Reintentá.'); }
    });
  };

  const tabResumen = (
    <>
      <InfoPrincipalCard leadId={lead.id} nombre={lead.nombre} empresa={lead.empresa} email={lead.email} telefono={lead.telefono} />
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 16 }}>Recorrido del lead</div>
        <JourneyTimeline steps={journey} />
      </section>
      {isLost && lead.motivo_perdida && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 12 }}>Motivo de pérdida</div>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{lead.motivo_perdida}</div>
        </section>
      )}
    </>
  );

  const tabCobranza = isGanado || pagos.length > 0 ? (
    <>
      <DealDetailsCard lead={lead} pagos={pagos} editable={false} />
      <Link href={`/leads/${lead.id}?tab=cobranza&edit=1`} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Editar deal →</Link>
    </>
  ) : (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 10 }}>Deal Details</div>
      <p style={{ fontSize: 14, color: 'var(--faint)' }}>El deal se habilita cuando el lead pasa a Facturando o Ganado.</p>
    </section>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px,4vw,48px) clamp(10px,3vw,20px)' }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="leadsheet-title" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, maxHeight: 'calc(100dvh - clamp(32px,8vw,96px))', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden', outline: 'none' }}>

        <div style={{ height: 3, background: sm?.dot ?? 'var(--accent)' }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: 'clamp(18px,4vw,24px) clamp(16px,4vw,28px) 12px' }}>
          <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
            <div aria-hidden style={{ flex: 'none', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 17, fontWeight: 700, background: chip.bg, color: chip.fg, border: '1px solid ' + chip.bd }}>{initials(lead.nombre)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: 5 }}><span style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: chip.bg, color: chip.fg, border: '1px solid ' + chip.bd }}>{sm?.label ?? lead.estado_lead}</span></div>
              <h2 id="leadsheet-title" style={{ fontWeight: 600, fontSize: 'clamp(20px,5vw,27px)', letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', lineHeight: 1.1 }}>{lead.nombre}</h2>
              <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 3 }}>{lead.empresa ?? 'Sin empresa'}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)', marginTop: 4 }}>Lead #{lead.id} · creado {fmtDDMMYYYY(lead.created_at)}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX /></button>
        </div>

        {/* tabs + cuerpo scrolleable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 clamp(16px,4vw,28px) clamp(14px,4vw,20px)' }}>
          <LeadTabs
            initial={initialTab}
            tabs={[
              { key: 'resumen', label: 'Overview', content: tabResumen },
              { key: 'comportamiento', label: 'Tracking', content: <><OrigenCard lead={lead} vslEng={vslEng} campana={campana} /><ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} /><TrackingTimelineCard eventos={tracking} /></> },
              { key: 'reuniones', label: 'Meetings', content: <ReunionesCard lead={lead} respuestas={respuestas} /> },
              { key: 'insights', label: 'Insights', content: <InsightsCard insights={insights} />, badge: insights.length },
              { key: 'cobranza', label: 'Deal Details', content: tabCobranza, badge: pagos.filter((p) => !p.pagado).length },
              { key: 'actividad', label: 'Change History', content: <AuditHistory leadId={lead.id} stages={stages} /> },
            ]}
          />
        </div>

        {/* footer */}
        {delErr && <div style={{ padding: '8px clamp(16px,4vw,28px)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>{delErr}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px clamp(16px,4vw,28px)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={() => setConfirmDelete(true)} disabled={pending} style={{ padding: '8px 6px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Borrar lead</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cerrar</button>
            <Link href={`/leads/${lead.id}?edit=1`} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textDecoration: 'none' }}>Editar lead →</Link>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Borrar lead"
          message={<>Vas a borrar definitivamente a <b style={{ color: 'var(--ink)' }}>{lead.nombre}</b> y todo su historial. <b style={{ color: 'var(--bad)' }}>No se puede deshacer.</b></>}
          confirmLabel="Borrar definitivamente"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
          zIndex={120}
        />
      )}
    </div>
  );
}
