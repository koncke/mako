'use client';

// =============================================================================
// FunnelEditor — editor visual del funnel (tab /funnel) · rediseño Claude Design
// =============================================================================
// Nodos = etapas en 3 bandas (Pipeline / Nutrición / Salidas). Flechas = transiciones.
//   • Ruteo ortogonal: las flechas salen y entran por ARRIBA o ABAJO de la etapa
//     (excepto entre vecinas de la misma fila → de costado) y nunca cruzan tarjetas.
//   • Hover sobre una etapa aísla su flujo. Clic en una etapa abre su pop-up.
//   • Clic + arrastrar entre etapas crea una flecha; arrastrar el handle la reconecta.
//   • TODO cambio estructural pide confirmación; al confirmar se guarda y aparece el
//     toast de 5s con "Deshacer". (funnel_config en Supabase.)

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE, type ReactNode } from 'react';
import {
  CATEGORY,
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
const BAND_IDX: Record<StageBand, number> = { pipeline: 0, nutricion: 1, salidas: 2 };
const CHAN = [(ROWY.pipeline + CH + ROWY.nutricion) / 2, (ROWY.nutricion + CH + ROWY.salidas) / 2]; // [138, 272]
const TOPCHAN = ROWY.pipeline - 22; // 22
const GAPHALF = (COL - CW) / 2; // 15
// Las bandas usan los mismos nombres que las categorías: Avanza / Nutrición / Pérdida.
const BAND_LABEL: Record<StageBand, string> = { pipeline: 'Avanza', nutricion: 'Nutrición', salidas: 'Pérdida' };
const BANDS: { band: StageBand; label: string; tint: string }[] = [
  { band: 'pipeline', label: BAND_LABEL.pipeline, tint: 'rgba(59,109,17,.055)' },
  { band: 'nutricion', label: BAND_LABEL.nutricion, tint: 'rgba(200,135,12,.06)' },
  { band: 'salidas', label: BAND_LABEL.salidas, tint: 'rgba(207,78,41,.055)' },
];
// Chevron del select (los <select> globales tienen appearance:none).
const CHEVRON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23A39E91' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const FILTERS: [TransitionCategory | 'all', string][] = [['all', 'Todas'], ['avanza', 'Avanza'], ['nutricion', 'Nutrición'], ['perdida', 'Pérdida']];

type ETrans = FunnelTransition & { id: string };
type Pt = { x: number; y: number };
type Box = { x: number; y: number; cx: number; cy: number; w: number; h: number };

// ── ruteo ortogonal por arriba/abajo, sin cruzar tarjetas ──
function routeNodes(sa: Stage, sb: Stage, A: Box, B: Box): Pt[] {
  const bi = BAND_IDX[sa.band ?? 'nutricion'], bj = BAND_IDX[sb.band ?? 'nutricion'];
  const colA = sa.col ?? 0, colB = sb.col ?? 0;
  if (bi === bj) {
    if (Math.abs(colA - colB) === 1) { const r = colB > colA; return [{ x: r ? A.x + A.w : A.x, y: A.cy }, { x: r ? B.x : B.x + B.w, y: B.cy }]; }
    const chY = bi === 0 ? TOPCHAN : CHAN[bi - 1];
    return [{ x: A.cx, y: A.y }, { x: A.cx, y: chY }, { x: B.cx, y: chY }, { x: B.cx, y: B.y }];
  }
  const down = bj > bi;
  const exitYA = down ? A.y + A.h : A.y;
  const entryYB = down ? B.y : B.y + B.h;
  if (Math.abs(bj - bi) === 1) {
    const chY = CHAN[Math.min(bi, bj)];
    return [{ x: A.cx, y: exitYA }, { x: A.cx, y: chY }, { x: B.cx, y: chY }, { x: B.cx, y: entryYB }];
  }
  const ch1 = down ? CHAN[0] : CHAN[1];
  const ch2 = down ? CHAN[1] : CHAN[0];
  const corridorX = B.cx >= A.cx ? B.x - GAPHALF : B.x + B.w + GAPHALF;
  return [{ x: A.cx, y: exitYA }, { x: A.cx, y: ch1 }, { x: corridorX, y: ch1 }, { x: corridorX, y: ch2 }, { x: B.cx, y: ch2 }, { x: B.cx, y: entryYB }];
}
function routeToCursor(A: Box, p: Pt): Pt[] { const down = p.y >= A.cy; return [{ x: A.cx, y: down ? A.y + A.h : A.y }, { x: A.cx, y: p.y }, { x: p.x, y: p.y }]; }
function pathFrom(pts: Pt[]): string { return 'M ' + pts.map((p) => `${p.x} ${p.y}`).join(' L '); }
function labelAt(pts: Pt[]): Pt {
  const seg: number[] = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); total += d; }
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) { if (half <= seg[i - 1]) { const t = seg[i - 1] ? half / seg[i - 1] : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } half -= seg[i - 1]; }
  return pts[Math.floor(pts.length / 2)];
}
function arrowPoints(b: Pt, prev: Pt, w: number): string {
  const ang = Math.atan2(b.y - prev.y, b.x - prev.x), sz = 6 + w * 1.3;
  const lx = b.x - sz * Math.cos(ang - 0.5), ly = b.y - sz * Math.sin(ang - 0.5);
  const rx = b.x - sz * Math.cos(ang + 0.5), ry = b.y - sz * Math.sin(ang + 0.5);
  return `${b.x},${b.y} ${lx},${ly} ${rx},${ry}`;
}

type Drag = { tid: string | null; end: 'from' | 'to'; from?: string; x: number; y: number; over: string | null } | null;
type Snap = { stages: Stage[]; trans: ETrans[] };
type Confirm = { msg: string; apply: () => void } | null;

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
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; bad?: boolean } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<{ from: string; sx: number; sy: number } | null>(null);
  const ref = useRef({ stages, trans, drag });
  ref.current = { stages, trans, drag };
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stageByKey = useMemo(() => { const m: Record<string, Stage> = {}; stages.forEach((s) => { m[s.key] = s; }); return m; }, [stages]);
  const labelOf = (key: string) => stageByKey[key]?.label ?? key;
  const maxCol = stages.reduce((m, s) => Math.max(m, s.col ?? 0), 4);
  const BASEW = Math.max(1120, GUT + maxCol * COL + CW + 28);

  const boxOf = useCallback((s: Stage): Box => {
    const x = GUT + (s.col ?? 0) * COL, y = ROWY[s.band ?? 'nutricion'];
    return { x, y, cx: x + CW / 2, cy: y + CH / 2, w: CW, h: CH };
  }, []);
  const P = useMemo(() => { const m: Record<string, Box> = {}; stages.forEach((s) => { m[s.key] = boxOf(s); }); return m; }, [stages, boxOf]);

  // ── guardado + toast (5s, con Deshacer) ──
  const plain = (tr: ETrans[]): FunnelTransition[] => tr.map(({ id: _id, ...t }) => t);
  const flashToast = useCallback((msg: string, undo?: () => void, bad?: boolean) => {
    setToast({ msg, undo, bad });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  // Guarda en segundo plano (debounce). Si falla, re-muestra el toast con el aviso
  // de migración (manteniendo "Deshacer").
  const bgSave = useCallback((st: Stage[], tr: ETrans[], undo?: () => void) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveFunnelAction(st, plain(tr)).catch(() => flashToast('No se pudo guardar — aplicá la migración 0025 en Supabase', undo, true));
    }, 500);
  }, [flashToast]);
  // El toast (con Deshacer y su cuenta de 5s) aparece YA al confirmar el cambio;
  // el guardado va por detrás.
  const persist = useCallback((msg: string, undo?: () => void) => {
    flashToast(msg, undo);
    const { stages: st, trans: tr } = ref.current;
    bgSave(st, tr, undo);
  }, [flashToast, bgSave]);
  const undoTo = useCallback((s: Snap) => { setStages(s.stages); setTrans(s.trans); flashToast('Cambio deshecho'); bgSave(s.stages, s.trans); }, [flashToast, bgSave]);
  const snap = (): Snap => ({ stages: ref.current.stages, trans: ref.current.trans });
  const ask = (msg: string, apply: () => void) => setConfirm({ msg, apply });

  const updateScale = useCallback(() => {
    const el = canvasRef.current; if (!el) return;
    const s = Math.min(el.clientWidth, BASEW) / BASEW;
    setScale((prev) => (Math.abs(s - prev) > 0.002 ? s : prev));
  }, [BASEW]);
  const toLocal = (e: { clientX: number; clientY: number }): Pt => { const r = canvasRef.current!.getBoundingClientRect(); const s = r.width / BASEW; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; };
  const hitStage = (lx: number, ly: number): string | null => { for (const s of ref.current.stages) { const b = boxOf(s); if (lx >= b.x && lx <= b.x + CW && ly >= b.y && ly <= b.y + CH) return s.key; } return null; };

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

  // ── appliers (mutan + guardan + toast) ──
  const addTrans = (from: string, to: string) => {
    if (from === to || ref.current.trans.some((t) => t.from === from && t.to === to)) return;
    const prev = snap();
    setTrans((ts) => [...ts, { id: 't' + (idc.current++), from, to, label: 'Nueva flecha', category: 'avanza' }]);
    persist('Flecha creada', () => undoTo(prev));
  };
  const removeTrans = (id: string) => { const prev = snap(); setTrans((ts) => ts.filter((t) => t.id !== id)); setSelected((s) => (s === id ? null : s)); persist('Flecha eliminada', () => undoTo(prev)); };
  const updateTransEndpoint = (id: string, end: 'from' | 'to', stage: string) => { const prev = snap(); setTrans((ts) => ts.map((t) => (t.id === id ? { ...t, [end]: stage } : t))); persist('Flecha reconectada', () => undoTo(prev)); };
  const moveStageBand = (key: string, band: StageBand) => { const prev = snap(); setStages((ss) => { const used = ss.filter((x) => x.band === band && x.key !== key).map((x) => x.col ?? 0); let col = 0; while (used.includes(col)) col++; return ss.map((s) => (s.key === key ? { ...s, band, col } : s)); }); persist('Etapa movida', () => undoTo(prev)); };
  const removeStage = (key: string) => { const prev = snap(); setStages((ss) => ss.filter((s) => s.key !== key)); setTrans((ts) => ts.filter((t) => t.from !== key && t.to !== key)); setHoverStage(null); setStageModal((m) => (m === key ? null : m)); persist('Etapa eliminada', () => undoTo(prev)); };
  const addStage = () => { const prev = snap(); const key = 's' + Date.now().toString(36); setStages((ss) => { const nut = ss.filter((x) => x.band === 'nutricion').length; return [...ss, { key, label: 'Nueva etapa', dot: '#6B675C', tone: 'neutral', band: 'nutricion', col: nut, custom: true }]; }); persist('Etapa creada', () => undoTo(prev)); };
  // edits sin confirmación (texto / categoría / asistencia)
  const updateTrans = (id: string, patch: Partial<FunnelTransition>) => { setTrans((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))); persist('Funnel guardado'); };
  const updateStage = (key: string, patch: Partial<Stage>) => { setStages((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s))); persist('Funnel guardado'); };

  // ── triggers con confirmación ──
  const reqAddTrans = (from: string, to: string) => { if (from === to || ref.current.trans.some((t) => t.from === from && t.to === to)) return; ask(`Crear flecha "${labelOf(from)}" → "${labelOf(to)}"`, () => addTrans(from, to)); };
  const reqRemoveTrans = (id: string) => { const t = ref.current.trans.find((x) => x.id === id); if (!t) return; ask(`Eliminar flecha "${labelOf(t.from)}" → "${labelOf(t.to)}"`, () => removeTrans(id)); };
  const reqReconnect = (id: string, end: 'from' | 'to', stage: string) => ask('Reconectar la flecha', () => updateTransEndpoint(id, end, stage));
  const reqRemoveStage = (key: string) => ask(`Eliminar la etapa "${labelOf(key)}" y sus flechas`, () => removeStage(key));
  const reqAddStage = () => ask('Crear una nueva etapa', () => addStage());
  const reqMoveBand = (key: string, band: StageBand) => ask(`Mover "${labelOf(key)}" a ${BAND_LABEL[band]}`, () => moveStageBand(key, band));

  const commitDrag = (d: NonNullable<Drag>) => {
    if (d.tid == null) { if (d.over && d.over !== d.from) reqAddTrans(d.from!, d.over); return; }
    const t = ref.current.trans.find((x) => x.id === d.tid); if (!t) return;
    if (d.over) { const other = d.end === 'to' ? t.from : t.to; if (d.over !== other) reqReconnect(d.tid, d.end, d.over); }
  };

  const cardDown = (s: Stage, e: RPE) => { e.stopPropagation(); pendingRef.current = { from: s.key, sx: e.clientX, sy: e.clientY }; };
  const handleDown = (t: ETrans, end: 'from' | 'to', e: RPE) => { e.stopPropagation(); pendingRef.current = null; const p = toLocal(e); setSelected(t.id); setHoverStage(null); setDrag({ tid: t.id, end, x: p.x, y: p.y, over: null }); };

  // ── geometría ──
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
    const A = P[from], B = P[to], sa = stageByKey[from], sb = stageByKey[to]; if (!A || !B || !sa || !sb) return null;
    const pts = routeNodes(sa, sb, A, B);
    return { pts, d: pathFrom(pts), b: pts[pts.length - 1], prev: pts[pts.length - 2], mid: labelAt(pts) };
  };

  const field: CSSProperties = { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
  const selectStyle: CSSProperties = { ...field, appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("${CHEVRON}")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28, cursor: 'pointer' };
  const stageObj = stageModal ? stageByKey[stageModal] : null;
  // Etapas relacionadas a la que tiene hover (para atenuar el resto).
  const related = focus ? new Set<string>([focus, ...trans.filter((t) => t.from === focus).map((t) => t.to), ...trans.filter((t) => t.to === focus).map((t) => t.from)]) : null;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 80px', fontFamily: SANS }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Funnel</h1>
        <span style={{ fontSize: 15, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{stages.length} etapas · {trans.length} flechas</span>
      </header>

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
        <button onClick={() => setShowStages(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✎ Editar etapas</button>
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
                style={{ position: 'absolute', left: b.x, top: b.y, width: CW, height: CH, background: s.bg || '#fff', border: `${bw} solid ${bColor}`, borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', boxShadow: shadow, userSelect: 'none', opacity: related && !related.has(s.key) ? 0.12 : 1, transition: 'box-shadow .12s, border-color .12s, opacity .12s' }}>
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
              let pts: Pt[] = [], color = '#C8870C'; const cur = { x: drag.x, y: drag.y };
              if (drag.tid == null) { const sa = stageByKey[drag.from!]; pts = drag.over && P[drag.over] ? routeNodes(sa, stageByKey[drag.over], P[drag.from!], P[drag.over]) : routeToCursor(P[drag.from!], cur); }
              else { const t = trans.find((x) => x.id === drag.tid); if (t) { color = CATEGORY[t.category].c; if (drag.end === 'to') { pts = drag.over && P[drag.over] ? routeNodes(stageByKey[t.from], stageByKey[drag.over], P[t.from], P[drag.over]) : routeToCursor(P[t.from], cur); } else { pts = drag.over && P[drag.over] ? routeNodes(stageByKey[drag.over], stageByKey[t.to], P[drag.over], P[t.to]) : routeToCursor(P[t.to], cur); } } }
              if (pts.length < 2) return null;
              const b = pts[pts.length - 1], prev = pts[pts.length - 2];
              return (<g><path d={pathFrom(pts)} fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={drag.over ? undefined : '7 6'} /><polygon points={arrowPoints(b, prev, 2.8)} fill={color} /><circle cx={b.x} cy={b.y} r={7} fill="#fff" stroke={color} strokeWidth={2.5} /></g>);
            })()}
          </svg>
        </div>
      </div>

      {/* Editor flotante de la flecha seleccionada */}
      {(() => {
        const t = trans.find((x) => x.id === selected); if (!t) return null;
        const c = CATEGORY[t.category].c;
        return (
          <div style={{ position: 'fixed', left: '50%', bottom: 92, transform: 'translateX(-50%)', zIndex: 70, width: 'min(700px, calc(100vw - 40px))', background: 'var(--surface)', border: '1px solid ' + c, borderRadius: 14, boxShadow: '0 16px 40px rgba(23,21,17,.22)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{labelOf(t.from)}</b>{'  →  '}<b style={{ color: 'var(--ink)', fontWeight: 600 }}>{labelOf(t.to)}</b></span>
              <button onClick={() => reqRemoveTrans(t.id)} title="Eliminar flecha" style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 14, cursor: 'pointer' }}>×</button>
              <button onClick={() => setSelected(null)} title="Cerrar" style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={t.label} onChange={(e) => updateTrans(t.id, { label: e.target.value })} placeholder="Texto de la flecha" style={{ ...field, flex: '1 1 200px', minWidth: 0 }} />
              <select value={t.category} onChange={(e) => updateTrans(t.id, { category: e.target.value as TransitionCategory })} style={selectStyle}>
                {(Object.keys(CATEGORY) as TransitionCategory[]).map((k) => <option key={k} value={k}>{CATEGORY[k].label}</option>)}
              </select>
              {(['asistioJ1', 'asistioJ2'] as const).map((fld, i) => (
                <label key={fld} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Marca R{i + 1}</span>
                  <select value={t[fld] === undefined ? '' : t[fld] ? 'si' : 'no'} onChange={(e) => updateTrans(t.id, { [fld]: e.target.value === '' ? undefined : e.target.value === 'si' })} style={{ ...selectStyle, padding: '7px 24px 7px 8px', fontSize: 13 }}>
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
                <select value={s.band ?? 'pipeline'} onChange={(e) => reqMoveBand(s.key, e.target.value as StageBand)} title="Banda" style={{ ...selectStyle, flex: 'none', color: 'var(--dim)', fontSize: 12.5 }}>
                  <option value="pipeline">{BAND_LABEL.pipeline}</option><option value="nutricion">{BAND_LABEL.nutricion}</option><option value="salidas">{BAND_LABEL.salidas}</option>
                </select>
                <button onClick={() => reqRemoveStage(s.key)} title="Eliminar etapa" style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--faint)', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            ))}
            <button onClick={reqAddStage} style={{ padding: 10, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>+ Agregar etapa</button>
          </div>
        </ModalShell>
      )}

      {/* Modal: editar UNA etapa (nombre, banda, conexiones gráficas) */}
      {stageObj && (
        <ModalShell title={stageObj.label || 'Etapa'} subtitle="Quitá un vínculo con la ✕ de cada etapa; agregá con los nodos punteados." onClose={() => setStageModal(null)} width={860}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: stageObj.dot, flex: 'none', boxShadow: '0 0 0 3px ' + stageObj.dot + '22' }} />
            <input value={stageObj.label} onChange={(e) => updateStage(stageObj.key, { label: e.target.value })} style={{ ...field, flex: 1, minWidth: 0 }} />
            <select value={stageObj.band ?? 'pipeline'} onChange={(e) => reqMoveBand(stageObj.key, e.target.value as StageBand)} title="Banda" style={{ ...selectStyle, flex: 'none', color: 'var(--dim)', fontSize: 12.5 }}>
              <option value="pipeline">{BAND_LABEL.pipeline}</option><option value="nutricion">{BAND_LABEL.nutricion}</option><option value="salidas">{BAND_LABEL.salidas}</option>
            </select>
            <button onClick={() => reqRemoveStage(stageObj.key)} style={{ flex: 'none', padding: '9px 13px', borderRadius: 9, border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
          </div>
          <StageConnGraph stageKey={stageObj.key} stages={stages} trans={trans} labelOf={labelOf}
            onRemove={reqRemoveTrans} onAddOut={(to) => reqAddTrans(stageObj.key, to)} onAddIn={(from) => reqAddTrans(from, stageObj.key)} />
        </ModalShell>
      )}

      {/* Confirmación (antes de aplicar cualquier cambio estructural) */}
      {confirm && (
        <div onClick={() => setConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(23,21,17,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(23,21,17,.35)', padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Confirmar cambio</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>{confirm.msg}.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
              <button onClick={() => { const a = confirm.apply; setConfirm(null); a(); }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast (guardado + Deshacer · 5s) */}
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

// ── Grafo interactivo de conexiones de una etapa (aislada) ──
function StageConnGraph({ stageKey, stages, trans, labelOf, onRemove, onAddOut, onAddIn }: {
  stageKey: string; stages: Stage[]; trans: ETrans[]; labelOf: (k: string) => string;
  onRemove: (id: string) => void; onAddOut: (to: string) => void; onAddIn: (from: string) => void;
}) {
  const inc = trans.filter((t) => t.to === stageKey);
  const out = trans.filter((t) => t.from === stageKey);
  const incSet = new Set(inc.map((t) => t.from));
  const outSet = new Set(out.map((t) => t.to));
  const incOpts = stages.filter((s) => s.key !== stageKey && !incSet.has(s.key));
  const outOpts = stages.filter((s) => s.key !== stageKey && !outSet.has(s.key));
  const W = 632, NW = 176, NH = 36, GAP = 16, PADY = 22, COLX = { left: 10, right: W - 10 - NW };
  const centerX = (W - NW) / 2;
  const rowsL = inc.length + (incOpts.length ? 1 : 0);
  const rowsR = out.length + (outOpts.length ? 1 : 0);
  const rows = Math.max(rowsL, rowsR, 1);
  const H = PADY * 2 + rows * NH + (rows - 1) * GAP;
  const cyC = H / 2;
  // y central del item i dentro de una columna de n elementos (centrada en H).
  const yAt = (n: number, i: number) => PADY + i * (NH + GAP) + (rows - n) * (NH + GAP) / 2 + NH / 2;

  // Escala a-medida: el grafo nunca desborda (no hay barra horizontal).
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [sc, setSc] = useState(1);
  useEffect(() => { const el = wrapRef.current; if (!el) return; const upd = () => setSc(Math.min(1, el.clientWidth / W)); upd(); const ro = new ResizeObserver(upd); ro.observe(el); return () => ro.disconnect(); }, [W]);

  const nodeBox: CSSProperties = { position: 'absolute', width: NW, height: NH, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', fontSize: 12, fontWeight: 600, lineHeight: 1.1, textAlign: 'center' };
  const xBtn: CSSProperties = { position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, padding: 0, boxShadow: '0 1px 3px rgba(23,21,17,.15)' };

  const connNode = (key: string, x: number, y: number, label: string, color: string, tid: string) => (
    <div key={key} style={{ ...nodeBox, left: x, top: y, background: '#fff', border: '1px solid ' + color, color: '#1A1813' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trunc(label, 20)}</span>
      <button onClick={() => onRemove(tid)} title="Quitar vínculo" style={xBtn}>×</button>
    </div>
  );
  const addNode = (x: number, y: number, text: string, opts: Stage[], onPick: (k: string) => void) => (
    <div style={{ position: 'absolute', left: x, top: y, width: NW, height: NH }}>
      <div style={{ ...nodeBox, position: 'relative', width: NW, height: NH, border: '1px dashed var(--border-strong)', color: 'var(--dim)', background: 'transparent', fontWeight: 500 }}>{text}</div>
      <select value="" onChange={(e) => { if (e.target.value) onPick(e.target.value); }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: NW, height: NH }}>
        <option value="">{text}</option>{opts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: 8, width: '100%', marginBottom: 4 }}>
      <div ref={wrapRef} style={{ width: '100%', height: H * sc, overflow: 'hidden' }}>
        <div style={{ position: 'relative', width: W, height: H, transform: `scale(${sc})`, transformOrigin: 'top left' }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {inc.map((t, i) => { const y = yAt(rowsL, i); const c = CATEGORY[t.category].c; const sx = COLX.left + NW, ex = centerX, mx = (sx + ex) / 2;
              return <g key={'gi' + t.id}><path d={`M ${sx} ${y} L ${mx} ${y} L ${mx} ${cyC} L ${ex} ${cyC}`} fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /><polygon points={arrowPoints({ x: ex, y: cyC }, { x: mx, y: cyC }, 1.7)} fill={c} /></g>; })}
            {out.map((t, i) => { const y = yAt(rowsR, i); const c = CATEGORY[t.category].c; const sx = centerX + NW, ex = COLX.right, mx = (sx + ex) / 2;
              return <g key={'go' + t.id}><path d={`M ${sx} ${cyC} L ${mx} ${cyC} L ${mx} ${y} L ${ex} ${y}`} fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /><polygon points={arrowPoints({ x: ex, y }, { x: mx, y }, 1.7)} fill={c} /></g>; })}
          </svg>
          <div style={{ ...nodeBox, left: centerX, top: cyC - NH / 2, background: 'rgba(200,135,12,.10)', border: '1.6px solid #C8870C', color: '#1A1813' }}>{trunc(labelOf(stageKey), 22)}</div>
          {inc.map((t, i) => connNode('ni' + t.id, COLX.left, yAt(rowsL, i) - NH / 2, labelOf(t.from), CATEGORY[t.category].c, t.id))}
          {incOpts.length > 0 && addNode(COLX.left, yAt(rowsL, inc.length) - NH / 2, '+ Vincular entrada…', incOpts, onAddIn)}
          {out.map((t, i) => connNode('no' + t.id, COLX.right, yAt(rowsR, i) - NH / 2, labelOf(t.to), CATEGORY[t.category].c, t.id))}
          {outOpts.length > 0 && addNode(COLX.right, yAt(rowsR, out.length) - NH / 2, '+ Vincular salida…', outOpts, onAddOut)}
        </div>
      </div>
    </div>
  );
}

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
