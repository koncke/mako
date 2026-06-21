'use client';

// =============================================================================
// FunnelEditor — editor visual del funnel (tab /funnel) · rediseño Claude Design
// =============================================================================
// Diagrama de flujo: nodos = etapas (en 3 bandas: Pipeline / Nutrición / Salidas),
// flechas curvas = transiciones (color por categoría). Interacciones:
//   • Hover sobre una etapa → aísla su flujo. Clic → lo fija (pin).
//   • Clic en una etapa y arrastrar a otra → crea una flecha.
//   • Arrastrar el punto (handle) de una flecha seleccionada → la reconecta.
//   • Filtro por categoría + leyenda. Paneles para editar etapas y flechas.
// Las flechas alimentan "Datos sin marcar" en el CRM (cada flecha define qué
// asistencia R1/R2 marca). Se guarda todo en funnel_config (Supabase).

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

// Geometría del lienzo (coordenadas base; se escala para entrar en el ancho).
const GUT = 92, COL = 200, CW = 170, CH = 54, BASEH = 392;
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

// Intersección del borde de la caja con la recta hacia (tx,ty).
function edge(b: Box, tx: number, ty: number): Pt {
  const dx = tx - b.cx, dy = ty - b.cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: b.cx, y: b.cy };
  const ex = Math.abs(dx) < 0.001 ? 1e9 : (b.w / 2 + 2) / Math.abs(dx);
  const ey = Math.abs(dy) < 0.001 ? 1e9 : (b.h / 2 + 2) / Math.abs(dy);
  const t = Math.min(ex, ey);
  return { x: b.cx + dx * t, y: b.cy + dy * t };
}
// Bezier en S entre dos puntos (curva horizontal o vertical según el delta dominante).
function sPath(a: Pt, b: Pt): { d: string; c2: Pt } {
  const dx = b.x - a.x, dy = b.y - a.y;
  let c1: Pt, c2: Pt;
  if (Math.abs(dy) >= Math.abs(dx)) { const my = (a.y + b.y) / 2; c1 = { x: a.x, y: my }; c2 = { x: b.x, y: my }; }
  else { const mx = (a.x + b.x) / 2; c1 = { x: mx, y: a.y }; c2 = { x: mx, y: b.y }; }
  return { d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`, c2 };
}
function arrowPoints(b: Pt, c2: Pt, w: number): string {
  const ang = Math.atan2(b.y - c2.y, b.x - c2.x), sz = 6 + w * 1.3;
  const lx = b.x - sz * Math.cos(ang - 0.5), ly = b.y - sz * Math.sin(ang - 0.5);
  const rx = b.x - sz * Math.cos(ang + 0.5), ry = b.y - sz * Math.sin(ang + 0.5);
  return `${b.x},${b.y} ${lx},${ly} ${rx},${ry}`;
}

type Drag = { tid: string | null; end: 'from' | 'to'; from?: string; x: number; y: number; over: string | null } | null;

export function FunnelEditor({
  initialStages,
  initialTransitions,
}: {
  initialStages: Stage[];
  initialTransitions: FunnelTransition[];
}) {
  const router = useRouter();
  const idc = useRef(0);
  const mkTrans = useCallback((arr: FunnelTransition[]): ETrans[] => arr.map((t) => ({ ...t, id: 't' + (idc.current++) })), []);

  const [stages, setStages] = useState<Stage[]>(() => initialStages.map(withLayout));
  const [trans, setTrans] = useState<ETrans[]>(() => mkTrans(initialTransitions));
  const [hoverStage, setHoverStage] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hoverTrans, setHoverTrans] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<TransitionCategory | 'all'>('all');
  const [drag, setDrag] = useState<Drag>(null);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<{ from: string; sx: number; sy: number } | null>(null);
  // Refs espejo para los handlers de document (evitan closures obsoletos).
  const ref = useRef({ stages, trans, drag });
  ref.current = { stages, trans, drag };

  const labelOf = (key: string) => stages.find((s) => s.key === key)?.label ?? key;

  // ── ancho dinámico (cabe la columna más a la derecha) ──
  const maxCol = stages.reduce((m, s) => Math.max(m, s.col ?? 0), 4);
  const BASEW = Math.max(1120, GUT + maxCol * COL + CW + 28);

  const boxOf = useCallback((s: Stage): Box => {
    const x = GUT + (s.col ?? 0) * COL, y = ROWY[s.band ?? 'nutricion'];
    return { x, y, cx: x + CW / 2, cy: y + CH / 2, w: CW, h: CH };
  }, []);

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

  // ── document pointer listeners (una vez) ──
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
      if (pendingRef.current) { const id = pendingRef.current.from; pendingRef.current = null; setPinned((p) => (p === id ? null : id)); setSelected(null); }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    window.addEventListener('resize', updateScale);
    updateScale();
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); window.removeEventListener('resize', updateScale); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateScale]);

  // ── mutaciones ──
  const dirty = () => { setToast(false); setErr(null); };
  const commitDrag = (d: NonNullable<Drag>) => {
    if (d.tid == null) { if (d.over && d.over !== d.from) addTrans(d.from!, d.over); return; }
    const t = ref.current.trans.find((x) => x.id === d.tid); if (!t) return;
    if (d.over) { const other = d.end === 'to' ? t.from : t.to; if (d.over !== other) updateTrans(d.tid, d.end === 'to' ? { to: d.over } : { from: d.over }); }
  };
  const addTrans = (from: string, to: string) => {
    if (from === to) return;
    setTrans((ts) => (ts.some((t) => t.from === from && t.to === to) ? ts : [...ts, { id: 't' + (idc.current++), from, to, label: 'Nueva flecha', category: 'avanza' }]));
    dirty();
  };
  const updateTrans = (id: string, patch: Partial<FunnelTransition>) => { setTrans((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))); dirty(); };
  const removeTrans = (id: string) => { setTrans((ts) => ts.filter((t) => t.id !== id)); setSelected((s) => (s === id ? null : s)); dirty(); };
  const updateStage = (key: string, patch: Partial<Stage>) => { setStages((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s))); dirty(); };
  const moveStageBand = (key: string, band: StageBand) => {
    setStages((ss) => { const used = ss.filter((x) => x.band === band && x.key !== key).map((x) => x.col ?? 0); let col = 0; while (used.includes(col)) col++; return ss.map((s) => (s.key === key ? { ...s, band, col } : s)); });
    dirty();
  };
  const removeStage = (key: string) => { setStages((ss) => ss.filter((s) => s.key !== key)); setTrans((ts) => ts.filter((t) => t.from !== key && t.to !== key)); setPinned(null); setHoverStage(null); dirty(); };
  const addStage = () => {
    const key = 's' + Date.now().toString(36);
    setStages((ss) => { const nut = ss.filter((x) => x.band === 'nutricion').length; return [...ss, { key, label: 'Nueva etapa', dot: '#6B675C', tone: 'neutral', band: 'nutricion', col: nut, custom: true }]; });
    dirty();
  };
  const resetFunnel = () => { setStages(DEFAULT_STAGES.map(withLayout)); setTrans(mkTrans(DEFAULT_TRANSITIONS)); setSelected(null); setPinned(null); setHoverStage(null); setHoverTrans(null); setFilter('all'); dirty(); };

  const onSave = () => {
    setErr(null); setSaving(true);
    const plain: FunnelTransition[] = trans.map(({ id: _id, ...t }) => t);
    (async () => {
      try { await saveFunnelAction(stages, plain); router.refresh(); setToast(true); setTimeout(() => setToast(false), 1800); }
      catch (e) { setErr('No se pudo guardar (¿falta aplicar la migración 0025?). Tus cambios siguen acá: ' + (e instanceof Error ? e.message : String(e))); }
      finally { setSaving(false); }
    })();
  };

  // ── pointer en tarjetas / handles ──
  const cardDown = (s: Stage, e: RPE) => { e.stopPropagation(); pendingRef.current = { from: s.key, sx: e.clientX, sy: e.clientY }; };
  const handleDown = (t: ETrans, end: 'from' | 'to', e: RPE) => { e.stopPropagation(); pendingRef.current = null; const p = toLocal(e); setSelected(t.id); setHoverStage(null); setDrag({ tid: t.id, end, x: p.x, y: p.y, over: null }); };

  // ── geometría de flechas ──
  const P: Record<string, Box> = {};
  stages.forEach((s) => { P[s.key] = boxOf(s); });
  const focus = drag ? null : (hoverStage || pinned);
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
    const a = edge(A, B.cx, B.cy), b = edge(B, A.cx, A.cy); const sp = sPath(a, b);
    return { a, b, d: sp.d, c2: sp.c2 };
  };

  // ── estilos ──
  const ghost: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', fontFamily: SANS };
  const field: CSSProperties = { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
  const sect: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 15 };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 80px', fontFamily: SANS }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Funnel</h1>
          <span style={{ fontSize: 15, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{stages.length} etapas · {trans.length} flechas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/leads" style={ghost}>← Volver al CRM</Link>
          <button onClick={onSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 18px', borderRadius: 11, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', boxShadow: '0 2px 8px rgba(240,198,10,.3)', opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : 'Guardar funnel'}</button>
        </div>
      </header>

      <p style={{ fontSize: 14.5, color: 'var(--dim)', margin: '0 0 18px', maxWidth: 760, lineHeight: 1.5 }}>
        Pasá el mouse sobre una etapa para <b style={{ color: 'var(--ink)', fontWeight: 600 }}>aislar su flujo</b>. Hacé clic en una etapa y arrastrá hacia otra para <b style={{ color: 'var(--ink)', fontWeight: 600 }}>crear una flecha</b>. Arrastrá el punto de una flecha seleccionada para <b style={{ color: 'var(--ink)', fontWeight: 600 }}>reconectarla</b>.
      </p>

      {err && <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13.5, fontWeight: 500, background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad)', marginBottom: 14 }}>{err}</div>}

      {/* TOOLBAR: filtro + leyenda + reset */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {(Object.keys(CATEGORY) as TransitionCategory[]).map((k) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--dim)' }}>
                <span style={{ width: 18, height: 3, borderRadius: 2, background: CATEGORY[k].c, display: 'inline-block' }} />{CATEGORY[k].label}
              </span>
            ))}
          </div>
        </div>
        <button onClick={resetFunnel} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>↺ Restablecer</button>
      </div>

      {/* CANVAS */}
      <div
        ref={(el) => { canvasRef.current = el; if (el) requestAnimationFrame(updateScale); }}
        onPointerDown={() => { if (!ref.current.drag) { setSelected(null); setPinned(null); } }}
        style={{ position: 'relative', width: '100%', maxWidth: BASEW, margin: '0 auto', height: BASEH * scale, background: '#FFFFFF', border: '1px solid #E7E3D9', borderRadius: 18, overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: BASEW, height: BASEH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {/* SVG detrás: bandas + flechas */}
          <svg width={BASEW} height={BASEH} viewBox={`0 0 ${BASEW} ${BASEH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
            {BANDS.map((bd, i) => { const y = ROWY[bd.band]; return (
              <g key={'ln' + i}>
                <rect x={16} y={y - 15} width={BASEW - 32} height={CH + 30} rx={13} fill={bd.tint} />
                <text x={30} y={y + CH / 2 + 1} dominantBaseline="central" fontFamily={MONO} fontSize={10.5} letterSpacing=".1em" fontWeight={600} fill="#A39E91">{bd.label.toUpperCase()}</text>
              </g>
            ); })}
            {trans.map((t) => {
              if (drag && drag.tid === t.id) return null;
              const g = geomOf(t.from, t.to); if (!g) return null;
              const st = drag ? { op: matches(t) ? 0.07 : 0.04, w: 1.5 } : styleFor(t);
              const c = CATEGORY[t.category].c;
              return (
                <g key={'a' + t.id}>
                  <path d={g.d} fill="none" stroke={c} strokeWidth={st.w} strokeOpacity={st.op} strokeLinecap="round" />
                  <polygon points={arrowPoints(g.b, g.c2, st.w)} fill={c} opacity={st.op} />
                </g>
              );
            })}
          </svg>

          {/* Tarjetas (HTML) */}
          {stages.map((s) => {
            const b = P[s.key];
            const isFocus = focus === s.key, isPin = pinned === s.key;
            const isDrop = drag && drag.over === s.key && !(drag.tid == null && drag.from === s.key);
            let bColor = s.border || 'rgba(31,30,29,.2)', bw = '1.5px', shadow = '0 1px 2px rgba(26,24,19,.05)';
            if (isDrop) { bColor = '#3B6D11'; bw = '2px'; shadow = '0 0 0 3px rgba(59,109,17,.26)'; }
            else if (isPin) { bColor = '#C8870C'; bw = '2px'; shadow = '0 0 0 3px rgba(200,135,12,.22)'; }
            else if (isFocus) { bColor = '#C8870C'; bw = '2px'; shadow = '0 0 0 2px rgba(200,135,12,.18)'; }
            return (
              <div key={s.key}
                onPointerDown={(e) => cardDown(s, e)}
                onPointerEnter={() => { if (!ref.current.drag) setHoverStage(s.key); }}
                onPointerLeave={() => { if (!ref.current.drag) setHoverStage(null); }}
                style={{ position: 'absolute', left: b.x, top: b.y, width: CW, height: CH, background: s.bg || '#fff', border: `${bw} solid ${bColor}`, borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'grab', boxShadow: shadow, userSelect: 'none', transition: 'box-shadow .12s, border-color .12s' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.fg || '#1A1813', lineHeight: 1.15 }}>{s.label}</span>
              </div>
            );
          })}

          {/* SVG encima: hit-areas + labels + handles + drag fantasma */}
          <svg width={BASEW} height={BASEH} viewBox={`0 0 ${BASEW} ${BASEH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
            {trans.map((t) => {
              if (drag && drag.tid === t.id) return null;
              const g = geomOf(t.from, t.to); if (!g) return null;
              return (
                <path key={'hit' + t.id} d={g.d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onPointerEnter={() => { if (!ref.current.drag) setHoverTrans(t.id); }}
                  onPointerLeave={() => { if (!ref.current.drag) setHoverTrans(null); }}
                  onClick={(e) => { e.stopPropagation(); setSelected(t.id); setPinned(null); }} />
              );
            })}
            {!drag && trans.map((t) => {
              const st = styleFor(t); if (!st.label) return null;
              const g = geomOf(t.from, t.to); if (!g) return null;
              const mx = (g.a.x + g.b.x) / 2, my = (g.a.y + g.b.y) / 2, lw = t.label.length * 6.2 + 18; const c = CATEGORY[t.category].c;
              return (
                <g key={'l' + t.id} style={{ pointerEvents: 'none' }}>
                  <rect x={mx - lw / 2} y={my - 11} width={lw} height={22} rx={6} fill="#FFFFFF" stroke={c} strokeOpacity={0.5} />
                  <text x={mx} y={my + 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#1A1813" fontFamily={SANS}>{t.label}</text>
                </g>
              );
            })}
            {!drag && trans.map((t) => {
              const st = styleFor(t); if (!st.handles) return null;
              const g = geomOf(t.from, t.to); if (!g) return null; const c = CATEGORY[t.category].c;
              return (
                <g key={'h' + t.id}>
                  <circle cx={g.a.x} cy={g.a.y} r={6.5} fill="#fff" stroke={c} strokeWidth={2.5} style={{ pointerEvents: 'auto', cursor: 'grab' }} onPointerDown={(e) => handleDown(t, 'from', e)} />
                  <circle cx={g.b.x} cy={g.b.y} r={6.5} fill="#fff" stroke={c} strokeWidth={2.5} style={{ pointerEvents: 'auto', cursor: 'grab' }} onPointerDown={(e) => handleDown(t, 'to', e)} />
                </g>
              );
            })}
            {drag && (() => {
              let aKey: string | undefined, bPt: Pt | undefined, aPt: Pt | undefined, bKey: string | undefined, color = '#C8870C';
              if (drag.tid == null) { aKey = drag.from; if (drag.over) bKey = drag.over; else bPt = { x: drag.x, y: drag.y }; }
              else { const t = trans.find((x) => x.id === drag.tid); if (t) { color = CATEGORY[t.category].c; if (drag.end === 'to') { aKey = t.from; if (drag.over) bKey = drag.over; else bPt = { x: drag.x, y: drag.y }; } else { bKey = t.to; if (drag.over) aKey = drag.over; else aPt = { x: drag.x, y: drag.y }; } } }
              const ca = aKey && P[aKey] ? { x: P[aKey].cx, y: P[aKey].cy } : aPt!; const cb = bKey && P[bKey] ? { x: P[bKey].cx, y: P[bKey].cy } : bPt!;
              const a = aKey && P[aKey] ? edge(P[aKey], cb.x, cb.y) : aPt!; const b = bKey && P[bKey] ? edge(P[bKey], ca.x, ca.y) : bPt!;
              const sp = sPath(a, b);
              return (<g><path d={sp.d} fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeDasharray={drag.over ? undefined : '7 6'} /><polygon points={arrowPoints(b, sp.c2, 2.8)} fill={color} /><circle cx={b.x} cy={b.y} r={7} fill="#fff" stroke={color} strokeWidth={2.5} /></g>);
            })()}
          </svg>
        </div>
      </div>

      {/* PANELES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 22, marginTop: 24, alignItems: 'start' }}>
        {/* Etapas */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={sect}>Etapas · {stages.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
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
        </section>

        {/* Transiciones */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={sect}>Transiciones (flechas) · {trans.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
            {trans.map((t) => {
              const sel = selected === t.id; const c = CATEGORY[t.category].c;
              return (
                <div key={t.id} onClick={() => { setSelected(t.id); setPinned(null); }} style={{ border: '1px solid ' + (sel ? c : 'var(--border)'), background: sel ? c + '0E' : 'var(--surface-2)', borderRadius: 12, padding: 13, display: 'flex', flexDirection: 'column', gap: 9, cursor: 'pointer', boxShadow: sel ? '0 0 0 2px ' + c + '22' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--dim)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{labelOf(t.from)}</b>{'  →  '}<b style={{ color: 'var(--ink)', fontWeight: 600 }}>{labelOf(t.to)}</b>
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); removeTrans(t.id); }} title="Eliminar flecha" style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--faint)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={t.label} onChange={(e) => updateTrans(t.id, { label: e.target.value })} onClick={(e) => e.stopPropagation()} style={{ ...field, flex: 1, minWidth: 0 }} />
                    <select value={t.category} onChange={(e) => updateTrans(t.id, { category: e.target.value as TransitionCategory })} onClick={(e) => e.stopPropagation()} style={{ ...field, flex: 'none', cursor: 'pointer' }}>
                      {(Object.keys(CATEGORY) as TransitionCategory[]).map((k) => <option key={k} value={k}>{CATEGORY[k].label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['asistioJ1', 'asistioJ2'] as const).map((fld, i) => (
                      <label key={fld} style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', flex: 'none' }}>Marca R{i + 1}</span>
                        <select value={t[fld] === undefined ? '' : t[fld] ? 'si' : 'no'} onChange={(e) => updateTrans(t.id, { [fld]: e.target.value === '' ? undefined : e.target.value === 'si' })} onClick={(e) => e.stopPropagation()} style={{ ...field, flex: 1, minWidth: 0, padding: '7px 8px', fontSize: 13, cursor: 'pointer' }}>
                          <option value="">—</option><option value="si">Asistió</option><option value="no">No-show</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <button onClick={() => stages[0] && stages[1] && addTrans(stages[0].key, stages[1].key)} style={{ padding: 11, borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>+ Agregar flecha</button>
          </div>
        </section>
      </div>

      <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 26 }}>Editor de funnel · &quot;Guardar funnel&quot; persiste etapas y flechas; las flechas definen las opciones de &quot;Datos sin marcar&quot;.</footer>

      {toast && <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#171511', color: '#F3F0E7', padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 12px 34px rgba(23,21,17,.32)', zIndex: 80 }}>Funnel guardado ✓</div>}
    </main>
  );
}
