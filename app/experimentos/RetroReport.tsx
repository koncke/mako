'use client';

// =============================================================================
// RetroReport — el REPORTE de una Retro de MaKo (Overview · Plan · Detail)
// =============================================================================
// Porteado FIELMENTE del diseño de Claude Design "Retro MaKo (3).dc.html".
// Tres vistas con switcher de pills, modal de hallazgo (evidencia num/bars/
// spark), modal de acción (aceptar/posponer/descartar con motivo), seguimiento
// del retro pasado, banda de cobertura de datos y gráficos REALES por
// herramienta (recharts + divs). El estado del plan vive en item.status
// (persistido); onPlan lo muta el padre.

import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  ScatterChart, Scatter, LabelList,
} from 'recharts';
import type {
  RetroReporte, RetroFinding, RetroPlanItem, Evidencia, ToolId,
  AreaId, SaludArea, FindingTipo, TonoEv, PlanStatus, RetroCharts,
} from '@/lib/retro-reporte';
import { TOOL_LABEL, TOOL_HREF } from '@/lib/retro-reporte';
import { MakoStar } from '@/app/_components/MakoBrand';

// ── Tokens locales (el resto sale de las CSS vars de la app) ─────────────────
const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const BLUE_BD = '#CFE0FC';   // --blue-bd del diseño
const WARN_FILL = '#E8B30B'; // --warn-fill
const GRIS = '#6B7280';      // --gris
const GRIS_BG = '#EEF1F5';   // --gris-bg
const GRAY_BAR = '#D5DAE2';  // barra neutra de la evidencia
const BAD_BD = '#F1CBC8';    // borde de la card de fuga
const MUTED = '#98A0AC';     // título descartado / glifo "sin tocar"

const TONE_FG: Record<TonoEv, string> = {
  good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--warn)', blue: 'var(--primary)', gris: GRIS,
};
const BAR_BG: Record<TonoEv | 'gray', string> = {
  gray: GRAY_BAR, blue: 'var(--primary)', bad: 'var(--bad)', good: 'var(--good)', warn: WARN_FILL, gris: GRAY_BAR,
};
const barTxt = (t: TonoEv | 'gray'): string => (t === 'gray' || t === 'gris' ? GRIS : TONE_FG[t]);

const DOT: Record<SaludArea, string> = {
  good: 'var(--good)', bad: 'var(--bad)', warn: WARN_FILL, gris: MUTED,
};
const CHIP: Record<'good' | 'warn' | 'bad' | 'gris', [string, string]> = {
  good: ['var(--good-bg)', 'var(--good)'],
  warn: ['var(--warn-bg)', 'var(--warn)'],
  bad: ['var(--bad-bg)', 'var(--bad)'],
  gris: [GRIS_BG, GRIS],
};

const BADGE: Record<FindingTipo, { label: string; bg: string; fg: string }> = {
  cruce: { label: '⇄ Cruce', bg: 'var(--primary-bg)', fg: 'var(--primary)' },
  anomalia: { label: '⚠ Anomalía', bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  hallazgo: { label: 'Hallazgo', bg: 'var(--surface-2)', fg: 'var(--dim)' },
};

// ── Detail: orden de herramientas y blurbs fijos ─────────────────────────────
const TOOL_ORDER: ToolId[] = ['closing', 'script', 'vsl', 'landing', 'offer', 'market', 'cs', 'crm', 'graphics', 'todo', 'chats', 'crosses'];

const TOOL_BLURB: Record<ToolId, string> = {
  closing: 'Análisis de las llamadas de cierre: no-show, scores y pases a R2.',
  script: 'Rendimiento de los guiones: hook rate y retención por video.',
  vsl: 'Reproducción del VSL por tramo. Todavía con datos parciales.',
  landing: 'Comportamiento en la landing y pasos hacia el formulario.',
  offer: 'Oferta y objeciones detectadas en las llamadas.',
  market: 'Anuncios y audiencias: costo, frecuencia y fatiga.',
  cs: 'Cobranza y cuentas: cuotas, mora y salud de la cartera.',
  crm: 'Estado de los leads: nutridos, sin tocar y secuencias.',
  graphics: 'Los números del negocio: CPL, CAC, vendido y cobrado.',
  todo: 'Tareas del equipo ligadas a las recomendaciones.',
  chats: 'Mensajes de venta. Chatwoot todavía sin conectar.',
  crosses: 'Los hallazgos que cruzan dos tabs: el contenido más valioso del análisis.',
};

const MOTIVOS = ['ya lo probé', 'no aplica al negocio', 'no es prioridad', 'el dato está mal'];

// Animaciones del modal (ids únicos para no chocar con el resto de la app).
const KEYFRAMES = `
@keyframes rrModalFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes rrModalPop { from { opacity: 0; transform: translateY(10px) scale(.99) } to { opacity: 1; transform: none } }
`;

// ── Piezas chicas ────────────────────────────────────────────────────────────

/** Polyline de la evidencia 'spark' (portada tal cual del diseño). */
function Spark({ vals, color, w = 118 }: { vals: number[]; color: string; w?: number }) {
  const width = w, min = Math.min(...vals), max = Math.max(...vals);
  const d = vals
    .map((v, i) => [4 + i * ((width - 8) / (vals.length - 1 || 1)), 32 - ((v - min) / (max - min || 1)) * 26])
    .map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ' ' + p[1])
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} 38`} style={{ width, height: 38, flex: 'none' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** El bloque visual del modal de hallazgo: num / bars / spark. */
function EvidenciaBlock({ ev }: { ev: Evidencia }) {
  if (ev.type === 'num') {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 13, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1, color: TONE_FG[ev.tone], fontVariantNumeric: 'tabular-nums' }}>{ev.value}</span>
        <span style={{ fontSize: 15.5, color: 'var(--dim)' }}>{ev.label}</span>
      </div>
    );
  }
  if (ev.type === 'bars') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ev.rows.map((r, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, marginBottom: 4 }}>
              <span style={{ fontWeight: r.strong ? 600 : 400, color: r.strong ? 'var(--ink)' : 'var(--dim)' }}>{r.label}</span>
              <span style={{ fontFamily: MONO, fontWeight: 600, color: barTxt(r.tone) }}>{r.val}</span>
            </div>
            <div style={{ height: 22, borderRadius: 6, background: BAR_BG[r.tone], width: `${r.pct}%`, minWidth: 14 }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <Spark vals={ev.vals} color={TONE_FG[ev.tone]} />
      <span style={{ fontFamily: MONO, fontSize: 14, color: 'var(--dim)' }}>{ev.note}</span>
    </div>
  );
}

/** Card compacta de hallazgo (Overview y Detail). */
function FindingCard({ f, st, onOpen }: { f: RetroFinding; st: SaludArea; onOpen: () => void }) {
  const b = BADGE[f.tipo];
  const accent = f.tipo === 'cruce' ? 'var(--primary)' : f.tipo === 'anomalia' ? WARN_FILL : DOT[st];
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, color: 'var(--ink)', background: 'var(--surface)', border: `1px solid ${f.tipo === 'cruce' ? BLUE_BD : 'var(--border)'}`, borderLeft: `4px solid ${accent}`, borderRadius: 13, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 132 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em', padding: '3px 9px', borderRadius: 6, background: b.bg, color: b.fg }}>{b.label}</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>{TOOL_LABEL[f.tool]}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
        <span style={{ flex: 'none', marginTop: 3 }}><MakoStar size={13} /></span>
        <span style={{ fontWeight: 600, fontSize: 16.5, letterSpacing: '-0.01em', lineHeight: 1.3, textWrap: 'pretty' }}>{f.short}</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--primary)' }}>Ver detalle →</span>
    </button>
  );
}

/** Card contenedora de cada gráfico del Detail. */
function ChartCard({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Fila [label 110px | barra proporcional | valor mono] para embudos/splits. */
function HBarRow({ label, val, pct, color, fuga }: { label: string; val: string; pct: number; color: string; fuga?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 110, flex: 'none', fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 22, borderRadius: 6, background: color, width: `${Math.max(0, Math.min(100, pct))}%`, minWidth: 14 }} />
      </div>
      <span style={{ flex: 'none', fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
        {val}
        {fuga && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 600, color: 'var(--bad)' }}>fuga</span>}
      </span>
    </div>
  );
}

const CHART_TICK = { fontSize: 11, fontFamily: MONO, fill: 'var(--faint)' };
const CHART_TOOLTIP: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontFamily: SANS };

/** Gráfico REAL de la herramienta activa del Detail (si reporte.charts lo trae). */
function ToolChart({ tool, charts }: { tool: ToolId; charts: RetroCharts }) {
  if (tool === 'market' && charts.market) {
    const m = charts.market;
    return (
      <ChartCard title={`${m.series[0]} vs ${m.series[1]} · semanal`}>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={m.puntos} margin={{ top: 6, right: 10, bottom: 0, left: 10 }}>
              <XAxis dataKey="x" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval="preserveStartEnd" minTickGap={18} />
              <YAxis yAxisId="s0" hide />
              <YAxis yAxisId="s1" hide orientation="right" />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Line yAxisId="s0" type="monotone" dataKey={m.series[0]} stroke="var(--primary)" strokeWidth={2.4} dot={false} isAnimationActive={false} />
              <Line yAxisId="s1" type="monotone" dataKey={m.series[1]} stroke="var(--warn)" strokeWidth={2.4} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    );
  }
  if (tool === 'graphics' && charts.graphics) {
    const max = Math.max(...charts.graphics.funnel.map((e) => e.valor), 1);
    return (
      <ChartCard title="embudo del período">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {charts.graphics.funnel.map((e, i) => (
            <HBarRow key={i} label={e.label} val={e.valor.toLocaleString('en-US')} pct={(e.valor / max) * 100} color={e.fuga ? 'var(--bad)' : 'var(--primary)'} fuga={e.fuga} />
          ))}
        </div>
      </ChartCard>
    );
  }
  if (tool === 'crm' && charts.crm) {
    const max = Math.max(...charts.crm.split.map((e) => e.valor), 1);
    return (
      <ChartCard title="nutrición · split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {charts.crm.split.map((e, i) => (
            <HBarRow key={i} label={e.label} val={e.valor.toLocaleString('en-US')} pct={(e.valor / max) * 100} color={e.tone === 'good' ? 'var(--good)' : e.tone === 'bad' ? 'var(--bad)' : GRAY_BAR} />
          ))}
        </div>
      </ChartCard>
    );
  }
  if (tool === 'closing' && charts.closing) {
    const c = charts.closing;
    const max = Math.max(...c.pasos.map((p) => p.valor), 1);
    return (
      <ChartCard
        title="embudo comercial"
        right={typeof c.score === 'number' ? (
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: 'var(--primary-bg)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>score promedio {c.score}</span>
        ) : undefined}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {c.pasos.map((p, i) => (
            <HBarRow key={i} label={p.label} val={p.valor.toLocaleString('en-US')} pct={(p.valor / max) * 100} color="var(--primary)" />
          ))}
        </div>
      </ChartCard>
    );
  }
  if (tool === 'script' && charts.script && charts.script.guiones.length > 0) {
    const pts = charts.script.guiones;
    let bestIdx = 0;
    pts.forEach((g, i) => { if (g.ret > pts[bestIdx].ret) bestIdx = i; });
    return (
      <ChartCard title="hook × retención por guion">
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
              <XAxis type="number" dataKey="hook" name="hook" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={(v: number) => `${v}%`} domain={[0, 'auto']} />
              <YAxis type="number" dataKey="ret" name="retención" width={44} tick={CHART_TICK} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={(v: number) => `${v}%`} domain={[0, 'auto']} />
              <Tooltip contentStyle={CHART_TOOLTIP} cursor={{ strokeDasharray: '3 3', stroke: 'var(--border-strong)' }} />
              <Scatter data={pts} fill="var(--primary)" isAnimationActive={false}>
                <LabelList
                  dataKey="nombre"
                  content={(p) => {
                    if (p.index !== bestIdx) return null;
                    const vb = p.viewBox as { x?: number; y?: number } | undefined;
                    const px = typeof p.x === 'number' ? p.x : (vb?.x ?? 0);
                    const py = typeof p.y === 'number' ? p.y : (vb?.y ?? 0);
                    const label = typeof p.value === 'string' || typeof p.value === 'number' ? p.value : '';
                    return (
                      <text x={px} y={py - 10} textAnchor="middle" fontSize={10.5} fontFamily={MONO} fontWeight={600} fill="var(--ink)">{label}</text>
                    );
                  }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    );
  }
  return null; // crosses / vsl / landing / offer / cs / todo / chats: sin chart
}

// ── Plan: helpers de estado / prioridad ──────────────────────────────────────

function statusChip(st: PlanStatus): { short: string; long: string; bg: string; fg: string } {
  if (st.estado === 'aceptada') return { short: 'Aceptada', long: 'Aceptada ✓', bg: 'var(--good-bg)', fg: 'var(--good)' };
  if (st.estado === 'pospuesta') return { short: 'Pospuesta', long: 'Pospuesta', bg: 'var(--warn-bg)', fg: 'var(--warn)' };
  return { short: 'Descartada', long: st.motivo ? `Descartada · ${st.motivo}` : 'Descartada', bg: GRIS_BG, fg: GRIS };
}

function prioColors(p: 'alta' | 'media' | 'baja'): [string, string] {
  return p === 'alta' ? ['var(--bad-bg)', 'var(--bad)'] : p === 'media' ? ['var(--warn-bg)', 'var(--warn)'] : [GRIS_BG, GRIS];
}

/** Card del plan (Experiments y To-do comparten estructura, cambia la escala). */
function PlanCard({ item, onOpen }: { item: RetroPlanItem; onOpen: () => void }) {
  const exp = item.kind === 'exp';
  const st = item.status ? statusChip(item.status) : null;
  const descartada = item.status?.estado === 'descartada';
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, color: 'var(--ink)', background: 'var(--surface)', border: `1px solid ${exp && item.destacado ? 'var(--primary)' : 'var(--border)'}`, borderLeft: `4px solid ${exp ? 'var(--primary)' : 'var(--border-strong)'}`, borderRadius: 14, padding: exp ? '20px 24px' : '18px 22px', display: 'flex', flexDirection: 'column', gap: exp ? 12 : 11, minHeight: exp ? 140 : 118 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: exp ? 11 : 10.5, fontWeight: 600, letterSpacing: exp ? '.06em' : '.05em', textTransform: 'uppercase', padding: exp ? '3px 10px' : '3px 9px', borderRadius: 6, background: exp ? 'var(--primary-bg)' : GRIS_BG, color: exp ? 'var(--primary)' : 'var(--ink)' }}>
          {exp ? 'Experiment' : 'To-do'}
        </span>
        {item.prio && (
          <span style={{ fontFamily: MONO, fontSize: exp ? 11 : 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', padding: exp ? '3px 10px' : '3px 9px', borderRadius: 6, background: prioColors(item.prio)[0], color: prioColors(item.prio)[1] }}>
            {item.prio}
          </span>
        )}
        {st && (
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: exp ? 11 : 10.5, fontWeight: 600, padding: exp ? '3px 10px' : '3px 9px', borderRadius: 999, background: st.bg, color: st.fg }}>{st.short}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
        <span style={{ flex: 'none', marginTop: exp ? 4 : 3 }}><MakoStar size={exp ? 14 : 13} /></span>
        <span style={{ fontWeight: 600, fontSize: exp ? 17 : 15, letterSpacing: exp ? '-0.01em' : '-0.008em', lineHeight: 1.28, textWrap: 'pretty', color: descartada ? MUTED : 'var(--ink)' }}>{item.titulo}</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--primary)' }}>Ver detalle →</span>
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// El componente
// ═════════════════════════════════════════════════════════════════════════════

type View = 'overview' | 'plan' | 'detail';
type ModalRef = { kind: 'find' | 'act'; id: string } | null;

const VIEWS: Array<{ id: View; name: string }> = [
  { id: 'overview', name: 'Overview' },
  { id: 'plan', name: 'Plan' },
  { id: 'detail', name: 'Detail' },
];

const TIPO_PILLS: Array<{ id: FindingTipo; label: string }> = [
  { id: 'hallazgo', label: 'Hallazgos' },
  { id: 'cruce', label: 'Cruces' },
  { id: 'anomalia', label: 'Anomalías' },
];

export function RetroReport({ reporte, periodo, alcance, onPlan, busyPlanId }: {
  reporte: RetroReporte;
  periodo: string;                 // "30 nov 2025 – 30 jun 2026"
  alcance: string;                 // "todo el negocio"
  onPlan: (item: RetroPlanItem, op: 'aceptar' | 'posponer' | 'descartar' | 'deshacer', motivo?: string) => void;
  busyPlanId: string | null;       // item del plan en vuelo (deshabilitar botones)
}) {
  const [view, setViewState] = useState<View>('overview');
  const [tool, setTool] = useState<ToolId>('closing');
  const [fTipo, setFTipo] = useState<FindingTipo | 'todos'>('todos');
  const [modal, setModal] = useState<ModalRef>(null);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [discardMotivo, setDiscardMotivo] = useState('');

  const closeModal = () => { setModal(null); setDiscardId(null); setDiscardMotivo(''); };
  const setView = (v: View) => {
    setViewState(v); closeModal();
    try { window.scrollTo({ top: 0 }); } catch { /* SSR / entornos sin window */ }
  };

  const stArea = (id: AreaId): SaludArea => reporte.areas.find((a) => a.id === id)?.st ?? 'gris';
  const counts = { bad: 0, warn: 0, good: 0 };
  for (const a of reporte.areas) {
    if (a.st === 'bad') counts.bad++;
    else if (a.st === 'warn') counts.warn++;
    else if (a.st === 'good') counts.good++;
  }

  const findsDe = (t: ToolId): RetroFinding[] =>
    t === 'crosses' ? reporte.findings.filter((f) => f.tipo === 'cruce') : reporte.findings.filter((f) => f.tool === t);

  const filtrados = reporte.findings.filter((f) => fTipo === 'todos' || f.tipo === fTipo);
  const exps = reporte.plan.filter((p) => p.kind === 'exp');
  const tareas = reporte.plan.filter((p) => p.kind === 'tarea');

  const modalFind = modal?.kind === 'find' ? reporte.findings.find((f) => f.id === modal.id) : undefined;
  const modalAct = modal?.kind === 'act' ? reporte.plan.find((p) => p.id === modal.id) : undefined;

  // ── Tesis: pintar la subcadena highlight en rojo ──
  const tesis = (() => {
    const { texto, highlight } = reporte.tesis;
    if (!highlight) return texto;
    const i = texto.indexOf(highlight);
    if (i < 0) return texto;
    return (
      <>
        {texto.slice(0, i)}
        <span style={{ color: 'var(--bad)' }}>{highlight}</span>
        {texto.slice(i + highlight.length)}
      </>
    );
  })();

  const pillBtn = (active: boolean): CSSProperties => ({
    border: `1px solid ${active ? BLUE_BD : 'var(--border-strong)'}`, borderRadius: 999,
    background: active ? 'var(--primary-bg)' : 'var(--surface)', color: active ? 'var(--primary)' : 'var(--dim)',
    fontFamily: SANS, fontSize: 13, fontWeight: active ? 600 : 500, padding: '6px 13px', cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ fontFamily: SANS, color: 'var(--ink)' }}>
      <style>{KEYFRAMES}</style>

      {/* ── switcher de vistas (arriba a la derecha) ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: 'var(--faint)' }}>{periodo} · {alcance}</div>
        <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 13, padding: 5, gap: 3 }}>
          {VIEWS.map((v) => (
            <button key={v.id} type="button" onClick={() => setView(v.id)} style={{ border: 0, borderRadius: 10, background: view === v.id ? 'var(--primary-bg)' : 'transparent', padding: '11px 22px', cursor: 'pointer', fontFamily: SANS, fontSize: 15.5, fontWeight: 600, color: view === v.id ? 'var(--primary)' : 'var(--dim)' }}>
              {v.name}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {view === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 26 }}>

          {/* tesis (MaKo) */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '34px 38px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ flex: 'none' }}><MakoStar size={18} /></span>
              <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)' }}>La tesis del período</span>
            </div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 33, letterSpacing: '-0.022em', lineHeight: 1.28, textWrap: 'pretty' }}>{tesis}</p>
          </section>

          {/* fuga (el problema principal, en plata) */}
          {reporte.fuga && (
            <section style={{ background: 'var(--bad-bg)', border: `1px solid ${BAD_BD}`, borderRadius: 16, padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' }}>
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--bad)', fontVariantNumeric: 'tabular-nums' }}>{reporte.fuga.valor}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--bad)' }}>{reporte.fuga.unidad}</span>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: BAD_BD }} />
              <div style={{ flex: 1, minWidth: 300 }}>
                <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--bad)', marginBottom: 10 }}>{reporte.fuga.titulo}</div>
                <p style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: '-0.012em', lineHeight: 1.34, color: 'var(--ink)', textWrap: 'pretty' }}>{reporte.fuga.texto}</p>
              </div>
            </section>
          )}

          {/* hallazgos */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px 20px', flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontWeight: 600, fontSize: 21, letterSpacing: '-0.015em', margin: 0 }}>Hallazgos</h2>
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{reporte.findings.length} de todas las áreas</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999, background: 'var(--bad-bg)', color: 'var(--bad)', fontFamily: MONO, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: 'var(--bad)' }} />{counts.bad} urgente
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999, background: 'var(--warn-bg)', color: 'var(--warn)', fontFamily: MONO, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: WARN_FILL }} />{counts.warn} vigilar
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good)', fontFamily: MONO, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: 'var(--good)' }} />{counts.good} en orden
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
              {TIPO_PILLS.map((p) => (
                <button key={p.id} type="button" onClick={() => setFTipo(fTipo === p.id ? 'todos' : p.id)} style={pillBtn(fTipo === p.id)}>{p.label}</button>
              ))}
            </div>
            {filtrados.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
                {filtrados.map((f) => (
                  <FindingCard key={f.id} f={f} st={stArea(f.area)} onOpen={() => setModal({ kind: 'find', id: f.id })} />
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', borderRadius: 13, padding: 34, textAlign: 'center', color: 'var(--faint)', fontSize: 15 }}>
                Sin resultados para este filtro.
              </div>
            )}
          </section>

        </div>
      )}

      {/* ═══ PLAN ═══ */}
      {view === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 26 }}>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 600, fontSize: 24, letterSpacing: '-0.017em', margin: 0 }}>Experiments</h2>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>los experimentos que recomienda MaKo</span>
            </div>
            {exps.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
                {exps.map((a) => (
                  <PlanCard key={a.id} item={a} onOpen={() => setModal({ kind: 'act', id: a.id })} />
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: 34, textAlign: 'center', color: 'var(--faint)', fontSize: 15 }}>
                MaKo no recomendó experimentos este período.
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 600, fontSize: 24, letterSpacing: '-0.017em', margin: 0 }}>To-do</h2>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{tareas.length} tareas</span>
            </div>
            {tareas.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
                {tareas.map((a) => (
                  <PlanCard key={a.id} item={a} onOpen={() => setModal({ kind: 'act', id: a.id })} />
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: 34, textAlign: 'center', color: 'var(--faint)', fontSize: 15 }}>
                Sin tareas directas este período.
              </div>
            )}
          </div>

          {reporte.seguimiento.length > 0 && (
            <div>
              <h2 style={{ fontWeight: 600, fontSize: 24, letterSpacing: '-0.017em', margin: '0 0 16px' }}>Lo que quedó del retro pasado</h2>
              <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 30px' }}>
                {reporte.seguimiento.map((s, i) => {
                  const [glyph, gBg, gFg] = s.st === 'done' ? ['✓', 'var(--good-bg)', 'var(--good)'] : s.st === 'curso' ? ['◐', 'var(--warn-bg)', 'var(--warn)'] : ['○', GRIS_BG, MUTED];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 0', borderTop: '1px solid var(--surface-2)' }}>
                      <span style={{ width: 26, height: 26, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: gBg, color: gFg }}>{glyph}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 17 }}>{s.title}</div>
                        <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)', marginTop: 4 }}>{s.estado}</div>
                      </div>
                      <span style={{ marginLeft: 'auto', flex: 'none', fontFamily: MONO, fontSize: 14, fontWeight: 600, padding: '6px 13px', borderRadius: 8, background: CHIP[s.fxT][0], color: CHIP[s.fxT][1], whiteSpace: 'nowrap' }}>{s.fx}</span>
                    </div>
                  );
                })}
              </section>
            </div>
          )}

        </div>
      )}

      {/* ═══ DETAIL ═══ */}
      {view === 'detail' && (
        <div style={{ display: 'grid', gridTemplateColumns: '214px 1fr', gap: 26, marginTop: 26, alignItems: 'start' }}>

          {/* cobertura de datos */}
          {reporte.cobertura.length > 0 && (
            <section style={{ gridColumn: '1 / -1', background: GRIS_BG, border: '1px solid var(--border-strong)', borderRadius: 14, padding: '16px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: GRIS, marginRight: 4 }}>Cobertura de datos</span>
                {reporte.cobertura.map((c, i) => (
                  <Fragment key={i}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: GRIS }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.tone === 'warn' ? WARN_FILL : GRIS }} />
                      {c.label}
                    </span>
                    {c.accion && (
                      <button type="button" onClick={() => setView('plan')} style={{ border: 0, borderRadius: 8, background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontWeight: 600, fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}>{c.accion}</button>
                    )}
                  </Fragment>
                ))}
              </div>
            </section>
          )}

          {/* nav de herramientas */}
          <nav style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', margin: '0 0 8px 12px' }}>Herramientas</div>
            {TOOL_ORDER.map((t) => {
              const n = findsDe(t).length;
              const active = tool === t;
              return (
                <button key={t} type="button" onClick={() => setTool(t)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: 0, borderRadius: 9, background: active ? 'var(--primary-bg)' : 'transparent', padding: '10px 12px', cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: active ? 600 : 500, color: active ? 'var(--primary)' : 'var(--dim)' }}>
                  {TOOL_LABEL[t]}
                  {n > 0 && (
                    <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, fontWeight: 600, padding: '0 7px', borderRadius: 6, background: active ? 'var(--surface)' : GRIS_BG, color: active ? 'var(--primary)' : GRIS }}>{n}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* panel de la herramienta */}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <h2 style={{ fontWeight: 600, fontSize: 26, letterSpacing: '-0.02em', margin: 0 }}>{TOOL_LABEL[tool]}</h2>
              {TOOL_HREF[tool] && (
                <Link href={TOOL_HREF[tool]!} style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Ver en {TOOL_LABEL[tool]} →</Link>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--dim)', lineHeight: 1.45, maxWidth: 640 }}>{TOOL_BLURB[tool]}</p>
            <ToolChart tool={tool} charts={reporte.charts} />
            {findsDe(tool).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
                {findsDe(tool).map((f) => (
                  <FindingCard key={f.id} f={f} st={stArea(f.area)} onOpen={() => setModal({ kind: 'find', id: f.id })} />
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: 44, textAlign: 'center', color: 'var(--faint)', fontSize: 15 }}>
                MaKo leyó esta tab pero no encontró hallazgos este período.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ═══ MODAL ═══ */}
      {(modalFind || modalAct) && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,22,27,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 20px', overflowY: 'auto', animation: 'rrModalFade .16s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 24px 60px rgba(20,22,27,.24)', overflow: 'hidden', animation: 'rrModalPop .2s cubic-bezier(.2,.7,.3,1)' }}>

            {/* ── modal de hallazgo ── */}
            {modalFind && (() => {
              const f = modalFind;
              const b = BADGE[f.tipo];
              const href = TOOL_HREF[f.tool];
              return (
                <div style={{ padding: '26px 30px 28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', padding: '4px 12px', borderRadius: 7, background: b.bg, color: b.fg }}>
                      {f.tipo === 'cruce' && f.cross ? `⇄ Cruce · ${f.cross}` : b.label}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT[stArea(f.area)] }} />
                      {TOOL_LABEL[f.tool]}
                    </span>
                    <button type="button" onClick={closeModal} style={{ marginLeft: 'auto', width: 30, height: 30, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                  </div>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', marginBottom: 18 }}>
                    <EvidenciaBlock ev={f.ev} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
                    <span style={{ flex: 'none', marginTop: 5 }}><MakoStar size={16} /></span>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 21, letterSpacing: '-0.014em', lineHeight: 1.32, textWrap: 'pretty' }}>{f.insight}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>Fuente: {f.source}</span>
                    {href && (
                      <Link href={href} style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Ver en {f.tab} →</Link>
                    )}
                  </div>
                  {(() => {
                    // Solo si la recomendación existe en el plan (los recId colgantes no muestran botón).
                    const rec = f.recId ? reporte.plan.find((p) => p.id === f.recId) : undefined;
                    if (!rec) return null;
                    const esExp = rec.kind === 'exp';
                    return (
                      <button type="button" onClick={() => { setView('plan'); setModal({ kind: 'act', id: rec.id }); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, border: `1px solid ${esExp ? BLUE_BD : 'var(--border-strong)'}`, borderRadius: 9, background: esExp ? 'var(--primary-bg)' : 'var(--surface)', color: esExp ? 'var(--primary)' : 'var(--ink)', fontFamily: MONO, fontSize: 12.5, fontWeight: 600, padding: '9px 14px', cursor: 'pointer', maxWidth: '100%' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>→ {esExp ? 'Experiment' : 'To-do'}: {rec.titulo.length > 46 ? rec.titulo.slice(0, 46) + '…' : rec.titulo}</span>
                      </button>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
                    <button type="button" disabled title="próximamente" style={{ border: '1px solid var(--border-strong)', borderRadius: 9, background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'not-allowed', opacity: 0.6 }}>Debatir con MaKo</button>
                    <button type="button" disabled title="próximamente" style={{ border: '1px solid var(--border-strong)', borderRadius: 9, background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'not-allowed', opacity: 0.6 }}>Marcar dato dudoso</button>
                  </div>
                </div>
              );
            })()}

            {/* ── modal de acción (plan item) ── */}
            {modalAct && (() => {
              const a = modalAct;
              const exp = a.kind === 'exp';
              const busy = busyPlanId === a.id;
              const st = a.status ? statusChip(a.status) : null;
              const dis: CSSProperties = busy ? { opacity: 0.55, cursor: 'default' } : {};
              return (
                <div style={{ padding: '26px 30px 28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 18 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 6, background: exp ? 'var(--primary-bg)' : GRIS_BG, color: exp ? 'var(--primary)' : 'var(--ink)' }}>
                      {exp ? 'Experiment' : 'To-do'}
                    </span>
                    {a.prio && (
                      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 6, background: prioColors(a.prio)[0], color: prioColors(a.prio)[1] }}>{a.prio}</span>
                    )}
                    <button type="button" onClick={closeModal} style={{ marginLeft: 'auto', width: 30, height: 30, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <span style={{ flex: 'none', marginTop: 5 }}><MakoStar size={18} /></span>
                    <h3 style={{ fontWeight: 600, fontSize: 23, letterSpacing: '-0.014em', lineHeight: 1.28, margin: 0, textWrap: 'pretty' }}>{a.titulo}</h3>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', margin: '0 0 14px 28px' }}>{a.origen}</div>
                  <p style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--dim)', lineHeight: 1.5 }}>{a.why}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--good)', background: 'var(--good-bg)', borderRadius: 7, padding: '5px 12px' }}>impacto estimado {a.impacto}</span>
                  </div>
                  {a.chain && a.chain.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>Para poder probarlo</div>
                      <div style={{ borderLeft: '2px solid var(--border-strong)', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {a.chain.map((t, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0' }}>
                            <span style={{ width: 17, height: 17, flex: 'none', border: '1.5px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)' }} />
                            <span style={{ fontSize: 15 }}>{t}</span>
                            <span style={{ marginLeft: 'auto', flex: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', color: 'var(--dim)' }}>To-do</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {st ? (
                    <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                      <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 999, background: st.bg, color: st.fg }}>{st.long}</span>
                      <button type="button" disabled={busy} onClick={() => onPlan(a, 'deshacer')} style={{ border: 0, background: 'none', color: 'var(--primary)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', ...dis }}>Deshacer</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                        <button type="button" disabled={busy} onClick={() => { setDiscardId(null); setDiscardMotivo(''); onPlan(a, 'aceptar'); }} style={{ border: 0, borderRadius: 10, background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '11px 18px', cursor: 'pointer', whiteSpace: 'nowrap', ...dis }}>Aceptar</button>
                        <button type="button" disabled={busy} onClick={() => { setDiscardId(null); setDiscardMotivo(''); onPlan(a, 'posponer'); }} style={{ border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '11px 16px', cursor: 'pointer', whiteSpace: 'nowrap', ...dis }}>Posponer</button>
                        <button type="button" disabled={busy} onClick={() => { setDiscardId(discardId === a.id ? null : a.id); setDiscardMotivo(''); }} style={{ border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '11px 16px', cursor: 'pointer', whiteSpace: 'nowrap', ...dis }}>Descartar</button>
                        <button type="button" disabled title="próximamente" style={{ border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '11px 16px', cursor: 'not-allowed', whiteSpace: 'nowrap', opacity: 0.6 }}>Debatir con MaKo</button>
                      </div>
                      {discardId === a.id && (
                        <div style={{ marginTop: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 11 }}>Motivo del descarte</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            {MOTIVOS.map((m) => (
                              <button key={m} type="button" disabled={busy} onClick={() => setDiscardMotivo(m)} style={{ ...pillBtn(discardMotivo === m), ...dis }}>{m}</button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 9 }}>
                            <button type="button" disabled={busy} onClick={() => { onPlan(a, 'descartar', discardMotivo || undefined); setDiscardId(null); }} style={{ border: 0, borderRadius: 9, background: 'var(--ink)', color: '#fff', fontFamily: SANS, fontWeight: 600, fontSize: 13.5, padding: '9px 16px', cursor: 'pointer', ...dis }}>Confirmar descarte</button>
                            <button type="button" disabled={busy} onClick={() => { setDiscardId(null); setDiscardMotivo(''); }} style={{ border: '1px solid var(--border-strong)', borderRadius: 9, background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontWeight: 600, fontSize: 13.5, padding: '9px 14px', cursor: 'pointer', ...dis }}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
}
