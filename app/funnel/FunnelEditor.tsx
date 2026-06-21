'use client';

// =============================================================================
// FunnelEditor — editor visual del funnel (tab /funnel) · rediseño Claude Design
// =============================================================================
// Diagrama de flujo: nodos = etapas (3 bandas: Pipeline / Nutrición / Salidas),
// flechas ortogonales (horizontal/vertical) = transiciones (color por categoría).
//   • Hover sobre una etapa → aísla su flujo. Clic → abre su pop-up de edición.
//   • Clic en una etapa y arrastrar a otra → crea una flecha.
//   • Arrastrar el punto de una flecha seleccionada → la reconecta.
// Cada cambio se GUARDA solo (funnel_config) y muestra un toast de 5s con Deshacer.
// Las flechas alimentan "Datos sin marcar" en el CRM (asistencia R1/R2 por flecha).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE, type ReactNode } from 'react';
import {
  CATEGORY,
  DEFAULT_STAGES,
  DEFAULT_TRANSITIONS,
  withLayout,
  type Stage,
  type StageBand,
  type FunnelTransition,
  type TransitionCategory,
} from '@/lib/pipeline';
import { saveFunnelAction } from '../leads/actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const GUT = 130, COL = 200, CW = 170, CH = 54, BASEH = 392;
const ROWY: Record<StageBand, number> = { pipeline: 44, nutricion: 178, salidas: 312 };
const BANDS: { band: StageBand; label: string; tint: string }[] = [
  { band: 'pipeline', label: 'Pipeline', tint: 'rgba(59,109,17,.055)' },
  { band: 'nutricion', label: 'Nutrición', tint: 'rgba(200,135,12,.06)' },
  { band: 'salidas', label: 'Salidas', tint: 'rgba(207,78,41,.055)' },
];
const FILTERS: [TransitionCategory | 'all', string][] = [['all', 'Todas'], ['avanza', 'Avanza'], ['nutricion', 'Nutrición'], ['perdida', 'Pérdida']];

type ETrans = FunnelTransition & { id: string };
type Pt = { x: number; y: number };
type Box = { x: number; y: number; cx: number; cy: number; w: number; h: number };

// ── ruteo ortogonal (solo segmentos horizontales / verticales) ──
function orthRoute(A: Box, B: Box): Pt[] {
  if (Math.abs(A.cy - B.cy) < 1) { const r = B.cx >= A.cx; return [{ x: r ? A.x + A.w : A.x, y: A.cy }, { x: r ? B.x : B.x + B.w, y: B.cy }]; }
  if (Math.abs(A.cx - B.cx) < 1) { const d = B.cy >= A.cy; return [{ x: A.cx, y: d ? A.y + A.h : A.y }, { x: B.cx, y: d ? B.y : B.y + B.h }]; }
  const r = B.cx >= A.cx; const sx = r ? A.x + A.w : A.x; const ex = r ? B.x : B.x + B.w; const midX = (sx + ex) / 2;
  return [{ x: sx, y: A.cy }, { x: midX, y: A.cy }, { x: midX, y: B.cy }, { x: ex, y: B.cy }];
}
function routeBoxPt(A: Box, p: Pt): Pt[] { const r = p.x >= A.cx; return [{ x: r ? A.x + A.w : A.x, y: A.cy }, { x: p.x, y: A.cy }, { x: p.x, y: p.y }]; }
function routePtBox(p: Pt, B: Box): Pt[] { const r = B.cx >= p.x; return [{ x: p.x, y: p.y }, { x: p.x, y: B.cy }, { x: r ? B.x : B.x + B.w, y: B.cy }]; }
function pathFrom(pts: Pt[]): string { return 'M ' + pts.map((p) => `${p.x} ${p.y}`).join(' L '); }
function labelAt(pts: Pt[]): Pt { if (pts.length >= 4) return { x: pts[1].x, y: (pts[1].y + pts[2].y) / 2 }; const a = pts[0], b = pts[pts.length - 1]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function arrowPoints(b: Pt, prev: Pt, w: number): string {
  const ang = Math.atan2(b.y - prev.y, b.x - prev.x), sz = 6 + w * 1.3;
  const lx = b.x - sz * Math.cos(ang - 0.5), ly = b.y - sz * Math.sin(ang - 0.5);
  const rx = b.x - sz * Math.cos(ang + 0.5), ry = b.y - sz * Math.sin(ang + 0.5);
  return `${b.x},${b.y} ${lx},${ly} ${rx},${ry}`;
}

type Drag = { tid: string | null; end: 'from' | 'to'; from?: string; x: number; y: number; over: string | null } | null;
type Snap = { stages: Stage[]; trans: ETrans[] };

export function FunnelEditor({
  initialStages,
  initialTransitions,
}: {
  initialStages: Stage[];
  initialTransitions: FunnelTransition[];
}) {
  const idc = useRef(0);
  const mkTrans = useCallback((arr: FunnelTransition[]): ETrans[] => arr.map((t) => ({ ...t, id: 't' + (idc.current++) })), []);

  const [stages, setStages] = useState<Stage[]>(() => initialStages.map(withLayout));
  const [trans, setTrans] = useState<ETrans[]>(() => mkTrans(initialTransitions));
  const [hoverStage, setHoverStage] = useState<string | null>(null);
  const [hoverTrans, setHoverTrans] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<TransitionCategory | 'all'>('all');
  const [drag, setDrag] = useState<Drag>(null);
  const [scale, setScale] = useState(1);
  const [showStages, setShowStages] = useState(false);
  const [stageModal, setStageModal] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; bad?: boolean } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<{ from: string; sx: number; sy: number } | null>(null);
  const ref = useRef({ stages, trans, drag });
  ref.current = { stages, trans, drag };
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const labelOf = (key: string) => stages.find((s) => s.key === key)?.label ?? key;
  const maxCol = stages.reduce((m, s) => Math.max(m, s.col ?? 0), 4);
  const BASEW = Math.max(1120, GUT + maxCol * COL + CW + 28);

  const boxOf = useCallback((s: Stage): Box => {
    const x = GUT + (s.col ?? 0) * COL, y = ROWY[s.band ?? 'nutricion'];
    return { x, y, cx: x + CW / 2, cy: y + CH / 2, w: CW, h: CH };
  }, []);

  // ── guardado automático (debounce) + toast 5s (con Deshacer) ──
  const plain = (tr: ETrans[]): FunnelTransition[] => tr.map(({ id: _id, ...t }) => t);
  const flashToast = useCallback((msg: string, undo?: () => void, bad?: boolean) => {
    setToast({ msg, undo, bad });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const doSave = useCallback((st: Stage[], tr: ETrans[], msg: string, undo?: () => void) => {
    saveFunnelAction(st, plain(tr))
      .then(() => flashToast(msg, undo))
      .catch((e) => flashToast('No se pudo guardar (¿falta migración 0025?): ' + (e instanceof Error ? e.message : String(e)), undefined, true));
  }, [flashToast]);
  const persist = useCallback((msg: string, undo?: () => void) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { const { stages: st, trans: tr } = ref.current; doSave(st, tr, msg, undo); }, 600);
  }, [doSave]);
  // Deshacer: restaura un snapshot y lo guarda.
  const undoTo = useCallback((s: Snap) => { setStages(s.stages); setTrans(s.trans); clearTimeout(saveTimer.current); doSave(s.stages, s.trans, 'Cambio deshecho'); }, [doSave]);
  const snap = (): Snap => ({ stages: ref.current.stages, trans: ref.current.trans });

  const updateScale = useCallback(() => {
    const el = canvasRef.current; if (!el) return;
    const s = Math.min(el.clientWidth, BASEW) / BASEW;
    setScale((prev) => (Math.abs(s - prev) > 0.002 ? s : prev));
  }, [BASEW]);

  const toLocal = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect(); const s = r.width / BASEW;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };
  const hitStage = (lx: number, ly: number): string | null => {
    for (const s of ref.current.stages) { const b = boxOf(s); if (lx >= b.x && lx <= b.x + CW && ly >= b.y && ly <= b.y + CH) return s.key; }
    return null;
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = ref.current.drag;
      if (pendingRef.current && !d) {
        const dx = e.clientX - pendingRef.current.sx, dy = e.clientY - pendingRef.current.sy;
        if (dx * dx + dy * dy > 36) { const p = toLocal(e); setHoverStage(null); setDrag({ tid: null, end: 'to', from: pendingRef.current.from, x: p.x, y: p.y, over: null }); }
        return;
      }
      if (d) { const p = toLocal(e); setDrag({ ...d, x: p.x, y: p.y, over: hitStage(p.x, p.y) }); }
    };
    const onUp = () => {
      const d = ref.current.drag;
      if (d) { commitDrag(d); setDrag(null); pendingRef.current = null; return; }
      if (pendingRef.current) { const id = pendingRef.current.from; pendingRef.current = null; setStageModal(id); setSelected(null); }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    window.addEventListener('resize', updateScale);
    updateScale();
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); window.removeEventListener('resize', updateScale); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateScale]);

  // ── mutaciones (cada una guarda + toast) ──
  const commitDrag = (d: NonNullable<Drag>) => {
    if (d.tid == null) { if (d.over && d.over !== d.from) addTrans(d.from!, d.over); return; }
    const t = ref.current.trans.find((x) => x.id === d.tid); if (!t) return;
    if (d.over) { const other = d.end === 'to' ? t.from : t.to; if (d.over !== other) updateTransEndpoint(d.tid, d.end, d.over); }
  };
  const addTrans = (from: string, to: string) => {
    if (from === to) return;
    if (ref.current.trans.some((t) => t.from === from && t.to === to)) return;
    const prev = snap();
    setTrans((ts) => [...ts, { id: 't' + (idc.current++), from, to, label: 'Nueva flecha', category: 'avanza' }]);
    persist('Flecha creada', () => undoTo(prev));
  };
  const updateTrans = (id: string, patch: Partial<FunnelTransition>) => { setTrans((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))); persist('Funnel guardado'); };
  const updateTransEndpoint = (id: string, end: 'from' | 'to', stage: string) => { const prev = snap(); setTrans((ts) => ts.map((t) => (t.id === id ? { ...t, [end]: stage } : t))); persist('Flecha reconectada', () => undoTo(prev)); };
  const removeTrans = (id: string) => { const prev = snap(); setTrans((ts) => ts.filter((t) => t.id !== id)); setSelected((s) => (s === id ? null : s)); persist('Flecha eliminada', () => undoTo(prev)); };
  const updateStage = (key: string, patch: Partial<Stage>) => { setStages((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s))); persist('Funnel guardado'); };
  const moveStageBand = (key: string, band: StageBand) => {
    const prev = snap();
    setStages((ss) => { const used = ss.filter((x) => x.band === band && x.key !== key).map((x) => x.col ?? 0); let col = 0; while (used.includes(col)) col++; return ss.map((s) => (s.key === key ? { ...s, band, col } : s)); });
    persist('Etapa movida', () => undoTo(prev));
  };
  const removeStage = (key: string) => { const prev = snap(); setStages((ss) => ss.filter((s) => s.key !== key)); setTrans((ts) => ts.filter((t) => t.from !== key && t.to !== key)); setHoverStage(null); setStageModal((m) => (m === key ? null : m)); persist('Etapa eliminada', () => undoTo(prev)); };
  const addStage = () => {
    const prev = snap(); const key = 's' + Date.now().toString(36);
    setStages((ss) => { const nut = ss.filter((x) => x.band === 'nutricion').length; return [...ss, { key, label: 'Nueva etapa', dot: '#6B675C', tone: 'neutral', band: 'nutricion', col: nut, custom: true }]; });
    persist('Etapa creada', () => undoTo(prev));
  };
  const resetFunnel = () => { const prev = snap(); setStages(DEFAULT_STAGES.map(withLayout)); setTrans(mkTrans(DEFAULT_TRANSITIONS)); setSelected(null); setHoverStage(null); setHoverTrans(null); setFilter('all'); persist('Funnel restablecido', () => undoTo(prev)); };

  // ── pointer en tarjetas / handles ──
  const cardDown = (s: Stage, e: RPE) => { e.stopPropagation(); pendingRef.current = { from: s.key, sx: e.clientX, sy: e.clientY }; };
  const handleDown = (t: ETrans, end: 'from' | 'to', e: RPE) => { e.stopPropagation(); pendingRef.current = null; const p = toLocal(e); setSelected(t.id); setHoverStage(null); setDrag({ tid: t.id, end, x: p.x, y: p.y, over: null }); };

  // ── geometría ──
  const P = useMemo(() => { const m: Record<string, Box> = {}; stages.forEach((s) => { m[s.key] = boxOf(s); }); return m; }, [stages, boxOf]);
  const focus = drag ? null : hoverStage;
  const matches = (t: ETrans) => filter === 'all' || t.category === filter;
  const styleFor = (t: ETrans): { op: number; w: number; label?: boolean; handles?: boolean } => {
    if (!matches(t)) return { op: 0.04, w: 1.4 };
    if (selected === t.id || hoverTrans === t.id) return { op: 1, w: 2.6, label: true, handles: true };
    if (focus) return t.from === focus || t.to === focus ? { op: 1, w: 2.4, label: true } : { op: 0.05, w: 1.4 };
    if (filter !== 'all') return { op: 0.9, w: 2.2 };
    return t.category === 'avanza' ? { op: 0.55, w: 2 } : { op: 0.34, w: 1.5 };
  };
  const geomOf = (from: string, to: string) => {
    const A = P[from], B = P[to]; if (!A || !B) return null;
    const pts = orthRoute(A, B);
    return { pts, d: pathFrom(pts), b: pts[pts.length - 1], prev: pts[pts.length - 2], mid: labelAt(pts) };
  };

  const field: CSSProperties = { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };

  const stageObj = stageModal ? stages.find((s) => s.key === stageModal) : null;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 80px', fontFamily: SANS }}>
      {/* HEADER (sin botones: guarda solo) */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Funnel</h1>
        <span style={{ fontSize: 15, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{stages.length} etapas · {trans.length} flechas</span>
      </header>

      {/* TOOLBAR: filtro + acciones */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: 4, gap: 4 }}>
          {FILTERS.map(([v, l]) => {
            const on = filter === v; const dotC = v === 'all' ? null : CATEGORY[v].c;
            return (
              <button key={v} onClick={() => setFilter(v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: on ? 600 : 500, background: on ? 'var(--ink)' : 'transparent', color: on ? '#F3F0E7' : 'var(--dim)' }}>
                {dotC && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotC }} />}{l}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowStages(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✎ Editar etapas</button>
          <button onClick={resetFunnel} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>↺ Restablecer</button>
        </div>
      </div>

      {/* CANVAS */}
      <div
        ref={(el) => { canvasRef.current = el; if (el) requestAnimationFrame(updateScale); }}
        onPointerDown={() => { if (!ref.current.drag) setSelected(null); }}
        style={{ position: 'relative', width: '100%', maxWidth: BASEW, margin: '0 auto', height: BASEH * scale, background: '#FFFFFF', border: '1px solid #E7E3D9', borderRadius: 18, overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: BASEW, height: BASEH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <svg width={BASEW} height={BASEH} viewBox={`0 0 ${BASEW} ${BASEH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
            {BANDS.map((bd, i) => { const y = ROWY[bd.band]; return (
              <g key={'ln' + i}>
                <rect x={16} y={y - 15} width={BASEW - 32} height={CH + 30} rx={13} fill={bd.tint} />
                <text x={28} y={y + CH / 2 + 1} dominantBaseline="central" fontFamily={MONO} fontSize={10.5} letterSpacing=".1em" fontWeight={600} fill="#A39E91">{bd.label.toUpperCase()}</text>
              </g>
            ); })}
            {trans.map((t) => {
              if (drag && drag.tid === t.id) return null;
              const g = geomOf(t.from, t.to); if (!g) return null;
              const st = drag ? { op: matches(t) ? 0.07 : 0.04, w: 1.5 } : styleFor(t);
              const c = CATEGORY[t.category].c;
              return (
                <g key={'a' + t.id}>
                  <path d={g.d} fill="none" stroke={c} strokeWidth={st.w} strokeOpacity={st.op} strokeLinecap="round" strokeLinejoin="round" />
                  <polygon points={arrowPoints(g.b, g.prev, st.w)} fill={c} opacity={st.op} />
                </g>
              );
            })}
          </svg>

          {stages.map((s) => {
            const b = P[s.key];
            const isFocus = focus === s.key;
            const isDrop = drag && drag.over === s.key && !(drag.tid == null && drag.from === s.key);
            let bColor = s.border || 'rgba(31,30,29,.2)', bw = '1.5px', shadow = '0 1px 2px rgba(26,24,19,.05)';
            if (isDrop) { bColor = '#3B6D11'; bw = '2px'; shadow = '0 0 0 3px rgba(59,109,17,.26)'; }
            else if (isFocus) { bColor = '#C8870C'; bw = '2px'; shadow = '0 0 0 2px rgba(200,135,12,.18)'; }
            return (
              <div key={s.key}
                onPointerDown={(e) => cardDown(s, e)}
                onPointerEnter={() => { if (!ref.current.drag) setHoverStage(s.key); }}
                onPointerLeave={() => { if (!ref.current.drag) setHoverStage(null); }}
                title="Clic para editar · arrastrá a otra etapa para conectar"
                style={{ position: 'absolute', left: b.x, top: b.y, width: CW, height: CH, background: s.bg || '#fff', border: `${bw} solid ${bColor}`, borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', boxShadow: shadow, userSelect: 'none', transition: 'box-shadow .12s, border-color .12s' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.fg || '#1A1813', lineHeight: 1.15 }}>{s.label}</span>
              </div>
            );
          })}

          <svg width={BASEW} height={BASEH} viewBox={`0 0 ${BASEW} ${BASEH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
            {trans.map((t) => {
              if (drag && drag.tid === t.id) return null;
              const g = geomOf(t.from, t.to); if (!g) return null;
              return (
                <path key={'hit' + t.id} d={g.d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onPointerEnter={() => { if (!ref.current.drag) setHoverTrans(t.id); }}
                  onPointerLeave={() => { if (!ref.current.drag) setHoverTrans(null); }}
                  onClick={(e) => { e.stopPropagation(); setSelected(t.id); }} />
              );
            })}
            {!drag && trans.map((t) => {
              const st = styleFor(t); if (!st.label) return null;
              const g = geomOf(t.from, t.to); if (!g) return null;
              const lw = t.label.length * 6.2 + 18; const c = CATEGORY[t.category].c;
              return (
                <g key={'l' + t.id} style={{ pointerEvents: 'none' }}>
                  <rect x={g.mid.x - lw / 2} y={g.mid.y - 11} width={lw} height={22} rx={6} fill="#FFFFFF" stroke={c} strokeOpacity={0.5} />
                  <text x={g.mid.x} y={g.mid.y + 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#1A1813" fontFamily={SANS}>{t.label}</text>
                </g>
              );
            })}
            {!drag && trans.map((t) => {
              const st = styleFor(t); if (!st.handles) return null;
              const g = geomOf(t.from, t.to); if (!g) return null; const c = CATEGORY[t.category].c;
              return (
                <g key={'h' + t.id}>
                  <circle cx={g.pts[0].x} cy={g.pts[0].y} r={6.5} fill="#fff" stroke={c} strokeWidth={2.5} style={{ pointerEvents: 'auto', cursor: 'grab' }} onPointerDown={(e) => handleDown(t, 'from', e)} />
                  <circle cx={g.b.x} cy={g.b.y} r={6.5} fill="#fff" stroke={c} strokeWidth={2.5} style={{ pointerEvents: 'auto', cursor: 'grab' }} onPointerDown={(e) => handleDown(t, 'to', e)} />
                </g>
              );
            })}
            {drag && (() => {
              let pts: Pt[] = [], color = '#C8870C';
              const cur = { x: drag.x, y: drag.y };
              if (drag.tid == null) { const A = P[drag.from!]; pts = drag.over && P[drag.over] ? orthRoute(A, P[drag.over]) : routeBoxPt(A, cur); }
              else { const t = trans.find((x) => x.id === drag.tid); if (t) { color = CATEGORY[t.category].c; if (drag.end === 'to') { const A = P[t.from]; pts = drag.over && P[drag.over] ? orthRoute(A, P[drag.over]) : routeBoxPt(A, cur); } else { const B = P[t.to]; pts = drag.over && P[drag.over] ? orthRoute(P[drag.over], B) : routePtBox(cur, B); } } }
              if (pts.length < 2) return null;
              const b = pts[pts.length - 1], prev = pts[pts.length - 2];
              return (<g><path d={pathFrom(pts)} fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={drag.over ? undefined : '7 6'} /><polygon points={arrowPoints(b, prev, 2.8)} fill={color} /><circle cx={b.x} cy={b.y} r={7} fill="#fff" stroke={color} strokeWidth={2.5} /></g>);
            })()}
          </svg>
        </div>
      </div>

      {/* Editor flotante de la flecha seleccionada */}
      {(() => {
        const t = trans.find((x) => x.id === selected);
        if (!t) return null;
        const c = CATEGORY[t.category].c;
        return (
          <div style={{ position: 'fixed', left: '50%', bottom: 92, transform: 'translateX(-50%)', zIndex: 70, width: 'min(700px, calc(100vw - 40px))', background: 'var(--surface)', border: '1px solid ' + c, borderRadius: 14, boxShadow: '0 16px 40px rgba(23,21,17,.22)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{labelOf(t.from)}</b>{'  →  '}<b style={{ color: 'var(--ink)', fontWeight: 600 }}>{labelOf(t.to)}</b>
              </span>
              <button onClick={() => removeTrans(t.id)} title="Eliminar flecha" style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 14, cursor: 'pointer' }}>×</button>
              <button onClick={() => setSelected(null)} title="Cerrar" style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={t.label} onChange={(e) => updateTrans(t.id, { label: e.target.value })} placeholder="Texto de la flecha" style={{ ...field, flex: '1 1 200px', minWidth: 0 }} />
              <select value={t.category} onChange={(e) => updateTrans(t.id, { category: e.target.value as TransitionCategory })} style={{ ...field, cursor: 'pointer' }}>
                {(Object.keys(CATEGORY) as TransitionCategory[]).map((k) => <option key={k} value={k}>{CATEGORY[k].label}</option>)}
              </select>
              {(['asistioJ1', 'asistioJ2'] as const).map((fld, i) => (
                <label key={fld} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Marca R{i + 1}</span>
                  <select value={t[fld] === undefined ? '' : t[fld] ? 'si' : 'no'} onChange={(e) => updateTrans(t.id, { [fld]: e.target.value === '' ? undefined : e.target.value === 'si' })} style={{ ...field, padding: '7px 8px', fontSize: 13, cursor: 'pointer' }}>
                    <option value="">—</option><option value="si">Asistió</option><option value="no">No-show</option>
                  </select>
                </label>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Modal: editar etapas (lista) */}
      {showStages && (
        <ModalShell title="Editar etapas" subtitle={`${stages.length} etapas · nombre, banda y agregar/eliminar.`} onClose={() => setShowStages(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
            {stages.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.dot, flex: 'none', boxShadow: '0 0 0 3px ' + s.dot + '22' }} />
                <input value={s.label} onChange={(e) => updateStage(s.key, { label: e.target.value })} style={{ ...field, flex: 1, minWidth: 0 }} />
                <select value={s.band ?? 'pipeline'} onChange={(e) => moveStageBand(s.key, e.target.value as StageBand)} title="Banda" style={{ ...field, flex: 'none', padding: '9px 8px', color: 'var(--dim)', fontSize: 12.5, cursor: 'pointer' }}>
                  <option value="pipeline">Pipeline</option><option value="nutricion">Nutrición</option><option value="salidas">Salidas</option>
                </select>
                <button onClick={() => removeStage(s.key)} title="Eliminar etapa" style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--faint)', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            ))}
            <button onClick={addStage} style={{ padding: 10, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>+ Agregar etapa</button>
          </div>
        </ModalShell>
      )}

      {/* Modal: editar UNA etapa (nombre, banda, conexiones + grafo aislado) */}
      {stageObj && (
        <ModalShell title={stageObj.label || 'Etapa'} subtitle="Conexiones de esta etapa, aisladas." onClose={() => setStageModal(null)} width={640}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: stageObj.dot, flex: 'none', boxShadow: '0 0 0 3px ' + stageObj.dot + '22' }} />
            <input value={stageObj.label} onChange={(e) => updateStage(stageObj.key, { label: e.target.value })} style={{ ...field, flex: 1, minWidth: 0 }} />
            <select value={stageObj.band ?? 'pipeline'} onChange={(e) => moveStageBand(stageObj.key, e.target.value as StageBand)} title="Banda" style={{ ...field, flex: 'none', padding: '9px 8px', color: 'var(--dim)', fontSize: 12.5, cursor: 'pointer' }}>
              <option value="pipeline">Pipeline</option><option value="nutricion">Nutrición</option><option value="salidas">Salidas</option>
            </select>
            <button onClick={() => removeStage(stageObj.key)} style={{ flex: 'none', padding: '9px 13px', borderRadius: 9, border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
          </div>

          <IsolatedGraph stageKey={stageObj.key} trans={trans} labelOf={labelOf} />

          <ConnPanel title="Sale hacia" dir="out" stageKey={stageObj.key} stages={stages} trans={trans}
            onAdd={(target) => addTrans(stageObj.key, target)} onRemove={removeTrans} onUpdate={updateTrans} labelOf={labelOf} field={field} />
          <ConnPanel title="Entra desde" dir="in" stageKey={stageObj.key} stages={stages} trans={trans}
            onAdd={(source) => addTrans(source, stageObj.key)} onRemove={removeTrans} onUpdate={updateTrans} labelOf={labelOf} field={field} />
        </ModalShell>
      )}

      {/* Toast (confirmación de guardado + Deshacer · 5s) */}
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, display: 'flex', alignItems: 'center', gap: 14, background: toast.bad ? '#5C2B2E' : '#171511', color: '#F3F0E7', padding: '12px 18px', borderRadius: 12, boxShadow: '0 12px 32px rgba(23,21,17,.35)', fontFamily: SANS, fontSize: 14 }}>
          <span>{toast.msg}{!toast.bad && ' ✓'}</span>
          {toast.undo && <button type="button" onClick={() => { toast.undo!(); }} style={{ background: 'transparent', border: '1px solid rgba(243,240,231,.35)', color: 'var(--accent-soft)', fontWeight: 600, fontSize: 13.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS }}>↶ Deshacer</button>}
          <button type="button" onClick={() => setToast(null)} aria-label="cerrar" style={{ background: 'transparent', border: 'none', color: 'rgba(243,240,231,.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      )}
    </main>
  );
}

// ── Modal genérico ──
function ModalShell({ title, subtitle, onClose, width = 560, children }: { title: string; subtitle?: string; onClose: () => void; width?: number; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(23,21,17,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: width, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontWeight: 600, fontSize: 21, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
            {subtitle && <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '18px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Grafo aislado: entrantes → etapa → salientes ──
function IsolatedGraph({ stageKey, trans, labelOf }: { stageKey: string; trans: ETrans[]; labelOf: (k: string) => string }) {
  const inc = trans.filter((t) => t.to === stageKey);
  const out = trans.filter((t) => t.from === stageKey);
  const rows = Math.max(inc.length, out.length, 1);
  const W = 592, NH = 30, GAP = 14, NW = 150, PADY = 16;
  const H = PADY * 2 + rows * NH + (rows - 1) * GAP;
  const cx = W / 2, cyC = H / 2;
  const leftX = 8, rightX = W - 8 - NW, centerX = cx - NW / 2;
  const colY = (n: number, i: number) => PADY + i * (NH + GAP) + (rows - n) * (NH + GAP) / 2;
  const node = (x: number, y: number, label: string, key: string, accent?: boolean) => (
    <g key={key}>
      <rect x={x} y={y} width={NW} height={NH} rx={8} fill={accent ? 'rgba(200,135,12,.10)' : '#fff'} stroke={accent ? '#C8870C' : 'rgba(31,30,29,.2)'} strokeWidth={accent ? 1.6 : 1} />
      <text x={x + NW / 2} y={y + NH / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={accent ? 600 : 500} fill="#1A1813" fontFamily={SANS}>{trunc(label, 20)}</text>
    </g>
  );
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: 8, marginBottom: 16, overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {inc.map((t, i) => { const y = colY(inc.length, i) + NH / 2; const c = CATEGORY[t.category].c; const sx = leftX + NW, ex = centerX; const mx = (sx + ex) / 2;
          return <g key={'gi' + t.id}><path d={`M ${sx} ${y} L ${mx} ${y} L ${mx} ${cyC} L ${ex} ${cyC}`} fill="none" stroke={c} strokeWidth={1.6} strokeLinejoin="round" /><polygon points={arrowPoints({ x: ex, y: cyC }, { x: mx, y: cyC }, 1.6)} fill={c} /></g>; })}
        {out.map((t, i) => { const y = colY(out.length, i) + NH / 2; const c = CATEGORY[t.category].c; const sx = centerX + NW, ex = rightX; const mx = (sx + ex) / 2;
          return <g key={'go' + t.id}><path d={`M ${sx} ${cyC} L ${mx} ${cyC} L ${mx} ${y} L ${ex} ${y}`} fill="none" stroke={c} strokeWidth={1.6} strokeLinejoin="round" /><polygon points={arrowPoints({ x: ex, y }, { x: mx, y }, 1.6)} fill={c} /></g>; })}
        {inc.map((t, i) => node(leftX, colY(inc.length, i), labelOf(t.from), 'ni' + t.id))}
        {out.map((t, i) => node(rightX, colY(out.length, i), labelOf(t.to), 'no' + t.id))}
        {node(centerX, cyC - NH / 2, labelOf(stageKey), 'center', true)}
        {inc.length === 0 && <text x={leftX + 4} y={cyC} dominantBaseline="central" fontSize={11} fill="#A39E91" fontFamily={SANS}>nadie conecta acá</text>}
        {out.length === 0 && <text x={rightX} y={cyC} dominantBaseline="central" fontSize={11} fill="#A39E91" fontFamily={SANS}>no sale a ningún lado</text>}
      </svg>
    </div>
  );
}

// ── Panel de conexiones (salientes o entrantes) ──
function ConnPanel({ title, dir, stageKey, stages, trans, onAdd, onRemove, onUpdate, labelOf, field }: {
  title: string; dir: 'in' | 'out'; stageKey: string; stages: Stage[]; trans: ETrans[];
  onAdd: (other: string) => void; onRemove: (id: string) => void; onUpdate: (id: string, p: Partial<FunnelTransition>) => void;
  labelOf: (k: string) => string; field: CSSProperties;
}) {
  const list = trans.filter((t) => (dir === 'out' ? t.from === stageKey : t.to === stageKey));
  const connected = new Set(list.map((t) => (dir === 'out' ? t.to : t.from)));
  const options = stages.filter((s) => s.key !== stageKey && !connected.has(s.key));
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', margin: '8px 0 8px' }}>{title} · {list.length}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((t) => { const c = CATEGORY[t.category].c; const other = dir === 'out' ? t.to : t.from;
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flex: 'none' }} />
              <span style={{ flex: 'none', fontSize: 12.5, color: 'var(--dim)' }}>{dir === 'out' ? '→' : '←'}</span>
              <span style={{ flex: '0 0 130px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelOf(other)}</span>
              <input value={t.label} onChange={(e) => onUpdate(t.id, { label: e.target.value })} placeholder="Texto" style={{ ...field, flex: 1, minWidth: 0, padding: '7px 9px', fontSize: 13 }} />
              <select value={t.category} onChange={(e) => onUpdate(t.id, { category: e.target.value as TransitionCategory })} style={{ ...field, flex: 'none', padding: '7px 8px', fontSize: 12.5, cursor: 'pointer' }}>
                {(Object.keys(CATEGORY) as TransitionCategory[]).map((k) => <option key={k} value={k}>{CATEGORY[k].label}</option>)}
              </select>
              <button onClick={() => onRemove(t.id)} title="Quitar conexión" style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--faint)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          );
        })}
        {options.length > 0 && (
          <select value="" onChange={(e) => { if (e.target.value) onAdd(e.target.value); }} style={{ ...field, cursor: 'pointer', color: 'var(--dim)' }}>
            <option value="">{dir === 'out' ? '+ Conectar a una etapa…' : '+ Conectar desde una etapa…'}</option>
            {options.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
