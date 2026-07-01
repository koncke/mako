'use client';

// =============================================================================
// ExperimentosBrowser — UI de la vista de Experimentos
// =============================================================================
// Hipótesis → MaKo la configura → arrancás → se mide en vivo → cerrás → queda el
// aprendizaje (verdad con datos). Además, MaKo propone experimentos a partir del
// funnel. Las verdades validadas viven solo acá.
// =============================================================================

import { useState, type ReactNode } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import type {
  ExperimentosView, ExperimentoConMedicion, Experimento, Propuesta, Punto, Direccion,
} from '@/lib/experimentos';
import { MakoChat } from '@/app/_components/MakoChat';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// Formato de cada métrica del catálogo (mantener en sync con METRICAS de
// lib/experimentos.ts). El cliente no puede importar el módulo server-only.
const METRICA_FMT: Record<string, 'usd' | 'pct' | 'num'> = {
  cpl: 'usd', cp_form: 'usd', cpc: 'usd', cpm: 'usd', cpa: 'usd', cac: 'usd', spend_usd: 'usd',
  ctr: 'pct', tasa_landing: 'pct', tasa_form: 'pct', tasa_agenda: 'pct',
  impressions: 'num', landing_page_views: 'num', leads_count: 'num', agendamientos: 'num',
  vsl_views: 'num', cierres: 'num',
};

function fmtVal(v: number | null | undefined, metrica: string): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const f = METRICA_FMT[metrica] ?? 'num';
  if (f === 'usd') return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (f === 'pct') return `${v.toFixed(1)}%`;
  return Math.round(v).toLocaleString('es-MX');
}

function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

// ── Átomos de UI ──────────────────────────────────────────────────────────────

function Pill({ tone, children }: { tone: 'good' | 'bad' | 'warn' | 'faint'; children: ReactNode }) {
  const map = {
    good: { bg: 'var(--good-bg)', bd: 'var(--good)', fg: 'var(--good)' },
    bad: { bg: 'var(--bad-bg)', bd: 'var(--bad)', fg: 'var(--bad)' },
    warn: { bg: 'var(--warn-bg)', bd: 'var(--warn)', fg: 'var(--warn)' },
    faint: { bg: 'var(--surface-2)', bd: 'var(--border-strong)', fg: 'var(--faint)' },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: map.bg, border: `1px solid ${map.bd}`, color: map.fg, fontSize: 12, fontWeight: 600 }}>
      {children}
    </span>
  );
}

function Spark({ serie, color = 'var(--primary)' }: { serie: Punto[]; color?: string }) {
  const data = serie.filter((p) => p.valor != null).map((p) => ({ x: fmtFechaCorta(p.fecha), y: p.valor }));
  if (data.length < 2) {
    return <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--faint)', fontFamily: MONO }}>aún sin serie</div>;
  }
  return (
    <div style={{ height: 64, width: '100%' }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="x" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--faint)' }}
            formatter={(val) => [String(val), ''] as [string, string]}
          />
          <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill="url(#sparkfill)" connectNulls dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20,
};
const sectionTitle: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', margin: '0 0 12px',
};
const btnPrimary: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 11, border: 'none', background: '#14161B', color: '#F3F5F8',
  fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer',
};

const dirLabel = (d: Direccion) => (d === 'subir' ? 'subir ↑' : 'bajar ↓');

// ── Componente principal ────────────────────────────────────────────────────

export function ExperimentosBrowser({ data, errorMsg }: { data: ExperimentosView; errorMsg: string | null }) {
  const [view, setView] = useState<ExperimentosView>(data);
  const [hip, setHip] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [ideas, setIdeas] = useState<Propuesta[] | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [busyId, setBusyId] = useState<number | 'crear' | null>(null);
  const [err, setErr] = useState<string | null>(errorMsg);
  const [chatOpen, setChatOpen] = useState(false);

  const refresh = async () => {
    try {
      const j = await fetch('/api/experimentos').then((r) => r.json());
      if (j.ok) setView(j.view as ExperimentosView);
      else setErr(j.error);
    } catch (e) { setErr(String(e)); }
  };

  const onSuggest = async () => {
    const h = hip.trim();
    if (!h || suggesting) return;
    setSuggesting(true); setErr(null); setPropuesta(null);
    try {
      const j = await fetch('/api/experimentos/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hipotesis: h }),
      }).then((r) => r.json());
      if (j.ok) setPropuesta(j.propuesta as Propuesta);
      else setErr(j.error);
    } catch (e) { setErr(String(e)); } finally { setSuggesting(false); }
  };

  const onIdeas = async () => {
    if (loadingIdeas) return;
    setLoadingIdeas(true); setErr(null);
    try {
      const j = await fetch('/api/experimentos/ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ n: 3 }),
      }).then((r) => r.json());
      if (j.ok) setIdeas(j.ideas as Propuesta[]);
      else setErr(j.error);
    } catch (e) { setErr(String(e)); } finally { setLoadingIdeas(false); }
  };

  const crearDesde = async (p: Propuesta, arrancar: boolean) => {
    setBusyId('crear'); setErr(null);
    try {
      const j = await fetch('/api/experimentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'crear',
          experimento: {
            titulo: p.titulo, hipotesis: p.hipotesis, cambio: p.cambio,
            metrica: p.metrica, direccion: p.direccion, objetivo_valor: p.objetivo_valor,
            criterio_exito: p.criterio_exito, ventana_dias: p.ventana_dias,
            presupuesto_usd: p.presupuesto_usd, origen: 'mako', racional: p.racional,
            config: { propuesta: p }, arrancar,
          },
        }),
      }).then((r) => r.json());
      if (!j.ok) { setErr(j.error); return; }
      setPropuesta(null);
      setIdeas((prev) => (prev ? prev.filter((x) => x !== p) : prev));
      setHip('');
      await refresh();
    } catch (e) { setErr(String(e)); } finally { setBusyId(null); }
  };

  const accion = async (action: 'iniciar' | 'cerrar' | 'descartar', id: number) => {
    setBusyId(id); setErr(null);
    try {
      const j = await fetch('/api/experimentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }),
      }).then((r) => r.json());
      if (!j.ok) { setErr(j.error); return; }
      await refresh();
    } catch (e) { setErr(String(e)); } finally { setBusyId(null); }
  };

  return (
    <div style={{ fontFamily: SANS, display: 'flex', flexDirection: 'column', gap: 30 }}>
      {err && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '10px 14px', color: 'var(--bad)', fontSize: 13.5 }}>
          {err}
        </div>
      )}

      {/* ── Hero: contale tu hipótesis a MaKo ── */}
      <section style={{ ...card, background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>¿Y si…? Contale tu hipótesis a MaKo</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--dim)' }}>
          Ej.: “si filtro más fuerte el formulario, baja el costo por agenda” · “si cambio el hook del VSL, sube la tasa de agenda”.
          MaKo la convierte en un experimento medible.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <textarea
            value={hip} onChange={(e) => setHip(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSuggest(); } }}
            rows={2} placeholder="Escribí tu hipótesis…  (⌘/Ctrl+Enter)"
            style={{ flex: 1, minWidth: 280, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14.5, outline: 'none', resize: 'vertical', lineHeight: 1.45 }}
          />
          <button type="button" onClick={onSuggest} disabled={suggesting || !hip.trim()} style={{ ...btnPrimary, opacity: suggesting || !hip.trim() ? 0.55 : 1, alignSelf: 'flex-start' }}>
            {suggesting ? 'Diseñando…' : 'Diseñar experimento'}
          </button>
        </div>

        {propuesta && (
          <div style={{ marginTop: 16 }}>
            <PropuestaCard
              p={propuesta} onChange={setPropuesta} busy={busyId === 'crear'}
              onIniciar={() => crearDesde(propuesta, true)}
              onGuardar={() => crearDesde(propuesta, false)}
              onDescartar={() => setPropuesta(null)}
              editable
            />
          </div>
        )}
      </section>

      {/* ── Experimentos en curso ── */}
      <section>
        <h3 style={sectionTitle}>En curso · {view.counts.activos}</h3>
        {view.activos.length === 0 ? (
          <Vacio texto="No hay experimentos corriendo. Arrancá uno con una hipótesis arriba." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {view.activos.map((e) => (
              <ActivoCard key={e.id} e={e} busy={busyId === e.id} onCerrar={() => accion('cerrar', e.id)} onDescartar={() => accion('descartar', e.id)} />
            ))}
          </div>
        )}
      </section>

      {/* ── Ideas de MaKo (propone, no concluye) ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Ideas de MaKo · qué probar ahora</h3>
          <button type="button" onClick={onIdeas} disabled={loadingIdeas} style={{ ...btnGhost, opacity: loadingIdeas ? 0.6 : 1 }}>
            {loadingIdeas ? 'Pensando…' : ideas ? 'Pedir otras' : 'Pedir ideas a MaKo'}
          </button>
        </div>
        {view.propuestos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>
            {view.propuestos.map((e) => (
              <PropuestaGuardadaCard key={e.id} e={e} busy={busyId === e.id} onIniciar={() => accion('iniciar', e.id)} onDescartar={() => accion('descartar', e.id)} />
            ))}
          </div>
        )}
        {ideas && ideas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {ideas.map((p, i) => (
              <PropuestaCard
                key={i} p={p} busy={busyId === 'crear'}
                onIniciar={() => crearDesde(p, true)}
                onGuardar={() => crearDesde(p, false)}
                onDescartar={() => setIdeas((prev) => (prev ? prev.filter((x) => x !== p) : prev))}
              />
            ))}
          </div>
        )}
        {ideas && ideas.length === 0 && <Vacio texto="MaKo no encontró ideas nuevas ahora mismo." />}
        {!ideas && view.propuestos.length === 0 && (
          <Vacio texto="MaKo nunca concluye: te dice qué experimento abrir. Pedile ideas y elegí cuál arrancar." />
        )}
      </section>

      {/* ── Aprendizajes: las verdades con datos ── */}
      <section>
        <h3 style={sectionTitle}>Aprendizajes · verdades con datos · {view.counts.cerrados}</h3>
        {view.aprendizajes.length === 0 ? (
          <Vacio texto="Todavía no hay verdades. Una verdad nace cuando cerrás un experimento: MaKo lee el dato y deja la lectura." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {view.aprendizajes.map((e) => <AprendizajeCard key={e.id} e={e} />)}
          </div>
        )}
      </section>

      {/* ── MaKo sobre tus experimentos (bajo demanda para no gastar al cargar) ── */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Preguntale a MaKo sobre tus experimentos</h3>
          <button type="button" onClick={() => setChatOpen((v) => !v)} style={btnGhost}>{chatOpen ? 'Cerrar' : 'Abrir MaKo'}</button>
        </div>
        {chatOpen && (
          <div style={{ marginTop: 14, height: 520, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <MakoChat
              chartKey="experimentos"
              titulo="Experimentos"
              contexto={`Tenés ${view.counts.activos} experimento(s) en curso, ${view.counts.validadas} verdad(es) validada(s) y ${view.counts.cerrados} cerrado(s). En esta vista MaKo SÍ puede afirmar lo validado; para lo no probado, propone abrir un experimento.`}
              sugerencias={['¿Qué experimento abro esta semana?', '¿Cuál de mis experimentos ya da para cerrar?', '¿Qué aprendí hasta ahora?']}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div style={{ ...card, color: 'var(--dim)', fontSize: 14, lineHeight: 1.55, borderStyle: 'dashed' }}>{texto}</div>
  );
}

// ── Card de propuesta (de la hipótesis o de las ideas de MaKo) ──────────────────

function PropuestaCard({
  p, onChange, onIniciar, onGuardar, onDescartar, busy, editable = false,
}: {
  p: Propuesta; onChange?: (p: Propuesta) => void;
  onIniciar: () => void; onGuardar: () => void; onDescartar: () => void; busy: boolean; editable?: boolean;
}) {
  const set = (patch: Partial<Propuesta>) => onChange?.({ ...p, ...patch });
  const numInput = (val: number | null, on: (n: number | null) => void, ph: string) => (
    <input
      type="number" value={val ?? ''} placeholder={ph} disabled={!editable}
      onChange={(e) => on(e.target.value === '' ? null : Number(e.target.value))}
      style={{ width: 110, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: editable ? 'var(--surface)' : 'var(--surface-2)', color: 'var(--ink)', fontFamily: MONO, fontSize: 13 }}
    />
  );

  return (
    <div style={{ ...card, borderColor: 'var(--accent-soft)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        {editable ? (
          <input value={p.titulo} onChange={(e) => set({ titulo: e.target.value })}
            style={{ flex: 1, fontSize: 16, fontWeight: 600, color: 'var(--ink)', border: 'none', borderBottom: '1px dashed var(--border-strong)', background: 'transparent', fontFamily: SANS, outline: 'none', padding: '2px 0' }} />
        ) : (
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{p.titulo}</div>
        )}
        <Pill tone="warn">propuesta</Pill>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{p.hipotesis}</p>

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Pill tone="faint">📏 {p.metrica_label}</Pill>
        <Pill tone="faint">objetivo: {dirLabel(p.direccion)}</Pill>
        <Pill tone="faint">ventana: {p.ventana_dias}d</Pill>
        {p.presupuesto_usd != null && <Pill tone="faint">presup.: ${p.presupuesto_usd}</Pill>}
      </div>

      {p.cambio && (
        <div style={{ marginTop: 12 }}>
          <Etiqueta>Qué se cambia</Etiqueta>
          {editable ? (
            <textarea value={p.cambio} onChange={(e) => set({ cambio: e.target.value })} rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, resize: 'vertical', outline: 'none', marginTop: 4 }} />
          ) : <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p.cambio}</p>}
        </div>
      )}

      {p.criterio_exito && (
        <div style={{ marginTop: 10 }}>
          <Etiqueta>Criterio de éxito</Etiqueta>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p.criterio_exito}</p>
        </div>
      )}

      {p.racional && (
        <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, fontStyle: 'italic' }}>💡 {p.racional}</p>
      )}

      {editable && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12.5, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 7 }}>
            Ventana (días) {numInput(p.ventana_dias, (n) => set({ ventana_dias: n ?? 14 }), '14')}
          </label>
          <label style={{ fontSize: 12.5, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 7 }}>
            Objetivo {numInput(p.objetivo_valor, (n) => set({ objetivo_valor: n }), 'opcional')}
          </label>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={onIniciar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Arrancando…' : 'Iniciar experimento'}</button>
        <button type="button" onClick={onGuardar} disabled={busy} style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}>Guardar para después</button>
        <button type="button" onClick={onDescartar} disabled={busy} style={{ ...btnGhost, border: 'none', color: 'var(--faint)' }}>Descartar</button>
      </div>
    </div>
  );
}

function Etiqueta({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{children}</div>;
}

// ── Card de propuesta YA guardada (estado propuesto en la DB) ───────────────────

function PropuestaGuardadaCard({ e, onIniciar, onDescartar, busy }: { e: Experimento; onIniciar: () => void; onDescartar: () => void; busy: boolean }) {
  return (
    <div style={{ ...card, borderColor: 'var(--accent-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{e.titulo}</div>
        <Pill tone="warn">guardado</Pill>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{e.hipotesis}</p>
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Pill tone="faint">📏 {e.metrica_label ?? e.metrica}</Pill>
        <Pill tone="faint">objetivo: {dirLabel(e.direccion)}</Pill>
        <Pill tone="faint">ventana: {e.ventana_dias}d</Pill>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <button type="button" onClick={onIniciar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Arrancando…' : 'Iniciar'}</button>
        <button type="button" onClick={onDescartar} disabled={busy} style={{ ...btnGhost, border: 'none', color: 'var(--faint)' }}>Descartar</button>
      </div>
    </div>
  );
}

// ── Card de experimento en curso ───────────────────────────────────────────────

function ActivoCard({ e, onCerrar, onDescartar, busy }: { e: ExperimentoConMedicion; onCerrar: () => void; onDescartar: () => void; busy: boolean }) {
  const m = e.medicion;
  const vaBien = m?.va_bien;
  const listoParaCerrar = m != null && m.dias_corridos >= m.dias_total;
  const progreso = m ? Math.min(100, Math.round((m.dias_corridos / Math.max(1, m.dias_total)) * 100)) : 0;
  const deltaTxt = m?.delta_pct != null ? `${m.delta_pct > 0 ? '+' : ''}${m.delta_pct.toFixed(1)}%` : '—';
  const sparkColor = vaBien === true ? 'var(--good)' : vaBien === false ? 'var(--bad)' : 'var(--primary)';

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{e.titulo}</div>
        {vaBien == null ? <Pill tone="faint">sin dato aún</Pill> : vaBien ? <Pill tone="good">va bien</Pill> : <Pill tone="bad">en contra</Pill>}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--dim)', lineHeight: 1.45 }}>{e.hipotesis}</p>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <Etiqueta>{e.metrica_label ?? e.metrica}</Etiqueta>
      </div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 14, color: 'var(--faint)' }}>{fmtVal(m?.baseline, e.metrica)}</span>
        <span style={{ color: 'var(--faint)' }}>→</span>
        <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>{fmtVal(m?.actual, e.metrica)}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, color: vaBien === true ? 'var(--good)' : vaBien === false ? 'var(--bad)' : 'var(--faint)' }}>{deltaTxt}</span>
        {e.objetivo_valor != null && <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', marginLeft: 'auto' }}>obj. {fmtVal(e.objetivo_valor, e.metrica)}</span>}
      </div>

      <div style={{ marginTop: 12 }}>
        <Spark serie={m?.serie ?? []} color={sparkColor} />
      </div>

      {/* progreso de la ventana */}
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ width: `${progreso}%`, height: '100%', background: listoParaCerrar ? 'var(--good)' : 'var(--primary)' }} />
        </div>
        <div style={{ marginTop: 5, fontFamily: MONO, fontSize: 11, color: 'var(--faint)', display: 'flex', justifyContent: 'space-between' }}>
          <span>día {m?.dias_corridos ?? 0} de {m?.dias_total ?? e.ventana_dias}</span>
          <span>{e.fecha_inicio ? `desde ${fmtFechaCorta(e.fecha_inicio)}` : ''}</span>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={onCerrar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, background: listoParaCerrar ? 'var(--good)' : '#14161B' }}>
          {busy ? 'Cerrando…' : 'Cerrar y guardar aprendizaje'}
        </button>
        <button type="button" onClick={onDescartar} disabled={busy} style={{ ...btnGhost, border: 'none', color: 'var(--faint)' }}>Descartar</button>
      </div>
    </div>
  );
}

// ── Card de aprendizaje (verdad con datos) ──────────────────────────────────────

function AprendizajeCard({ e }: { e: Experimento }) {
  const tone: 'good' | 'bad' | 'warn' = e.veredicto === 'validada' ? 'good' : e.veredicto === 'refutada' ? 'bad' : 'warn';
  const label = e.veredicto === 'validada' ? 'Validada' : e.veredicto === 'refutada' ? 'Refutada' : 'No concluyente';
  const serieCierre = (e.config?.serie_cierre as Punto[] | undefined) ?? [];
  const sparkColor = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--warn)';

  return (
    <div style={{ ...card, display: 'flex', gap: 18, alignItems: 'stretch', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Pill tone={tone}>{label}</Pill>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{e.titulo}</span>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--ink)', lineHeight: 1.55, fontWeight: 500 }}>{e.aprendizaje || '—'}</p>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Pill tone="faint">📏 {e.metrica_label ?? e.metrica}</Pill>
          <Pill tone="faint">{fmtVal(e.baseline_valor, e.metrica)} → {fmtVal(e.resultado_valor, e.metrica)}</Pill>
          <Pill tone="faint">cerrado {fmtFechaCorta(e.cerrado_at)}</Pill>
        </div>
      </div>
      {serieCierre.length >= 2 && (
        <div style={{ width: 200, minWidth: 160, alignSelf: 'center' }}>
          <Spark serie={serieCierre} color={sparkColor} />
        </div>
      )}
    </div>
  );
}
