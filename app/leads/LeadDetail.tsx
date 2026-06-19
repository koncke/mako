'use client';

// =============================================================================
// LeadDetail — ficha del lead en modal (rediseño CRM)
// =============================================================================

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CHIP, NUTRI_KEYS, stageMeta as findStage, type Stage } from '@/lib/pipeline';
import type { CrmLead, Edits, PendingMove } from './CrmBoard';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const ADV = ['agendaj2', 'facturando', 'ganado'];
const AGENDA_PASSED = ['agenda', 'agendaj2', 'facturando', 'ganado', 'noshow', 'postagenda'];
const fmt = (n: number) => '$' + n.toLocaleString('en-US');

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
  onPatch, onPickStage, onClose, onSave, onDelete,
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
}) {
  const s = pendingMove ? pendingMove.to : effStage;
  const headerMeta = findStage(stages, effStage);
  const isGanado = s === 'ganado';
  const isLost = s === 'perdido' || s === 'descal';
  const isNutri = NUTRI_KEYS.includes(s);
  const isManual = s === 'manual';
  const passedJ1 = !!lead.agenda || ADV.includes(s);
  const passedJ2 = ADV.includes(s);
  const passedAgenda = AGENDA_PASSED.includes(s) || !!lead.agenda || !!lead.j2;

  const groups = [
    { label: 'En proceso', keys: ['lead', 'agenda', 'agendaj2', 'facturando'] },
    { label: 'Resultado', keys: ['ganado', 'perdido', 'descal'] },
    { label: 'Nutrición', keys: ['noshow', 'nutri', 'nopaga', 'manual', 'postagenda', 'noresp'] },
  ];

  const setFathom = (i: number, field: 'label' | 'url', v: string) =>
    onPatch({ fathom: edits.fathom.map((f, fi) => (fi === i ? { ...f, [field]: v } : f)) });
  const setNutri = (i: number, field: 'name' | 'dt', v: string) =>
    onPatch({ nutriciones: edits.nutriciones.map((n, ni) => (ni === i ? { ...n, [field]: v } : n)) });
  const setCuota = (i: number, field: 'monto' | 'fecha', v: string) =>
    onPatch({ cuotas: edits.cuotas.map((c, ci) => (ci === i ? { ...c, [field]: v } : c)) });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>

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
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--warn)' }}>Moviendo a &quot;{findStage(stages, pendingMove.to).label}&quot; — completá lo obligatorio</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Falta:</span>
                {missing.map((x) => (
                  <span key={x} style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', padding: '3px 9px', borderRadius: 999 }}>{x}</span>
                ))}
              </div>
              {moveError && <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600, marginTop: 8 }}>Faltan datos — completalos y tocá Guardar para mover.</div>}
              <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 7 }}>Si cancelás, el lead vuelve a su etapa anterior.</div>
            </div>
          )}

          {/* contacto + origen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={card}>
              <div style={{ ...sectLabel, marginBottom: 12 }}>Contacto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Email</div><div style={{ fontSize: 14, color: 'var(--ink)', wordBreak: 'break-all' }}>{lead.email || '—'}</div></div>
                <div><div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Teléfono</div><div style={{ fontSize: 14, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{lead.phone}</div></div>
              </div>
            </div>
            <div style={card}>
              <div style={{ ...sectLabel, marginBottom: 12 }}>Origen del lead</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Atribución</div><div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>📄 Instant Form (Meta)</div></div>
                <div><div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Anuncio</div><div style={{ fontSize: 14, color: 'var(--ink)' }}>{lead.origin}</div></div>
              </div>
            </div>
          </div>

          {/* etapa / resolución */}
          <div style={card}>
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
          {passedAgenda && (
            <details open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Datos comerciales<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <Stat label="Fecha Junta 1" value={lead.agenda || '—'} />
                <Stat label="¿Asistió a J1?" value={lead.asistioJ1 === true ? 'Sí' : lead.asistioJ1 === false ? 'No' : '—'} />
                <Stat label="¿Era calificado?" value={lead.calificado === true ? 'Sí' : lead.calificado === false ? 'No' : '—'} />
                <Stat label="Fecha Junta 2" value={passedJ2 ? lead.j2 || '—' : '—'} />
                <Stat label="¿Asistió a J2?" value={lead.asistioJ2 === true ? 'Sí' : lead.asistioJ2 === false ? 'No' : '—'} />
                <Stat label="¿Se comprometió a pagar?" value={['facturando', 'ganado'].includes(s) ? 'Sí' : 'No'} />
                <div style={{ gridColumn: '1/-1', ...miniCard }}>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 6 }}>Closer asignado</div>
                  <input value={edits.closer} onChange={(e) => onPatch({ closer: e.target.value })} placeholder="Nombre del closer…" style={fieldInput} />
                </div>
              </div>
            </details>
          )}

          {/* respuestas del calendly */}
          {passedAgenda && lead.calendly.length > 0 && (
            <details style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Respuestas del Calendly<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lead.calendly.map((c, i) => (
                  <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--faint)' }}>{c.q}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 3 }}>{c.a}</div>
                  </div>
                ))}
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
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Sesiones</div>
                <div style={{ fontSize: 22, color: 'var(--ink)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>—</div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Retención del VSL</div>
                <div style={{ fontSize: 22, color: 'var(--accent)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>—</div>
              </div>
            </div>
          </details>

          {/* link de fathom */}
          {passedJ1 && (
            <details style={{ ...card, padding: '0 18px' }}>
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
            <details open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Nutrición<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {isManual && (
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
            <details open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Motivo · narrar detalles<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px' }}>
                <textarea value={edits.motivo} onChange={(e) => onPatch({ motivo: e.target.value })} placeholder="¿Por qué se perdió o descalificó? Contá el contexto…" style={{ width: '100%', minHeight: 88, resize: 'vertical', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.5, outline: 'none' }} />
              </div>
            </details>
          )}

          {/* plan de pagos */}
          {isGanado && (
            <details open style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Plan de pagos<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '0 0 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div><div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 5 }}>Total del plan (USD)</div><input value={edits.plan.total} onChange={(e) => onPatch({ plan: { ...edits.plan, total: e.target.value } })} placeholder="0" style={{ ...rowInput, width: '100%' }} /></div>
                  <div><div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 5 }}>Duración del servicio (meses)</div><input value={edits.plan.duracion} onChange={(e) => onPatch({ plan: { ...edits.plan, duracion: e.target.value } })} placeholder="3" style={{ ...rowInput, width: '100%' }} /></div>
                  <div><div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 5 }}>Fecha de cierre</div><input value={edits.plan.cierre} onChange={(e) => onPatch({ plan: { ...edits.plan, cierre: e.target.value } })} placeholder="dd/mm/aaaa" style={{ ...rowInput, width: '100%' }} /></div>
                  <div><div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 5 }}>Inicio del servicio</div><input value={edits.plan.inicio} onChange={(e) => onPatch({ plan: { ...edits.plan, inicio: e.target.value } })} placeholder="dd/mm/aaaa" style={{ ...rowInput, width: '100%' }} /></div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 5 }}>Contrato</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input value={edits.contract} onChange={(e) => onPatch({ contract: e.target.value })} placeholder="Pegá el link del contrato…" style={{ ...rowInput, flex: 1 }} />
                    <button style={{ flex: 'none', padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>⬆ Subir contrato</button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--faint)', margin: '14px 0 8px' }}>Cuotas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {edits.cuotas.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ flex: 'none', fontFamily: MONO, fontSize: 12, color: 'var(--faint)', width: 24 }}>{i + 1}</span>
                      <input value={c.monto} onChange={(e) => setCuota(i, 'monto', e.target.value)} placeholder="Monto cuota" style={{ ...rowInput, flex: 1 }} />
                      <input value={c.fecha} onChange={(e) => setCuota(i, 'fecha', e.target.value)} placeholder="Fecha de pago" style={{ ...rowInput, flex: 1 }} />
                    </div>
                  ))}
                  <button onClick={() => onPatch({ cuotas: [...edits.cuotas, { monto: '', fecha: '' }] })} style={dashBtn}>+ Agregar otra cuota</button>
                </div>
              </div>
            </details>
          )}

          {/* línea de tiempo SCL */}
          {isGanado && (
            <details style={{ ...card, padding: '0 18px' }}>
              <summary style={summary}>Línea de tiempo · SCL<span style={{ fontSize: 11 }}>▾</span></summary>
              <div style={{ padding: '4px 0 18px', display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: 'Instant Form (Meta)', date: lead.created },
                  { label: 'Junta 1', date: lead.agenda || '—' },
                  { label: 'Junta 2', date: lead.j2 || '—' },
                  { label: 'Cierre ganado', date: fmt(lead.monto) },
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

          {/* historial */}
          <details style={{ ...card, padding: '0 18px' }}>
            <summary style={summary}>Historial de cambios<span style={{ fontSize: 11 }}>▾</span></summary>
            <div style={{ padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { when: lead.created, what: 'Lead creado desde Instant Form' },
                { when: lead.agenda || lead.created, what: 'Agendó Junta 1' },
                { when: 'hoy', what: 'Etapa actual: ' + headerMeta.label },
              ].map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', width: 96 }}>{h.when}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{h.what}</span>
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* footer */}
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
