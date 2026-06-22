'use client';

// =============================================================================
// FunnelEditor — configuración del funnel (tab /funnel)
// =============================================================================
// Filosofía: el usuario conoce su pipeline al dedillo, pero deja la nutrición
// "abierta". Por eso NO le pedimos que dibuje flechas: edita una LISTA simple
// (nombre, banda, orden) y elige a dónde puede ir cada etapa con un desplegable;
// la categoría/color se deriva sola de la banda destino. La nutrición se la
// SUGERIMOS nosotros (panel destacado), lista para enganchar mensajes
// automáticos de WhatsApp/Email más adelante.
//   • Arriba: mapa de SOLO LECTURA del funnel (hover para resaltar un flujo).
//   • Plantillas para arrancar sin configurar nada.
//   • Autoguardado con toast de 5s + "Deshacer".  (funnel_config en Supabase.)

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CATEGORY,
  bandToCategory,
  withLayout,
  DEFAULT_STAGES,
  NUTRITION_SUGGESTIONS,
  FUNNEL_TEMPLATES,
  type Stage,
  type StageBand,
  type FunnelTransition,
} from '@/lib/pipeline';
import { saveFunnelAction } from '../leads/actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// Geometría del mapa de solo lectura (3 bandas, etapas en columnas).
const GUT = 130, COL = 200, CW = 170, CH = 54, BASEH = 392;
const ROWY: Record<StageBand, number> = { pipeline: 44, nutricion: 178, salidas: 312 };
const BAND_IDX: Record<StageBand, number> = { pipeline: 0, nutricion: 1, salidas: 2 };
const CHAN = [(ROWY.pipeline + CH + ROWY.nutricion) / 2, (ROWY.nutricion + CH + ROWY.salidas) / 2];
const TOPCHAN = ROWY.pipeline - 22;
const GAPHALF = (COL - CW) / 2;
const BAND_LABEL: Record<StageBand, string> = { pipeline: 'Avanza', nutricion: 'Nutrición', salidas: 'Pérdida' };
const BAND_TINT: Record<StageBand, string> = { pipeline: 'rgba(59,109,17,.055)', nutricion: 'rgba(200,135,12,.06)', salidas: 'rgba(207,78,41,.055)' };
const BAND_ACCENT: Record<StageBand, string> = { pipeline: CATEGORY.avanza.c, nutricion: CATEGORY.nutricion.c, salidas: CATEGORY.perdida.c };
const BAND_ORDER: StageBand[] = ['pipeline', 'nutricion', 'salidas'];
const CHEVRON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23A39E91' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

type ETrans = FunnelTransition & { id: string };
type Pt = { x: number; y: number };
type Box = { x: number; y: number; cx: number; cy: number; w: number; h: number };
type Snap = { stages: Stage[]; trans: ETrans[] };
type Confirm = { msg: string; apply: () => void } | null;

// ── ruteo ortogonal por arriba/abajo, sin cruzar tarjetas (solo dibujo) ──
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
  const [flash, setFlash] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; bad?: boolean } | null>(null);
  const [scale, setScale] = useState(1);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const ref = useRef({ stages, trans });
  ref.current = { stages, trans };
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stageByKey = useMemo(() => { const m: Record<string, Stage> = {}; stages.forEach((s) => { m[s.key] = s; }); return m; }, [stages]);
  const labelOf = (key: string) => stageByKey[key]?.label ?? key;
  const maxCol = stages.reduce((m, s) => Math.max(m, s.col ?? 0), 4);
  const BASEW = Math.max(1120, GUT + maxCol * COL + CW + 28);

  // ── guardado en segundo plano + toast (5s, con Deshacer) ──
  const plain = (tr: ETrans[]): FunnelTransition[] => tr.map(({ id: _id, ...t }) => t);
  const flashToast = useCallback((msg: string, undo?: () => void, bad?: boolean) => {
    setToast({ msg, undo, bad });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  // El debounce lee el estado FRESCO al disparar (no el capturado), así no se
  // guarda un snapshot previo a la mutación.
  const bgSave = useCallback((undo?: () => void) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { stages: st, trans: tr } = ref.current;
      saveFunnelAction(st, plain(tr)).catch(() => flashToast('No se pudo guardar — aplicá la migración 0025 en Supabase', undo, true));
    }, 500);
  }, [flashToast]);
  const persist = useCallback((msg: string, undo?: () => void) => { flashToast(msg, undo); bgSave(undo); }, [flashToast, bgSave]);
  const undoTo = useCallback((s: Snap) => { setStages(s.stages); setTrans(s.trans); flashToast('Cambio deshecho'); bgSave(); }, [flashToast, bgSave]);
  const snap = (): Snap => ({ stages: ref.current.stages, trans: ref.current.trans });
  const ask = (msg: string, apply: () => void) => setConfirm({ msg, apply });

  // ── escala del mapa (cabe sin scroll horizontal) ──
  const updateScale = useCallback(() => {
    const el = canvasRef.current; if (!el) return;
    const s = Math.min(el.clientWidth, BASEW) / BASEW;
    setScale((prev) => (Math.abs(s - prev) > 0.002 ? s : prev));
  }, [BASEW]);
  useEffect(() => { window.addEventListener('resize', updateScale); updateScale(); return () => window.removeEventListener('resize', updateScale); }, [updateScale]);

  // ── geometría del mapa ──
  const boxOf = useCallback((s: Stage): Box => {
    const x = GUT + (s.col ?? 0) * COL, y = ROWY[s.band ?? 'nutricion'];
    return { x, y, cx: x + CW / 2, cy: y + CH / 2, w: CW, h: CH };
  }, []);
  const P = useMemo(() => { const m: Record<string, Box> = {}; stages.forEach((s) => { m[s.key] = boxOf(s); }); return m; }, [stages, boxOf]);
  const geomOf = (from: string, to: string) => {
    const A = P[from], B = P[to], sa = stageByKey[from], sb = stageByKey[to]; if (!A || !B || !sa || !sb) return null;
    const pts = routeNodes(sa, sb, A, B);
    return { pts, d: pathFrom(pts), b: pts[pts.length - 1], prev: pts[pts.length - 2], mid: labelAt(pts) };
  };
  const focus = hoverStage;
  const related = focus ? new Set<string>([focus, ...trans.filter((t) => t.from === focus).map((t) => t.to), ...trans.filter((t) => t.to === focus).map((t) => t.from)]) : null;
  const styleFor = (t: ETrans): { op: number; w: number; label: boolean } => {
    if (focus) return t.from === focus || t.to === focus ? { op: 1, w: 2.4, label: true } : { op: 0.05, w: 1.4, label: false };
    return t.category === 'avanza' ? { op: 0.6, w: 2, label: false } : { op: 0.4, w: 1.6, label: false };
  };

  // ── mutaciones (todas: mutan + autoguardan + toast con Deshacer) ──
  const setStageField = (key: string, patch: Partial<Stage>) => setStages((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const commitStage = (msg = 'Guardado') => persist(msg);

  const setBand = (key: string, band: StageBand) => {
    const prev = snap();
    setStages((ss) => { const used = ss.filter((x) => x.band === band && x.key !== key).map((x) => x.col ?? 0); let col = 0; while (used.includes(col)) col++; return ss.map((s) => (s.key === key ? { ...s, band, col } : s)); });
    persist('Etapa movida de banda', () => undoTo(prev));
  };
  const moveStage = (key: string, dir: -1 | 1) => {
    const s = stageByKey[key]; if (!s) return;
    const sibs = stages.filter((x) => x.band === s.band).sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
    const i = sibs.findIndex((x) => x.key === key), j = i + dir; if (j < 0 || j >= sibs.length) return;
    const a = sibs[i], b = sibs[j], prev = snap();
    setStages((ss) => ss.map((x) => (x.key === a.key ? { ...x, col: b.col ?? 0 } : x.key === b.key ? { ...x, col: a.col ?? 0 } : x)));
    persist('Orden actualizado', () => undoTo(prev));
  };
  const addStage = (band: StageBand) => {
    const prev = snap();
    const key = 's' + Date.now().toString(36);
    const col = stages.filter((x) => x.band === band).length;
    setStages((ss) => [...ss, withLayout({ key, label: 'Nueva etapa', dot: '#6B675C', tone: 'neutral', band, col, custom: true })]);
    persist('Etapa creada', () => undoTo(prev));
  };
  const removeStage = (key: string) => {
    const prev = snap();
    setStages((ss) => ss.filter((s) => s.key !== key));
    setTrans((ts) => ts.filter((t) => t.from !== key && t.to !== key));
    setHoverStage(null);
    persist('Etapa eliminada', () => undoTo(prev));
  };
  const addTransition = (from: string, to: string) => {
    if (from === to || ref.current.trans.some((t) => t.from === from && t.to === to)) return;
    const prev = snap();
    const cat = bandToCategory(stageByKey[to]?.band);
    setTrans((ts) => [...ts, { id: 't' + (idc.current++), from, to, label: stageByKey[to]?.label ?? to, category: cat }]);
    persist('Camino agregado', () => undoTo(prev));
  };
  const removeTransition = (id: string) => {
    const prev = snap();
    setTrans((ts) => ts.filter((t) => t.id !== id));
    persist('Camino quitado', () => undoTo(prev));
  };
  const addSuggestion = (sug: FunnelTransition) => {
    const prev = snap();
    if (!ref.current.stages.some((s) => s.key === sug.to)) {
      const def = DEFAULT_STAGES.find((s) => s.key === sug.to);
      if (def) setStages((ss) => [...ss, withLayout({ ...def, col: ss.filter((x) => x.band === def.band).length })]);
    }
    setTrans((ts) => (ts.some((t) => t.from === sug.from && t.to === sug.to) ? ts : [...ts, { ...sug, id: 't' + (idc.current++) }]));
    persist('Nutrición agregada', () => undoTo(prev));
  };
  const applyTemplate = (id: string) => {
    const tpl = FUNNEL_TEMPLATES.find((t) => t.id === id); if (!tpl) return;
    const prev = snap();
    ask(`Reemplazar tu funnel por la plantilla "${tpl.name}"`, () => {
      setStages(tpl.stages.map((s) => withLayout({ ...s })));
      setTrans(mkTrans(tpl.transitions));
      setShowTemplates(false);
      persist('Plantilla aplicada', () => undoTo(prev));
    });
  };

  const goToRow = (key: string) => {
    const el = document.getElementById('frow-' + key);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(key);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash((f) => (f === key ? null : f)), 1300);
  };

  // ── estilos compartidos ──
  const field: CSSProperties = { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
  const selectStyle: CSSProperties = { ...field, appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("${CHEVRON}")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28, cursor: 'pointer' };
  const iconBtn: CSSProperties = { flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--faint)', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };

  const suggestions = NUTRITION_SUGGESTIONS.filter((s) => stageByKey[s.from] && !trans.some((t) => t.from === s.from && t.to === s.to));

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 90px', fontFamily: SANS }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Funnel</h1>
          <p style={{ fontSize: 14.5, color: 'var(--dim)', margin: '10px 0 0', maxWidth: 640, lineHeight: 1.5 }}>
            Así avanza un lead por tu negocio. Tu pipeline lo conocés de memoria; la <b style={{ color: 'var(--ink)', fontWeight: 600 }}>nutrición</b> te la sugerimos nosotros — y queda lista para mensajes automáticos.
          </p>
        </div>
        <button onClick={() => setShowTemplates(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>▦ Plantillas</button>
      </header>

      {/* MAPA (solo lectura) */}
      <div
        ref={(el) => { canvasRef.current = el; if (el) requestAnimationFrame(updateScale); }}
        style={{ position: 'relative', width: '100%', maxWidth: BASEW, margin: '18px auto 0', height: BASEH * scale, background: '#FFFFFF', border: '1px solid #E7E3D9', borderRadius: 18, overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: BASEW, height: BASEH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <svg width={BASEW} height={BASEH} viewBox={`0 0 ${BASEW} ${BASEH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
            {BAND_ORDER.map((band, i) => { const y = ROWY[band]; return (
              <g key={'ln' + i}>
                <rect x={16} y={y - 15} width={BASEW - 32} height={CH + 30} rx={13} fill={BAND_TINT[band]} />
                <text x={28} y={y + CH / 2 + 1} dominantBaseline="central" fontFamily={MONO} fontSize={10.5} letterSpacing=".1em" fontWeight={600} fill="#A39E91">{BAND_LABEL[band].toUpperCase()}</text>
              </g>
            ); })}
            {trans.map((t) => {
              const g = geomOf(t.from, t.to); if (!g) return null;
              const st = styleFor(t); const c = CATEGORY[t.category].c;
              return (
                <g key={'a' + t.id}>
                  <path d={g.d} fill="none" stroke={c} strokeWidth={st.w} strokeOpacity={st.op} strokeLinecap="round" strokeLinejoin="round" />
                  <polygon points={arrowPoints(g.b, g.prev, st.w)} fill={c} opacity={st.op} />
                </g>
              );
            })}
            {focus && trans.map((t) => {
              const st = styleFor(t); if (!st.label) return null;
              const g = geomOf(t.from, t.to); if (!g) return null;
              const lw = t.label.length * 6.2 + 18; const c = CATEGORY[t.category].c;
              return (
                <g key={'l' + t.id}>
                  <rect x={g.mid.x - lw / 2} y={g.mid.y - 11} width={lw} height={22} rx={6} fill="#FFFFFF" stroke={c} strokeOpacity={0.5} />
                  <text x={g.mid.x} y={g.mid.y + 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#1A1813" fontFamily={SANS}>{t.label}</text>
                </g>
              );
            })}
          </svg>

          {stages.map((s) => {
            const b = P[s.key]; const isFocus = focus === s.key;
            const bColor = isFocus ? '#C8870C' : (s.border || 'rgba(31,30,29,.2)');
            return (
              <div key={s.key}
                onMouseEnter={() => setHoverStage(s.key)}
                onMouseLeave={() => setHoverStage(null)}
                onClick={() => goToRow(s.key)}
                title="Clic para editar esta etapa abajo"
                style={{ position: 'absolute', left: b.x, top: b.y, width: CW, height: CH, background: s.bg || '#fff', border: `${isFocus ? 2 : 1.5}px solid ${bColor}`, borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', boxShadow: isFocus ? '0 0 0 2px rgba(200,135,12,.18)' : '0 1px 2px rgba(26,24,19,.05)', userSelect: 'none', opacity: related && !related.has(s.key) ? 0.14 : 1, transition: 'box-shadow .12s, border-color .12s, opacity .12s' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.fg || '#1A1813', lineHeight: 1.15 }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* NUTRICIÓN SUGERIDA (protagonista) */}
      {suggestions.length > 0 && (
        <section style={{ marginTop: 22, border: '1px solid ' + CATEGORY.nutricion.c + '55', background: CATEGORY.nutricion.c + '0E', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16 }}>💧</span>
            <h2 style={{ fontSize: 16.5, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Te faltan caminos de nutrición</h2>
            <button onClick={() => suggestions.forEach(addSuggestion)} style={{ marginLeft: 'auto', padding: '7px 13px', borderRadius: 8, border: '1px solid ' + CATEGORY.nutricion.c, background: CATEGORY.nutricion.c, color: '#fff', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Agregar todas</button>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '8px 0 14px', lineHeight: 1.5, maxWidth: 660 }}>
            Casi nadie define qué pasa cuando un lead <i>no</i> avanza. Estos son los caminos típicos — al sumarlos, esos leads dejan de perderse y quedan listos para secuencias automáticas de WhatsApp/Email.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {suggestions.map((s, i) => (
              <button key={s.from + s.to + i} onClick={() => addSuggestion(s)} title={`Agregar: ${labelOf(s.from)} → ${stageByKey[s.to]?.label ?? DEFAULT_STAGES.find((d) => d.key === s.to)?.label ?? s.to}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, border: '1px solid ' + CATEGORY.nutricion.c + '66', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <span style={{ color: 'var(--dim)' }}>{labelOf(s.from)}</span>
                <span style={{ color: CATEGORY.nutricion.c, fontWeight: 700 }}>→ {stageByKey[s.to]?.label ?? DEFAULT_STAGES.find((d) => d.key === s.to)?.label ?? s.to}</span>
                <span style={{ color: CATEGORY.nutricion.c, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>+</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* EDITOR POR BANDA */}
      <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {BAND_ORDER.map((band) => {
          const rows = stages.filter((s) => s.band === band).sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
          const accent = BAND_ACCENT[band];
          return (
            <section key={band}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.01em', margin: 0, color: 'var(--ink)' }}>{BAND_LABEL[band]}</h2>
                <span style={{ fontSize: 12.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{rows.length}</span>
                {band === 'nutricion' && <span style={{ marginLeft: 8, fontSize: 11.5, color: CATEGORY.nutricion.c, background: CATEGORY.nutricion.c + '14', border: '1px solid ' + CATEGORY.nutricion.c + '33', borderRadius: 999, padding: '2px 9px', fontWeight: 600 }}>✉ Mensajes automáticos · próximamente</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((s, i) => {
                  const outs = trans.filter((t) => t.from === s.key);
                  const targets = new Set(outs.map((t) => t.to));
                  const opts = stages.filter((d) => d.key !== s.key && !targets.has(d.key));
                  return (
                    <div key={s.key} id={'frow-' + s.key}
                      onMouseEnter={() => setHoverStage(s.key)} onMouseLeave={() => setHoverStage(null)}
                      style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '11px 13px', boxShadow: flash === s.key ? '0 0 0 2px ' + accent : 'none', transition: 'box-shadow .2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 'none' }}>
                          <button onClick={() => moveStage(s.key, -1)} disabled={i === 0} title="Subir" style={{ ...iconBtn, width: 22, height: 15, opacity: i === 0 ? 0.3 : 1, fontSize: 9 }}>▲</button>
                          <button onClick={() => moveStage(s.key, 1)} disabled={i === rows.length - 1} title="Bajar" style={{ ...iconBtn, width: 22, height: 15, opacity: i === rows.length - 1 ? 0.3 : 1, fontSize: 9 }}>▼</button>
                        </div>
                        <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.dot, flex: 'none', boxShadow: '0 0 0 3px ' + s.dot + '22' }} />
                        <input value={s.label} onChange={(e) => setStageField(s.key, { label: e.target.value })} onBlur={() => commitStage('Nombre actualizado')} style={{ ...field, flex: 1, minWidth: 0 }} />
                        <select value={s.band ?? 'pipeline'} onChange={(e) => setBand(s.key, e.target.value as StageBand)} title="Banda" style={{ ...selectStyle, flex: 'none', color: 'var(--dim)', fontSize: 12.5 }}>
                          {BAND_ORDER.map((b) => <option key={b} value={b}>{BAND_LABEL[b]}</option>)}
                        </select>
                        <button onClick={() => ask(`Eliminar la etapa "${s.label}" y sus caminos`, () => removeStage(s.key))} title="Eliminar etapa" style={{ ...iconBtn, color: 'var(--bad)', borderColor: 'var(--border-strong)' }}>×</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 9, paddingLeft: 38 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Puede ir a</span>
                        {outs.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>nada aún</span>}
                        {outs.map((t) => { const c = CATEGORY[t.category].c; return (
                          <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 999, border: '1px solid ' + c + '55', background: c + '12', fontSize: 12.5, fontWeight: 600, color: c }}>
                            {labelOf(t.to)}
                            <button onClick={() => removeTransition(t.id)} title="Quitar camino" style={{ width: 17, height: 17, borderRadius: '50%', border: 'none', background: c + '22', color: c, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>×</button>
                          </span>
                        ); })}
                        {opts.length > 0 && (
                          <select value="" onChange={(e) => { if (e.target.value) addTransition(s.key, e.target.value); }} style={{ ...selectStyle, padding: '5px 24px 5px 10px', fontSize: 12.5, color: 'var(--dim)', borderStyle: 'dashed' }}>
                            <option value="">+ destino…</option>
                            {opts.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => addStage(band)} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Agregar etapa a {BAND_LABEL[band]}</button>
              </div>
            </section>
          );
        })}
      </div>

      {/* Modal: plantillas */}
      {showTemplates && (
        <ModalShell title="Plantillas de funnel" subtitle="Arrancá desde una base y ajustá lo que quieras." onClose={() => setShowTemplates(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FUNNEL_TEMPLATES.map((tpl) => (
              <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 14, border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{tpl.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3, lineHeight: 1.45 }}>{tpl.description}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{tpl.stages.length} etapas · {tpl.transitions.length} caminos</div>
                </div>
                <button onClick={() => applyTemplate(tpl.id)} style={{ flex: 'none', padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Usar</button>
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {/* Confirmación (cambios destructivos) */}
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

      {/* Toast (autoguardado + Deshacer · 5s) */}
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
