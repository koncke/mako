'use client';

// =============================================================================
// LeadSheet — ficha del lead en modal: PREVIEW de solo lectura, organizada en tabs
// =============================================================================
// Tabs: Resumen / Cobranza / Actividad. La edición vive en /leads/[id] (botón
// "Editar lead →"). Los movimientos del Kanban que exigen datos usan su propio
// pop-up chico (StageMoveDialog), no esta ficha.

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CHIP, deriveStageKey, stageMeta, type Stage } from '@/lib/pipeline';
import { buildJourney } from '@/lib/journey';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { FathomLink } from '@/lib/leads';
import { deleteLeadInlineAction, type LeadFullData } from './actions';
import { JourneyTimeline } from './JourneyTimeline';
import { OrigenCard } from './lead-view/OrigenCard';
import { InfoPrincipalCard } from './lead-view/InfoPrincipalCard';
import { AuditHistory } from './lead-view/AuditHistory';
import { ComportamientoCard } from './lead-view/ComportamientoCard';
import { RespuestasCard } from './lead-view/RespuestasCard';
import { LeadTabs } from './lead-view/LeadTabs';
import { ConfirmDialog } from '../components/ConfirmDialog';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US');

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

const yesNo = (v: boolean | null): ReactNode =>
  v === true ? <span style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: 'var(--good)', background: 'var(--good-bg)' }}>Sí</span>
  : v === false ? <span style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: 'var(--bad)', background: 'var(--bad-bg)' }}>No</span>
  : <span style={{ color: 'var(--faint)' }}>—</span>;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  const isEmpty = value === '—' || value == null || value === '';
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 15, color: isEmpty ? 'var(--faint)' : 'var(--ink)', fontWeight: isEmpty ? 400 : 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}

export function LeadSheet({ data, onClose, initialTab }: { data: LeadFullData; onClose: () => void; initialTab?: string }) {
  const { lead, stages, pagos, vslEng, campana, visitas } = data;
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
  const agendo = !!lead.fecha_junta_1 || !!lead.fecha_junta_2 || !!lead.fecha_agenda || lead.asistio_j1 != null;

  const cobrado = pagos.filter((p) => p.pagado).reduce((s, p) => s + Number(p.monto_usd), 0);
  const pendiente = pagos.filter((p) => !p.pagado).reduce((s, p) => s + Number(p.monto_usd), 0);
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

  const fathomLinks = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url);

  const tabResumen = (
    <>
      <InfoPrincipalCard leadId={lead.id} nombre={lead.nombre} empresa={lead.empresa} email={lead.email} telefono={lead.telefono} />
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 16 }}>Recorrido del lead</div>
        <JourneyTimeline steps={journey} />
      </section>
      {agendo && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 14 }}>Datos comerciales</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
            <Stat label="Fecha Reunión 1" value={lead.fecha_junta_1 ? fmtDDMMYYYY(lead.fecha_junta_1) : lead.fecha_agenda ? fmtDDMMYYYY(lead.fecha_agenda) : '—'} />
            <Stat label="¿Asistió a R1?" value={yesNo(lead.asistio_j1)} />
            <Stat label="¿Era calificado?" value={yesNo(lead.calificado)} />
            {(lead.fecha_junta_2 || lead.asistio_j2 != null) && <Stat label="Fecha Reunión 2" value={lead.fecha_junta_2 ? fmtDDMMYYYY(lead.fecha_junta_2) : '—'} />}
            {(lead.fecha_junta_2 || lead.asistio_j2 != null) && <Stat label="¿Asistió a R2?" value={yesNo(lead.asistio_j2)} />}
            {lead.fecha_confirmacion && <Stat label="Confirmación de pago" value={fmtDDMMYYYY(lead.fecha_confirmacion)} />}
            <Stat label="Closer" value={lead.closer || '—'} />
            <Stat label="Setter" value={lead.setter || '—'} />
          </div>
          {fathomLinks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {fathomLinks.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{f.label || 'Llamada'} (Fathom)</span>
                  <span style={{ fontSize: 13, color: 'var(--accent)' }}>Abrir →</span>
                </a>
              ))}
            </div>
          )}
        </section>
      )}
      {isLost && lead.motivo_perdida && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 12 }}>Motivo de pérdida</div>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{lead.motivo_perdida}</div>
        </section>
      )}
      <OrigenCard lead={lead} vslEng={vslEng} campana={campana} />
      <ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} />
      <RespuestasCard lead={lead} />
    </>
  );

  const tabCobranza = (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Cobranza</div>
      {isGanado || pagos.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
            <Stat label="Monto de cierre" value={monto ? fmtUSD(monto) : '—'} />
            <Stat label="Cobrado" value={fmtUSD(cobrado)} />
            <Stat label="Pendiente" value={pendiente > 0 ? fmtUSD(pendiente) : cobrado > 0 ? 'Pagado' : '—'} />
          </div>
          {pagos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
              {pagos.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border)', background: p.pagado ? 'var(--good-bg)' : 'var(--surface-2)', fontSize: 13.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.numero === 0 ? 'Cobro inicial' : `Cuota ${p.numero}`}</span>
                  <span style={{ color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(Number(p.monto_usd))}</span>
                  <span style={{ color: p.pagado ? 'var(--good)' : 'var(--dim)', fontSize: 12.5 }}>{p.pagado ? `cobrada ${fmtDDMMYYYY(p.fecha_pago)}` : `vence ${fmtDDMMYYYY(p.fecha_esperada)}`}</span>
                </div>
              ))}
            </div>
          )}
          <Link href={`/leads/${lead.id}?tab=cobranza`} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', marginTop: 14 }}>Editar plan y marcar cuotas →</Link>
        </>
      ) : (
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>La cobranza se habilita cuando el lead pasa a Facturando o Ganado.</p>
      )}
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
              { key: 'resumen', label: 'Resumen', content: tabResumen },
              { key: 'cobranza', label: 'Cobranza', content: tabCobranza, badge: pagos.filter((p) => !p.pagado).length },
              { key: 'actividad', label: 'Actividad', content: <AuditHistory leadId={lead.id} /> },
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
