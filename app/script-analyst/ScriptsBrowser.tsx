'use client';

// =============================================================================
// ScriptsBrowser — Scripts Analyst (port del diseño "Scripts Analyst.dc.html")
// =============================================================================
// Toda la lógica determinística (verdicto, confianza, retención por beat,
// patrones ganadores, cuadrante) se calcula acá sobre los ScriptView que arma
// el server (lib/script-analyst.ts). Las conclusiones de MaKo se derivan de los
// patrones reales del período. La curva de retención sale de los cuartiles de
// Meta y los tiempos de cada beat los estima Claude (ambos rotulados).
// =============================================================================

import { createElement as h, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Dropdown } from '../components/Dropdown';
import type { ScriptView, ScriptAnalystView } from '@/lib/script-analyst';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── Vocabularios visuales (del diseño) ──
const ANGLE: Record<string, { label: string; c: string }> = {
  visionario: { label: 'Visionario', c: '#2F6DDB' }, capataz: { label: 'Capataz', c: '#C8870C' },
  dolor: { label: 'Dolor', c: '#CF4E29' }, testimonio: { label: 'Testimonio', c: '#3B6D11' }, oferta: { label: 'Oferta', c: '#7C4DD6' },
};
const KIND: Record<string, { label: string; c: string }> = {
  gancho: { label: 'Gancho', c: '#C8870C' }, contexto: { label: 'Contexto', c: '#B5742A' }, problema: { label: 'Problema', c: '#CF4E29' },
  mecanismo: { label: 'Mecanismo', c: '#2F6DDB' }, prueba: { label: 'Prueba', c: '#3B6D11' }, objecion: { label: 'Objeción', c: '#A8770F' },
  recordatorio: { label: 'Recordatorio', c: '#7C4DD6' }, oferta: { label: 'Oferta + CTA', c: '#7C4DD6' }, cta: { label: 'CTA', c: '#0E8E7E' },
};
const VERDICT: Record<string, { label: string; c: string }> = {
  escalar: { label: 'Escalar', c: '#1C8A54' }, mejorar: { label: 'Mejorar gancho', c: '#2F6DDB' }, reescribir: { label: 'Reescribir cuerpo', c: '#9A6A09' },
  repensar: { label: 'Repensar', c: '#CF4E29' }, validar: { label: 'Validar (poco spend)', c: '#6B675C' },
};
const CONF: Record<string, { label: string; c: string }> = {
  alta: { label: 'Alta', c: '#1C8A54' }, media: { label: 'Media', c: '#A8770F' }, baja: { label: 'Baja', c: '#A39E91' },
};
const HOOK_MID = 20, HOLD_MID = 22;
const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';

// ── Helpers puros ──
function rgba(hex: string, a: number): string {
  const n = hex.replace('#', '');
  return `rgba(${parseInt(n.substring(0, 2), 16)},${parseInt(n.substring(2, 4), 16)},${parseInt(n.substring(4, 6), 16)},${a})`;
}
function fmtT(s: number): string { return `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`; }
function fmtUSD(n: number): string { return `$${Math.round(n).toLocaleString('en-US')}`; }
function fmtK(n: number): string { return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`; }
function hookColor(hr: number): string { return hr >= 22 ? 'var(--good)' : hr >= 15 ? 'var(--warn)' : 'var(--bad)'; }
function retColor(r: number): string { return r >= 25 ? 'var(--good)' : r >= 18 ? 'var(--warn)' : 'var(--bad)'; }
function angleInfo(k: string) { return ANGLE[k] ?? { label: k, c: '#6B675C' }; }
function confidence(a: ScriptView): 'alta' | 'media' | 'baja' { return a.impressions >= 25000 ? 'alta' : a.impressions >= 8000 ? 'media' : 'baja'; }
function fatigue(a: ScriptView): 'alta' | 'media' | 'ok' { return a.freq >= 2.4 ? 'alta' : a.freq >= 1.8 ? 'media' : 'ok'; }
function fatColor(a: ScriptView): string { const f = fatigue(a); return f === 'alta' ? 'var(--bad)' : f === 'media' ? 'var(--warn)' : 'var(--dim)'; }
function cpa(a: ScriptView): number | null { return a.agendas > 0 ? a.spend / a.agendas : null; }
function hold(a: ScriptView): number { return a.beats.length ? a.beats[a.beats.length - 1].ret : a.finalRet; }
function verdictOf(a: ScriptView): string {
  if (confidence(a) === 'baja') return 'validar';
  const hi = a.hookRate >= HOOK_MID, ho = hold(a) >= HOLD_MID;
  return hi ? (ho ? 'escalar' : 'reescribir') : (ho ? 'mejorar' : 'repensar');
}
function angleChip(k: string): CSSProperties {
  const a = angleInfo(k);
  return { display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 6, fontFamily: MONO, letterSpacing: '.04em', background: rgba(a.c, .12), color: a.c, border: `1px solid ${rgba(a.c, .3)}` };
}
function kindChip(k: string): CSSProperties {
  const x = KIND[k] ?? { label: k, c: '#6B675C' };
  return { display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, fontFamily: MONO, letterSpacing: '.05em', textTransform: 'uppercase', background: rgba(x.c, .12), color: x.c, border: `1px solid ${rgba(x.c, .28)}` };
}
function verdictChip(k: string): CSSProperties {
  const v = VERDICT[k];
  return { display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', background: rgba(v.c, .1), color: v.c, border: `1px solid ${rgba(v.c, .32)}` };
}
function bar(v: number, max: number, c: string): CSSProperties {
  return { height: '100%', width: `${Math.max(2, Math.min(100, (v / max) * 100))}%`, background: c, borderRadius: 8 };
}
function spark(size: number, id: string): ReactNode {
  return h('svg', { width: size, height: size, viewBox: '-12 -12 24 24', style: { display: 'block', overflow: 'visible' } },
    h('defs', null, h('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' },
      h('stop', { offset: '0%', stopColor: '#F6D365' }), h('stop', { offset: '100%', stopColor: '#EF9F27' }))),
    h('path', { d: SPARK, fill: `url(#${id})` }));
}
function funnelSeg(retIn: number, retOut: number, severe: boolean): ReactNode {
  const wi = Math.max(retIn, 5), wo = Math.max(retOut, 5);
  const pts = `${(50 - wi / 2).toFixed(1)},0 ${(50 + wi / 2).toFixed(1)},0 ${(50 + wo / 2).toFixed(1)},100 ${(50 - wo / 2).toFixed(1)},100`;
  return h('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', style: { width: '100%', height: '100%', display: 'block' } },
    h('polygon', { points: pts, fill: severe ? '#CF4E29' : '#D9A23C' }));
}

type DecoratedBeat = {
  kindLabel: string; kindChip: CSSProperties; time: string; text: string; funnel: ReactNode;
  retInText: string; retInColor: string; dropText: string; dropColor: string;
  isSteep: boolean; steepLabel: string; rowStyle: CSSProperties;
};
function decorateBeats(sc: ScriptView): DecoratedBeat[] {
  const beats = sc.beats;
  let leakIdx = 0, maxDrop = -1;
  const info = beats.map((b, i) => {
    const next = beats[i + 1] ? beats[i + 1].ret : sc.finalRet;
    const drop = b.ret - next;
    if (drop > maxDrop) { maxDrop = drop; leakIdx = i; }
    return { drop, next };
  });
  const severe = maxDrop >= 30;
  return beats.map((b, i) => {
    const k = KIND[b.kind] ?? { label: b.kind, c: '#6B675C' };
    const drop = info[i].drop, next = info[i].next;
    const t1 = beats[i + 1] ? beats[i + 1].t0 : sc.dur;
    const isSteep = i === leakIdx;
    const sev = isSteep && severe;
    const dropColor = drop >= 30 ? 'var(--bad)' : drop >= 18 ? 'var(--warn)' : 'var(--faint)';
    return {
      kindLabel: k.label, kindChip: kindChip(b.kind), time: `${fmtT(b.t0)}–${fmtT(t1)}`, text: b.text,
      funnel: funnelSeg(b.ret, next, sev), retInText: `${b.ret}%`, retInColor: sev ? '#fff' : '#5A3E0A',
      dropText: `↓ ${drop} pts`, dropColor, isSteep,
      steepLabel: severe ? 'Aquí se va la mayor parte de los views' : 'La caída más fuerte del guión',
      rowStyle: { display: 'flex', alignItems: 'stretch', minHeight: 90, borderBottom: i < beats.length - 1 ? '1px solid var(--border)' : 'none' },
    };
  });
}

// ── Patrones ganadores (determinístico sobre los guiones confiables) ──
type PatternCard = {
  key: string; chip: string; c: string; big: string; tlabel: string; bigColor: string; stmt: string;
  aLabel: string; aVal: string; a: number; bLabel: string; bVal: string; b: number; max: number; ads: ScriptView[];
};
type Patterns = {
  marquee: { pct: number; rateWith: number; rateWithout: number; lift: string; spendShare: number; nWin: number; nDashWin: number; ads: ScriptView[] };
  cards: PatternCard[];
};
function buildPatterns(ads: ScriptView[]): Patterns {
  const won = (a: ScriptView) => a.agendas > 0;
  const tag = (a: ScriptView, t: string) => a.tags.indexOf(t) >= 0;
  const mean = (arr: ScriptView[], f: (x: ScriptView) => number) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0);
  const sum = (arr: ScriptView[], f: (x: ScriptView) => number) => arr.reduce((s, x) => s + f(x), 0);
  const r = (x: number) => Math.round(x);
  const winners = ads.filter(won);
  const dash = ads.filter((a) => tag(a, 'dashboard')), noDash = ads.filter((a) => !tag(a, 'dashboard'));
  const dashWin = winners.filter((a) => tag(a, 'dashboard'));
  const spendWin = sum(winners, (a) => a.spend), spendDashWin = sum(dashWin, (a) => a.spend);
  const marquee = {
    pct: winners.length ? r((dashWin.length / winners.length) * 100) : 0,
    rateWith: dash.length ? r((dash.filter(won).length / dash.length) * 100) : 0,
    rateWithout: noDash.length ? r((noDash.filter(won).length / noDash.length) * 100) : 0,
    nWin: winners.length, nDashWin: dashWin.length,
    spendShare: spendWin > 0 ? r((spendDashWin / spendWin) * 100) : 0,
    ads: dash.filter(won), lift: '0',
  };
  marquee.lift = (marquee.rateWith / Math.max(marquee.rateWithout, 1)).toFixed(1);

  const cards: PatternCard[] = [];
  const gH = ads.filter((a) => a.hookType === 'resultado' || a.hookType === 'pregunta'), gD = ads.filter((a) => a.hookType === 'dolor');
  if (gH.length && gD.length) {
    cards.push({ key: 'hook', chip: 'Tipo de gancho', c: '#C8870C', big: `${r(mean(gH, (a) => a.hookRate))}%`, tlabel: 'hook con cifra o pregunta', bigColor: '#C8870C',
      stmt: `Los ganchos que abren con una cifra o una pregunta promedian ${r(mean(gH, (a) => a.hookRate))}% de hook rate — bastante más que abrir con dolor abstracto.`,
      aLabel: 'cifra/pregunta', aVal: `${r(mean(gH, (a) => a.hookRate))}%`, a: mean(gH, (a) => a.hookRate), bLabel: 'dolor', bVal: `${r(mean(gD, (a) => a.hookRate))}%`, b: mean(gD, (a) => a.hookRate), max: 30, ads: gH });
  }
  const gA = ads.filter((a) => a.dur >= 44), gB = ads.filter((a) => a.dur < 44);
  if (gA.length && gB.length) {
    const diff = r(mean(gA, (a) => hold(a))) - r(mean(gB, (a) => hold(a)));
    cards.push({ key: 'dur', chip: 'Duración', c: '#0E8E7E', stmt: `Los guiones de 44s o más retienen ${diff >= 0 ? '+' : ''}${diff} pts al CTA frente a los de menos de 44s. Dan tiempo a construir el deseo.`,
      aLabel: '≥44s', aVal: `${r(mean(gA, (a) => hold(a)))}%`, a: mean(gA, (a) => hold(a)), bLabel: '<44s', bVal: `${r(mean(gB, (a) => hold(a)))}%`, b: mean(gB, (a) => hold(a)), max: 35, ads: gA,
      big: `${diff >= 0 ? '+' : ''}${diff} pts`, tlabel: 'retención extra en 44s o más', bigColor: '#0E8E7E' });
  }
  const iA = ads.filter((a) => tag(a, 'implementacion')), iB = ads.filter((a) => !tag(a, 'implementacion'));
  if (iA.length && iB.length) {
    cards.push({ key: 'impl', chip: 'Contenido', c: '#7C4DD6', stmt: `Mostrar cómo se implementa (el setup, el panel en marcha) está en los guiones con más cierres: ${mean(iA, (a) => a.cierres).toFixed(1)} vs ${mean(iB, (a) => a.cierres).toFixed(1)} de los que no lo muestran.`,
      aLabel: 'lo muestran', aVal: mean(iA, (a) => a.cierres).toFixed(1), a: mean(iA, (a) => a.cierres), bLabel: 'no', bVal: mean(iB, (a) => a.cierres).toFixed(1), b: mean(iB, (a) => a.cierres), max: Math.max(mean(iA, (a) => a.cierres), 0.1), ads: iA,
      big: `${(mean(iA, (a) => a.cierres) / Math.max(mean(iB, (a) => a.cierres), 0.1)).toFixed(1)}×`, tlabel: 'cierres al mostrar el setup', bigColor: '#7C4DD6' });
  }
  // eficiencia: agendas por $1k por ángulo
  const byAng: Record<string, ScriptView[]> = {};
  ads.forEach((a) => { (byAng[a.angle] = byAng[a.angle] || []).push(a); });
  let bestEff: { k: string; per1k: number } | null = null, waste: { k: string; sp: number; g: ScriptView[] } | null = null;
  Object.keys(byAng).forEach((k) => {
    const g = byAng[k], sp = sum(g, (x) => x.spend), ag = sum(g, (x) => x.agendas), per1k = sp > 0 ? (ag / sp) * 1000 : 0;
    if (ag > 0 && (!bestEff || per1k > bestEff.per1k)) bestEff = { k, per1k };
    if (ag === 0 && sp > 0 && (!waste || sp > waste.sp)) waste = { k, sp, g };
  });
  if (bestEff && waste) {
    const be = bestEff as { k: string; per1k: number }, wa = waste as { k: string; sp: number; g: ScriptView[] };
    cards.push({ key: 'eff', chip: 'Eficiencia $', c: '#1C8A54', stmt: `El ángulo ${angleInfo(be.k).label} agenda ${be.per1k.toFixed(1)} juntas por cada $1,000. El ángulo ${angleInfo(wa.k).label} gastó ${fmtUSD(wa.sp)} sin una sola agenda — pausalo.`,
      aLabel: angleInfo(be.k).label, aVal: be.per1k.toFixed(1), a: be.per1k, bLabel: angleInfo(wa.k).label, bVal: '0', b: 0, max: Math.max(be.per1k, 1), ads: wa.g,
      big: be.per1k.toFixed(1), tlabel: `juntas por $1k · ${angleInfo(be.k).label}`, bigColor: '#1C8A54' });
  }
  // fatiga
  const fat = ads.filter((a) => a.freq >= 2.4), healthy = ads.filter((a) => a.freq < 1.8);
  if (fat.length && healthy.length) {
    cards.push({ key: 'fat', chip: 'Fatiga', c: '#CF4E29', stmt: `${fat.length} guiones ya pasaron frecuencia 2.5 — la misma gente los vio de más y su costo por resultado sube. Rotá el creativo antes de que se quemen.`,
      aLabel: 'saturados', aVal: `${mean(fat, (a) => a.freq).toFixed(1)}x`, a: mean(fat, (a) => a.freq), bLabel: 'sanos', bVal: `${mean(healthy, (a) => a.freq).toFixed(1)}x`, b: mean(healthy, (a) => a.freq), max: 3, ads: fat,
      big: String(fat.length), tlabel: 'guiones saturados (frec. >2.5)', bigColor: '#CF4E29' });
  }
  return { marquee, cards };
}

type DrillRow = { id: string; name: string; angleColor: string; sub: string; verdictLabel: string; verdictChip: CSSProperties };
function drillRows(ads: ScriptView[]): DrillRow[] {
  return ads.slice().sort((a, b) => b.spend - a.spend).map((a) => ({
    id: a.id, name: a.name, angleColor: angleInfo(a.angle).c,
    sub: `${angleInfo(a.angle).label} · hook ${a.hookRate}% · ${fmtUSD(a.spend)} · ${a.agendas} agendas`,
    verdictLabel: VERDICT[verdictOf(a)].label, verdictChip: verdictChip(verdictOf(a)),
  }));
}

// MaKo: conclusiones derivadas de los patrones reales del período.
function makoConclusions(reliable: ScriptView[], P: Patterns): { text: string; bullets: string[] } {
  const bullets: string[] = [];
  if (P.marquee.nWin > 0 && P.marquee.nDashWin > 0 && P.marquee.rateWith > P.marquee.rateWithout) {
    bullets.push(`Mostrá el dashboard en pantalla. Los guiones que muestran un panel agendan ${P.marquee.rateWith}% vs ${P.marquee.rateWithout}% y concentran ${P.marquee.spendShare}% del spend que sí agenda.`);
  }
  const eff = P.cards.find((c) => c.key === 'eff');
  if (eff) bullets.push(`Cortá el ángulo ${eff.bLabel}: gastó sin agendar, mientras ${eff.aLabel} rinde ${eff.aVal} juntas por cada $1k. Movele ese presupuesto.`);
  const fat = P.cards.find((c) => c.key === 'fat');
  if (fat) bullets.push(`Refrescá los ${fat.big} guiones saturados (frecuencia >2.5): mismo guion, creativo nuevo, antes de que suba el costo por resultado.`);
  const hookCard = P.cards.find((c) => c.key === 'hook');
  if (hookCard) bullets.push(`Abrí con cifra o pregunta: promedian ${hookCard.aVal} de hook rate frente a ${hookCard.bVal} al abrir con dolor abstracto.`);
  const impl = P.cards.find((c) => c.key === 'impl');
  if (impl && bullets.length < 4) bullets.push(`Mostrá la implementación: los guiones que enseñan el setup promedian ${impl.aVal} cierres vs ${impl.bVal} de los que no.`);
  const text = reliable.length
    ? `Leí los ${reliable.length} guiones con señal suficiente, cruzando guion, spend, frecuencia y resultado. Ponderado por lo que cada uno gastó, esto es lo que importa:`
    : 'Todavía no hay guiones con suficiente señal para sacar patrones confiables. Dejá correr más presupuesto y volvé.';
  return { text, bullets: bullets.slice(0, 4) };
}

// ─────────────────────────────────────────────────────────────────────────────

export function ScriptsBrowser({ data, errorMsg }: { data: ScriptAnalystView; errorMsg: string | null }) {
  const router = useRouter();
  const ads = data.scripts;
  const { counts, lastSync } = data;

  const [angle, setAngle] = useState('todos');
  const [mapMode, setMapMode] = useState<'ads' | 'angle'>('ads');
  const [sort, setSort] = useState<{ key: string; dir: number }>({ key: 'spend', dir: -1 });
  const [openAd, setOpenAd] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ title: string; aLabel: string; aVal: string; aColor: string; aBar: CSSProperties; bLabel: string; bVal: string; bBar: CSSProperties; rows: DrillRow[] } | null>(null);
  const [mako, setMako] = useState(false);
  const [showCaveat, setShowCaveat] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [reMsg, setReMsg] = useState<string | null>(null);

  async function sincronizar() {
    setSyncing(true); setSyncMsg('Analizando guiones…');
    try {
      const r = await fetch('/api/script-analyst/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló el sync');
      setSyncMsg(`${j.analizados} analizados${j.restantes > 0 ? ` · quedan ${j.restantes}` : ''}.`);
      router.refresh();
    } catch (e) { setSyncMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSyncing(false); }
  }
  async function reanalizar(adId: string) {
    setReMsg('Re-analizando…');
    try {
      const r = await fetch('/api/script-analyst/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad_id: adId }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló');
      setReMsg('Listo.'); router.refresh();
    } catch (e) { setReMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
  }

  const reliable = useMemo(() => ads.filter((a) => confidence(a) !== 'baja'), [ads]);
  const visible = useMemo(() => ads.filter((s) => angle === 'todos' || s.angle === angle), [ads, angle]);
  const P = useMemo(() => buildPatterns(reliable), [reliable]);
  const mk = useMemo(() => makoConclusions(reliable, P), [reliable, P]);

  // KPIs (ponderados por spend)
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const totalAg = ads.reduce((s, a) => s + a.agendas, 0);
  const wHook = totalSpend > 0 ? Math.round(ads.reduce((s, a) => s + a.hookRate * a.spend, 0) / totalSpend) : 0;
  const wasteSpend = ads.filter((a) => a.agendas === 0).reduce((s, a) => s + a.spend, 0);
  const wasteN = ads.filter((a) => a.agendas === 0).length;

  // tabla
  const cols: Array<{ key: string; label: string; al: 'left' | 'right' }> = [
    { key: 'name', label: 'Anuncio', al: 'left' }, { key: 'angle', label: 'Ángulo', al: 'left' },
    { key: 'hookRate', label: 'Hook', al: 'right' }, { key: 'hold', label: 'Ret. CTA', al: 'right' },
    { key: 'spend', label: 'Spend', al: 'right' }, { key: 'freq', label: 'Frec.', al: 'right' },
    { key: 'agendas', label: 'Agendas', al: 'right' }, { key: 'cpa', label: '$/agenda', al: 'right' },
    { key: 'verdict', label: 'Veredicto', al: 'left' },
  ];
  const val = (a: ScriptView, k: string): number | string => {
    if (k === 'angle') return angleInfo(a.angle).label;
    if (k === 'hold') return hold(a);
    if (k === 'cpa') { const c = cpa(a); return c == null ? Infinity : c; }
    if (k === 'verdict') return verdictOf(a);
    if (k === 'name') return a.name;
    return (a as unknown as Record<string, number>)[k];
  };
  const sorted = useMemo(() => visible.slice().sort((x, y) => {
    const vx = val(x, sort.key), vy = val(y, sort.key);
    if (typeof vx === 'string' && typeof vy === 'string') return sort.dir * vx.localeCompare(vy);
    const nx = vx as number, ny = vy as number;
    const d = nx - ny;
    // $/agenda mapea null→Infinity; Infinity−Infinity=NaN rompe el contrato de sort.
    const safe = Number.isFinite(d) ? d : nx === ny ? 0 : nx > ny ? 1 : -1;
    return sort.dir * safe;
  }), [visible, sort]);

  // ── cuadrante (SVG) ──
  function quadMap(items: ScriptView[], mode: 'ads' | 'angle', selId: string | null): ReactNode {
    const W = 560, H = 412, padL = 46, padR = 16, padT = 22, padB = 42;
    const x0 = 8, x1 = 32, y0 = 10, y1 = 32;
    const xOf = (v: number) => padL + ((Math.min(Math.max(v, x0), x1) - x0) / (x1 - x0)) * (W - padL - padR);
    const yOf = (v: number) => padT + (1 - (Math.min(Math.max(v, y0), y1) - y0) / (y1 - y0)) * (H - padT - padB);
    const L = padL, R = W - padR, T = padT, B = H - padB, xMid = xOf(HOOK_MID), yMid = yOf(HOLD_MID);
    const els: ReactNode[] = [];
    els.push(h('rect', { key: 'tr', x: xMid, y: T, width: R - xMid, height: yMid - T, fill: 'rgba(28,138,84,.09)' }));
    els.push(h('rect', { key: 'tl', x: L, y: T, width: xMid - L, height: yMid - T, fill: 'rgba(47,109,219,.06)' }));
    els.push(h('rect', { key: 'br', x: xMid, y: yMid, width: R - xMid, height: B - yMid, fill: 'rgba(200,135,12,.10)' }));
    els.push(h('rect', { key: 'bl', x: L, y: yMid, width: xMid - L, height: B - yMid, fill: 'rgba(207,78,41,.07)' }));
    const ql = (k: string, x: number, y: number, an: 'start' | 'end', c: string, t1: string, t2: string) => {
      els.push(h('text', { key: `${k}a`, x, y, textAnchor: an, fontSize: 11.5, fontWeight: 700, fill: c, fontFamily: 'Geist Mono, monospace' }, t1));
      els.push(h('text', { key: `${k}b`, x, y: y + 14, textAnchor: an, fontSize: 10, fill: '#A39E91', fontFamily: 'Geist, sans-serif' }, t2));
    };
    ql('q1', R - 10, T + 16, 'end', '#1C8A54', 'ESCALAR', 'paran y se quedan');
    ql('q2', L + 10, T + 16, 'start', '#2F6DDB', 'MEJORAR GANCHO', 'entran pocos');
    ql('q3', R - 10, B - 20, 'end', '#9A6A09', 'REESCRIBIR CUERPO', 'paran y se van');
    ql('q4', L + 10, B - 20, 'start', '#CF4E29', 'REPENSAR', 'ni frenan ni retienen');
    els.push(h('line', { key: 'cx', x1: xMid, y1: T, x2: xMid, y2: B, stroke: '#D8D3C6', strokeDasharray: '4 4' }));
    els.push(h('line', { key: 'cy', x1: L, y1: yMid, x2: R, y2: yMid, stroke: '#D8D3C6', strokeDasharray: '4 4' }));
    els.push(h('line', { key: 'ax', x1: L, y1: B, x2: R, y2: B, stroke: '#E7E3D9' }));
    els.push(h('line', { key: 'ay', x1: L, y1: T, x2: L, y2: B, stroke: '#E7E3D9' }));
    els.push(h('text', { key: 'xt', x: (L + R) / 2, y: H - 7, textAnchor: 'middle', fontSize: 10.5, fontWeight: 600, fill: '#6B675C', fontFamily: 'Geist Mono, monospace' }, 'HOOK RATE → ¿frena el scroll?'));
    els.push(h('text', { key: 'yt', x: 14, y: (T + B) / 2, textAnchor: 'middle', fontSize: 10.5, fontWeight: 600, fill: '#6B675C', fontFamily: 'Geist Mono, monospace', transform: `rotate(-90 14 ${(T + B) / 2})` }, 'RETENCIÓN AL CTA →'));
    if (mode === 'angle') {
      const byA: Record<string, ScriptView[]> = {};
      items.forEach((a) => { (byA[a.angle] = byA[a.angle] || []).push(a); });
      Object.keys(byA).forEach((k) => {
        const g = byA[k], sp = g.reduce((s, x) => s + x.spend, 0);
        const mh = sp > 0 ? g.reduce((s, x) => s + x.hookRate * x.spend, 0) / sp : 0;
        const mo = sp > 0 ? g.reduce((s, x) => s + hold(x) * x.spend, 0) / sp : 0;
        const cx = xOf(mh), cy = yOf(mo), r = 13 + Math.sqrt(sp) / 9, c = angleInfo(k).c;
        els.push(h('circle', { key: `c${k}`, cx, cy, r, fill: rgba(c, .74), stroke: '#fff', strokeWidth: 2, style: { cursor: 'pointer' }, onClick: () => { setAngle(k); setMapMode('ads'); } }));
        els.push(h('text', { key: `n${k}`, x: cx, y: cy + 4, textAnchor: 'middle', fontSize: 12, fontWeight: 700, fill: '#fff', fontFamily: 'Geist, sans-serif', style: { pointerEvents: 'none' } }, g.length));
        els.push(h('text', { key: `l${k}`, x: cx, y: cy - r - 5, textAnchor: 'middle', fontSize: 10.5, fontWeight: 600, fill: '#1A1813', fontFamily: 'Geist, sans-serif', style: { paintOrder: 'stroke', stroke: '#F2F0EA', strokeWidth: 3, strokeLinejoin: 'round', pointerEvents: 'none' } }, angleInfo(k).label));
      });
    } else {
      items.forEach((s) => {
        const cx = xOf(s.hookRate), cy = yOf(hold(s)), r = 7 + (Math.min(s.spend, 2100) / 2100) * 15, c = angleInfo(s.angle).c, on = s.id === selId;
        const conf = confidence(s); const op = conf === 'alta' ? .82 : conf === 'media' ? .5 : .26; const low = conf === 'baja';
        if (on) els.push(h('circle', { key: `o${s.id}`, cx, cy, r: r + 4, fill: 'none', stroke: '#1A1813', strokeWidth: 1.5 }));
        els.push(h('circle', { key: `c${s.id}`, cx, cy, r, fill: rgba(c, op), stroke: low ? '#A39E91' : '#fff', strokeWidth: 1.5, strokeDasharray: low ? '3 2' : undefined, style: { cursor: 'pointer' }, onClick: () => setOpenAd(s.id) }));
        els.push(h('text', { key: `l${s.id}`, x: cx, y: cy - r - 5, textAnchor: 'middle', fontSize: 10, fontWeight: 600, fill: low ? '#A39E91' : '#1A1813', fontFamily: 'Geist, sans-serif', style: { paintOrder: 'stroke', stroke: '#F2F0EA', strokeWidth: 3, strokeLinejoin: 'round', pointerEvents: 'none' } }, s.short));
      });
    }
    return h('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', height: 'auto', display: 'block' } }, ...els);
  }

  function openPattern(p: PatternCard | { stmt: string; aLabel: string; aVal: string; a: number; bLabel: string; bVal: string; b: number; max: number; c: string; ads: ScriptView[] }) {
    setDrill({
      title: p.stmt, aLabel: p.aLabel, aVal: p.aVal, aColor: p.c, aBar: bar(p.a, p.max, p.c),
      bLabel: p.bLabel, bVal: p.bVal, bBar: bar(p.b, p.max, 'var(--border-strong)'),
      rows: drillRows(p.ads),
    });
  }

  const lowConf = ads.filter((a) => confidence(a) === 'baja' || (a.hookRate >= 24 && a.agendas === 0 && a.spend < 800));
  const quadLegend = [
    { c: '#1C8A54', title: 'Escalar', sub: 'Paran y se quedan. Más presupuesto.' },
    { c: '#2F6DDB', title: 'Mejorar el gancho', sub: 'Retienen, pero entran pocos.' },
    { c: '#9A6A09', title: 'Reescribir el cuerpo', sub: 'Frenan, pero se aburren y se van.' },
    { c: '#CF4E29', title: 'Repensar', sub: 'Ni frenan ni retienen. Pausar.' },
  ];

  const sel = openAd ? ads.find((a) => a.id === openAd) ?? null : null;

  // ── Estado vacío / error ──
  if (ads.length === 0) {
    return (
      <div style={{ marginTop: 24 }}>
        <SyncBar syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} counts={counts} onSync={sincronizar} />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            {errorMsg ? 'Sin datos disponibles' : 'Todavía no hay guiones analizados en este período'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
            {errorMsg
              ? 'No se pudo leer la base (en local faltan las claves de Supabase). En producción, sincronizá para analizar los guiones de los video ads con transcript.'
              : 'Sincronizá para que MaKo lea los guiones de los video ads (los que ya tienen transcript), los clasifique y arme los patrones. Aparecen acá los guiones con gasto en el período elegido.'}
          </div>
          {!errorMsg && counts.sinTranscript > 0 && (
            <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)', marginTop: 16 }}>
              {counts.sinTranscript} anuncios con gasto sin transcript todavía · {counts.analizadas} guiones analizados en total
            </div>
          )}
          {errorMsg && <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)', marginTop: 16, wordBreak: 'break-word' }}>{errorMsg}</div>}
        </div>
      </div>
    );
  }

  const tableCount = `${visible.length}${angle === 'todos' ? ' guiones' : ` en ${angleInfo(angle).label}`}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)', marginTop: 24 }}>
      <SyncBar syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} counts={counts} onSync={sincronizar} />

      {/* KPIs */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Guiones analizados', value: String(ads.length), sub: `${fmtK(totalSpend)} de gasto`, color: 'var(--ink)' },
          { label: 'Hook rate ponderado', value: `${wHook}%`, sub: 'por gasto, no por conteo', color: hookColor(wHook) },
          { label: 'Costo por agenda', value: totalAg > 0 ? fmtUSD(totalSpend / totalAg) : '—', sub: `${totalAg} agendas en total`, color: 'var(--ink)' },
          { label: 'Gasto sin retorno', value: fmtK(wasteSpend), sub: `${wasteN} guiones, 0 agendas`, color: 'var(--bad)' },
        ].map((k) => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 12 }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</span>
              <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </section>

      {/* PATRONES */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
          <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Patrones Ganadores</h2>
          <button onClick={() => setMako(true)} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(23,21,17,.18)' }}>
            {spark(14, 'sap')}<span>Conclusiones con <span style={{ fontFamily: 'Georgia,serif', fontWeight: 700 }}><span style={{ color: '#EF9F27' }}>M</span>a<span style={{ color: '#EF9F27' }}>K</span>o</span></span>
          </button>
        </div>

        {P.marquee.nWin > 0 && P.marquee.nDashWin > 0 ? (
          <button onClick={() => openPattern({ stmt: `Guiones que agendaron y muestran un panel/dashboard en el guión. Los que lo mencionan agendan ${P.marquee.rateWith}% vs ${P.marquee.rateWithout}% de los que no.`, aLabel: 'mencionan', aVal: `${P.marquee.rateWith}%`, a: P.marquee.rateWith, bLabel: 'no mencionan', bVal: `${P.marquee.rateWithout}%`, b: P.marquee.rateWithout, max: 100, c: '#C8870C', ads: P.marquee.ads })}
            style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: 'linear-gradient(100deg,rgba(28,138,84,.13),rgba(28,138,84,.03))', border: '1px solid rgba(28,138,84,.36)', borderRadius: 16, padding: '22px 24px', margin: '18px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 'none' }}><div style={{ fontSize: 54, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--good)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{P.marquee.pct}%</div></div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>de los guiones que <span style={{ color: 'var(--good)' }}>agendaron</span> menciona o muestra un <b>panel / dashboard</b> en el guión.</div>
                <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.5 }}>Los que lo mencionan agendan <b style={{ color: 'var(--ink)' }}>{P.marquee.rateWithout > 0 ? `${P.marquee.lift}× más` : 'mucho más'}</b> ({P.marquee.rateWith}% vs {P.marquee.rateWithout}%) y concentran <b style={{ color: 'var(--ink)' }}>{P.marquee.spendShare}%</b> del spend que sí agenda. <span style={{ color: 'var(--good)', fontWeight: 600 }}>ver anuncios →</span></div>
              </div>
            </div>
          </button>
        ) : (
          <div style={{ fontSize: 13.5, color: 'var(--faint)', margin: '16px 0' }}>Faltan agendas en el período para sacar el patrón de dashboard. Sincronizá o ampliá el rango de fechas.</div>
        )}

        {P.cards.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(184px,1fr))', gap: 12 }}>
            {P.cards.map((p) => (
              <button key={p.key} onClick={() => openPattern(p)} style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 17px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 152 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 999, fontFamily: MONO, letterSpacing: '.04em', background: rgba(p.c, .12), color: p.c, border: `1px solid ${rgba(p.c, .3)}` }}>{p.chip}</span>
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>ver →</span>
                </div>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', color: p.bigColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{p.big}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.35, marginTop: 6 }}>{p.tlabel}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 13 }}>
                    <div style={{ height: 6, borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}><div style={bar(p.a, p.max, p.c)} /></div>
                    <div style={{ height: 6, borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}><div style={bar(p.b, p.max, 'var(--border-strong)')} /></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* confidence guard */}
        {lowConf.length > 0 && (
          <div style={{ marginTop: 16, background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 14, overflow: 'hidden' }}>
            <button onClick={() => setShowCaveat((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 17px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 7, background: 'var(--bad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>!</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--bad)' }}>Cuidado con la muestra chica</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--bad)', background: 'rgba(207,78,41,.13)', padding: '2px 9px', borderRadius: 999 }}>{lowConf.length}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--bad)' }}>{showCaveat ? '▴' : '▾'}</span>
            </button>
            {showCaveat && (
              <div style={{ padding: '0 18px 16px 52px' }}>
                <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 12 }}>Estos guiones llaman la atención pero aún no probaron nada — poco spend o cero agendas. Validá con presupuesto antes de copiarlos; no los compares de igual a igual con los que ya gastaron miles. Quedan fuera de los patrones de arriba.</div>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {lowConf.map((a) => (
                    <button key={a.id} onClick={() => setOpenAd(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.short}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>hook {a.hookRate}% · {fmtUSD(a.spend)} · {a.agendas} ag</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* MAPA */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Cuadrante de Retención</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Dropdown value={angle} onChange={setAngle} ariaLabel="Ángulo" buttonStyle={{ padding: '9px 14px', fontSize: 13.5 }}
              options={[{ value: 'todos', label: 'Todos los ángulos' }, ...Object.keys(ANGLE).map((k) => ({ value: k, label: ANGLE[k].label, color: ANGLE[k].c }))]} />
            <Dropdown value={mapMode} onChange={(v) => setMapMode(v as 'ads' | 'angle')} ariaLabel="Vista" buttonStyle={{ padding: '9px 14px', fontSize: 13.5 }}
              options={[{ value: 'ads', label: 'Por anuncio' }, { value: 'angle', label: 'Por ángulo' }]} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 244px', gap: 30, alignItems: 'center' }}>
          <div>{quadMap(visible, mapMode, openAd)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Cómo leerlo</div>
            {quadLegend.map((q) => (
              <div key={q.title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, flex: 'none', marginTop: 3, background: q.c }} />
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{q.title}</div><div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.4 }}>{q.sub}</div></div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 11, marginTop: 3 }}>
              {mapMode === 'ads'
                ? 'Cada punto es un anuncio. El tamaño = spend; las burbujas translúcidas con borde punteado tienen poca muestra — no te fíes todavía. Con cientos de ads, cambiá a “Por ángulo”.'
                : 'Cada burbuja es un ángulo (número = cuántos anuncios), ponderado por spend. Tocala para ver sus guiones.'}
            </div>
          </div>
        </div>
      </section>

      {/* TABLA */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Guiones</h2>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)' }}>{tableCount} · clic para el embudo</span>
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 13 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 1000 }}>
            <thead><tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              {cols.map((c) => (
                <th key={c.key} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : (c.key === 'name' || c.key === 'angle' ? 1 : -1) }))}
                  style={{ padding: `13px ${c.al === 'right' ? '14px' : '16px'}`, textAlign: c.al, fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: sort.key === c.key ? 'var(--ink)' : 'var(--dim)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {c.label}{sort.key === c.key ? (sort.dir < 0 ? '  ▾' : '  ▴') : ''}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {sorted.map((a) => {
                const v = verdictOf(a), ho = hold(a), conf = confidence(a), cp = cpa(a);
                return (
                  <tr key={a.id} onClick={() => setOpenAd(a.id)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                    <td style={{ padding: '13px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span title={`Confianza ${CONF[conf].label} · ${a.impressions.toLocaleString('en-US')} impres.`} style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: CONF[conf].c, boxShadow: `0 0 0 3px ${rgba(CONF[conf].c, .2)}` }} />
                      <span style={{ fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                    </div></td>
                    <td style={{ padding: '13px 14px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--dim)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: angleInfo(a.angle).c }} />{angleInfo(a.angle).label}</span></td>
                    <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: hookColor(a.hookRate) }}>{a.hookRate}%</td>
                    <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: retColor(ho) }}>{ho}%</td>
                    <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{fmtUSD(a.spend)}</td>
                    <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: fatColor(a) }}>{a.freq.toFixed(2)}</td>
                    <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: a.agendas > 0 ? 'var(--good)' : 'var(--faint)' }}>{a.agendas}</td>
                    <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: cp == null ? 'var(--faint)' : cp <= 300 ? 'var(--good)' : 'var(--ink)' }}>{cp == null ? '—' : fmtUSD(cp)}</td>
                    <td style={{ padding: '13px 16px' }}><span style={verdictChip(v)}>{VERDICT[v].label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 6, lineHeight: 1.6 }}>
        Patrones automáticos · Meta Ads (spend · frecuencia · retención de video por cuartiles) × CRM (agendas y cierres). La retención por beat se estima con los cuartiles de Meta y los tiempos de cada bloque con el ritmo de lectura. Los guiones de muestra chica quedan fuera de los patrones.
      </footer>

      {/* FUNNEL MODAL */}
      {sel && <FunnelModal sel={sel} onClose={() => setOpenAd(null)} onReanalizar={reanalizar} reMsg={reMsg} />}

      {/* PATTERN DRILL MODAL */}
      {drill && (
        <div onClick={() => setDrill(null)} style={{ position: 'fixed', inset: 0, zIndex: 66, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '22px 26px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}><div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>Patrón</div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 4, lineHeight: 1.4 }}>{drill.title}</div></div>
              <button onClick={() => setDrill(null)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
            </div>
            <div style={{ padding: '18px 26px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 110, flex: 'none', fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{drill.aLabel}</span><div style={{ flex: 1, height: 15, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}><div style={drill.aBar} /></div><span style={{ width: 52, flex: 'none', fontFamily: MONO, fontSize: 13, fontWeight: 600, color: drill.aColor }}>{drill.aVal}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 110, flex: 'none', fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{drill.bLabel}</span><div style={{ flex: 1, height: 15, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}><div style={drill.bBar} /></div><span style={{ width: 52, flex: 'none', fontFamily: MONO, fontSize: 13, fontWeight: 600, color: 'var(--faint)' }}>{drill.bVal}</span></div>
            </div>
            <div style={{ padding: '12px 26px 4px', fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>Anuncios detrás del patrón</div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {drill.rows.map((r) => (
                <div key={r.id} onClick={() => { setDrill(null); setOpenAd(r.id); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 26px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: r.angleColor }} />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div><div style={{ fontSize: 12, color: 'var(--faint)' }}>{r.sub}</div></div>
                  <span style={r.verdictChip}>{r.verdictLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAKO MODAL */}
      {mako && (
        <div onClick={() => setMako(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, background: 'linear-gradient(150deg,#2A251C,#171511)', border: '1px solid rgba(239,159,39,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{spark(15, 'samb')}</div>
                <div style={{ minWidth: 0 }}><div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Conclusiones con MaKo</div><div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>Qué escribir esta semana</div></div>
              </div>
              <button onClick={() => setMako(false)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
            </div>
            <div style={{ padding: '22px 24px' }}>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)' }}>{mk.text}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
                  {mk.bullets.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span style={{ flex: 'none', width: 5, height: 5, borderRadius: '50%', background: '#EF9F27', marginTop: 8 }} /><span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--dim)' }}>{b}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Barra de sync (control + última corrida + cobertura) ──
function SyncBar({ syncing, syncMsg, lastSync, counts, onSync }: { syncing: boolean; syncMsg: string | null; lastSync: string | null; counts: ScriptAnalystView['counts']; onSync: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>
        {counts.analizadas} guiones analizados{counts.sinTranscript > 0 ? ` · ${counts.sinTranscript} con gasto sin transcript` : ''}{counts.errores > 0 ? ` · ${counts.errores} con error` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {syncMsg ? <span style={{ fontSize: 11.5, color: 'var(--dim)', maxWidth: 360, textAlign: 'right' }}>{syncMsg}</span>
          : lastSync && <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>sync {lastSync.slice(0, 10)}</span>}
        <button onClick={onSync} disabled={syncing} style={{ padding: '9px 15px', borderRadius: 11, cursor: syncing ? 'default' : 'pointer', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, border: '1px solid var(--border-strong)', background: syncing ? 'var(--surface-2)' : 'var(--surface)', color: syncing ? 'var(--dim)' : 'var(--ink)' }}>
          {syncing ? 'Sincronizando…' : '↻ Sincronizar'}
        </button>
      </div>
    </div>
  );
}

// ── Modal del embudo de un guion ──
function FunnelModal({ sel, onClose, onReanalizar, reMsg }: { sel: ScriptView; onClose: () => void; onReanalizar: (id: string) => void; reMsg: string | null }) {
  const v = verdictOf(sel), ho = hold(sel), vc = VERDICT[v].c, conf = confidence(sel), cp = cpa(sel);
  const beats = decorateBeats(sel);
  const chips = [
    { label: 'Hook 3s', value: `${sel.hookRate}%`, color: hookColor(sel.hookRate) },
    { label: 'Ret. CTA', value: `${ho}%`, color: retColor(ho) },
    { label: 'Spend', value: fmtUSD(sel.spend), color: 'var(--ink)' },
    { label: 'Frecuencia', value: sel.freq.toFixed(2), color: fatColor(sel) },
    { label: '$/agenda', value: cp == null ? '—' : fmtUSD(cp), color: cp == null ? 'var(--faint)' : 'var(--ink)' },
    { label: 'Agendas', value: String(sel.agendas), color: sel.agendas > 0 ? 'var(--good)' : 'var(--faint)' },
    { label: 'Cierres', value: String(sel.cierres), color: sel.cierres > 0 ? 'var(--good)' : 'var(--faint)' },
    { label: 'Confianza', value: CONF[conf].label, color: CONF[conf].c },
  ];
  const avgWatch = `0:${String(Math.round(sel.dur * 0.62)).padStart(2, '0')}`;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '22px 26px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={angleChip(sel.angle)}>{angleInfo(sel.angle).label}</span>
              <span style={verdictChip(v)}>{VERDICT[v].label}</span>
            </div>
            <h2 style={{ fontWeight: 600, fontSize: 23, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)', lineHeight: 1.2 }}>{sel.name}</h2>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4, fontFamily: MONO }}>{sel.format} · {fmtT(sel.dur)} · {sel.days} días · ad_id {sel.adId}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 'none' }}>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, color: hookColor(sel.hookRate), fontVariantNumeric: 'tabular-nums' }}>{sel.hookRate}%</div><div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: MONO, marginTop: 3, letterSpacing: '.04em' }}>HOOK · 3s</div></div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '22px 26px', maxHeight: '74vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {conf === 'baja' && (
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 12, padding: '13px 15px' }}><span style={{ flex: 'none', color: '#7A5908', fontWeight: 700, fontSize: 15 }}>!</span><div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#5A4408' }}>Muestra chica: {fmtUSD(sel.spend)} y {sel.impressions.toLocaleString('en-US')} impresiones en {sel.days} días. Las métricas pueden moverse mucho todavía — validá con más presupuesto.</div></div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chips.map((c) => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 11px' }}><span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' }}>{c.label}</span><span style={{ fontSize: 14, fontWeight: 600, color: c.color, fontVariantNumeric: 'tabular-nums' }}>{c.value}</span></div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 5 }}>El guión · embudo de retención</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 12 }}>El ancho de cada bloque es la audiencia que sigue viendo (estimada por los cuartiles de Meta). Donde se estrecha de golpe, se están yendo.</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}><span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: 'var(--good)' }}>100% vio los primeros 3s</span><span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>tiempo medio {avgWatch}</span></div>
              {beats.map((b, i) => (
                <div key={i} style={b.rowStyle}>
                  <div style={{ width: 88, flex: 'none', alignSelf: 'stretch', position: 'relative', background: 'var(--surface-2)' }}>
                    {b.funnel}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 12, fontWeight: 600, color: b.retInColor, pointerEvents: 'none' }}>{b.retInText}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}><span style={b.kindChip}>{b.kindLabel}</span><span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{b.time}</span><span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: b.dropColor }}>{b.dropText}</span></div>
                    <div style={{ fontSize: 15.5, lineHeight: 1.5, color: 'var(--ink)' }}>{b.text}</div>
                    {b.isSteep && <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2, fontSize: 12, fontWeight: 600, color: b.dropColor }}><span style={{ fontSize: 12 }}>▼</span>{b.steepLabel}</div>}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}><span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: retColor(sel.finalRet) }}>{sel.finalRet}% llegó al final</span><span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{sel.thru.toLocaleString('en-US')} thruplays</span></div>
            </div>
          </div>
          {sel.note && (
            <div style={{ background: rgba(vc, .06), border: `1px solid ${rgba(vc, .26)}`, borderRadius: 13, padding: '16px 18px' }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10, color: vc }}>{sel.note.title || 'Diagnóstico'}</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{sel.note.text}</div>
              {sel.suggestion && (
                <div style={{ marginTop: 13, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, padding: '13px 15px' }}><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9A6A09', marginBottom: 6 }}>Gancho a probar</div><div style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink)', fontWeight: 500 }}>{sel.suggestion}</div></div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
            <button onClick={() => onReanalizar(sel.adId)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer' }}>↻ Re-analizar guion</button>
            {reMsg && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{reMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
