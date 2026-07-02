'use client';

// =============================================================================
// LeadSheet — ficha del lead editable en un modal (fusión vista + edición)
// =============================================================================
// Reemplaza al viejo LeadDetail read-only: el modal ahora EDITA en el lugar,
// reusando el mismo editor de la ruta (/leads/[id] → EditLeadForm) con guardado
// coherente (saveLeadEditorAction, respeta las cascadas de updateLead). Compone
// los mismos sub-componentes que la ruta (recorrido, origen, historial, acciones
// rápidas), así no hay dos fichas divergentes. Un movimiento del Kanban que pide
// datos abre esta ficha con la etapa destino pre-seleccionada (initialStage).

import { useEffect, useRef, type CSSProperties } from 'react';
import { CHIP, deriveStageKey, stageMeta, type Stage } from '@/lib/pipeline';
import { buildJourney } from '@/lib/journey';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { Lead } from '@/lib/leads';
import type { LeadFullData } from './actions';
import { JourneyTimeline } from './JourneyTimeline';
import { EditLeadForm } from './[id]/EditLeadForm';
import { OrigenCard } from './lead-view/OrigenCard';
import { QuickActions } from './lead-view/QuickActions';
import { AuditHistory } from './lead-view/AuditHistory';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

function journeyFor(lead: Lead) {
  return buildJourney({
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
}

export function LeadSheet({ data, onClose, initialStage }: { data: LeadFullData; onClose: () => void; initialStage?: string }) {
  const { lead, stages, pagos, vslEng, campana } = data;
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

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px,4vw,48px) clamp(10px,3vw,20px)' }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="leadsheet-title" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 860, maxHeight: 'calc(100dvh - clamp(32px,8vw,96px))', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden', outline: 'none' }}>

        <div style={{ height: 3, background: sm?.dot ?? 'var(--accent)' }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: 'clamp(18px,4vw,24px) clamp(16px,4vw,28px)', borderBottom: '1px solid var(--border)' }}>
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

        {/* acciones rápidas */}
        <div style={{ padding: '14px clamp(16px,4vw,28px) 0' }}>
          <QuickActions email={lead.email} telefono={lead.telefono} telefonoNorm={lead.telefono_normalizado} />
        </div>

        {/* cuerpo scrolleable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'clamp(16px,4vw,22px) clamp(16px,4vw,28px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={card}>
            <div style={{ ...sectLabel, marginBottom: 16 }}>Recorrido del lead</div>
            <JourneyTimeline steps={journeyFor(lead)} />
          </section>

          <OrigenCard lead={lead} vslEng={vslEng} campana={campana} />

          <EditLeadForm lead={lead} stages={stages} pagos={pagos} initialStage={initialStage} onClose={onClose} />

          <AuditHistory leadId={lead.id} />
        </div>
      </div>
    </div>
  );
}
