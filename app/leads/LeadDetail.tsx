'use client';

// =============================================================================
// LeadDetail — ficha del lead en modal (rediseño CRM)
// =============================================================================

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PlanPagosCard } from './PlanPagosCard';
import { CHIP, BAND_LABEL, stageMeta as findStage, type Stage, type StageBand } from '@/lib/pipeline';
import type { CrmLead, Edits, PendingMove } from './CrmBoard';
import { getLeadAuditAction } from './actions';
import type { LeadAuditRow } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const fmtAuditDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Tijuana' }).format(d);
};
const autorColor = (a: string) => (a === 'Fathom' ? '#0E8E7E' : a === 'Calendly' ? '#2F6DDB' : a === 'CRM' ? '#8A6D3B' : '#6B675C');
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

function chipStyle(tone: Stage['tone'], big = false): CSSProperties {
  const c = CHIP[tone] || CHIP.neutral;
  return { display: 'inline-block', fontSize: big ? 13 : 12, fontWeight: 600, padding: big ? '5px 12px' : '4px 10px', borderRadius: 999, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap' };
}

const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' };
const cardAccion: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 13, padding: '16px 18px', boxShadow: '0 1px 3px rgba(23,21,17,.06)' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const summary: CSSProperties = { cursor: 'pointer', padding: '15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', listStyle: 'none' };
const miniCard: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '14px 16px' };
const dashBtn: CSSProperties = { padding: 9, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: SANS };
const calBtn: CSSProperties = { flex: 1, minWidth: 190, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--accent)', background: 'rgba(200,135,12,.08)', color: '#9A6A09', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const fieldLabel: CSSProperties = { fontSize: 12, color: 'var(--dim)' };

const badge = (color: string, bg: string): CSSProperties => ({ display: 'inline-block', fontSize: 12.5, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: `var(${color})`, background: `var(${bg})` });
const yesNoNode = (v: boolean | null): ReactNode =>
  v === true ? <span style={badge('--good', '--good-bg')}>Sí</span> : v === false ? <span style={badge('--bad', '--bad-bg')}>No</span> : '—';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}
function IconCal() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" strokeLinecap="round" /></svg>;
}

function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  const isEmpty = value === '—' || value == null || value === '';
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 15, color: isEmpty ? 'var(--faint)' : accent ? 'var(--accent)' : 'var(--ink)', fontWeight: isEmpty ? 400 : 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}

export function LeadDetail({
  lead, stages, effStage, pendingMove, moveError, edits, missing,
  onPatch, onPickStage, onClose, onSave, onDelete, onSchedule, focus, zIndex = 50, saveError = false,
}: {
  lead: CrmLead;
  stages: Stage[];
  effStage: string;
  pendingMove: PendingMove | null;
  moveError: boolean;
  edits: Edits;
  missing: string[];
  onPatch: (patch: Partial<Edits>) => void;
  onPickStage: (key: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onSchedule?: (key: string) => void;   // R1/R2: abre el pop-up agendar/marcar
  focus?: string;       // sección a la que saltar
  zIndex?: number;
  saveError?: boolean;
}) {
  // Historial real (audit log) — se trae al abrir la ficha.
  const [audit, setAudit] = useState<LeadAuditRow[]>([]);
  const [auditErr, setAuditErr] = useState(false);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    let alive = true;
    getLeadAuditAction(lead.id)
      .then((r) => { if (alive) { setAudit(r); setAuditErr(false); } })
      .catch(() => { if (alive) setAuditErr(true); });
    return () => { alive = false; };
  }, [lead.id]);

  // a11y de diálogo: ESC para cerrar, foco al panel, focus-trap básico y scroll-lock.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
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
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, []);

  // Al abrir con foco, desplegar y desplazarse a la sección a editar.
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`lead-sec-${focus}`);
      if (!el) return;
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const prev = el.style.boxShadow;
      el.style.transition = 'box-shadow .3s';
      el.style.boxShadow = '0 0 0 2px var(--accent)';
      setTimeout(() => { el.style.boxShadow = prev; }, 1500);
    }, 90);
    return () => clearTimeout(t);
  }, [focus]);

  const s = pendingMove ? pendingMove.to : effStage;
  const headerMeta = findStage(stages, effStage);
  const stageNow = findStage(stages, s);
  const band: StageBand = stageNow?.band ?? 'pipeline';
  const isGanado = s === 'ganado';
  const isLost = s === 'perdido' || s === 'descal';
  const isNutri = band === 'nutricion';
  const isAgendaStage = band === 'pipeline' && (s === 'agenda' || s === 'agendaj2' || s === 'facturando');
  const agendo = !!lead.fechaJ1 || !!lead.j2;
  const reachedMeeting = agendo || isAgendaStage || isGanado;
  const movingToGanado = pendingMove?.to === 'ganado';
  const showFathom = reachedMeeting || lead.fathom.length > 0 || !!lead.closer || lead.asistioJ1 != null;

  // Selector de etapas: grupos dinámicos por banda del funnel actual.
  const groups = (['pipeline', 'nutricion', 'salidas'] as StageBand[])
    .map((b) => ({
      label: BAND_LABEL[b],
      keys: stages.filter((st) => (st.band ?? 'pipeline') === b).sort((a, c) => (a.col ?? 0) - (c.col ?? 0)).map((st) => st.key),
    }))
    .filter((g) => g.keys.length > 0);

  const setFathom = (i: number, field: 'label' | 'url', v: string) =>
    onPatch({ fathom: edits.fathom.map((f, fi) => (fi === i ? { ...f, [field]: v } : f)) });

  const hasPhone = !!lead.phone && lead.phone !== '—';
  const hasEmail = !!lead.email;
  const hasWa = !!lead.telefonoNorm;
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1200); }).catch(() => {});
  };
  const qa = (enabled: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: enabled ? 'var(--ink)' : 'var(--faint)', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: SANS, opacity: enabled ? 1 : 0.55 });
  const copyBtn: CSSProperties = { flex: 'none', padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'clamp(16px,4vw,48px) clamp(10px,3vw,20px)', overflowY: 'auto' }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="lead-title" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden', outline: 'none' }}>

        {/* barra superior de color de la etapa */}
        <div style={{ height: 3, background: stageNow?.dot ?? 'var(--accent)' }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: 'clamp(18px,4vw,24px) clamp(16px,4vw,28px)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
            <div aria-hidden style={{ flex: 'none', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 17, fontWeight: 700, background: (CHIP[headerMeta.tone] || CHIP.neutral).bg, color: (CHIP[headerMeta.tone] || CHIP.neutral).fg, border: '1px solid ' + (CHIP[headerMeta.tone] || CHIP.neutral).bd }}>{initials(lead.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
                <span style={chipStyle(headerMeta.tone, true)}>{headerMeta.label}</span>
              </div>
              <h2 id="lead-title" style={{ fontWeight: 600, fontSize: 'clamp(20px,5vw,27px)', letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', lineHeight: 1.1 }}>{lead.name}</h2>
              <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 3 }}>{lead.company}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)', marginTop: 4 }}>Lead #{lead.id} · creado {lead.created}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX /></button>
        </div>

        {/* acciones rápidas de contacto */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px clamp(16px,4vw,28px) 0' }}>
          {hasPhone ? <a href={`tel:${lead.phone}`} style={qa(true)}>Llamar</a> : <span style={qa(false)}>Llamar</span>}
          {hasEmail ? <a href={`mailto:${lead.email}`} style={qa(true)}>Email</a> : <span style={qa(false)}>Email</span>}
          {hasWa ? <a href={`https://wa.me/${lead.telefonoNorm}`} target="_blank" rel="noopener noreferrer" style={qa(true)}>WhatsApp</a> : <span style={qa(false)}>WhatsApp</span>}
        </div>

        <div style={{ padding: 'clamp(16px,4vw,22px) clamp(16px,4vw,28px)', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* banner: pase de etapa pendiente */}
          {pendingMove && (
            <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 13, padding: '15px 18px' }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--warn)' }}>
                Moviendo a &quot;{findStage(stages, pendingMove.to).label}&quot; — {missing.length ? 'completá lo obligatorio' : 'completá los datos y guardá'}
              </div>
              {missing.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Falta:</span>
                  {missing.map((x) => (
                    <span key={x} style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', padding: '3px 9px', borderRadius: 999 }}>{x}</span>
                  ))}
                </div>
              )}
              {moveError && <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600, marginTop: 8 }}>Faltan datos — completalos y tocá Guardar para mover.</div>}
              <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 7 }}>Si cancelás, el lead vuelve a su etapa anterior.</div>
            </div>
          )}

          {/* etapa / resolución — acción primaria, destacada */}
          <div id="lead-sec-etapa" style={cardAccion}>
            <div style={sectLabel}>Etapa / resolución</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 13 }}>
              {groups.map((g) => (
                <div key={g.label}>
                  <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 7 }}>{g.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {g.keys.map((k) => {
                      const st = findStage(stages, k);
                      if (!st || st.key !== k) return null;
                      const c = CHIP[st.tone] || CHIP.neutral;
                      const active = s === k;
                      return (
                        <button key={k} aria-pressed={active} onClick={() => onPickStage(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: '7px 11px', borderRadius: 9, fontFamily: SANS, background: active ? c.bg : 'var(--surface)', color: active ? c.fg : 'var(--dim)', border: '1px solid ' + (active ? c.bd : 'var(--border)') }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flex: 'none' }} />{st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* contacto + origen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div style={card}>
              <div style={{ ...sectLabel, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Contacto</span>
                <span style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: 0, textTransform: 'none', color: 'var(--faint)' }}>editable · confirma al guardar</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <label style={{ display: 'block' }}><span style={fieldLabel}>Nombre</span><input className="lead-field" value={edits.nombre} onChange={(e) => onPatch({ nombre: e.target.value })} style={{ marginTop: 4 }} /></label>
                <label style={{ display: 'block' }}><span style={fieldLabel}>Empresa</span><input className="lead-field" value={edits.empresa} onChange={(e) => onPatch({ empresa: e.target.value })} placeholder="—" style={{ marginTop: 4 }} /></label>
                <label style={{ display: 'block' }}><span style={fieldLabel}>Email</span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <input className="lead-field" value={edits.email} onChange={(e) => onPatch({ email: e.target.value })} placeholder="—" style={{ wordBreak: 'break-all' }} />
                    {hasEmail && <button type="button" onClick={() => copy(lead.email, 'email')} style={copyBtn}>{copied === 'email' ? '✓' : 'Copiar'}</button>}
                  </div>
                </label>
                <label style={{ display: 'block' }}><span style={fieldLabel}>Teléfono</span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <input className="lead-field" value={edits.telefono} onChange={(e) => onPatch({ telefono: e.target.value })} placeholder="—" style={{ fontVariantNumeric: 'tabular-nums' }} />
                    {hasPhone && <button type="button" onClick={() => copy(lead.phone, 'tel')} style={copyBtn}>{copied === 'tel' ? '✓' : 'Copiar'}</button>}
                  </div>
                </label>
              </div>
            </div>
            <div style={card}>
              <div style={{ ...sectLabel, marginBottom: 12 }}>Origen del lead</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><div style={fieldLabel}>Canal</div><div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>{lead.originChannel}</div></div>
                <div><div style={fieldLabel}>Campaña / anuncio</div><div style={{ fontSize: 14, color: lead.origin ? 'var(--ink)' : 'var(--faint)' }}>{lead.origin || '—'}</div></div>
              </div>
            </div>
          </div>

          {/* datos comerciales */}
          {reachedMeeting && (
            <details id="lead-sec-datos-comerciales" open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Datos comerciales<span className="chev" style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
                <Stat label="Fecha Reunión 1" value={lead.agenda ?? '—'} />
                <Stat label="¿Asistió a R1?" value={yesNoNode(lead.asistioJ1)} />
                <Stat label="¿Era calificado?" value={yesNoNode(lead.calificado)} />
                <Stat label="Fecha Reunión 2" value={lead.j2 ?? '—'} />
                <Stat label="¿Asistió a R2?" value={yesNoNode(lead.asistioJ2)} />
                <Stat label="Confirmación de pago" value={lead.confirmacion ?? '—'} />
                {onSchedule && (
                  <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => onSchedule('agenda')} style={calBtn}><IconCal /> Agendar / marcar R1</button>
                    <button onClick={() => onSchedule('agendaj2')} style={calBtn}><IconCal /> Agendar / marcar R2</button>
                  </div>
                )}
                <div style={{ gridColumn: '1/-1', ...miniCard }}>
                  <label><span style={fieldLabel}>Closer asignado</span><input className="lead-field" value={edits.closer} onChange={(e) => onPatch({ closer: e.target.value })} placeholder="Nombre del closer…" style={{ marginTop: 6 }} /></label>
                </div>
              </div>
            </details>
          )}

          {/* respuestas del calendly */}
          {lead.calendly.length > 0 && (
            <details style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Respuestas del Calendly<span className="chev" style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lead.calendly.map((c, i) => (
                  <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 600 }}>{c.q}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 3 }}>{c.a}</div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* comportamiento */}
          <details style={{ ...card, padding: '0 18px' }}>
            <summary style={summary}>Comportamiento<span className="chev" style={{ fontSize: 11 }}>▾</span></summary>
            <div style={{ padding: '0 0 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
              <div style={miniCard}>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>Visitó la landing</div>
                <div style={{ fontSize: 22, color: lead.landingVisitas ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.landingVisitas}<span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}> {lead.landingVisitas === 1 ? 'vez' : 'veces'}</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{lead.landingDias} {lead.landingDias === 1 ? 'día distinto' : 'días distintos'}</div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>VSL reproducido</div>
                <div style={{ fontSize: 22, color: lead.vslPlays ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.vslPlays || '—'}<span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}>{lead.vslPlays ? (lead.vslPlays === 1 ? ' vez' : ' veces') : ''}</span></div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>Retención del VSL</div>
                <div style={{ fontSize: 22, color: lead.vslMaxPct == null ? 'var(--faint)' : lead.vslMaxPct >= 60 ? 'var(--good)' : lead.vslMaxPct >= 30 ? 'var(--accent)' : 'var(--bad)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.vslMaxPct != null ? lead.vslMaxPct + '%' : '—'}</div>
                {lead.vslMaxPct != null && (
                  <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', marginTop: 7, overflow: 'hidden' }}>
                    <div style={{ width: Math.min(100, lead.vslMaxPct) + '%', height: '100%', background: lead.vslMaxPct >= 60 ? 'var(--good)' : lead.vslMaxPct >= 30 ? 'var(--accent)' : 'var(--bad)' }} />
                  </div>
                )}
              </div>
            </div>
          </details>

          {/* link de fathom */}
          {showFathom && (
            <details id="lead-sec-fathom" open={isAgendaStage || undefined} style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Link de Fathom<span className="chev" style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {edits.fathom.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input aria-label="Etiqueta del link de Fathom" className="lead-field" value={f.label} onChange={(e) => setFathom(i, 'label', e.target.value)} placeholder="Llamada" style={{ flex: 'none', width: 120 }} />
                    <input aria-label="URL del link de Fathom" className="lead-field" value={f.url} onChange={(e) => setFathom(i, 'url', e.target.value)} placeholder="https://fathom.video/…" style={{ flex: 1, minWidth: 180 }} />
                  </div>
                ))}
                <button onClick={() => onPatch({ fathom: [...edits.fathom, { label: '', url: '' }] })} style={dashBtn}>+ Agregar otro link</button>
                <Link href="/closing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', padding: '11px 13px', borderRadius: 9, border: '1px solid var(--accent)', background: 'rgba(200,135,12,.08)' }}>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#9A6A09' }}>Ver análisis de closing</span>
                    <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Review del desempeño del closer (SPIN, objeciones, CTA)</span>
                  </span>
                  <span style={{ fontSize: 15, color: 'var(--accent)' }}>→</span>
                </Link>
              </div>
            </details>
          )}

          {/* nutrición */}
          {isNutri && (
            <details id="lead-sec-nutricion" open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Nutrición<span className="chev" style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={miniCard}>
                  <label><span style={fieldLabel}>Setter asignado</span><input className="lead-field" value={edits.setter} onChange={(e) => onPatch({ setter: e.target.value })} placeholder="Nombre del setter…" style={{ marginTop: 6 }} /></label>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic', padding: '2px 2px' }}>El detalle de los toques de nutrición por lead todavía no se registra acá. Por ahora se controla desde las automatizaciones del funnel.</div>
              </div>
            </details>
          )}

          {/* motivo */}
          {isLost && (
            <details id="lead-sec-motivo" open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Motivo · narrar detalles<span className="chev" style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px' }}>
                <textarea aria-label="Motivo de pérdida o descalificación" className="lead-field" value={edits.motivo} onChange={(e) => onPatch({ motivo: e.target.value })} placeholder="¿Por qué se perdió o descalificó? Contá el contexto…" style={{ minHeight: 88, lineHeight: 1.5 }} />
              </div>
            </details>
          )}

          {/* plan de pagos */}
          {isGanado && (
            <div id="lead-sec-plan-pagos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {movingToGanado && (
                <div style={card}>
                  <div style={{ ...sectLabel, marginBottom: 10 }}>Monto de cierre (USD)</div>
                  <input aria-label="Monto de cierre en USD" className="lead-field" value={edits.plan.total} onChange={(e) => onPatch({ plan: { ...edits.plan, total: e.target.value } })} placeholder="0" inputMode="numeric" />
                </div>
              )}
              <PlanPagosCard leadId={lead.id} />
            </div>
          )}

          {/* línea de tiempo del recorrido */}
          {(isGanado || s === 'facturando') && (
            <details style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Línea de tiempo del recorrido<span className="chev" style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '4px 0 18px', display: 'flex', flexDirection: 'column' }}>
                {([
                  { label: 'Instant Form (Meta)', date: lead.created, done: !!lead.created && lead.created !== '—' },
                  { label: 'Reunión 1', date: lead.agenda || '—', done: !!lead.agenda },
                  { label: 'Reunión 2', date: lead.j2 || '—', done: !!lead.j2 },
                  { label: 'Cierre ganado', date: lead.cierre ?? '—', done: !!lead.cierre || isGanado },
                ]).map((t, i, arr) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                      <span style={{ width: 13, height: 13, borderRadius: '50%', background: t.done ? 'var(--good)' : 'var(--surface)', border: t.done ? '3px solid var(--good-bg)' : '2px solid var(--border-strong)' }} />
                      {i < arr.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 22, background: t.done ? 'var(--good-bg)' : 'var(--border)' }} />}
                    </div>
                    <div style={{ paddingBottom: 16 }}>
                      <div style={{ fontSize: 14.5, color: t.done ? 'var(--ink)' : 'var(--faint)', fontWeight: 600 }}>{t.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{t.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* historial de cambios (audit log real) */}
          <details style={{ ...card, padding: '0 18px' }}>
            <summary style={summary}>Historial de cambios<span className="chev" style={{ fontSize: 11 }}>▾</span></summary>
            <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {audit.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', width: 112 }}>{fmtAuditDate(a.created_at)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)' }}>
                    <b style={{ fontWeight: 600 }}>{a.campo}</b>: {a.valor_anterior ?? '—'} → {a.valor_nuevo ?? '—'}
                  </span>
                  <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: autorColor(a.autor), background: autorColor(a.autor) + '1A', borderRadius: 999, padding: '2px 8px' }}>{a.autor}</span>
                </div>
              ))}
              {audit.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', padding: '4px 0' }}>
                  {auditErr ? 'No se pudo cargar el historial. Reintentá reabriendo la ficha.' : 'Sin cambios registrados todavía. Cada movimiento de etapa, edición o evento de Fathom va a aparecer acá.'}
                </div>
              )}
            </div>
          </details>
        </div>

        {/* footer */}
        {saveError && (
          <div style={{ padding: '10px clamp(16px,4vw,28px)', background: 'var(--bad-bg)', borderTop: '1px solid var(--bad)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>
            No se pudo guardar. Revisá la conexión y reintentá — tus cambios siguen acá.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px clamp(16px,4vw,28px)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={onDelete} style={{ padding: '8px 6px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Borrar lead</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
            <button onClick={onSave} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Guardar cambios</button>
          </div>
        </div>
      </div>
    </div>
  );
}
