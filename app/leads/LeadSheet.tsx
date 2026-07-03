'use client';

// =============================================================================
// LeadSheet — ficha del lead en modal: PREVIEW de solo lectura + Editar → ruta
// =============================================================================
// El pop-up muestra el lead (recorrido, contacto/origen, comportamiento, datos
// comerciales, plan resumen, historial); la edición vive en /leads/[id] (botón
// "Editar lead →"). Única escritura acá: la tarjeta "completar movimiento",
// cuando el Kanban mueve a una etapa que exige datos (pendingMove).

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CHIP, deriveStageKey, stageMeta, type Stage } from '@/lib/pipeline';
import { buildJourney } from '@/lib/journey';
import { missingForStage } from '@/lib/stage-requirements';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { FathomLink } from '@/lib/leads';
import { completeStageMoveAction, deleteLeadInlineAction, type LeadFullData } from './actions';
import { JourneyTimeline } from './JourneyTimeline';
import { OrigenCard } from './lead-view/OrigenCard';
import { QuickActions } from './lead-view/QuickActions';
import { AuditHistory } from './lead-view/AuditHistory';
import { ComportamientoCard } from './lead-view/ComportamientoCard';
import { RespuestasCard } from './lead-view/RespuestasCard';
import { ConfirmDialog } from '../components/ConfirmDialog';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };
const compInput: CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };

export type PendingMoveInfo = { to: string; asistioJ1?: boolean | null; asistioJ2?: boolean | null };

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

export function LeadSheet({ data, onClose, pendingMove, focus }: { data: LeadFullData; onClose: () => void; pendingMove?: PendingMoveInfo | null; focus?: string }) {
  const { lead, stages, pagos, vslEng, campana, visitas } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveErr, setMoveErr] = useState<string | null>(null);

  // Estado local de la tarjeta "completar movimiento".
  const [mFechaJ1, setMFechaJ1] = useState(lead.fecha_junta_1 ?? '');
  const [mFechaJ2, setMFechaJ2] = useState(lead.fecha_junta_2 ?? '');
  const [mMonto, setMMonto] = useState(lead.monto_cierre_usd?.toString() ?? '');
  const [mMotivo, setMMotivo] = useState(lead.motivo_perdida ?? '');
  // 'manual' se intercepta en el Kanban (pide motivo+deadline en su propio modal),
  // así que la tarjeta nunca pide setter — pero la validación lo considera.
  const mSetter = lead.setter ?? '';
  const [mFathom, setMFathom] = useState<FathomLink[]>(() => {
    const base = (lead.fathom_links ?? []) as FathomLink[];
    return base.length ? base : [{ label: 'Llamada', url: '' }];
  });

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

  // Scroll a la tarjeta de completar (movimiento pendiente) o a la sección de
  // foco pedida por el caller (desgloses: plan-pagos, datos-comerciales…).
  useEffect(() => {
    const targetId = pendingMove ? 'lead-sec-completar' : focus ? `lead-sec-${focus}` : null;
    if (!targetId) return;
    const t = setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 90);
    return () => clearTimeout(t);
  }, [pendingMove, focus]);

  const stageKey = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const sm: Stage | undefined = stageMeta(stages, stageKey);
  const chip = sm ? CHIP[sm.tone] || CHIP.neutral : CHIP.neutral;
  const isLost = lead.estado_lead === 'perdido' || lead.estado_lead === 'descalificado';
  const isGanado = lead.estado_lead === 'ganado';
  const agendo = !!lead.fecha_junta_1 || !!lead.fecha_junta_2 || !!lead.fecha_agenda || lead.asistio_j1 != null;

  const cobrado = pagos.filter((p) => p.pagado).reduce((s, p) => s + Number(p.monto_usd), 0);
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

  // ── Completar movimiento ──
  const to = pendingMove?.to;
  const needFechaJ1 = to === 'agenda';
  const needFechaJ2 = to === 'agendaj2' || to === 'facturando';
  const needFathom = to === 'agenda' || to === 'agendaj2' || to === 'facturando';
  const needMonto = to === 'ganado';
  const needMotivo = to === 'perdido' || to === 'descal';
  const faltan = to ? missingForStage(to, {
    fechaJ1: mFechaJ1, fechaJ2: mFechaJ2,
    hasFathomUrl: mFathom.some((f) => f.url.trim()),
    monto: parseFloat(mMonto) || null, motivo: mMotivo, setter: mSetter,
  }) : [];

  const confirmarMovimiento = () => {
    if (!to || faltan.length) return;
    setMoveErr(null);
    startTransition(async () => {
      try {
        await completeStageMoveAction(lead.id, to, {
          ...(needFechaJ1 ? { fechaJ1: mFechaJ1 || null } : {}),
          ...(needFechaJ2 ? { fechaJ2: mFechaJ2 || null } : {}),
          ...(needFathom ? { fathom: mFathom.filter((f) => f.url.trim() || f.label.trim()) } : {}),
          ...(needMonto ? { monto: parseFloat(mMonto) || null } : {}),
          ...(needMotivo ? { motivo: mMotivo.trim() || null } : {}),
          asistioJ1: pendingMove?.asistioJ1,
          asistioJ2: pendingMove?.asistioJ2,
        });
        router.refresh();
        onClose();
      } catch (err) {
        setMoveErr(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const doDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      try { await deleteLeadInlineAction(lead.id); router.refresh(); onClose(); }
      catch { setMoveErr('No se pudo borrar. Reintentá.'); }
    });
  };

  const setFathomAt = (i: number, field: 'label' | 'url', v: string) =>
    setMFathom((arr) => arr.map((f, fi) => (fi === i ? { ...f, [field]: v } : f)));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px,4vw,48px) clamp(10px,3vw,20px)' }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="leadsheet-title" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, maxHeight: 'calc(100dvh - clamp(32px,8vw,96px))', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden', outline: 'none' }}>

        <div style={{ height: 3, background: sm?.dot ?? 'var(--accent)' }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: 'clamp(18px,4vw,24px) clamp(16px,4vw,28px) 14px', borderBottom: '1px solid var(--border)' }}>
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
        <div style={{ padding: '12px clamp(16px,4vw,28px) 0' }}>
          <QuickActions leadId={lead.id} email={lead.email} telefono={lead.telefono} />
        </div>

        {/* cuerpo scrolleable — SOLO LECTURA */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'clamp(14px,4vw,20px) clamp(16px,4vw,28px)', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* tarjeta de completar movimiento (única escritura del preview) */}
          {pendingMove && (
            <div id="lead-sec-completar" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--warn)' }}>
                Moviendo a &quot;{stageMeta(stages, to!)?.label ?? to}&quot; — {faltan.length ? 'completá lo obligatorio' : 'confirmá el cambio'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                {needFechaJ1 && (
                  <label><span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Fecha de la Reunión 1</span><input type="date" value={mFechaJ1} onChange={(e) => setMFechaJ1(e.target.value)} style={{ ...compInput, marginTop: 5 }} /></label>
                )}
                {needFechaJ2 && (
                  <label><span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Fecha de la Reunión 2</span><input type="date" value={mFechaJ2} onChange={(e) => setMFechaJ2(e.target.value)} style={{ ...compInput, marginTop: 5 }} /></label>
                )}
                {needMonto && (
                  <label><span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Monto de cierre (USD)</span><input inputMode="numeric" value={mMonto} onChange={(e) => setMMonto(e.target.value)} placeholder="0" style={{ ...compInput, marginTop: 5 }} /></label>
                )}
                {needMotivo && (
                  <label><span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Motivo</span><textarea value={mMotivo} onChange={(e) => setMMotivo(e.target.value)} placeholder="¿Por qué se perdió o descalificó?" style={{ ...compInput, marginTop: 5, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }} /></label>
                )}
                {needFathom && (
                  <div>
                    <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Link(s) de Fathom</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 5 }}>
                      {mFathom.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input aria-label="Etiqueta" value={f.label} onChange={(e) => setFathomAt(i, 'label', e.target.value)} placeholder="Llamada" style={{ ...compInput, flex: 'none', width: 110 }} />
                          <input aria-label="URL de Fathom" value={f.url} onChange={(e) => setFathomAt(i, 'url', e.target.value)} placeholder="https://fathom.video/…" style={{ ...compInput, flex: 1, minWidth: 170 }} />
                        </div>
                      ))}
                      <button onClick={() => setMFathom((arr) => [...arr, { label: '', url: '' }])} style={{ padding: 9, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>+ Agregar otro link</button>
                    </div>
                  </div>
                )}
              </div>
              {faltan.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Falta:</span>
                  {faltan.map((x) => (<span key={x} style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', padding: '3px 9px', borderRadius: 999 }}>{x}</span>))}
                </div>
              )}
              {moveErr && <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600, marginTop: 8 }}>{moveErr}</div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Si cancelás, el lead queda en su etapa actual.</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={onClose} style={{ padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
                  <button onClick={confirmarMovimiento} disabled={pending || faltan.length > 0} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: faltan.length ? 'var(--border)' : 'var(--primary)', color: faltan.length ? 'var(--ink)' : '#fff', fontSize: 13.5, fontWeight: 700, cursor: faltan.length ? 'default' : 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar y mover'}</button>
                </div>
              </div>
            </div>
          )}

          {/* recorrido */}
          <section style={card}>
            <div style={{ ...sectLabel, marginBottom: 16 }}>Recorrido del lead</div>
            <JourneyTimeline steps={journey} />
          </section>

          {/* origen + comportamiento */}
          <OrigenCard lead={lead} vslEng={vslEng} campana={campana} />
          <ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} />

          {/* datos comerciales (solo lectura) */}
          {agendo && (
            <section id="lead-sec-datos-comerciales" style={card}>
              <div style={{ ...sectLabel, marginBottom: 14 }}>Datos comerciales</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
                <Stat label="Fecha Reunión 1" value={lead.fecha_junta_1 ? fmtDDMMYYYY(lead.fecha_junta_1) : lead.fecha_agenda ? fmtDDMMYYYY(lead.fecha_agenda) : '—'} />
                <Stat label="¿Asistió a R1?" value={yesNo(lead.asistio_j1)} />
                <Stat label="¿Era calificado?" value={yesNo(lead.calificado)} />
                <Stat label="Fecha Reunión 2" value={lead.fecha_junta_2 ? fmtDDMMYYYY(lead.fecha_junta_2) : '—'} />
                <Stat label="¿Asistió a R2?" value={yesNo(lead.asistio_j2)} />
                <Stat label="Confirmación de pago" value={lead.fecha_confirmacion ? fmtDDMMYYYY(lead.fecha_confirmacion) : '—'} />
                <Stat label="Closer" value={lead.closer || '—'} />
                <Stat label="Setter" value={lead.setter || '—'} />
              </div>
              {((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                  {((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url).map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{f.label || 'Llamada'} (Fathom)</span>
                      <span style={{ fontSize: 13, color: 'var(--accent)' }}>Abrir →</span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* motivo de pérdida */}
          {isLost && lead.motivo_perdida && (
            <section id="lead-sec-motivo" style={card}>
              <div style={{ ...sectLabel, marginBottom: 12 }}>Motivo de pérdida</div>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{lead.motivo_perdida}</div>
            </section>
          )}

          {/* plan de pagos — resumen */}
          {isGanado && (
            <section id="lead-sec-plan-pagos" style={card}>
              <div style={{ ...sectLabel, marginBottom: 14 }}>Plan de pagos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
                <Stat label="Monto de cierre" value={monto ? fmtUSD(monto) : '—'} />
                <Stat label="Cobrado" value={fmtUSD(cobrado)} />
                <Stat label="Pendiente" value={monto - cobrado > 0 ? fmtUSD(monto - cobrado) : cobrado > 0 ? 'Pagado' : '—'} />
              </div>
              <Link href={`/leads/${lead.id}?tab=cobranza`} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', marginTop: 10 }}>Editar plan y marcar cuotas →</Link>
            </section>
          )}

          {/* respuestas del formulario */}
          <RespuestasCard lead={lead} />

          {/* historial */}
          <AuditHistory leadId={lead.id} />
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px clamp(16px,4vw,28px)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={() => setConfirmDelete(true)} disabled={pending} style={{ padding: '8px 6px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Borrar lead</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cerrar</button>
            <Link href={`/leads/${lead.id}?tab=editar`} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textDecoration: 'none' }}>Editar lead →</Link>
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
