'use client';

// =============================================================================
// FunnelEditor — configuración del funnel (tab /funnel)
// =============================================================================
// El usuario edita SOLO la fila de "Activo" (su pipeline): nombre, tipo y orden
// de cada etapa, y agregar/quitar. La Nutrición y el Descartado se DERIVAN del
// pipeline (generateFunnel) — la nutrición se puede quitar (queda "suprimida").
// Cada camino muestra su disparador: ⚡ automático hoy · ◐ automatizable ·
// ✋ requiere tu validación. Arriba, un mapa de solo lectura del funnel.
// Autoguardado con toast de 5s + "Deshacer". (funnel_config en Supabase.)

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CATEGORY, TRIGGER, BAND_LABEL, generateFunnel, FUNNEL_TEMPLATES, AUTO_REGLAS,
  type Stage, type StageBand, type StageKind, type FunnelTransition, type TransitionTrigger,
} from '@/lib/pipeline';
import { saveFunnelAction } from '../leads/actions';
import { Dropdown } from '../components/Dropdown';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

// Geometría del mapa de solo lectura.
const GUT = 130, COL = 200, CW = 170, CH = 54, BASEH = 392;
const ROWY: Record<StageBand, number> = { pipeline: 44, nutricion: 178, salidas: 312 };
const BAND_IDX: Record<StageBand, number> = { pipeline: 0, nutricion: 1, salidas: 2 };
const CHAN = [(ROWY.pipeline + CH + ROWY.nutricion) / 2, (ROWY.nutricion + CH + ROWY.salidas) / 2];
const TOPCHAN = ROWY.pipeline - 22;
const GAPHALF = (COL - CW) / 2;
const BAND_TINT: Record<StageBand, string> = { pipeline: 'rgba(59,109,17,.055)', nutricion: 'rgba(200,135,12,.06)', salidas: 'rgba(207,78,41,.055)' };
const BAND_ACCENT: Record<StageBand, string> = { pipeline: CATEGORY.avanza.c, nutricion: CATEGORY.nutricion.c, salidas: CATEGORY.perdida.c };
const BAND_ORDER: StageBand[] = ['pipeline', 'nutricion', 'salidas'];

const KIND_LABEL: Record<StageKind, string> = { entrada: 'Entrada', reunion: 'Reunión', grupo: 'Grupo', pago: 'Pago', cierre: 'Cierre', paso: 'Paso' };
const KIND_OPTIONS: StageKind[] = ['entrada', 'reunion', 'grupo', 'pago', 'cierre', 'paso'];

type Pt = { x: number; y: number };
type Box = { x: number; y: number; cx: number; cy: number; w: number; h: number };
type Snap = { pipeline: Stage[]; suppressed: string[] };
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

// Estilo del badge según el disparador (auto hoy / automatizable / manual).
function trigInfo(trg?: TransitionTrigger): { icon: string; label: string; c: string; bg: string } {
  const t = TRIGGER[trg ?? 'manual'];
  if (!t.auto) return { icon: '✋', label: 'Vos', c: '#8A6D3B', bg: 'rgba(138,109,59,.10)' };
  if (t.autoHoy) return { icon: '⚡', label: 'Auto', c: '#3B6D11', bg: 'rgba(59,109,17,.12)' };
  return { icon: '◐', label: 'Auto*', c: '#2E7DBE', bg: 'rgba(46,125,190,.10)' };
}

export function FunnelEditor({
  initialPipeline,
  initialSuppressed,
}: {
  initialPipeline: Stage[];
  initialSuppressed: string[];
}) {
  const [pipeline, setPipeline] = useState<Stage[]>(initialPipeline);
  const [suppressed, setSuppressed] = useState<string[]>(initialSuppressed);
  const [hoverStage, setHoverStage] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; bad?: boolean } | null>(null);
  const [scale, setScale] = useState(1);

  const { stages, transitions } = useMemo(() => generateFunnel(pipeline, suppressed), [pipeline, suppressed]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const ref = useRef({ pipeline, suppressed });
  useEffect(() => { ref.current = { pipeline, suppressed }; }, [pipeline, suppressed]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const uidRef = useRef(0);

  const stageByKey = useMemo(() => { const m: Record<string, Stage> = {}; stages.forEach((s) => { m[s.key] = s; }); return m; }, [stages]);
  const labelOf = (key: string) => stageByKey[key]?.label ?? key;
  const maxCol = stages.reduce((m, s) => Math.max(m, s.col ?? 0), 4);
  const BASEW = Math.max(1120, GUT + maxCol * COL + CW + 28);

  // ── guardado en segundo plano + toast (5s, con Deshacer) ──
  const flashToast = useCallback((msg: string, undo?: () => void, bad?: boolean) => {
    setToast({ msg, undo, bad });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  // El debounce lee el estado FRESCO al disparar.
  const bgSave = useCallback((undo?: () => void) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { pipeline: p, suppressed: s } = ref.current;
      saveFunnelAction(p, s).catch(() => flashToast('No se pudo guardar — aplicá la migración 0025 en Supabase', undo, true));
    }, 500);
  }, [flashToast]);
  const persist = useCallback((msg: string, undo?: () => void) => { flashToast(msg, undo); bgSave(undo); }, [flashToast, bgSave]);
  const snap = (): Snap => ({ pipeline: ref.current.pipeline, suppressed: ref.current.suppressed });
  const undoTo = useCallback((s: Snap) => { setPipeline(s.pipeline); setSuppressed(s.suppressed); flashToast('Cambio deshecho'); bgSave(); }, [flashToast, bgSave]);
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
  const related = focus ? new Set<string>([focus, ...transitions.filter((t) => t.from === focus).map((t) => t.to), ...transitions.filter((t) => t.to === focus).map((t) => t.from)]) : null;
  const styleFor = (t: FunnelTransition): { op: number; w: number; label: boolean } => {
    if (focus) return t.from === focus || t.to === focus ? { op: 1, w: 2.4, label: true } : { op: 0.05, w: 1.4, label: false };
    return t.category === 'avanza' ? { op: 0.6, w: 2, label: false } : { op: 0.4, w: 1.6, label: false };
  };

  // ── mutaciones (mutan pipeline/suppressed + autoguardan + toast con Deshacer) ──
  const setField = (key: string, patch: Partial<Stage>) => setPipeline((ps) => ps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const commit = (msg: string) => persist(msg);
  const setKind = (key: string, kind: StageKind) => { const prev = snap(); setField(key, { kind }); persist('Tipo actualizado', () => undoTo(prev)); };
  const moveStage = (key: string, dir: -1 | 1) => {
    const i = pipeline.findIndex((s) => s.key === key), j = i + dir; if (j < 0 || j >= pipeline.length) return;
    const prev = snap(); setPipeline((ps) => { const a = [...ps]; [a[i], a[j]] = [a[j], a[i]]; return a; }); persist('Orden actualizado', () => undoTo(prev));
  };
  const addStage = () => {
    const prev = snap();
    let key = '';
    do { key = 'st' + (uidRef.current++); } while (pipeline.some((s) => s.key === key));
    const ns: Stage = { key, label: 'Nueva etapa', dot: '#5B6472', tone: 'neutral', kind: 'reunion' };
    setPipeline((ps) => { const cierreIdx = ps.findIndex((s) => s.kind === 'cierre'); const at = cierreIdx >= 0 ? cierreIdx : ps.length; return [...ps.slice(0, at), ns, ...ps.slice(at)]; });
    persist('Etapa creada', () => undoTo(prev));
  };
  const removeStage = (key: string) => { const prev = snap(); setPipeline((ps) => ps.filter((s) => s.key !== key)); setHoverStage(null); persist('Etapa eliminada', () => undoTo(prev)); };
  const suppressNut = (from: string, to: string) => { const id = `${from}>${to}`; const prev = snap(); setSuppressed((ss) => (ss.includes(id) ? ss : [...ss, id])); persist('Nutrición quitada', () => undoTo(prev)); };
  const restoreNut = (id: string) => { const prev = snap(); setSuppressed((ss) => ss.filter((x) => x !== id)); persist('Nutrición restaurada', () => undoTo(prev)); };
  const applyTemplate = (id: string) => {
    const tpl = FUNNEL_TEMPLATES.find((t) => t.id === id); if (!tpl) return;
    const prev = snap();
    ask(`Reemplazar tu funnel por la plantilla "${tpl.name}"`, () => { setPipeline(tpl.pipeline); setSuppressed([]); setShowTemplates(false); persist('Plantilla aplicada', () => undoTo(prev)); });
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
  const iconBtn: CSSProperties = { flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--faint)', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };

  const Badge = ({ trg }: { trg?: TransitionTrigger }) => { const b = trigInfo(trg); return <span title={TRIGGER[trg ?? 'manual'].label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: b.c, background: b.bg }}>{b.icon} {b.label}</span>; };

  const lossStages = stages.filter((s) => s.band === 'salidas');
  const suppressedNow = suppressed.filter((id) => { const [from, to] = id.split('>'); return pipeline.some((p) => p.key === from) && !pipeline.some((p) => p.key === to); });

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 90px', fontFamily: SANS }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Funnel</h1>
          <p style={{ fontSize: 14.5, color: 'var(--dim)', margin: '10px 0 0', maxWidth: 660, lineHeight: 1.5 }}>
            Editás solo tu fila de <b style={{ color: 'var(--ink)', fontWeight: 600 }}>Activo</b> (cómo avanza un lead). La <b style={{ color: CATEGORY.nutricion.c, fontWeight: 600 }}>nutrición</b> y el descartado los generamos nosotros — quitá la nutrición que no uses.
          </p>
        </div>
        <button onClick={() => setShowTemplates(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>▦ Plantillas</button>
      </header>

      {/* MAPA (solo lectura) */}
      <div
        ref={(el) => { canvasRef.current = el; if (el) requestAnimationFrame(updateScale); }}
        style={{ position: 'relative', width: '100%', maxWidth: BASEW, margin: '18px auto 0', height: BASEH * scale, background: '#FFFFFF', border: '1px solid #EAECF1', borderRadius: 18, overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: BASEW, height: BASEH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <svg width={BASEW} height={BASEH} viewBox={`0 0 ${BASEW} ${BASEH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
            {BAND_ORDER.map((band, i) => { const y = ROWY[band]; return (
              <g key={'ln' + i}>
                <rect x={16} y={y - 15} width={BASEW - 32} height={CH + 30} rx={13} fill={BAND_TINT[band]} />
                <text x={28} y={y + CH / 2 + 1} dominantBaseline="central" fontFamily={MONO} fontSize={10.5} letterSpacing=".1em" fontWeight={600} fill="#98A0AC">{BAND_LABEL[band].toUpperCase()}</text>
              </g>
            ); })}
            {transitions.map((t, i) => {
              const g = geomOf(t.from, t.to); if (!g) return null;
              const st = styleFor(t); const c = CATEGORY[t.category].c;
              return (
                <g key={'a' + i}>
                  <path d={g.d} fill="none" stroke={c} strokeWidth={st.w} strokeOpacity={st.op} strokeLinecap="round" strokeLinejoin="round" />
                  <polygon points={arrowPoints(g.b, g.prev, st.w)} fill={c} opacity={st.op} />
                </g>
              );
            })}
            {focus && transitions.map((t, i) => {
              const st = styleFor(t); if (!st.label) return null;
              const g = geomOf(t.from, t.to); if (!g) return null;
              const lw = t.label.length * 6.2 + 18; const c = CATEGORY[t.category].c;
              return (
                <g key={'l' + i}>
                  <rect x={g.mid.x - lw / 2} y={g.mid.y - 11} width={lw} height={22} rx={6} fill="#FFFFFF" stroke={c} strokeOpacity={0.5} />
                  <text x={g.mid.x} y={g.mid.y + 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#12151B" fontFamily={SANS}>{t.label}</text>
                </g>
              );
            })}
          </svg>

          {stages.map((s) => {
            const b = P[s.key]; const isFocus = focus === s.key; const editable = s.band === 'pipeline';
            const bColor = isFocus ? 'var(--primary)' : (s.border || 'rgba(31,30,29,.2)');
            return (
              <div key={s.key}
                onMouseEnter={() => setHoverStage(s.key)}
                onMouseLeave={() => setHoverStage(null)}
                onClick={() => editable && goToRow(s.key)}
                title={editable ? 'Clic para editar esta etapa abajo' : undefined}
                style={{ position: 'absolute', left: b.x, top: b.y, width: CW, height: CH, background: s.bg || '#fff', border: `${isFocus ? 2 : 1.5}px solid ${bColor}`, borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: editable ? 'pointer' : 'default', boxShadow: isFocus ? '0 0 0 2px rgba(47,111,237,.18)' : '0 1px 2px rgba(18,21,27,.05)', userSelect: 'none', opacity: related && !related.has(s.key) ? 0.14 : 1, transition: 'box-shadow .12s, border-color .12s, opacity .12s' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.fg || '#12151B', lineHeight: 1.15 }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* leyenda auto/manual */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '12px 2px 0', fontSize: 12, color: 'var(--dim)' }}>
        <span><b style={{ color: '#3B6D11' }}>⚡ Auto</b> avanza solo (ya cableado)</span>
        <span><b style={{ color: '#2E7DBE' }}>◐ Auto*</b> lo mueve MaKo (CRM automático)</span>
        <span><b style={{ color: '#8A6D3B' }}>✋ Vos</b> requiere que marques cómo quedó</span>
      </div>

      {/* AUTOMATIZACIONES DE MAKO — qué mueve un lead solo y cuándo */}
      <section style={{ marginTop: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--primary)' }} />
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Automatizaciones de MaKo</h2>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#B5630A', background: 'rgba(217,119,6,.12)', padding: '2px 8px', borderRadius: 999 }}>en observación</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 12px 18px', maxWidth: 720, lineHeight: 1.5 }}>
          MaKo mueve el lead solo cuando se cumplen estas condiciones. En los que marcan <b style={{ color: '#B5630A', fontWeight: 600 }}>confirma</b> te pide un OK al entrar al CRM (por si se equivocó); los <b style={{ color: '#3B6D11', fontWeight: 600 }}>automático</b> los aplica sin preguntar. Todo queda en el historial. Hoy calcula los movimientos sin tocar nada; se prenden cuando lo decidas.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(322px, 1fr))', gap: 10 }}>
          {AUTO_REGLAS.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'rgba(47,111,237,.1)', padding: '2px 7px', borderRadius: 6 }}>{r.id}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{r.titulo}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: r.confirmar ? '#B5630A' : '#3B6D11', background: r.confirmar ? 'rgba(217,119,6,.12)' : 'rgba(59,109,17,.12)' }}>{r.confirmar ? 'confirma' : 'automático'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--dim)' }}>{r.desde}</span>
                <span style={{ color: 'var(--faint)' }}>→</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.hacia}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45 }}>{r.senal}</div>
            </div>
          ))}
        </div>
      </section>

      {/* EDITOR DE ACTIVO */}
      <section style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: BAND_ACCENT.pipeline }} />
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>{BAND_LABEL.pipeline}</h2>
          <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>cómo avanza un lead hacia la venta</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pipeline.map((s, i) => {
            const next = pipeline[i + 1];
            const advance = next && transitions.find((t) => t.from === s.key && t.to === next.key && t.category === 'avanza');
            const nutris = transitions.filter((t) => t.from === s.key && t.category === 'nutricion');
            return (
              <div key={s.key} id={'frow-' + s.key}
                onMouseEnter={() => setHoverStage(s.key)} onMouseLeave={() => setHoverStage(null)}
                style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '11px 13px', boxShadow: flash === s.key ? '0 0 0 2px ' + BAND_ACCENT.pipeline : 'none', transition: 'box-shadow .2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 'none' }}>
                    <button onClick={() => moveStage(s.key, -1)} disabled={i === 0} title="Subir" style={{ ...iconBtn, width: 22, height: 15, opacity: i === 0 ? 0.3 : 1, fontSize: 9 }}>▲</button>
                    <button onClick={() => moveStage(s.key, 1)} disabled={i === pipeline.length - 1} title="Bajar" style={{ ...iconBtn, width: 22, height: 15, opacity: i === pipeline.length - 1 ? 0.3 : 1, fontSize: 9 }}>▼</button>
                  </div>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.dot, flex: 'none', boxShadow: '0 0 0 3px ' + s.dot + '22' }} />
                  <input value={s.label} onChange={(e) => setField(s.key, { label: e.target.value })} onBlur={() => commit('Nombre actualizado')} style={{ ...field, flex: 1, minWidth: 0 }} />
                  <Dropdown value={s.kind ?? 'paso'} onChange={(v) => setKind(s.key, v as StageKind)} ariaLabel="Tipo de etapa" width={130}
                    options={KIND_OPTIONS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
                  <button onClick={() => ask(`Eliminar la etapa "${s.label}" y su nutrición`, () => removeStage(s.key))} disabled={pipeline.length <= 1} title="Eliminar etapa" style={{ ...iconBtn, color: 'var(--bad)', borderColor: 'var(--border-strong)', opacity: pipeline.length <= 1 ? 0.3 : 1 }}>×</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 9, paddingLeft: 38 }}>
                  {advance && next && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--dim)' }}>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Avanza a</span>
                      <b style={{ color: BAND_ACCENT.pipeline, fontWeight: 600 }}>{next.label}</b><Badge trg={advance.trigger} />
                    </span>
                  )}
                  {nutris.length > 0 && <span style={{ width: 1, height: 16, background: 'var(--border)' }} />}
                  {nutris.map((t) => { const c = CATEGORY.nutricion.c; return (
                    <span key={t.to} title={`${TRIGGER[t.trigger ?? 'manual'].label} · clic en ✕ para quitar`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 5px 3px 9px', borderRadius: 999, border: '1px solid ' + c + '44', background: c + '10', fontSize: 12, fontWeight: 600, color: c }}>
                      {trigInfo(t.trigger).icon} {labelOf(t.to).replace('Nutrición - ', '')}
                      <button onClick={() => suppressNut(s.key, t.to)} title="Quitar esta nutrición" style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: c + '22', color: c, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  ); })}
                </div>
              </div>
            );
          })}
          <button onClick={addStage} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Agregar etapa</button>
        </div>
      </section>

      {/* nutriciones ocultas (restaurar) */}
      {suppressedNow.length > 0 && (
        <section style={{ marginTop: 16, fontSize: 12.5, color: 'var(--dim)' }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginRight: 8 }}>Nutriciones ocultas</span>
          {suppressedNow.map((id) => { const [from, to] = id.split('>'); return (
            <button key={id} onClick={() => restoreNut(id)} title="Restaurar" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, margin: '0 6px 6px 0', padding: '4px 10px', borderRadius: 999, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: SANS }}>
              ↺ {labelOf(from)} → {labelOf(to).replace('Nutrición - ', '')}
            </button>
          ); })}
        </section>
      )}

      {/* DESCARTADO (fijo) */}
      <section style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: BAND_ACCENT.salidas }} />
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>{BAND_LABEL.salidas}</h2>
          <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>igual para todos los funnels</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 18 }}>
          {lossStages.map((s) => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, border: '1px solid ' + (s.border || 'var(--border-strong)'), background: s.bg || 'var(--surface)', fontSize: 13, fontWeight: 600, color: s.fg || 'var(--dim)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />{s.label}
            </span>
          ))}
        </div>
      </section>

      {/* Modal: plantillas */}
      {showTemplates && (
        <ModalShell title="Plantillas de funnel" subtitle="Arrancá desde una base y ajustá lo que quieras." onClose={() => setShowTemplates(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FUNNEL_TEMPLATES.map((tpl) => (
              <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 14, border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{tpl.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3, lineHeight: 1.45 }}>{tpl.description}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5 }}>{tpl.pipeline.map((s) => s.label).join(' → ')}</div>
                </div>
                <button onClick={() => applyTemplate(tpl.id)} style={{ flex: 'none', padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Usar</button>
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {/* Confirmación (cambios destructivos) */}
      {confirm && (
        <div onClick={() => setConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Confirmar cambio</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>{confirm.msg}.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
              <button onClick={() => { const a = confirm.apply; setConfirm(null); a(); }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast (autoguardado + Deshacer · 5s) */}
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, display: 'flex', alignItems: 'center', gap: 14, background: toast.bad ? '#5C2B2E' : '#14161B', color: '#F3F5F8', padding: '12px 18px', borderRadius: 12, boxShadow: '0 12px 32px rgba(18,21,27,.35)', fontFamily: SANS, fontSize: 14 }}>
          <span>{toast.msg}{!toast.bad && ' ✓'}</span>
          {toast.undo && <button type="button" onClick={() => { toast.undo!(); }} style={{ background: 'transparent', border: '1px solid rgba(243,245,248,.35)', color: 'var(--primary-weak)', fontWeight: 600, fontSize: 13.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS }}>↶ Deshacer</button>}
          <button type="button" onClick={() => setToast(null)} aria-label="cerrar" style={{ background: 'transparent', border: 'none', color: 'rgba(243,245,248,.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      )}
    </main>
  );
}

// ── Modal genérico ──
function ModalShell({ title, subtitle, onClose, width = 560, children }: { title: string; subtitle?: string; onClose: () => void; width?: number; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: width, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
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
