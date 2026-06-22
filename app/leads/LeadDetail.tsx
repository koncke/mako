'use client';

// =============================================================================
// LeadDetail — ficha del lead en modal (rediseño CRM)
// =============================================================================

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { PlanPagosCard } from './PlanPagosCard';
import { CHIP, BAND_LABEL, stageMeta as findStage, type Stage, type StageBand } from '@/lib/pipeline';
import type { CrmLead, Edits, PendingMove } from './CrmBoard';
import { getLeadAuditAction } from './actions';
import type { LeadAuditRow } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const fmt = (n: number) => '$' + n.toLocaleString('en-US');
const fmtAuditDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Tijuana' }).format(d);
};
const autorColor = (a: string) => (a === 'Fathom' ? '#0E8E7E' : a === 'Calendly' ? '#2F6DDB' : a === 'CRM' ? '#8A6D3B' : '#6B675C');

function chipStyle(tone: Stage['tone']): CSSProperties {
  const c = CHIP[tone] || CHIP.neutral;
  return { display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap' };
}

const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const summary: CSSProperties = { cursor: 'pointer', padding: '15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', listStyle: 'none' };
const fieldInput: CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const rowInput: CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
const miniCard: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' };
const dashBtn: CSSProperties = { padding: 9, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: SANS };
const calBtn: CSSProperties = { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--accent)', background: 'rgba(200,135,12,.08)', color: '#9A6A09', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{label}</div>
      <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600, marginTop: 3 }}>{value}</div>
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
  onSchedule?: (key: string) => void;   // abrir Calendly para R1/R2
  focus?: string;       // sección a la que saltar: datos-comerciales | plan-pagos | motivo | etapa | fathom | nutricion
  zIndex?: number;      // por defecto 50; se sube cuando abre sobre otro modal (desglose)
  saveError?: boolean;  // true si la última acción de guardar/borrar falló
}) {
  // Historial real (audit log) — se trae al abrir la ficha.
  const [audit, setAudit] = useState<LeadAuditRow[]>([]);
  useEffect(() => {
    let alive = true;
    getLeadAuditAction(lead.id).then((r) => { if (alive) setAudit(r); }).catch(() => {});
    return () => { alive = false; };
  }, [lead.id]);

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
      const t2 = setTimeout(() => { el.style.boxShadow = prev; }, 1500);
      return () => clearTimeout(t2);
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
  const agendo = !!lead.fechaJ1 || !!lead.j2;  // ¿agendó alguna reunión alguna vez?

  // Selector de etapas: grupos dinámicos por banda del funnel actual (no hardcodeado).
  const groups = (['pipeline', 'nutricion', 'salidas'] as StageBand[])
    .map((b) => ({
      label: BAND_LABEL[b],
      keys: stages.filter((st) => (st.band ?? 'pipeline') === b).sort((a, c) => (a.col ?? 0) - (c.col ?? 0)).map((st) => st.key),
    }))
    .filter((g) => g.keys.length > 0);

  const setFathom = (i: number, field: 'label' | 'url', v: string) =>
    onPatch({ fathom: edits.fathom.map((f, fi) => (fi === i ? { ...f, [field]: v } : f)) });
  const setNutri = (i: number, field: 'name' | 'dt', v: string) =>
    onPatch({ nutriciones: edits.nutriciones.map((n, ni) => (ni === i ? { ...n, [field]: v } : n)) });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 7 }}>
              <span style={chipStyle(headerMeta.tone)}>{headerMeta.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)' }}>Lead #{lead.id} · creado {lead.created}</span>
            </div>
            <h2 style={{ fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', lineHeight: 1.1 }}>{lead.name}</h2>
            <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 3 }}>{lead.company}</div>
          </div>
          <button onClick={onClose} style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 17, cursor: 'pointer', fontFamily: SANS }}>✕</button>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

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

          {/* contacto + origen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={card}>
              <div style={{ ...sectLabel, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>Contacto</span>
                <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: 0, textTransform: 'none', color: 'var(--faint)' }}>editable · confirma al guardar</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <label style={{ display: 'block' }}><span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Nombre</span><input value={edits.nombre} onChange={(e) => onPatch({ nombre: e.target.value })} style={{ ...fieldInput, marginTop: 4 }} /></label>
                <label style={{ display: 'block' }}><span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Empresa</span><input value={edits.empresa} onChange={(e) => onPatch({ empresa: e.target.value })} placeholder="—" style={{ ...fieldInput, marginTop: 4 }} /></label>
                <label style={{ display: 'block' }}><span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Email</span><input value={edits.email} onChange={(e) => onPatch({ email: e.target.value })} placeholder="—" style={{ ...fieldInput, marginTop: 4, wordBreak: 'break-all' }} /></label>
                <label style={{ display: 'block' }}><span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Teléfono</span><input value={edits.telefono} onChange={(e) => onPatch({ telefono: e.target.value })} placeholder="—" style={{ ...fieldInput, marginTop: 4, fontVariantNumeric: 'tabular-nums' }} /></label>
              </div>
            </div>
            <div style={card}>
              <div style={{ ...sectLabel, marginBottom: 12 }}>Origen del lead</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Canal</div><div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>{lead.originChannel}</div></div>
                <div><div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Campaña / anuncio</div><div style={{ fontSize: 14, color: 'var(--ink)' }}>{lead.origin}</div></div>
              </div>
            </div>
          </div>

          {/* etapa / resolución */}
          <div id="lead-sec-etapa" style={card}>
            <div style={sectLabel}>Etapa / resolución</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 13 }}>
              {groups.map((g) => (
                <div key={g.label}>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 7 }}>{g.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {g.keys.map((k) => {
                      const st = findStage(stages, k);
                      if (!st || st.key !== k) return null;
                      const c = CHIP[st.tone] || CHIP.neutral;
                      const active = s === k;
                      return (
                        <button key={k} onClick={() => onPickStage(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: '7px 11px', borderRadius: 9, fontFamily: SANS, background: active ? c.bg : 'var(--surface)', color: active ? c.fg : 'var(--dim)', border: '1px solid ' + (active ? c.bd : 'var(--border)') }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flex: 'none' }} />{st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* datos comerciales */}
          {agendo && (
            <details id="lead-sec-datos-comerciales" open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Datos comerciales<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <Stat label="Fecha Reunión 1" value={lead.agenda ?? '—'} />
                <Stat label="¿Asistió a R1?" value={lead.asistioJ1 === true ? 'Sí' : lead.asistioJ1 === false ? 'No' : '—'} />
                <Stat label="¿Era calificado?" value={lead.calificado === true ? 'Sí' : lead.calificado === false ? 'No' : '—'} />
                <Stat label="Fecha Reunión 2" value={lead.j2 ?? '—'} />
                <Stat label="¿Asistió a R2?" value={lead.asistioJ2 === true ? 'Sí' : lead.asistioJ2 === false ? 'No' : '—'} />
                <Stat label="¿Confirmó pago?" value={lead.confirmacion ? 'Sí · ' + lead.confirmacion : '—'} />
                {onSchedule && (
                  <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => onSchedule('agenda')} style={calBtn}>📅 Agendar / reagendar R1</button>
                    <button onClick={() => onSchedule('agendaj2')} style={calBtn}>📅 Agendar / reagendar R2</button>
                  </div>
                )}
                <div style={{ gridColumn: '1/-1', ...miniCard }}>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 6 }}>Closer asignado</div>
                  <input value={edits.closer} onChange={(e) => onPatch({ closer: e.target.value })} placeholder="Nombre del closer…" style={fieldInput} />
                </div>
              </div>
            </details>
          )}

          {/* respuestas del calendly */}
          {agendo && (
            <details style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Respuestas del Calendly<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lead.calendly.map((c, i) => (
                  <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{c.q}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 3 }}>{c.a}</div>
                  </div>
                ))}
                {lead.calendly.length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic' }}>Sin respuestas a las preguntas de calificación.</div>}
              </div>
            </details>
          )}

          {/* comportamiento */}
          <details style={{ ...card, padding: '0 18px' }}>
            <summary style={summary}>Comportamiento<span style={{ fontSize: 11 }}>▾</span></summary>
            <div style={{ padding: '0 0 18px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <div style={miniCard}>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Visitó la landing</div>
                <div style={{ fontSize: 22, color: 'var(--ink)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.landingVisitas}<span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}> {lead.landingVisitas === 1 ? 'vez' : 'veces'}</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{lead.landingDias} {lead.landingDias === 1 ? 'día distinto' : 'días distintos'}</div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>VSL reproducido</div>
                <div style={{ fontSize: 22, color: 'var(--ink)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.vslPlays || '—'}<span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}>{lead.vslPlays ? (lead.vslPlays === 1 ? ' vez' : ' veces') : ''}</span></div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Retención del VSL</div>
                <div style={{ fontSize: 22, color: 'var(--accent)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{lead.vslMaxPct != null ? lead.vslMaxPct + '%' : '—'}</div>
              </div>
            </div>
          </details>

          {/* link de fathom */}
          {agendo && (
            <details id="lead-sec-fathom" open={isAgendaStage || undefined} style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Link de Fathom<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {edits.fathom.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input value={f.label} onChange={(e) => setFathom(i, 'label', e.target.value)} placeholder="Llamada" style={{ ...rowInput, flex: 'none', width: 120 }} />
                    <input value={f.url} onChange={(e) => setFathom(i, 'url', e.target.value)} placeholder="https://fathom.video/…" style={{ ...rowInput, flex: 1 }} />
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
              <summary style={summary}>Nutrición<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {isNutri && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 6 }}>Setter asignado</div>
                    <input value={edits.setter} onChange={(e) => onPatch({ setter: e.target.value })} placeholder="Nombre del setter…" style={fieldInput} />
                  </div>
                )}
                {edits.nutriciones.map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input value={n.name} onChange={(e) => setNutri(i, 'name', e.target.value)} placeholder="Nombre de la nutrición" style={{ ...rowInput, flex: 1 }} />
                    <input value={n.dt} onChange={(e) => setNutri(i, 'dt', e.target.value)} placeholder="dd/mm — hh:mm" style={{ ...rowInput, flex: 'none', width: 150 }} />
                  </div>
                ))}
                <button onClick={() => onPatch({ nutriciones: [...edits.nutriciones, { name: '', dt: '' }] })} style={dashBtn}>+ Agregar nueva nutrición</button>
              </div>
            </details>
          )}

          {/* motivo */}
          {isLost && (
            <details id="lead-sec-motivo" open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Motivo · narrar detalles<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px' }}>
                <textarea value={edits.motivo} onChange={(e) => onPatch({ motivo: e.target.value })} placeholder="¿Por qué se perdió o descalificó? Contá el contexto…" style={{ width: '100%', minHeight: 88, resize: 'vertical', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.5, outline: 'none' }} />
              </div>
            </details>
          )}

          {/* plan de pagos */}
          {isGanado && (
            <div id="lead-sec-plan-pagos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={card}>
                <div style={{ ...sectLabel, marginBottom: 10 }}>Monto de cierre (USD)</div>
                <input value={edits.plan.total} onChange={(e) => onPatch({ plan: { ...edits.plan, total: e.target.value } })} placeholder="0" inputMode="numeric" style={fieldInput} />
              </div>
              <PlanPagosCard leadId={lead.id} />
            </div>
          )}

          {/* línea de tiempo SCL */}
          {(isGanado || s === 'facturando') && (
            <details style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Línea de tiempo · SCL<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '4px 0 18px', display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: 'Instant Form (Meta)', date: lead.created },
                  { label: 'Reunión 1', date: lead.agenda || '—' },
                  { label: 'Reunión 2', date: lead.j2 || '—' },
                  { label: 'Cierre ganado', date: lead.cierre ?? (isGanado ? fmt(lead.monto) : '—') },
                ].map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                      <span style={{ width: 13, height: 13, borderRadius: '50%', background: 'var(--good)', border: '3px solid var(--good-bg)' }} />
                      <span style={{ width: 2, flex: 1, minHeight: 22, background: 'var(--border)' }} />
                    </div>
                    <div style={{ paddingBottom: 16 }}>
                      <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600 }}>{t.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{t.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* historial de cambios (audit log real) */}
          <details style={{ ...card, padding: '0 18px' }}>
            <summary style={summary}>Historial de cambios<span style={{ fontSize: 11 }}>▾</span></summary>
            <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {audit.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', width: 100 }}>{fmtAuditDate(a.created_at)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)' }}>
                    <b style={{ fontWeight: 600 }}>{a.campo}</b>: {a.valor_anterior ?? '—'} → {a.valor_nuevo ?? '—'}
                  </span>
                  <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: autorColor(a.autor), background: autorColor(a.autor) + '1A', borderRadius: 999, padding: '2px 8px' }}>{a.autor}</span>
                </div>
              ))}
              {audit.length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', padding: '4px 0' }}>Sin cambios registrados todavía. Cada movimiento de etapa, edición o evento de Fathom va a aparecer acá.</div>}
            </div>
          </details>
        </div>

        {/* footer */}
        {saveError && (
          <div style={{ padding: '10px 28px', background: 'var(--bad-bg)', borderTop: '1px solid var(--bad)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>
            No se pudo guardar. Revisá la conexión y reintentá — tus cambios siguen acá.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '18px 28px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={onDelete} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--bad)', background: 'transparent', color: 'var(--bad)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Borrar lead</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
            <button onClick={onSave} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Guardar cambios</button>
          </div>
        </div>
      </div>
    </div>
  );
}
