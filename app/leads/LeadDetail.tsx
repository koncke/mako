'use client';

// =============================================================================
// LeadDetail — ficha del lead en modal (vista de solo-lectura + recorrido)
// =============================================================================
// El modal MUESTRA el lead (no se edita acá): info + línea de tiempo del
// recorrido + historial, con un botón "Editar" que lleva a /leads/[id].
// Excepción: cuando el Kanban/worklist mueve un lead a una etapa que pide datos
// (pendingMove), aparece una tarjeta compacta para completar y guardar ese paso.

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CHIP, stageMeta as findStage, type Stage } from '@/lib/pipeline';
import { buildJourney } from '@/lib/journey';
import { JourneyTimeline } from './JourneyTimeline';
import type { CrmLead, Edits, PendingMove } from './CrmBoard';
import { getLeadAuditAction } from './actions';
import type { LeadAuditRow } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US');
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

const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '17px 19px' };
const heroCard: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(23,21,17,.05)' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '13px 15px' };
const fieldLabel: CSSProperties = { fontSize: 11.5, color: 'var(--dim)' };
const dashBtn: CSSProperties = { padding: 9, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: SANS };

const badge = (color: string, bg: string): CSSProperties => ({ display: 'inline-block', fontSize: 12.5, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: `var(${color})`, background: `var(${bg})` });
const yesNoNode = (v: boolean | null): ReactNode =>
  v === true ? <span style={badge('--good', '--good-bg')}>Sí</span> : v === false ? <span style={badge('--bad', '--bad-bg')}>No</span> : '—';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  const isEmpty = value === '—' || value == null || value === '';
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 15, color: isEmpty ? 'var(--faint)' : accent ? 'var(--accent)' : 'var(--ink)', fontWeight: isEmpty ? 400 : 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function ReadRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const empty = !value || value === '—';
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={{ fontSize: 14, color: empty ? 'var(--faint)' : accent ? 'var(--accent)' : 'var(--ink)', fontWeight: accent ? 600 : 500, marginTop: 2, wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <details id={id} open style={{ ...card, padding: '0 19px' }}>
      <summary style={{ cursor: 'pointer', padding: '15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...sectLabel, listStyle: 'none' }}>
        {title}<span className="chev" style={{ fontSize: 11 }}>▾</span>
      </summary>
      <div style={{ padding: '0 0 18px' }}>{children}</div>
    </details>
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
  onSchedule?: (key: string) => void;
  focus?: string;
  zIndex?: number;
  saveError?: boolean;
}) {
  void onPickStage; void onSchedule;   // edición de etapa vive en el Kanban / ruta

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

  // a11y de diálogo: ESC, foco al panel, focus-trap básico, scroll-lock.
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

  // Al completar un movimiento, desplazarse a la tarjeta de completar.
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`lead-sec-${focus}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);
    return () => clearTimeout(t);
  }, [focus]);

  const headerMeta = findStage(stages, effStage);
  const completing = !!pendingMove;
  const to = pendingMove?.to;
  const isGanado = effStage === 'ganado';
  const isLost = effStage === 'perdido' || effStage === 'descal';
  const agendo = !!lead.fechaJ1 || !!lead.j2 || lead.asistioJ1 != null;
  const showFathom = agendo || lead.fathom.length > 0 || !!lead.closer;

  const journey = buildJourney({
    createdISO: lead.createdISO,
    fechaAgenda: lead.agendaISO,
    fechaJ1: lead.fechaJ1,
    asistioJ1: lead.asistioJ1,
    fechaJ2: lead.fechaJ2,
    asistioJ2: lead.asistioJ2,
    fechaConfirmacion: lead.confirmacionISO,
    fechaPrimerPago: lead.primerPagoISO,
    fechaCierre: lead.cierreISO,
    estadoLead: lead.estadoLead,
    monto: lead.monto,
  });

  const setFathom = (i: number, field: 'label' | 'url', v: string) =>
    onPatch({ fathom: edits.fathom.map((f, fi) => (fi === i ? { ...f, [field]: v } : f)) });

  const hasPhone = !!lead.phone && lead.phone !== '—';
  const hasEmail = !!lead.email;
  const hasWa = !!lead.telefonoNorm;
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1200); }).catch(() => {});
  };
  const qa = (enabled: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: enabled ? 'var(--ink)' : 'var(--faint)', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: SANS, opacity: enabled ? 1 : 0.55 });
  const copyBtn: CSSProperties = { flex: 'none', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
  const compInput: CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };

  // Campos que pide el movimiento pendiente.
  const needFechaJ1 = to === 'agenda';
  const needFechaJ2 = to === 'agendaj2' || to === 'facturando';
  const needFathom = to === 'agenda' || to === 'agendaj2' || to === 'facturando';
  const needMonto = to === 'ganado';
  const needMotivo = to === 'perdido' || to === 'descal';
  const needSetter = to === 'manual';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px,4vw,48px) clamp(10px,3vw,20px)' }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="lead-title" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: 'calc(100dvh - clamp(32px,8vw,96px))', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden', outline: 'none' }}>

        <div style={{ height: 3, background: headerMeta?.dot ?? 'var(--accent)' }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: 'clamp(18px,4vw,24px) clamp(16px,4vw,28px)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
            <div aria-hidden style={{ flex: 'none', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 17, fontWeight: 700, background: (CHIP[headerMeta.tone] || CHIP.neutral).bg, color: (CHIP[headerMeta.tone] || CHIP.neutral).fg, border: '1px solid ' + (CHIP[headerMeta.tone] || CHIP.neutral).bd }}>{initials(lead.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: 5 }}><span style={chipStyle(headerMeta.tone, true)}>{headerMeta.label}</span></div>
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

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'clamp(16px,4vw,22px) clamp(16px,4vw,28px)', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* tarjeta de completar movimiento (solo cuando el Kanban mueve a una etapa con datos) */}
          {completing && (
            <div id={focus ? `lead-sec-${focus}` : undefined} style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--warn)' }}>
                Moviendo a &quot;{findStage(stages, to!).label}&quot; — {missing.length ? 'completá lo obligatorio' : 'confirmá el cambio'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                {needFechaJ1 && (
                  <label><span style={fieldLabel}>Fecha de la Reunión 1</span><input type="date" value={edits.fechaJ1} onChange={(e) => onPatch({ fechaJ1: e.target.value })} style={{ ...compInput, marginTop: 5 }} /></label>
                )}
                {needFechaJ2 && (
                  <label><span style={fieldLabel}>Fecha de la Reunión 2</span><input type="date" value={edits.fechaJ2} onChange={(e) => onPatch({ fechaJ2: e.target.value })} style={{ ...compInput, marginTop: 5 }} /></label>
                )}
                {needMonto && (
                  <label><span style={fieldLabel}>Monto de cierre (USD)</span><input inputMode="numeric" value={edits.plan.total} onChange={(e) => onPatch({ plan: { ...edits.plan, total: e.target.value } })} placeholder="0" style={{ ...compInput, marginTop: 5 }} /></label>
                )}
                {needMotivo && (
                  <label><span style={fieldLabel}>Motivo</span><textarea value={edits.motivo} onChange={(e) => onPatch({ motivo: e.target.value })} placeholder="¿Por qué se perdió o descalificó?" style={{ ...compInput, marginTop: 5, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }} /></label>
                )}
                {needSetter && (
                  <label><span style={fieldLabel}>Setter asignado</span><input value={edits.setter} onChange={(e) => onPatch({ setter: e.target.value })} placeholder="Nombre del setter…" style={{ ...compInput, marginTop: 5 }} /></label>
                )}
                {needFathom && (
                  <div>
                    <span style={fieldLabel}>Link(s) de Fathom</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 5 }}>
                      {edits.fathom.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input aria-label="Etiqueta" value={f.label} onChange={(e) => setFathom(i, 'label', e.target.value)} placeholder="Llamada" style={{ ...compInput, flex: 'none', width: 110 }} />
                          <input aria-label="URL de Fathom" value={f.url} onChange={(e) => setFathom(i, 'url', e.target.value)} placeholder="https://fathom.video/…" style={{ ...compInput, flex: 1, minWidth: 170 }} />
                        </div>
                      ))}
                      <button onClick={() => onPatch({ fathom: [...edits.fathom, { label: '', url: '' }] })} style={dashBtn}>+ Agregar otro link</button>
                    </div>
                  </div>
                )}
              </div>
              {missing.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Falta:</span>
                  {missing.map((x) => (<span key={x} style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', padding: '3px 9px', borderRadius: 999 }}>{x}</span>))}
                </div>
              )}
              {moveError && <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600, marginTop: 8 }}>Faltan datos — completalos y tocá Guardar para mover.</div>}
              <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>Si cancelás, el lead vuelve a su etapa anterior.</div>
            </div>
          )}

          {/* recorrido — hero */}
          <div style={heroCard}>
            <div style={{ ...sectLabel, marginBottom: 16 }}>Recorrido del lead</div>
            <JourneyTimeline steps={journey} />
          </div>

          {/* contacto + origen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
            <div style={card}>
              <div style={{ ...sectLabel, marginBottom: 13 }}>Contacto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <ReadRow label="Email" value={lead.email} />
                <ReadRow label="Teléfono" value={lead.phone} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {hasEmail && <button onClick={() => copy(lead.email, 'email')} style={copyBtn}>{copied === 'email' ? '✓ Email' : 'Copiar email'}</button>}
                  {hasPhone && <button onClick={() => copy(lead.phone, 'tel')} style={copyBtn}>{copied === 'tel' ? '✓ Tel' : 'Copiar tel'}</button>}
                </div>
              </div>
            </div>
            <div style={card}>
              <div style={{ ...sectLabel, marginBottom: 13 }}>Origen del lead</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <ReadRow label="Canal" value={lead.originChannel} accent />
                <ReadRow label="Campaña / anuncio" value={lead.origin} />
              </div>
            </div>
          </div>

          {/* datos comerciales */}
          {agendo && (
            <Section title="Datos comerciales">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px,1fr))', gap: 12 }}>
                <Stat label="Fecha Reunión 1" value={lead.agenda ?? '—'} />
                <Stat label="¿Asistió a R1?" value={yesNoNode(lead.asistioJ1)} />
                <Stat label="¿Era calificado?" value={yesNoNode(lead.calificado)} />
                <Stat label="Fecha Reunión 2" value={lead.j2 ?? '—'} />
                <Stat label="¿Asistió a R2?" value={yesNoNode(lead.asistioJ2)} />
                <Stat label="Confirmación de pago" value={lead.confirmacion ?? '—'} />
                <Stat label="Closer" value={lead.closer || '—'} />
                <Stat label="Setter" value={lead.setter || '—'} />
              </div>
            </Section>
          )}

          {/* respuestas del calendly */}
          {lead.calendly.length > 0 && (
            <Section title="Respuestas del Calendly">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lead.calendly.map((c, i) => (
                  <div key={i} style={{ borderTop: i ? '1px solid var(--border)' : 'none', paddingTop: i ? 12 : 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 600 }}>{c.q}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 3 }}>{c.a}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* comportamiento */}
          <Section title="Comportamiento">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px,1fr))', gap: 12 }}>
              <div style={miniCard}>
                <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Visitó la landing</div>
                <div style={{ fontSize: 22, color: lead.landingVisitas ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.landingVisitas}<span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}> {lead.landingVisitas === 1 ? 'vez' : 'veces'}</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{lead.landingDias} {lead.landingDias === 1 ? 'día distinto' : 'días distintos'}</div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>VSL reproducido</div>
                <div style={{ fontSize: 22, color: lead.vslPlays ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.vslPlays || '—'}<span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}>{lead.vslPlays ? (lead.vslPlays === 1 ? ' vez' : ' veces') : ''}</span></div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Retención del VSL</div>
                <div style={{ fontSize: 22, color: lead.vslMaxPct == null ? 'var(--faint)' : lead.vslMaxPct >= 60 ? 'var(--good)' : lead.vslMaxPct >= 30 ? 'var(--accent)' : 'var(--bad)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.vslMaxPct != null ? lead.vslMaxPct + '%' : '—'}</div>
                {lead.vslMaxPct != null && (
                  <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', marginTop: 7, overflow: 'hidden' }}>
                    <div style={{ width: Math.min(100, lead.vslMaxPct) + '%', height: '100%', background: lead.vslMaxPct >= 60 ? 'var(--good)' : lead.vslMaxPct >= 30 ? 'var(--accent)' : 'var(--bad)' }} />
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* fathom */}
          {showFathom && (
            <Section title="Links de Fathom">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {lead.fathom.filter((f) => f.url).map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{f.label || 'Llamada'}</span>
                    <span style={{ fontSize: 13, color: 'var(--accent)' }}>Abrir →</span>
                  </a>
                ))}
                {lead.fathom.filter((f) => f.url).length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic' }}>Sin links de Fathom cargados.</div>}
                <Link href="/closing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--accent)', background: 'rgba(200,135,12,.08)' }}>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#9A6A09' }}>Ver análisis de closing</span>
                    <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Review del desempeño del closer (SPIN, objeciones, CTA)</span>
                  </span>
                  <span style={{ fontSize: 15, color: 'var(--accent)' }}>→</span>
                </Link>
              </div>
            </Section>
          )}

          {/* motivo (perdido/descal) */}
          {isLost && lead.motivo && (
            <Section title="Motivo de pérdida">
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{lead.motivo}</div>
            </Section>
          )}

          {/* plan de pagos — resumen (editable en la ficha completa) */}
          {isGanado && (
            <Section title="Plan de pagos">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px,1fr))', gap: 12 }}>
                <Stat label="Monto de cierre" value={lead.monto ? fmtUSD(lead.monto) : '—'} accent />
                <Stat label="Cobrado" value={lead.totalCobrado ? fmtUSD(lead.totalCobrado) : '—'} />
                <Stat label="Pendiente" value={lead.monto - lead.totalCobrado > 0 ? fmtUSD(lead.monto - lead.totalCobrado) : '—'} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 10 }}>Editá el plan y marcá cuotas cobradas desde la ficha completa (Editar).</div>
            </Section>
          )}

          {/* historial de cambios */}
          <Section title="Historial de cambios">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          </Section>
        </div>

        {/* footer */}
        {saveError && (
          <div style={{ padding: '10px clamp(16px,4vw,28px)', background: 'var(--bad-bg)', borderTop: '1px solid var(--bad)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>
            No se pudo guardar. Revisá la conexión y reintentá — tus cambios siguen acá.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px clamp(16px,4vw,28px)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          {completing ? (
            <>
              <span />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
                <button onClick={onSave} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Guardar cambios</button>
              </div>
            </>
          ) : (
            <>
              <button onClick={onDelete} style={{ padding: '8px 6px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Borrar lead</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cerrar</button>
                <Link href={`/leads/${lead.id}`} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textDecoration: 'none' }}>Editar lead →</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
