'use client';

// =============================================================================
// FunnelEditor — editor visual del funnel (tab /funnel)
// =============================================================================
// Nodos = etapas, flechas = transiciones (etapa → etapa). Permite:
//   • Agregar / renombrar / eliminar etapas (columnas del Kanban).
//   • Conectar etapas con flechas (clic en origen → clic en destino).
//   • Editar cada transición: texto, color y qué asistencia marca (R1/R2).
// Las transiciones alimentan las opciones de "Datos sin marcar" en el CRM.
// Persiste en Supabase (pipeline_stages + funnel_transitions). Sin BD, edita en
// sesión y el Guardar avisa del error sin perder los cambios.

import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CHIP,
  NEW_STAGE_PALETTE,
  NEW_STAGE_TONES,
  type Stage,
  type FunnelTransition,
  type TransitionTone,
} from '@/lib/pipeline';
import { savePipelineStagesAction, saveFunnelTransitionsAction } from '../leads/actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const NODE_W = 172;
const NODE_H = 54;
const GAP_X = 48;
const GAP_Y = 96;
const PAD = 28;

// Filas del diagrama: proceso (arriba), nutrición (medio), resultado (abajo).
const RESULT_KEYS = new Set(['ganado', 'perdido', 'descal', 'noresp']);
const NUTRI_ROW_KEYS = new Set(['noshow', 'nutri', 'nopaga', 'manual', 'postagenda']);

const EDGE_COLOR: Record<TransitionTone, string> = {
  accent: 'var(--accent)',
  good: 'var(--good)',
  bad: 'var(--bad)',
  nutri: 'var(--warn-fill)',
};
const TONE_LABEL: Record<TransitionTone, string> = {
  accent: 'Avanza', good: 'Ganado', nutri: 'Nutrición', bad: 'Pierde',
};
const TONES: TransitionTone[] = ['accent', 'good', 'nutri', 'bad'];

type Pos = { x: number; y: number; w: number; h: number };

function computeLayout(stages: Stage[]) {
  const rows: string[][] = [[], [], []];
  for (const s of stages) {
    const r = RESULT_KEYS.has(s.key) ? 2 : NUTRI_ROW_KEYS.has(s.key) ? 1 : 0;
    rows[r].push(s.key);
  }
  const pos: Record<string, Pos> = {};
  rows.forEach((keys, r) => {
    keys.forEach((k, i) => {
      pos[k] = { x: PAD + i * (NODE_W + GAP_X), y: PAD + r * (NODE_H + GAP_Y), w: NODE_W, h: NODE_H };
    });
  });
  const maxCols = Math.max(1, rows[0].length, rows[1].length, rows[2].length);
  const width = PAD * 2 + maxCols * (NODE_W + GAP_X) - GAP_X;
  const height = PAD * 2 + 3 * NODE_H + 2 * GAP_Y;
  return { pos, width, height };
}

// Punto del borde de la caja en dirección a (tx,ty) desde su centro.
function boxEdge(p: Pos, tx: number, ty: number): [number, number] {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const sx = dx !== 0 ? (p.w / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (p.h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

export function FunnelEditor({
  initialStages,
  initialTransitions,
}: {
  initialStages: Stage[];
  initialTransitions: FunnelTransition[];
}) {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [transitions, setTransitions] = useState<FunnelTransition[]>(initialTransitions);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  // Selección por clave estable `from|to` (no por índice: borrar/insertar reordena).
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const labelOf = (key: string) => stages.find((s) => s.key === key)?.label ?? key;
  const edgeKey = (t: FunnelTransition) => `${t.from}|${t.to}`;
  const { pos, width, height } = useMemo(() => computeLayout(stages), [stages]);

  // ── Etapas ──
  const addStage = () => {
    const dot = NEW_STAGE_PALETTE[stages.length % NEW_STAGE_PALETTE.length];
    const tone = NEW_STAGE_TONES[stages.length % NEW_STAGE_TONES.length];
    setStages((s) => [...s, { key: 'custom_' + Date.now(), label: 'Nueva etapa', dot, tone, custom: true }]);
    setMsg(null);
  };
  const renameStage = (key: string, label: string) => {
    setStages((s) => s.map((st) => (st.key === key ? { ...st, label } : st)));
    setMsg(null);
  };
  const deleteStage = (key: string) => {
    setStages((s) => s.filter((st) => st.key !== key));
    setTransitions((t) => t.filter((tr) => tr.from !== key && tr.to !== key));
    if (connectFrom === key) setConnectFrom(null);
    setMsg(null);
  };

  // ── Transiciones ──
  const addTransition = (from: string, to: string) => {
    if (from === to) return;
    if (transitions.some((t) => t.from === from && t.to === to)) return;
    setTransitions((t) => [...t, { from, to, label: labelOf(to), tone: 'accent' }]);
    setMsg(null);
  };
  const updateTransition = (i: number, patch: Partial<FunnelTransition>) => {
    setTransitions((t) => t.map((tr, j) => (j === i ? { ...tr, ...patch } : tr)));
    setMsg(null);
  };
  const deleteTransition = (i: number) => {
    const removed = transitions[i];
    if (removed && selectedEdge === edgeKey(removed)) setSelectedEdge(null);
    setTransitions((t) => t.filter((_, j) => j !== i));
    setMsg(null);
  };

  const onNodeClick = (key: string) => {
    if (connectFrom === null) { setConnectFrom(key); setSelectedEdge(null); return; }
    if (connectFrom === key) { setConnectFrom(null); return; }
    addTransition(connectFrom, key);
    setConnectFrom(null);
  };

  const save = () => {
    setMsg(null);
    start(async () => {
      try {
        await savePipelineStagesAction(stages);
        await saveFunnelTransitionsAction(transitions);
        router.refresh();
        setMsg({ kind: 'ok', text: 'Funnel guardado.' });
      } catch (e) {
        setMsg({ kind: 'err', text: 'No se pudo guardar (¿BD sin migrar 0024?). Tus cambios siguen acá: ' + (e instanceof Error ? e.message : String(e)) });
      }
    });
  };

  // Asistencia como tri-estado para los selects de cada transición.
  const asTri = (v: boolean | undefined) => (v === undefined ? '' : v ? 'si' : 'no');
  const fromTri = (v: string): boolean | undefined => (v === '' ? undefined : v === 'si');

  const btn: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
  const ghost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, textDecoration: 'none' };
  const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
  const sect: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
  const input: CSSProperties = { padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
  const selStyle: CSSProperties = { ...input, cursor: 'pointer' };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Funnel</h1>
          <span style={{ fontSize: 15, color: 'var(--dim)' }}>{stages.length} etapas · {transitions.length} flechas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/leads" style={ghost}>← Volver al CRM</Link>
          <button onClick={save} disabled={pending} style={{ ...btn, opacity: pending ? 0.6 : 1, cursor: pending ? 'wait' : 'pointer' }}>{pending ? 'Guardando…' : 'Guardar funnel'}</button>
        </div>
      </header>

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13.5, fontWeight: 500, background: msg.kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: msg.kind === 'ok' ? 'var(--good)' : 'var(--bad)', border: '1px solid ' + (msg.kind === 'ok' ? 'var(--good)' : 'var(--bad)') }}>{msg.text}</div>
      )}

      {/* HINT de conexión */}
      <div style={{ fontSize: 13.5, color: connectFrom ? 'var(--accent)' : 'var(--dim)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {connectFrom
          ? <>Conectando desde <strong>{labelOf(connectFrom)}</strong> — hacé clic en la etapa destino. <button onClick={() => setConnectFrom(null)} style={{ ...ghost, padding: '4px 10px' }}>Cancelar</button></>
          : <>Hacé clic en una etapa para empezar una flecha; luego clic en la etapa destino. Clic en una flecha para seleccionarla.</>}
      </div>

      {/* DIAGRAMA */}
      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <div style={{ position: 'relative', width, height, minWidth: '100%' }}>
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <defs>
              {TONES.map((t) => (
                <marker key={t} id={`arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={EDGE_COLOR[t]} />
                </marker>
              ))}
            </defs>
            {transitions.map((t) => {
              const a = pos[t.from];
              const b = pos[t.to];
              if (!a || !b) return null;
              const [sx, sy] = boxEdge(a, b.x + b.w / 2, b.y + b.h / 2);
              const [ex, ey] = boxEdge(b, a.x + a.w / 2, a.y + a.h / 2);
              const ek = edgeKey(t);
              const sel = selectedEdge === ek;
              return (
                <g key={ek}>
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth={14} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => setSelectedEdge(ek)} />
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={EDGE_COLOR[t.tone]} strokeWidth={sel ? 3 : 1.75} markerEnd={`url(#arrow-${t.tone})`} opacity={sel ? 1 : 0.7} style={{ pointerEvents: 'none' }} />
                </g>
              );
            })}
          </svg>

          {stages.map((s) => {
            const p = pos[s.key];
            if (!p) return null;
            const isFrom = connectFrom === s.key;
            const c = CHIP[s.tone] || CHIP.neutral;
            return (
              <button
                key={s.key}
                onClick={() => onNodeClick(s.key)}
                title={connectFrom ? `Conectar ${labelOf(connectFrom)} → ${s.label}` : `Empezar flecha desde ${s.label}`}
                style={{
                  position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h,
                  display: 'flex', alignItems: 'center', gap: 9, padding: '0 13px',
                  borderRadius: 12, cursor: 'pointer', fontFamily: SANS, textAlign: 'left',
                  background: isFrom ? c.bg : 'var(--surface)',
                  border: '2px solid ' + (isFrom ? 'var(--accent)' : c.bd),
                  boxShadow: isFrom ? '0 0 0 3px var(--accent-soft)' : '0 1px 2px rgba(23,21,17,.06)',
                }}
              >
                <span style={{ width: 10, height: 10, flex: 'none', borderRadius: '50%', background: s.dot }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.15, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PANELES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 18 }}>
        {/* Etapas */}
        <section style={{ ...card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={sect}>Etapas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {stages.map((st) => (
              <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                <span style={{ width: 11, height: 11, flex: 'none', borderRadius: '50%', background: st.dot }} />
                <input value={st.label} onChange={(e) => renameStage(st.key, e.target.value)} style={{ ...input, flex: 1, minWidth: 0 }} />
                <button onClick={() => deleteStage(st.key)} title="Eliminar etapa" style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>✕</button>
              </div>
            ))}
            <button onClick={addStage} style={{ marginTop: 2, padding: 10, borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>+ Agregar etapa</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10 }}>Al eliminar una etapa se quitan también sus flechas.</div>
        </section>

        {/* Transiciones */}
        <section style={{ ...card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={sect}>Transiciones (flechas)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 360, overflowY: 'auto' }}>
            {transitions.map((t, i) => (
              <div
                key={edgeKey(t)}
                onMouseEnter={() => setSelectedEdge(edgeKey(t))}
                style={{ background: selectedEdge === edgeKey(t) ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (selectedEdge === edgeKey(t) ? 'var(--accent)' : 'var(--border)'), borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: EDGE_COLOR[t.tone] }} />
                  <strong style={{ color: 'var(--ink)' }}>{labelOf(t.from)}</strong>
                  <span>→</span>
                  <strong style={{ color: 'var(--ink)' }}>{labelOf(t.to)}</strong>
                  <button onClick={() => deleteTransition(i)} title="Eliminar flecha" style={{ marginLeft: 'auto', flex: 'none', width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>✕</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input value={t.label} onChange={(e) => updateTransition(i, { label: e.target.value })} placeholder="Texto del botón" style={{ ...input, flex: 1, minWidth: 140 }} />
                  <select value={t.tone} onChange={(e) => updateTransition(i, { tone: e.target.value as TransitionTone })} style={selStyle}>
                    {TONES.map((tn) => <option key={tn} value={tn}>{TONE_LABEL[tn]}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--faint)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Marca R1
                    <select value={asTri(t.asistioJ1)} onChange={(e) => updateTransition(i, { asistioJ1: fromTri(e.target.value) })} style={{ ...selStyle, padding: '5px 8px' }}>
                      <option value="">—</option><option value="si">Asistió</option><option value="no">No Show</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Marca R2
                    <select value={asTri(t.asistioJ2)} onChange={(e) => updateTransition(i, { asistioJ2: fromTri(e.target.value) })} style={{ ...selStyle, padding: '5px 8px' }}>
                      <option value="">—</option><option value="si">Asistió</option><option value="no">No Show</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
            {transitions.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--faint)', fontSize: 13.5 }}>Sin flechas. Conectá etapas en el diagrama de arriba.</div>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10 }}>&quot;Marca R1/R2&quot; define qué asistencia se graba al usar la flecha desde &quot;Datos sin marcar&quot;.</div>
        </section>
      </div>
    </main>
  );
}
