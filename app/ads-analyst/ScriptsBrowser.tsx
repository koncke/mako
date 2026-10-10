'use client';

// =============================================================================
// ScriptsBrowser — Ads Analyst (port del diseño "Ads Analyst.dc.html")
// =============================================================================
// Toda la lógica determinística (verdicto, confianza, retención por beat,
// patrones ganadores, cuadrante) se calcula acá sobre los ScriptView que arma
// el server (lib/ads-analyst.ts). Las conclusiones de MaKo se derivan de los
// patrones reales del período. La curva de retención sale de los cuartiles de
// Meta y los tiempos de cada beat los estima Claude (ambos rotulados).
// =============================================================================

import { createElement as h, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useRouter } from '@/app/_ui/Link';
import dynamic from 'next/dynamic';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { TaxonomyManager } from '../components/TaxonomyManager';
import type { ScriptView, ScriptAnalystView, QuadPoint, Valoracion, ScriptDraft } from '@/lib/ads-analyst';

// Vista de detalle unificada (pestañas Rendimiento/Audiencia/Guion). Vive en
// ad-charts (recharts + d3) → se carga on-demand al abrir un guion. El import es
// dinámico, así que no hay ciclo estático con ad-charts (que sí importa de acá).
const AdDetailTabs = dynamic(() => import('../marketing/ad-charts').then((m) => m.AdDetailTabs), { ssr: false });

// Ads Analyst no tiene selector de fecha: la pestaña Rendimiento usa "todo el
// histórico" (≈3 años hacia atrás → el endpoint agrega toda la vida del anuncio).
function allHistoryRange(): { desde: string; hasta: string } {
  const hoy = new Date();
  return { desde: new Date(hoy.getTime() - 1095 * 86400000).toISOString().slice(0, 10), hasta: hoy.toISOString().slice(0, 10) };
}

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── Vocabularios visuales (del diseño) ──
// Vocabulario de ángulos para la UI (labels + colores). Es EDITABLE: la página
// lo lee con getAngles() y lo pasa por prop; `applyAngles` lo vuelca al mapa de
// módulo que leen angleInfo/angleChip/el cuadrante/los dropdowns. Si la lista
// está vacía o no llega, caen los 5 base. (Single-tenant: una sola fuente de
// ángulos, así que volcar el mapa en el render es seguro.)
export type AngleDef = { key: string; label: string; color: string; desc?: string };
const DEFAULT_ANGLE: Record<string, { label: string; c: string }> = {
  visionario: { label: 'Visionario', c: '#2F6DDB' }, capataz: { label: 'Capataz', c: '#C8870C' },
  dolor: { label: 'Dolor', c: '#D0504A' }, testimonio: { label: 'Testimonio', c: '#3B6D11' }, oferta: { label: 'Oferta', c: '#7C4DD6' },
};
let ANGLE: Record<string, { label: string; c: string }> = { ...DEFAULT_ANGLE };
export function applyAngles(list?: AngleDef[]) {
  ANGLE = list && list.length
    ? Object.fromEntries(list.map((a) => [a.key, { label: a.label, c: a.color }]))
    : { ...DEFAULT_ANGLE };
}
// AVATAR (público objetivo): vocabulario EDITABLE y específico del cliente, por eso
// arranca VACÍO (sin defaults). Mismo patrón module-mutable que ANGLE.
export type AvatarDef = { key: string; label: string; color: string; desc?: string };
let AVATAR: Record<string, { label: string; c: string }> = {};
export function applyAvatares(list?: AvatarDef[]) {
  AVATAR = list && list.length ? Object.fromEntries(list.map((a) => [a.key, { label: a.label, c: a.color }])) : {};
}
function avatarInfo(k: string) { return AVATAR[k] ?? { label: k, c: '#6B675C' }; }
const KIND: Record<string, { label: string; c: string }> = {
  gancho: { label: 'Gancho', c: '#C8870C' }, contexto: { label: 'Contexto', c: '#B5742A' }, problema: { label: 'Problema', c: '#D0504A' },
  mecanismo: { label: 'Mecanismo', c: '#2F6DDB' }, prueba: { label: 'Prueba', c: '#3B6D11' }, objecion: { label: 'Objeción', c: '#A8770F' },
  recordatorio: { label: 'Recordatorio', c: '#7C4DD6' }, oferta: { label: 'Oferta + CTA', c: '#7C4DD6' }, cta: { label: 'CTA', c: '#0E8E7E' },
};
const VERDICT: Record<string, { label: string; c: string }> = {
  escalar: { label: 'Escalar', c: '#1E9E57' }, mejorar: { label: 'Mejorar gancho', c: '#2F6DDB' }, reescribir: { label: 'Reescribir cuerpo', c: '#9A6A09' },
  repensar: { label: 'Repensar', c: '#D0504A' }, validar: { label: 'Validar (poco spend)', c: '#6B675C' },
  imagen: { label: 'Imagen', c: '#6B675C' },
};
const CONF: Record<string, { label: string; c: string }> = {
  alta: { label: 'Alta', c: '#1E9E57' }, media: { label: 'Media', c: '#A8770F' }, baja: { label: 'Baja', c: '#98A0AC' },
};
// Umbrales ABSOLUTOS recalibrados a los datos reales (el mock usaba 20/22, pero
// la retención al CTA real ronda 8% de mediana → 22 dejaba todo abajo). Benchmarks
// FIJOS: "buen gancho ≥28% frena el scroll", "retiene al CTA ≥10% = 1 de cada 10
// llega". Alimentan el veredicto (tabla) Y las divisorias FIJAS del cuadrante.
const HOOK_MID = 28, HOLD_MID = 10;
// Dominio FIJO del cuadrante: el marco no se auto-escala ni se mueve nunca.
const QUAD_XMAX = 55, QUAD_YMAX = 30;
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
function confFromImpr(impressions: number): 'alta' | 'media' | 'baja' { return impressions >= 25000 ? 'alta' : impressions >= 8000 ? 'media' : 'baja'; }
function confidence(a: ScriptView): 'alta' | 'media' | 'baja' { return confFromImpr(a.impressions); }
function fatigue(a: ScriptView): 'alta' | 'media' | 'ok' { return a.freq >= 2.4 ? 'alta' : a.freq >= 1.8 ? 'media' : 'ok'; }
function fatColor(a: ScriptView): string { const f = fatigue(a); return f === 'alta' ? 'var(--bad)' : f === 'media' ? 'var(--warn)' : 'var(--dim)'; }
function cpa(a: ScriptView): number | null { return a.agendas > 0 ? a.spend / a.agendas : null; }
function hold(a: ScriptView): number { return a.beats.length ? a.beats[a.beats.length - 1].ret : a.finalRet; }
function verdictFromVals(hookRate: number, holdv: number, impressions: number): string {
  if (confFromImpr(impressions) === 'baja') return 'validar';
  const hi = hookRate >= HOOK_MID, ho = holdv >= HOLD_MID;
  return hi ? (ho ? 'escalar' : 'reescribir') : (ho ? 'mejorar' : 'repensar');
}
function verdictOf(a: ScriptView): string { return a.esImagen ? 'imagen' : verdictFromVals(a.hookRate, hold(a), a.impressions); }
function angleChip(k: string): CSSProperties {
  const a = angleInfo(k);
  return { display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 6, fontFamily: MONO, letterSpacing: '.04em', background: rgba(a.c, .12), color: a.c, border: `1px solid ${rgba(a.c, .3)}` };
}
// El avatar se muestra como chip "outline" (punto + label) para distinguirlo del ángulo.
function avatarChip(k: string): CSSProperties {
  const a = avatarInfo(k);
  return { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 6, fontFamily: MONO, letterSpacing: '.04em', background: 'var(--surface-2)', color: a.c, border: `1px solid ${rgba(a.c, .4)}` };
}
function kindChip(k: string): CSSProperties {
  const x = KIND[k] ?? { label: k, c: '#6B675C' };
  return { display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, fontFamily: MONO, letterSpacing: '.05em', textTransform: 'uppercase', background: rgba(x.c, .12), color: x.c, border: `1px solid ${rgba(x.c, .28)}` };
}
function verdictChip(k: string): CSSProperties {
  const v = VERDICT[k] ?? { label: k, c: '#6B675C' };
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
    h('polygon', { points: pts, fill: severe ? '#D0504A' : '#D9A23C' }));
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
type Polarity = 'bueno' | 'malo' | 'proceso';
const POL: Record<Polarity, { c: string; label: string }> = {
  bueno: { c: '#1E9E57', label: 'Sigue' }, malo: { c: '#D0504A', label: 'Corta' }, proceso: { c: '#9A6A09', label: 'Proceso' },
};
type Pattern = {
  key: string; polarity: Polarity; chip: string; big: string; bigColor: string; tlabel: string; stmt: string;
  aLabel: string; aVal: string; a: number; bLabel: string; bVal: string; b: number; max: number; ads: ScriptView[]; priority: number;
};

// Patrones positivos (seguí), negativos (cortá) y de proceso (cómo estás probando).
// `ads` = todos los guiones con señal; `reliable` = confianza != baja (≥8k impr).
// Los POSITIVOS se calculan sobre reliable (no celebrar ruido); los de proceso y
// los negativos de desperdicio sobre TODOS (su punto es justo la falta de prueba).
function buildPatterns(ads: ScriptView[], reliable: ScriptView[]): Pattern[] {
  const won = (a: ScriptView) => a.agendas > 0;
  const tag = (a: ScriptView, t: string) => a.tags.indexOf(t) >= 0;
  const mean = (arr: ScriptView[], f: (x: ScriptView) => number) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0);
  const sum = (arr: ScriptView[], f: (x: ScriptView) => number) => arr.reduce((s, x) => s + f(x), 0);
  const r = Math.round;
  const total = ads.length;
  const out: Pattern[] = [];
  if (!total) return out;
  const bySpend = (arr: ScriptView[]) => arr.slice().sort((a, b) => b.spend - a.spend);
  // Patrones de gancho/retención: SOLO video (las imágenes no tienen métricas de video).
  const vReliable = reliable.filter((a) => !a.esImagen);

  // ── PROCESO ──
  const under = ads.filter((a) => a.spend < 10 || a.days < 3);
  if (under.length / total >= 0.5) {
    const share = r((under.length / total) * 100);
    out.push({ key: 'subtesteo', polarity: 'proceso', chip: 'Sub-testeo', big: `${share}%`, bigColor: POL.proceso.c, tlabel: 'guiones con <$10 o <3 días', priority: 10,
      stmt: `El ${share}% de tus guiones (${under.length} de ${total}) no pasaron $10 o estuvieron activos menos de 3 días: no los estás probando, los estás asomando. Cualquier "ganador" se apoya en muy pocos guiones realmente testeados.`,
      aLabel: 'sub-testeados', aVal: String(under.length), a: under.length, bLabel: 'probados', bVal: String(total - under.length), b: total - under.length, max: total, ads: bySpend(under) });
  }
  const byAngAll: Record<string, ScriptView[]> = {};
  ads.forEach((a) => { (byAngAll[a.angle] = byAngAll[a.angle] || []).push(a); });
  const domAngle = Object.keys(byAngAll).sort((x, y) => byAngAll[y].length - byAngAll[x].length)[0];
  if (domAngle && byAngAll[domAngle].length / total >= 0.6) {
    const share = r((byAngAll[domAngle].length / total) * 100);
    const nSub = Object.keys(byAngAll).filter((k) => byAngAll[k].length <= 2).length;
    out.push({ key: 'concentracion', polarity: 'proceso', chip: 'Ángulo dominante', big: `${share}%`, bigColor: POL.proceso.c, tlabel: `son del ángulo ${angleInfo(domAngle).label}`, priority: 10,
      stmt: `${share}% de tus guiones atacan por "${angleInfo(domAngle).label}". Estás optimizando dentro de un solo ángulo y dejaste ${nSub} casi sin probar. No sabes si es el mejor o el único que probaste — abre 2-3 guiones por ángulo flojo.`,
      aLabel: angleInfo(domAngle).label, aVal: `${share}%`, a: share, bLabel: 'otros', bVal: `${100 - share}%`, b: 100 - share, max: 100, ads: byAngAll[domAngle] });
  }
  const baja = ads.filter((a) => a.impressions < 8000), nAlta = ads.filter((a) => a.impressions >= 25000).length;
  if (baja.length / total >= 0.5) {
    const share = r((baja.length / total) * 100);
    out.push({ key: 'muestrachica', polarity: 'proceso', chip: 'Confianza', big: `${share}%`, bigColor: POL.proceso.c, tlabel: 'guiones de muestra chica', priority: 9,
      stmt: `El ${share}% de tus guiones tiene muestra chica (<8k impresiones). Solo ${nAlta} llegan a confianza alta — los "ganadores" se apoyan en poquitos guiones de verdad probados.`,
      aLabel: 'muestra chica', aVal: String(baja.length), a: baja.length, bLabel: 'confiables', bVal: String(total - baja.length), b: total - baja.length, max: total, ads: bySpend(baja) });
  }

  // ── MALO ──
  const waste = ads.filter((a) => a.agendas === 0 && a.spend > 0), wasteSpend = sum(waste, (a) => a.spend);
  if (wasteSpend >= 50) {
    out.push({ key: 'quemado', polarity: 'malo', chip: 'Plata quemada', big: fmtK(wasteSpend), bigColor: POL.malo.c, tlabel: `${waste.length} guiones, 0 agendas`, priority: 9,
      stmt: `Quemaste ${fmtUSD(wasteSpend)} en ${waste.length} guiones que no agendaron una sola junta. Pausa los que ya tienen impresiones suficientes (no es falta de muestra, no convierten) y reinvierte.`,
      aLabel: '0 agendas', aVal: String(waste.length), a: waste.length, bLabel: 'agendaron', bVal: String(ads.filter(won).length), b: ads.filter(won).length, max: total, ads: bySpend(waste) });
  }
  let wasteAng: { k: string; sp: number; g: ScriptView[] } | null = null;
  Object.keys(byAngAll).forEach((k) => { const g = byAngAll[k], sp = sum(g, (x) => x.spend), ag = sum(g, (x) => x.agendas); if (ag === 0 && sp >= 50 && (!wasteAng || sp > wasteAng.sp)) wasteAng = { k, sp, g }; });
  if (wasteAng && (wasteSpend < 50 || (wasteAng as { sp: number }).sp < 0.85 * wasteSpend)) { const w = wasteAng as { k: string; sp: number; g: ScriptView[] };
    out.push({ key: 'angulo-quemado', polarity: 'malo', chip: 'Ángulo a cortar', big: fmtK(w.sp), bigColor: POL.malo.c, tlabel: `${angleInfo(w.k).label}: 0 agendas`, priority: 8,
      stmt: `Corta el ángulo ${angleInfo(w.k).label}: quemó ${fmtUSD(w.sp)} sin agendar nada. Mueve ese dinero al ángulo que sí rinde.`,
      aLabel: 'gastado', aVal: fmtK(w.sp), a: w.sp, bLabel: 'agendas', bVal: '0', b: 0, max: w.sp, ads: bySpend(w.g) });
  }
  const leak = vReliable.filter((a) => a.hookRate >= HOOK_MID && hold(a) < HOLD_MID);
  if (leak.length >= 2 && sum(leak, (a) => a.spend) >= 50) {
    out.push({ key: 'gancho-sin-cuerpo', polarity: 'malo', chip: 'Gancho sin cuerpo', big: String(leak.length), bigColor: POL.malo.c, tlabel: 'frenan pero no retienen', priority: 8,
      stmt: `${leak.length} guiones frenan el scroll (hook ${r(mean(leak, (a) => a.hookRate))}% promedio) pero pierden a la gente antes del CTA (${r(mean(leak, (a) => hold(a)))}%). El problema no es la entrada, es el cuerpo: reescribe el medio.`,
      aLabel: 'hook', aVal: `${r(mean(leak, (a) => a.hookRate))}%`, a: mean(leak, (a) => a.hookRate), bLabel: 'ret. CTA', bVal: `${r(mean(leak, (a) => hold(a)))}%`, b: mean(leak, (a) => hold(a)), max: Math.max(mean(leak, (a) => a.hookRate), 30), ads: bySpend(leak) });
  }
  const fat = ads.filter((a) => a.freq >= 2.4), healthy = ads.filter((a) => a.freq < 1.8);
  if (fat.length >= 2) {
    out.push({ key: 'fatiga', polarity: 'malo', chip: 'Fatiga', big: String(fat.length), bigColor: POL.malo.c, tlabel: 'guiones saturados (frec. ≥2.4)', priority: 7,
      stmt: `${fat.length} guiones ya pasaron frecuencia 2.4 — la misma gente los vio de más y su costo por resultado sube. Mismo guion, creativo nuevo, antes de que se quemen.`,
      aLabel: 'saturados', aVal: `${mean(fat, (a) => a.freq).toFixed(1)}x`, a: mean(fat, (a) => a.freq), bLabel: 'sanos', bVal: healthy.length ? `${mean(healthy, (a) => a.freq).toFixed(1)}x` : '—', b: healthy.length ? mean(healthy, (a) => a.freq) : 0, max: Math.max(mean(fat, (a) => a.freq), 3), ads: bySpend(fat) });
  }
  const weakHook = vReliable.filter((a) => a.hookRate < HOOK_MID && hold(a) >= HOLD_MID);
  if (weakHook.length >= 2) {
    out.push({ key: 'gancho-flojo', polarity: 'malo', chip: 'Gancho flojo', big: String(weakHook.length), bigColor: POL.malo.c, tlabel: 'cuerpo retiene, gancho bajo', priority: 6,
      stmt: `${weakHook.length} guiones retienen bien una vez que arrancan (${r(mean(weakHook, (a) => hold(a)))}%) pero el gancho no frena el scroll (${r(mean(weakHook, (a) => a.hookRate))}%). Buen cuerpo desperdiciado: prueba los ganchos que sugiere MaKo en cada uno.`,
      aLabel: 'ret. CTA', aVal: `${r(mean(weakHook, (a) => hold(a)))}%`, a: mean(weakHook, (a) => hold(a)), bLabel: 'hook', bVal: `${r(mean(weakHook, (a) => a.hookRate))}%`, b: mean(weakHook, (a) => a.hookRate), max: Math.max(mean(weakHook, (a) => hold(a)), 30), ads: bySpend(weakHook) });
  }

  // ── BUENO (sobre reliable) ──
  const dash = reliable.filter((a) => tag(a, 'dashboard')), noDash = reliable.filter((a) => !tag(a, 'dashboard'));
  if (dash.length >= 2 && noDash.length >= 2) {
    const rw = r((dash.filter(won).length / dash.length) * 100), rwo = r((noDash.filter(won).length / noDash.length) * 100);
    if (rw > rwo) out.push({ key: 'dashboard', polarity: 'bueno', chip: 'Dashboard', big: `${rw}%`, bigColor: POL.bueno.c, tlabel: 'de los que muestran panel agendan', priority: 7,
      stmt: `Muestra el panel en pantalla: los guiones que muestran un dashboard agendan ${rw}% vs ${rwo}% de los que no. Es tu patrón ganador más claro.`,
      aLabel: 'con panel', aVal: `${rw}%`, a: rw, bLabel: 'sin panel', bVal: `${rwo}%`, b: rwo, max: 100, ads: dash.filter(won) });
  }
  const escalables = vReliable.filter((a) => a.hookRate >= HOOK_MID && hold(a) >= HOLD_MID && a.agendas > 0 && a.freq < 2.4);
  if (escalables.length >= 2) {
    out.push({ key: 'escalar', polarity: 'bueno', chip: 'Escala esto', big: String(escalables.length), bigColor: POL.bueno.c, tlabel: 'listos para más presupuesto', priority: 7,
      stmt: `${escalables.length} guiones ya frenan, retienen, agendan y tienen frecuencia sana. Súbeles presupuesto — son tus candidatos a escalar ya.`,
      aLabel: 'listos', aVal: String(escalables.length), a: escalables.length, bLabel: 'confiables', bVal: String(reliable.length), b: reliable.length, max: Math.max(reliable.length, 1), ads: bySpend(escalables) });
  }
  const gH = vReliable.filter((a) => a.hookType === 'resultado' || a.hookType === 'pregunta'), gD = vReliable.filter((a) => a.hookType === 'dolor');
  if (gH.length >= 2 && gD.length >= 2 && mean(gH, (a) => a.hookRate) > mean(gD, (a) => a.hookRate)) {
    out.push({ key: 'hook', polarity: 'bueno', chip: 'Tipo de gancho', big: `${r(mean(gH, (a) => a.hookRate))}%`, bigColor: POL.bueno.c, tlabel: 'hook con cifra o pregunta', priority: 6,
      stmt: `Los ganchos que abren con una cifra o una pregunta promedian ${r(mean(gH, (a) => a.hookRate))}% de hook rate — más que abrir con dolor abstracto (${r(mean(gD, (a) => a.hookRate))}%).`,
      aLabel: 'cifra/pregunta', aVal: `${r(mean(gH, (a) => a.hookRate))}%`, a: mean(gH, (a) => a.hookRate), bLabel: 'dolor', bVal: `${r(mean(gD, (a) => a.hookRate))}%`, b: mean(gD, (a) => a.hookRate), max: 50, ads: gH });
  }
  let bestEff: { k: string; per1k: number; g: ScriptView[] } | null = null;
  Object.keys(byAngAll).forEach((k) => { const g = byAngAll[k], sp = sum(g, (x) => x.spend), ag = sum(g, (x) => x.agendas), per1k = sp > 0 ? (ag / sp) * 1000 : 0; if (ag > 0 && (!bestEff || per1k > bestEff.per1k)) bestEff = { k, per1k, g }; });
  if (bestEff) { const be = bestEff as { k: string; per1k: number; g: ScriptView[] };
    out.push({ key: 'eff', polarity: 'bueno', chip: 'Eficiencia $', big: be.per1k.toFixed(1), bigColor: POL.bueno.c, tlabel: `juntas por $1k · ${angleInfo(be.k).label}`, priority: 6,
      stmt: `El ángulo ${angleInfo(be.k).label} agenda ${be.per1k.toFixed(1)} juntas por cada $1,000 — es tu ángulo más eficiente. Métele más guiones.`,
      aLabel: angleInfo(be.k).label, aVal: be.per1k.toFixed(1), a: be.per1k, bLabel: 'objetivo', bVal: '—', b: 0, max: Math.max(be.per1k, 1), ads: bySpend(be.g) });
  }
  const gLong = vReliable.filter((a) => a.dur >= 44), gShort = vReliable.filter((a) => a.dur < 44);
  if (gLong.length >= 2 && gShort.length >= 2) {
    const diff = Math.round(mean(gLong, (a) => hold(a)) - mean(gShort, (a) => hold(a)));
    if (diff > 0) out.push({ key: 'dur', polarity: 'bueno', chip: 'Duración', big: `+${diff} pts`, bigColor: POL.bueno.c, tlabel: 'retención extra en 44s o más', priority: 5,
      stmt: `Los guiones de 44s o más retienen +${diff} pts al CTA frente a los de menos de 44s. Dan tiempo a construir el deseo.`,
      aLabel: '≥44s', aVal: `${r(mean(gLong, (a) => hold(a)))}%`, a: mean(gLong, (a) => hold(a)), bLabel: '<44s', bVal: `${r(mean(gShort, (a) => hold(a)))}%`, b: mean(gShort, (a) => hold(a)), max: 35, ads: bySpend(gLong) });
  }
  const iA = reliable.filter((a) => tag(a, 'implementacion')), iB = reliable.filter((a) => !tag(a, 'implementacion'));
  if (iA.length >= 2 && iB.length >= 2 && mean(iA, (a) => a.cierres) > mean(iB, (a) => a.cierres)) {
    out.push({ key: 'impl', polarity: 'bueno', chip: 'Contenido', big: `${(mean(iA, (a) => a.cierres) / Math.max(mean(iB, (a) => a.cierres), 0.1)).toFixed(1)}×`, bigColor: POL.bueno.c, tlabel: 'cierres al mostrar el setup', priority: 5,
      stmt: `Mostrar cómo se implementa (el setup, el panel en marcha) está en los guiones con más cierres: ${mean(iA, (a) => a.cierres).toFixed(1)} vs ${mean(iB, (a) => a.cierres).toFixed(1)} de los que no.`,
      aLabel: 'lo muestran', aVal: mean(iA, (a) => a.cierres).toFixed(1), a: mean(iA, (a) => a.cierres), bLabel: 'no', bVal: mean(iB, (a) => a.cierres).toFixed(1), b: mean(iB, (a) => a.cierres), max: Math.max(mean(iA, (a) => a.cierres), 0.1), ads: bySpend(iA) });
  }

  return out.sort((x, y) => y.priority - x.priority);
}

type DrillRow = { id: string; name: string; angleColor: string; sub: string; verdictLabel: string; verdictChip: CSSProperties };
function drillRows(ads: ScriptView[]): DrillRow[] {
  return ads.slice().sort((a, b) => b.spend - a.spend).map((a) => ({
    id: a.id, name: a.name, angleColor: angleInfo(a.angle).c,
    sub: `${angleInfo(a.angle).label} · hook ${a.hookRate}% · ${fmtUSD(a.spend)} · ${a.agendas} agendas`,
    verdictLabel: VERDICT[verdictOf(a)].label, verdictChip: verdictChip(verdictOf(a)),
  }));
}

// MaKo: las conclusiones SON los patrones más urgentes, en palabras.
function makoConclusions(reliable: ScriptView[], patterns: Pattern[]): { text: string; bullets: string[] } {
  const text = patterns.length
    ? `Leí tus guiones cruzando guion, spend, frecuencia y resultado${reliable.length ? ` (${reliable.length} con señal suficiente)` : ''}. Esto es lo que importa, de lo más urgente a lo menos:`
    : 'Todavía no hay guiones con datos suficientes para sacar patrones. Sincroniza o deja correr más presupuesto.';
  return { text, bullets: patterns.slice(0, 4).map((p) => p.stmt) };
}

function humanizeAgo(iso: string | null): string {
  if (!iso) return 'sin registro';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(m) || m < 0) return 'sin registro';
  if (m < 60) return `hace ${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h}h` : `hace ${Math.round(h / 24)}d`;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ width: 38, height: 22, flex: 'none', borderRadius: 999, border: 'none', padding: 2, cursor: 'pointer', background: on ? 'var(--good)' : 'var(--border-strong)', display: 'inline-flex', alignItems: 'center', transition: 'background .15s' }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(16px)' : 'translateX(0)', transition: 'transform .15s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ScriptsBrowser({ data, errorMsg, drafts = [], angles = [], avatares = [] }: { data: ScriptAnalystView; errorMsg: string | null; drafts?: ScriptDraft[]; angles?: AngleDef[]; avatares?: AvatarDef[] }) {
  applyAngles(angles);
  applyAvatares(avatares);
  const router = useRouter();
  const ads = data.scripts;
  const { counts, lastSync } = data;

  const [angle, setAngle] = useState('todos');
  const [mapMode, setMapMode] = useState<'ads' | 'angle'>('ads');
  const [openAd, setOpenAd] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ title: string; aLabel: string; aVal: string; aColor: string; aBar: CSSProperties; bLabel: string; bVal: string; bBar: CSSProperties; rows: DrillRow[] } | null>(null);
  const [mako, setMako] = useState(false);
  const [showCaveat, setShowCaveat] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const detalleRange = useMemo(allHistoryRange, []);
  const [hoverPt, setHoverPt] = useState<string | null>(null);
  const [quadWin, setQuadWin] = useState('todo');
  const [quadPoints, setQuadPoints] = useState<QuadPoint[] | null>(null);
  const [quadLoading, setQuadLoading] = useState(false);
  const [hideSmall, setHideSmall] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);
  const [guionText, setGuionText] = useState('');
  const [valorando, setValorando] = useState(false);
  const [valoracion, setValoracion] = useState<Valoracion | null>(null);
  const [valError, setValError] = useState<string | null>(null);

  async function sincronizar(force = false) {
    setSyncing(true); setSyncMsg('Analizando guiones…');
    try {
      const r = await fetch('/api/ads-analyst/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló el sync');
      setSyncMsg(`${j.analizados} analizados${j.restantes > 0 ? ` · quedan ${j.restantes}` : ''}.`);
      router.refresh();
    } catch (e) { setSyncMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSyncing(false); }
  }
  // Filtro de fecha PROPIO del cuadrante: recalcula los puntos en una ventana sin
  // tocar KPIs/patrones/tabla (que siguen siendo histórico completo).
  async function onQuadWin(v: string) {
    setQuadWin(v);
    if (v === 'todo') { setQuadPoints(null); return; }
    setQuadLoading(true);
    try {
      const r = await fetch(`/api/ads-analyst/quadrant?dias=${encodeURIComponent(v)}`);
      const j = await r.json();
      setQuadPoints(j.ok ? (j.points as QuadPoint[]) : []);
    } catch { setQuadPoints([]); }
    finally { setQuadLoading(false); }
  }
  async function valorar() {
    if (guionText.trim().length < 80) { setValError('Pega el guion completo (unas líneas) para poder valorarlo.'); return; }
    setValorando(true); setValError(null); setValoracion(null);
    try {
      const r = await fetch('/api/ads-analyst/valorar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guion: guionText }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló');
      setValoracion(j.valoracion as Valoracion);
      router.refresh(); // recarga el historial con el guion recién guardado
    } catch (e) { setValError(e instanceof Error ? e.message : String(e)); }
    finally { setValorando(false); }
  }
  function viewDraft(d: ScriptDraft) { setValoracion(d.valoracion); setGuionText(d.guion); setValError(null); }
  async function borrarDraft(id: number) {
    try { await fetch(`/api/ads-analyst/valorar?id=${id}`, { method: 'DELETE' }); router.refresh(); } catch { /* no crítico */ }
  }

  const reliable = useMemo(() => ads.filter((a) => confidence(a) !== 'baja'), [ads]);
  const visible = useMemo(() => ads.filter((s) => angle === 'todos' || s.angle === angle), [ads, angle]);
  // Puntos del cuadrante: histórico (de props) o la ventana fetcheada; filtrados por ángulo y muestra.
  const allTimePoints = useMemo<QuadPoint[]>(() => ads.filter((s) => !s.esImagen).map((s) => ({ id: s.id, short: s.short, angle: s.angle, hookRate: s.hookRate, hold: hold(s), spend: s.spend, impressions: s.impressions, agendas: s.agendas })), [ads]);
  const quadItems = useMemo(() => (quadPoints ?? allTimePoints).filter((p) => (angle === 'todos' || p.angle === angle) && (!hideSmall || p.impressions >= 8000)), [quadPoints, allTimePoints, angle, hideSmall]);
  const P = useMemo(() => buildPatterns(ads, reliable), [ads, reliable]);
  const mk = useMemo(() => makoConclusions(reliable, P), [reliable, P]);
  const activeFilters = (quadWin !== 'todo' ? 1 : 0) + (angle !== 'todos' ? 1 : 0) + (mapMode !== 'ads' ? 1 : 0) + (hideSmall ? 1 : 0);
  const syncGate = useMemo(() => {
    const pend = counts.sinTranscript + counts.pendientes;
    const mins = lastSync ? Math.round((Date.now() - Date.parse(lastSync)) / 60000) : null;
    const level: 'nada' | 'reciente' | 'ok' = pend === 0 ? 'nada' : (mins != null && Number.isFinite(mins) && mins < 60) ? 'reciente' : 'ok';
    return { pend, level };
  }, [counts, lastSync]);

  // KPIs (ponderados por spend)
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const totalAg = ads.reduce((s, a) => s + a.agendas, 0);
  // Hook rate ponderado: solo video (las imágenes no tienen hook rate).
  const vAds = ads.filter((a) => !a.esImagen);
  const vSpend = vAds.reduce((s, a) => s + a.spend, 0);
  const wHook = vSpend > 0 ? Math.round(vAds.reduce((s, a) => s + a.hookRate * a.spend, 0) / vSpend) : 0;
  const wasteSpend = ads.filter((a) => a.agendas === 0).reduce((s, a) => s + a.spend, 0);
  const wasteN = ads.filter((a) => a.agendas === 0).length;

  // (la tabla/tarjetas y su orden viven en <GuionesPanel/>)

  // ── cuadrante (SVG) ──
  function quadMap(items: QuadPoint[], mode: 'ads' | 'angle', selId: string | null, hoverId: string | null, onHover: (id: string | null) => void): ReactNode {
    const W = 560, H = 432, padL = 52, padR = 24, padT = 40, padB = 58; // gutters arriba/abajo para los rótulos externos
    // Dominio FIJO (no se auto-escala) + divisorias en benchmarks ABSOLUTOS fijos
    // (HOOK_MID/HOLD_MID) → el marco significa lo mismo en cada render y ventana.
    const x0 = 0, x1 = QUAD_XMAX, y0 = 0, y1 = QUAD_YMAX;
    const xOf = (v: number) => padL + ((Math.min(Math.max(v, x0), x1) - x0) / (x1 - x0)) * (W - padL - padR);
    const yOf = (v: number) => padT + (1 - (Math.min(Math.max(v, y0), y1) - y0) / (y1 - y0)) * (H - padT - padB);
    const L = padL, R = W - padR, T = padT, B = H - padB, xMid = xOf(HOOK_MID), yMid = yOf(HOLD_MID);
    const cxOf = (v: number, r: number) => Math.min(R - r - 2, Math.max(L + r + 2, xOf(v)));
    const cyOf = (v: number, r: number) => Math.min(B - r - 2, Math.max(T + r + 2, yOf(v)));
    const els: ReactNode[] = [];
    els.push(h('rect', { key: 'tr', x: xMid, y: T, width: R - xMid, height: yMid - T, fill: 'rgba(30,158,87,.09)' }));
    els.push(h('rect', { key: 'tl', x: L, y: T, width: xMid - L, height: yMid - T, fill: 'rgba(47,109,219,.06)' }));
    els.push(h('rect', { key: 'br', x: xMid, y: yMid, width: R - xMid, height: B - yMid, fill: 'rgba(200,135,12,.10)' }));
    els.push(h('rect', { key: 'bl', x: L, y: yMid, width: xMid - L, height: B - yMid, fill: 'rgba(208,80,74,.07)' }));
    els.push(h('line', { key: 'ax', x1: L, y1: B, x2: R, y2: B, stroke: '#EAECF1' }));
    els.push(h('line', { key: 'ay', x1: L, y1: T, x2: L, y2: B, stroke: '#EAECF1' }));
    els.push(h('line', { key: 'cx', x1: xMid, y1: T, x2: xMid, y2: B, stroke: 'var(--border-strong)' }));
    els.push(h('line', { key: 'cy', x1: L, y1: yMid, x2: R, y2: yMid, stroke: 'var(--border-strong)' }));
    els.push(h('text', { key: 'bx', x: xMid + 4, y: T + 12, fontSize: 9, fill: '#98A0AC', fontFamily: 'Geist Mono, monospace' }, `gancho ${HOOK_MID}%`));
    els.push(h('text', { key: 'by', x: R - 4, y: yMid - 4, textAnchor: 'end', fontSize: 9, fill: '#98A0AC', fontFamily: 'Geist Mono, monospace' }, `retiene ${HOLD_MID}%`));
    // RÓTULOS DE CUADRANTE — FUERA del área de datos (en los gutters)
    const gl = (x: number, y: number, c: string, t: string) => els.push(h('text', { key: `g${t}`, x, y, textAnchor: 'middle', fontSize: 11, fontWeight: 700, fill: c, fontFamily: 'Geist Mono, monospace', letterSpacing: '.05em' }, t));
    gl((L + xMid) / 2, T - 14, '#2F6DDB', 'MEJORAR GANCHO');
    gl((xMid + R) / 2, T - 14, '#1E9E57', 'ESCALAR');
    gl((L + xMid) / 2, B + 22, '#D0504A', 'REPENSAR');
    gl((xMid + R) / 2, B + 22, '#9A6A09', 'REESCRIBIR CUERPO');
    els.push(h('text', { key: 'xt', x: (L + R) / 2, y: H - 8, textAnchor: 'middle', fontSize: 10.5, fontWeight: 600, fill: '#6B675C', fontFamily: 'Geist Mono, monospace' }, 'HOOK RATE → ¿frena el scroll?'));
    els.push(h('text', { key: 'yt', x: 14, y: (T + B) / 2, textAnchor: 'middle', fontSize: 10.5, fontWeight: 600, fill: '#6B675C', fontFamily: 'Geist Mono, monospace', transform: `rotate(-90 14 ${(T + B) / 2})` }, 'RETENCIÓN AL CTA →'));
    if (mode === 'angle') {
      const byA: Record<string, QuadPoint[]> = {};
      items.forEach((p) => { (byA[p.angle] = byA[p.angle] || []).push(p); });
      Object.keys(byA).forEach((k) => {
        const g = byA[k], sp = g.reduce((s, x) => s + x.spend, 0);
        const mh = sp > 0 ? g.reduce((s, x) => s + x.hookRate * x.spend, 0) / sp : 0;
        const mo = sp > 0 ? g.reduce((s, x) => s + x.hold * x.spend, 0) / sp : 0;
        const r = Math.min(36, 13 + Math.sqrt(sp) / 9), c = angleInfo(k).c;
        const cx = cxOf(mh, r), cy = cyOf(mo, r);
        els.push(h('circle', { key: `c${k}`, cx, cy, r, fill: rgba(c, .74), stroke: '#fff', strokeWidth: 2, style: { cursor: 'pointer' }, onClick: () => { setAngle(k); setMapMode('ads'); } }));
        els.push(h('text', { key: `n${k}`, x: cx, y: cy + 4, textAnchor: 'middle', fontSize: 12, fontWeight: 700, fill: '#fff', fontFamily: 'Geist, sans-serif', style: { pointerEvents: 'none' } }, g.length));
        els.push(h('text', { key: `l${k}`, x: cx, y: cy - r - 5, textAnchor: 'middle', fontSize: 10.5, fontWeight: 600, fill: '#12151B', fontFamily: 'Geist, sans-serif', style: { paintOrder: 'stroke', stroke: '#F4F6F9', strokeWidth: 3, strokeLinejoin: 'round', pointerEvents: 'none' } }, angleInfo(k).label));
      });
    } else {
      // Chicas arriba (al final) para que queden clickeables sobre las grandes.
      const pts = items.map((p) => ({ p, r: 7 + (Math.min(p.spend, 2100) / 2100) * 15 })).sort((a, b) => b.r - a.r);
      for (const { p, r } of pts) {
        const on = p.id === selId, hov = p.id === hoverId;
        const cx = cxOf(p.hookRate, r), cy = cyOf(p.hold, r);
        const conf = confFromImpr(p.impressions); const low = conf === 'baja';
        const op = hov ? .95 : conf === 'alta' ? .8 : conf === 'media' ? .5 : .28;
        const c = angleInfo(p.angle).c;
        if (on || hov) els.push(h('circle', { key: `o${p.id}`, cx, cy, r: r + 4, fill: 'none', stroke: '#12151B', strokeWidth: 1.5 }));
        els.push(h('circle', { key: `c${p.id}`, cx, cy, r, fill: rgba(c, op), stroke: low ? '#98A0AC' : '#fff', strokeWidth: 1.5, strokeDasharray: low ? '3 2' : undefined, style: { cursor: 'pointer' }, onClick: () => setOpenAd(p.id), onMouseEnter: () => onHover(p.id), onMouseLeave: () => onHover(null) }));
      }
      // Tooltip del hover (al final → encima de todo); título del guion SOLO acá.
      const hp = items.find((p) => p.id === hoverId);
      if (hp) {
        const r = 7 + (Math.min(hp.spend, 2100) / 2100) * 15;
        const bx0 = cxOf(hp.hookRate, r), by0 = cyOf(hp.hold, r);
        const tw = 188, th = 56;
        const tx = Math.min(R - tw, Math.max(L, bx0 + 10)), ty = Math.min(B - th, Math.max(T, by0 - th - 8));
        const v = verdictFromVals(hp.hookRate, hp.hold, hp.impressions);
        els.push(h('g', { key: 'tip', style: { pointerEvents: 'none' } },
          h('rect', { x: tx, y: ty, width: tw, height: th, rx: 9, fill: 'var(--surface)', stroke: 'var(--border-strong)' }),
          h('text', { x: tx + 11, y: ty + 18, fontSize: 12.5, fontWeight: 700, fill: 'var(--ink)', fontFamily: 'Geist, sans-serif' }, hp.short.length > 26 ? `${hp.short.slice(0, 25)}…` : hp.short),
          h('text', { x: tx + 11, y: ty + 34, fontSize: 11, fill: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }, `hook ${hp.hookRate}%  ·  ret ${hp.hold}%  ·  ${fmtUSD(hp.spend)}`),
          h('text', { x: tx + 11, y: ty + 49, fontSize: 11, fontWeight: 600, fill: VERDICT[v].c, fontFamily: 'Geist, sans-serif' }, `${VERDICT[v].label}  ·  ${hp.agendas} ag`)));
      }
    }
    return h('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', height: 'auto', display: 'block' } }, ...els);
  }

  function openPattern(p: Pattern) {
    setDrill({
      title: p.stmt, aLabel: p.aLabel, aVal: p.aVal, aColor: p.bigColor, aBar: bar(p.a, p.max, p.bigColor),
      bLabel: p.bLabel, bVal: p.bVal, bBar: bar(p.b, p.max, 'var(--border-strong)'),
      rows: drillRows(p.ads),
    });
  }

  const lowConf = ads.filter((a) => confidence(a) === 'baja' || (a.hookRate >= 24 && a.agendas === 0 && a.spend < 800));
  const quadLegend = [
    { c: '#1E9E57', title: 'Escalar', sub: 'Paran y se quedan. Más presupuesto.' },
    { c: '#2F6DDB', title: 'Mejorar el gancho', sub: 'Retienen, pero entran pocos.' },
    { c: '#9A6A09', title: 'Reescribir el cuerpo', sub: 'Frenan, pero se aburren y se van.' },
    { c: '#D0504A', title: 'Repensar', sub: 'Ni frenan ni retienen. Pausar.' },
  ];

  const sel = openAd ? ads.find((a) => a.id === openAd) ?? null : null;

  // ── Estado vacío / error ──
  if (ads.length === 0) {
    return (
      <div style={{ marginTop: 24 }}>
        <SyncBar syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} counts={counts} onSync={() => sincronizar()} />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            {errorMsg ? 'Sin datos disponibles' : 'Todavía no hay guiones analizados'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
            {errorMsg
              ? 'No se pudo leer la base (en local faltan las claves de Supabase). En producción, sincroniza para analizar los guiones de los video ads con transcript.'
              : 'Sincroniza para que MaKo lea los guiones de los video ads (los que ya tienen transcript), los clasifique y arme los patrones. Aparecen aquí todos los guiones con gasto que ya tienen transcript.'}
          </div>
          {!errorMsg && counts.sinTranscript > 0 && (
            <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)', marginTop: 16 }}>
              {counts.sinTranscript} anuncios de Meta sin analizar todavía · {counts.analizadas} guiones analizados en total
            </div>
          )}
          {errorMsg && <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)', marginTop: 16, wordBreak: 'break-word' }}>{errorMsg}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)', marginTop: 24 }}>
      <SyncBar syncing={syncing} syncMsg={syncMsg} lastSync={lastSync} counts={counts} onSync={() => setConfirmSync(true)} />

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
          <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Patrones</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setConfirmSync(true)} disabled={syncing} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 999, border: '1px solid var(--border-strong)', background: syncing ? 'var(--surface-2)' : 'var(--surface)', color: syncing ? 'var(--dim)' : 'var(--ink)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>{syncing ? 'Actualizando…' : '↻ Actualizar'}</button>
            <button onClick={() => setMako(true)} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(18,21,27,.18)' }}>
              {spark(14, 'sap')}<span>Conclusiones con <span style={{ fontFamily: 'Georgia,serif', fontWeight: 700 }}><span style={{ color: '#EF9F27' }}>M</span>a<span style={{ color: '#EF9F27' }}>K</span>o</span></span>
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', margin: '0 0 4px' }}>
          <span><span style={{ color: POL.bueno.c }}>●</span> sigue</span><span><span style={{ color: POL.malo.c }}>●</span> corta</span><span><span style={{ color: POL.proceso.c }}>●</span> proceso</span>
        </div>

        {P.length === 0 ? (
          <div style={{ fontSize: 13.5, color: 'var(--faint)', margin: '16px 0' }}>Todavía no hay patrones — faltan guiones con datos. Toca Actualizar para analizar los pendientes.</div>
        ) : (
          <>
            <button onClick={() => openPattern(P[0])} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: rgba(POL[P[0].polarity].c, .07), border: `1px solid ${rgba(POL[P[0].polarity].c, .36)}`, borderRadius: 16, padding: '22px 24px', margin: '14px 0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                <div style={{ flex: 'none' }}>
                  <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, fontFamily: MONO, letterSpacing: '.06em', textTransform: 'uppercase', background: rgba(POL[P[0].polarity].c, .14), color: POL[P[0].polarity].c, marginBottom: 10 }}>{POL[P[0].polarity].label} · {P[0].chip}</span>
                  <div style={{ fontSize: 50, fontWeight: 600, letterSpacing: '-0.02em', color: POL[P[0].polarity].c, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{P[0].big}</div>
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{P[0].stmt}</div>
                  <div style={{ fontSize: 12.5, color: POL[P[0].polarity].c, fontWeight: 600, marginTop: 8 }}>ver guiones →</div>
                </div>
              </div>
            </button>
            {P.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(184px,1fr))', gap: 12 }}>
                {P.slice(1, 9).map((p) => (
                  <button key={p.key} onClick={() => openPattern(p)} style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: `3px solid ${POL[p.polarity].c}`, borderRadius: 14, padding: '16px 17px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 152 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 999, fontFamily: MONO, letterSpacing: '.04em', background: rgba(POL[p.polarity].c, .12), color: POL[p.polarity].c, border: `1px solid ${rgba(POL[p.polarity].c, .3)}` }}>{p.chip}</span>
                      <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>ver →</span>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                      <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', color: p.bigColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{p.big}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.35, marginTop: 6 }}>{p.tlabel}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 13 }}>
                        <div style={{ height: 6, borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}><div style={bar(p.a, p.max, POL[p.polarity].c)} /></div>
                        <div style={{ height: 6, borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}><div style={bar(p.b, p.max, 'var(--border-strong)')} /></div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* confidence guard */}
        {lowConf.length > 0 && (
          <div style={{ marginTop: 16, background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 14, overflow: 'hidden' }}>
            <button onClick={() => setShowCaveat((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 17px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 7, background: 'var(--bad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>!</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--bad)' }}>Cuidado con la muestra chica</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--bad)', background: 'rgba(208,80,74,.13)', padding: '2px 9px', borderRadius: 999 }}>{lowConf.length}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--bad)' }}>{showCaveat ? '▴' : '▾'}</span>
            </button>
            {showCaveat && (
              <div style={{ padding: '0 18px 16px 52px' }}>
                <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 12 }}>Estos guiones llaman la atención pero aún no probaron nada — poco spend o cero agendas. Valida con presupuesto antes de copiarlos; no los compares de igual a igual con los que ya gastaron miles. Quedan fuera de los patrones de arriba.</div>
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
          <div style={{ position: 'relative' }}>
            <button onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: activeFilters > 0 ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              <span aria-hidden>⚙</span> Filtros
              {activeFilters > 0 && <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--primary)', borderRadius: 999, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{activeFilters}</span>}
              <span aria-hidden style={{ fontSize: 10, color: 'var(--faint)' }}>▾</span>
            </button>
            {filtersOpen && (
              <>
                <div onClick={() => setFiltersOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
                <div style={{ position: 'absolute', right: 0, marginTop: 8, zIndex: 50, width: 300, maxWidth: '90vw', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', padding: 14, boxShadow: '0 16px 40px rgba(18,21,27,.22)', display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Filtros</span>
                    {activeFilters > 0 && <button onClick={() => { onQuadWin('todo'); setAngle('todos'); setMapMode('ads'); setHideSmall(false); }} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Limpiar</button>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Período</span>
                    <Dropdown value={quadWin} onChange={onQuadWin} ariaLabel="Período" width="100%" options={[{ value: 'todo', label: 'Todo el histórico' }, { value: '90', label: 'Últimos 90 días' }, { value: '30', label: 'Últimos 30 días' }, { value: '7', label: 'Últimos 7 días' }]} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Ángulo</span>
                    <Dropdown value={angle} onChange={setAngle} ariaLabel="Ángulo" width="100%" options={[{ value: 'todos', label: 'Todos los ángulos' }, ...Object.keys(ANGLE).map((k) => ({ value: k, label: ANGLE[k].label, color: ANGLE[k].c }))]} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Vista</span>
                    <Dropdown value={mapMode} onChange={(v) => setMapMode(v as 'ads' | 'angle')} ariaLabel="Vista" width="100%" options={[{ value: 'ads', label: 'Por anuncio' }, { value: 'angle', label: 'Por ángulo' }]} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Muestra</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>Ocultar muestra chica</span>
                      <Toggle on={hideSmall} onChange={setHideSmall} />
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>esconde los de baja confianza (&lt;8k impresiones)</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 244px', gap: 30, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginBottom: 4, minHeight: 16 }}>
              {quadLoading ? 'Recalculando…' : `${quadWin === 'todo' ? 'Todo el histórico' : `Últimos ${quadWin} días`} · ${quadItems.length} guion${quadItems.length === 1 ? '' : 'es'}`}
            </div>
            {quadMap(quadItems, mapMode, openAd, hoverPt, setHoverPt)}
          </div>
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
                ? `Cada punto es un anuncio (pasa el cursor para ver cuál); el tamaño = spend y las translúcidas de borde punteado tienen poca muestra. Ejes FIJOS con cortes en gancho ${HOOK_MID}% y retención ${HOLD_MID}% — la posición significa lo mismo siempre. La retención al CTA es baja para casi todos (es estructural del video), por eso la mayoría cae en la banda inferior; ahí lo que manda es el gancho (izq/der) y el spend (tamaño).`
                : 'Cada burbuja es un ángulo (número = cuántos anuncios), ponderado por spend. Los cortes son fijos. Tócala para ver sus guiones.'}
            </div>
          </div>
        </div>
      </section>

      {/* ANALIZA NUEVO GUION */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Analiza un guion nuevo</h2>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 5 }}>Pega un guion que todavía no subiste a Meta. MaKo lo compara con lo que ya te funciona y te dice qué esperar y cómo probarlo.</div>
        <textarea value={guionText} onChange={(e) => setGuionText(e.target.value)} placeholder="Pega aquí el guion completo del video…" rows={6} style={{ width: '100%', marginTop: 14, padding: '14px 16px', borderRadius: 13, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14.5, lineHeight: 1.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={valorar} disabled={valorando} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 11, border: 'none', background: valorando ? 'var(--surface-2)' : '#14161B', color: valorando ? 'var(--dim)' : '#F3F5F8', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: valorando ? 'default' : 'pointer' }}>{valorando ? 'Valorando…' : <>{spark(14, 'sva')} Valorar guion</>}</button>
          {valError && <span style={{ fontSize: 12.5, color: 'var(--bad)' }}>{valError}</span>}
          {guionText.length > 0 && !valorando && <button onClick={() => { setGuionText(''); setValoracion(null); setValError(null); }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' }}>limpiar</button>}
        </div>
        {valoracion && <ValoracionView v={valoracion} />}

        {drafts.length > 0 && (
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>Historial · {drafts.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drafts.map((d) => { const vv = VV[d.verdicto ?? ''] ?? { label: d.verdicto ?? '—', c: '#6B675C' }; return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px' }}>
                  <button onClick={() => viewDraft(d)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: 0 }}>
                    {d.angle && <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: angleInfo(d.angle).c }} />}
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 'none', maxWidth: 200 }}>{d.short || 'Guion'}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{d.guion.replace(/\s+/g, ' ').slice(0, 80)}…</span>
                  </button>
                  <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: rgba(vv.c, .1), color: vv.c, border: `1px solid ${rgba(vv.c, .3)}`, whiteSpace: 'nowrap', flex: 'none' }}>{vv.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap', flex: 'none' }}>{d.created_at.slice(0, 10)}</span>
                  <button onClick={() => borrarDraft(d.id)} aria-label="Borrar del historial" title="Borrar del historial" style={{ flex: 'none', width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><IconoBorrar size={15} /></button>
                </div>
              ); })}
            </div>
          </div>
        )}
      </section>

      {/* GUIONES */}
      <GuionesPanel scripts={visible} onOpen={setOpenAd} limit={8} fullHref="/ads-analyst/guiones" angles={angles} avatares={avatares} />

      <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 6, lineHeight: 1.6 }}>
        Patrones automáticos · Meta Ads (spend · frecuencia · retención de video por cuartiles) × CRM (agendas y cierres). La retención por beat se estima con los cuartiles de Meta y los tiempos de cada bloque con el ritmo de lectura. Los guiones de muestra chica quedan fuera de los patrones.
      </footer>

      {/* DETALLE UNIFICADO (Rendimiento · Audiencia · Guion) — abre en Guion */}
      {sel && <AdDetailTabs key={sel.id} scriptView={sel} angles={angles} avatares={avatares} desde={detalleRange.desde} hasta={detalleRange.hasta} defaultTab="guion" onClose={() => setOpenAd(null)} />}


      {/* PATTERN DRILL MODAL */}
      {drill && (
        <div onClick={() => setDrill(null)} style={{ position: 'fixed', inset: 0, zIndex: 66, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '22px 26px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}><div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>Patrón</div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 4, lineHeight: 1.4 }}>{drill.title}</div></div>
              <button aria-label="Cerrar" onClick={() => setDrill(null)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
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
        <div onClick={() => setMako(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, background: 'linear-gradient(150deg,#23272F,#14161B)', border: '1px solid rgba(239,159,39,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{spark(15, 'samb')}</div>
                <div style={{ minWidth: 0 }}><div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Conclusiones con MaKo</div><div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>Qué escribir esta semana</div></div>
              </div>
              <button aria-label="Cerrar" onClick={() => setMako(false)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
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

      {/* CONFIRMACIÓN DE ACTUALIZAR */}
      {confirmSync && (
        <div onClick={() => setConfirmSync(false)} style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 20px', overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Actualizar patrones</div>
                <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', marginTop: 3 }}>{syncGate.level === 'nada' ? 'Ya está todo al día' : syncGate.level === 'reciente' ? 'Recién sincronizaste' : 'Actualizar patrones'}</div>
              </div>
              <button aria-label="Cerrar" onClick={() => setConfirmSync(false)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {syncGate.level === 'nada' ? (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                  No hay guiones nuevos sin analizar — los patrones ya reflejan los {counts.analizadas} guiones analizados. Vuelve cuando entren anuncios nuevos con transcript.{counts.errores > 0 ? ` Hay ${counts.errores} con error — actualizar puede reintentarlos.` : ''}
                </div>
              ) : syncGate.level === 'reciente' ? (
                <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 12, padding: '13px 15px' }}>
                  <span style={{ flex: 'none', color: '#7A5908', fontWeight: 700, fontSize: 15 }}>!</span>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#5A4408' }}>Se actualizó {humanizeAgo(lastSync)}. Si recién lo corriste, los {syncGate.pend} pendiente{syncGate.pend === 1 ? '' : 's'} quizá todavía se están procesando.</div>
                </div>
              ) : (
                <div style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink)' }}>Hay <b>{syncGate.pend}</b> guion{syncGate.pend === 1 ? '' : 'es'} nuevo{syncGate.pend === 1 ? '' : 's'} sin analizar.</div>
              )}
              {syncGate.pend > 0 && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--faint)' }}>Esto corre MaKo (Claude) sobre {syncGate.pend} guion{syncGate.pend === 1 ? '' : 'es'} y puede tardar ~30-60s. Al terminar, los patrones y las conclusiones se recalculan solos.</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                {syncGate.level === 'nada' ? (
                  <>
                    <button onClick={() => { setConfirmSync(false); sincronizar(true); }} style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' }}>Actualizar igual</button>
                    <button onClick={() => setConfirmSync(false)} style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setConfirmSync(false)} style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={() => { setConfirmSync(false); sincronizar(syncGate.level === 'reciente'); }} style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{syncGate.level === 'reciente' ? 'Actualizar igual' : 'Sí, actualizar'}</button>
                  </>
                )}
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
        {counts.analizadas} guiones analizados{counts.sinTranscript > 0 ? ` · ${counts.sinTranscript} sin analizar` : ''}{counts.errores > 0 ? ` · ${counts.errores} con error` : ''}
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
export function FunnelModal({ sel, onClose, onReanalizar, reMsg, onSetAngle, onSetAvatar, embedded = false }: { sel: ScriptView; onClose: () => void; onReanalizar: (id: string) => void; reMsg: string | null; onSetAngle?: (id: string, angle: string | null) => void; onSetAvatar?: (id: string, avatar: string | null) => void; embedded?: boolean }) {
  const v = verdictOf(sel), ho = hold(sel), vc = VERDICT[v].c, conf = confidence(sel), cp = cpa(sel);
  const beats = decorateBeats(sel);
  // Los creativos de imagen no tienen gancho de 3s, retención al CTA ni frecuencia
  // de video útil → se muestran solo las métricas de negocio (plata, agendas, cierres).
  const chips = sel.esImagen ? [
    { label: 'Spend', value: fmtUSD(sel.spend), color: 'var(--ink)' },
    { label: '$/agenda', value: cp == null ? '—' : fmtUSD(cp), color: cp == null ? 'var(--faint)' : 'var(--ink)' },
    { label: 'Agendas', value: String(sel.agendas), color: sel.agendas > 0 ? 'var(--good)' : 'var(--faint)' },
    { label: 'Cierres', value: String(sel.cierres), color: sel.cierres > 0 ? 'var(--good)' : 'var(--faint)' },
    { label: 'Impresiones', value: sel.impressions.toLocaleString('en-US'), color: 'var(--ink)' },
    { label: 'Confianza', value: CONF[conf].label, color: CONF[conf].c },
  ] : [
    { label: 'Hook 3s', value: `${sel.hookRate}%`, color: hookColor(sel.hookRate) },
    { label: 'Ret. CTA', value: `${ho}%`, color: retColor(ho) },
    { label: 'Spend', value: fmtUSD(sel.spend), color: 'var(--ink)' },
    { label: 'Frecuencia', value: sel.freq.toFixed(2), color: fatColor(sel) },
    { label: '$/agenda', value: cp == null ? '—' : fmtUSD(cp), color: cp == null ? 'var(--faint)' : 'var(--ink)' },
    { label: 'Agendas', value: String(sel.agendas), color: sel.agendas > 0 ? 'var(--good)' : 'var(--faint)' },
    { label: 'Cierres', value: String(sel.cierres), color: sel.cierres > 0 ? 'var(--good)' : 'var(--faint)' },
    { label: 'Confianza', value: CONF[conf].label, color: CONF[conf].c },
  ];
  // Ángulos disponibles para corregir a mano + opción de volver a la IA.
  const angleOpts: DropdownOption[] = [
    ...Object.entries(ANGLE).map(([k, a]) => ({ value: k, label: a.label, color: a.c })),
    { value: '__auto', label: 'Automático (IA)', sub: 'volver a la clasificación de la IA' },
  ];
  // Avatares: solo si el cliente definió alguno. "Sin avatar" = limpiar (null).
  const avatarKeys = Object.keys(AVATAR);
  const avatarOpts: DropdownOption[] = [
    { value: '__none', label: 'Sin avatar' },
    ...Object.entries(AVATAR).map(([k, a]) => ({ value: k, label: a.label, color: a.c })),
    { value: '__auto', label: 'Automático (IA)', sub: 'volver a la clasificación de la IA' },
  ];
  const avgWatch = `0:${String(Math.round(sel.dur * 0.62)).padStart(2, '0')}`;
  // embedded = se renderiza adentro de la pestaña "Guion" de la vista unificada:
  // sin overlay, sin shell propio y sin botón de cierre (esos los pone el contenedor).
  const overlayStyle: CSSProperties = embedded
    ? { display: 'contents' }
    : { position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' };
  const shellStyle: CSSProperties = embedded
    ? { width: '100%' }
    : { width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' };
  return (
    <div onClick={embedded ? undefined : onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={shellStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: embedded ? '0 0 16px' : '22px 26px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
              {onSetAngle ? (
                <Dropdown value={sel.angle} options={angleOpts} ariaLabel="Cambiar ángulo del guion"
                  onChange={(val) => onSetAngle(sel.adId, val === '__auto' ? null : val)}
                  buttonStyle={{ padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, borderColor: rgba(angleInfo(sel.angle).c, .4), color: angleInfo(sel.angle).c, background: rgba(angleInfo(sel.angle).c, .1) }} />
              ) : (
                <span style={angleChip(sel.angle)}>{angleInfo(sel.angle).label}</span>
              )}
              {avatarKeys.length > 0 && (onSetAvatar ? (
                <Dropdown value={sel.avatar || '__none'} options={avatarOpts} ariaLabel="Cambiar avatar del guion"
                  onChange={(val) => onSetAvatar(sel.adId, val === '__auto' || val === '__none' ? null : val)}
                  buttonStyle={{ padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, borderColor: rgba(avatarInfo(sel.avatar).c, .4), color: sel.avatar ? avatarInfo(sel.avatar).c : 'var(--dim)', background: 'var(--surface-2)' }} />
              ) : sel.avatar ? (
                <span style={avatarChip(sel.avatar)}><span style={{ width: 7, height: 7, borderRadius: '50%', background: avatarInfo(sel.avatar).c }} />{avatarInfo(sel.avatar).label}</span>
              ) : null)}
              <span style={verdictChip(v)}>{VERDICT[v].label}</span>
            </div>
            {!embedded && <h2 style={{ fontWeight: 600, fontSize: 23, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)', lineHeight: 1.2 }}>{sel.name}</h2>}
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: embedded ? 0 : 4, fontFamily: MONO }}>{sel.format} · {fmtT(sel.dur)} · {sel.days} días{embedded ? '' : ` · ad_id ${sel.adId}`}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 'none' }}>
            {!sel.esImagen && (
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, color: hookColor(sel.hookRate), fontVariantNumeric: 'tabular-nums' }}>{sel.hookRate}%</div><div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: MONO, marginTop: 3, letterSpacing: '.04em' }}>HOOK · 3s</div></div>
            )}
            {!embedded && <button aria-label="Cerrar" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>}
          </div>
        </div>
        <div style={{ padding: embedded ? '16px 0 0' : '22px 26px', maxHeight: embedded ? undefined : '74vh', overflowY: embedded ? undefined : 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {conf === 'baja' && (
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 12, padding: '13px 15px' }}><span style={{ flex: 'none', color: '#7A5908', fontWeight: 700, fontSize: 15 }}>!</span><div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#5A4408' }}>Muestra chica: {fmtUSD(sel.spend)} y {sel.impressions.toLocaleString('en-US')} impresiones en {sel.days} días. Las métricas pueden moverse mucho todavía — valida con más presupuesto.</div></div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chips.map((c) => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 11px' }}><span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' }}>{c.label}</span><span style={{ fontSize: 14, fontWeight: 600, color: c.color, fontVariantNumeric: 'tabular-nums' }}>{c.value}</span></div>
            ))}
          </div>
          {sel.esImagen ? (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Creativo de imagen</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--surface-2)' }}>
              {sel.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sel.thumbnail} alt={sel.name} style={{ width: 200, flex: 'none', borderRadius: 10, border: '1px solid var(--border)', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 200, height: 200, flex: 'none', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 12, fontFamily: MONO }}>sin miniatura</div>
              )}
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--dim)' }}>
                Creativo de imagen — no tiene retención de video ni embudo. El ángulo, los tags y el diagnóstico se derivan del texto y la descripción del anuncio. Se lo juzga por plata, agendas y cierres.
                {sel.permalink && <div style={{ marginTop: 10 }}><a href={sel.permalink} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: 12.5, textDecoration: 'none', fontWeight: 600 }}>Ver en Meta →</a></div>}
              </div>
            </div>
          </div>
          ) : (
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
          )}
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

// ── Valoración de un guion nuevo ──
const VV: Record<string, { label: string; c: string }> = {
  'escalar-candidato': { label: 'Candidato a escalar', c: '#1E9E57' },
  'mejorar-gancho': { label: 'Mejorar gancho', c: '#2F6DDB' },
  'reescribir-cuerpo': { label: 'Reescribir cuerpo', c: '#9A6A09' },
  'repensar-angulo': { label: 'Repensar ángulo', c: '#D0504A' },
  'promesa-pero-validar': { label: 'Promesa — validar', c: '#6B675C' },
};
function Chip({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 11px' }}><span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{value}</span></div>;
}
function PatList({ title, color, items }: { title: string; color: string; items: Array<{ patron: string; evidencia: string }> }) {
  if (!items.length) return null;
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px' }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{items.map((it, i) => (<div key={i}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{it.patron}</div><div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.4 }}>{it.evidencia}</div></div>))}</div>
    </div>
  );
}
function ValoracionView({ v }: { v: Valoracion }) {
  const vv = VV[v.prediccion.verdicto] ?? { label: v.prediccion.verdicto, c: '#6B675C' };
  const sat = v.perfil.angulo_saturado && v.clasificacion.angle === v.perfil.angulo_saturado;
  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 12, padding: '13px 15px' }}>
        <span style={{ flex: 'none', color: '#7A5908', fontWeight: 700, fontSize: 15 }}>!</span>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#5A4408' }}>Predicción sin datos. Este guion no corrió en Meta; abajo es lo que MaKo espera comparándolo con tus {v.perfil.n_total} guiones reales ({v.perfil.n_confiables} con señal suficiente).</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={angleChip(v.clasificacion.angle)}>{angleInfo(v.clasificacion.angle).label}</span>
        {sat && <span style={{ fontSize: 11, color: 'var(--bad)' }}>ángulo ya saturado en tu cuenta</span>}
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)' }}>{v.clasificacion.hook_type} · {v.clasificacion.format}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-block', fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: rgba(vv.c, .1), color: vv.c, border: `1px solid ${rgba(vv.c, .32)}` }}>{vv.label}</span>
      </div>
      {v.clasificacion.tags.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{v.clasificacion.tags.map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>{t}</span>)}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="Hook (est.)" value={`${v.prediccion.hook_rate_estimado.min}–${v.prediccion.hook_rate_estimado.max}%`} />
        <Chip label="Ret. CTA (est.)" value={`${v.prediccion.retencion_cta_estimada.min}–${v.prediccion.retencion_cta_estimada.max}%`} />
        <Chip label="Confianza" value="Sin dato real" />
      </div>
      <div style={{ background: rgba(vv.c, .06), border: `1px solid ${rgba(vv.c, .26)}`, borderRadius: 13, padding: '16px 18px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: vv.c, marginBottom: 8 }}>{v.lectura_estructural.title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{v.lectura_estructural.text}</div>
        {v.prediccion.razon && <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)', marginTop: 8 }}>{v.prediccion.razon}</div>}
      </div>
      {v.beats.length > 0 && (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>El guion en bloques</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.beats.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderLeft: `3px solid ${(KIND[b.kind]?.c) || '#6B675C'}`, paddingLeft: 12 }}>
                <span style={kindChip(b.kind)}>{KIND[b.kind]?.label || b.kind}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>{b.text}</div>
                  {v.lectura_estructural.punto_de_fuga?.beat_index === i && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 3 }}>▼ punto de fuga: {v.lectura_estructural.punto_de_fuga.motivo}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(v.patrones_match.length > 0 || v.patrones_miss.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          <PatList title="Cumple" color="#1E9E57" items={v.patrones_match} />
          <PatList title="Se pierde / reproduce" color="#D0504A" items={v.patrones_miss} />
        </div>
      )}
      {v.reescrituras.length > 0 && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A6A09', marginBottom: 10 }}>Qué probar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{v.reescrituras.map((r, i) => (<div key={i}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.que_cambiar}</div><div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{r.propuesta}</div></div>))}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(30,158,87,.06)', border: '1px solid rgba(30,158,87,.26)', borderRadius: 13, padding: '14px 16px' }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#1E9E57' }}>Plan de validación</span>
        <Chip label="Presupuesto" value={fmtUSD(v.plan_validacion.presupuesto_usd)} />
        <Chip label="Días" value={String(v.plan_validacion.dias_minimos)} />
        <Chip label="Impresiones" value={v.plan_validacion.impresiones_objetivo.toLocaleString('en-US')} />
        {v.plan_validacion.control && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>control: {v.plan_validacion.control}</span>}
        {v.plan_validacion.nota && <div style={{ flexBasis: '100%', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{v.plan_validacion.nota}</div>}
      </div>
    </div>
  );
}

// ── Lista de Guiones (tabla / tarjetas, con preview o completa) ──
function Bar({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 54, flex: 'none', fontFamily: MONO, fontSize: 10.5, color: 'var(--dim)' }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(2, Math.min(100, val))}%`, background: color }} /></div>
      <span style={{ width: 34, flex: 'none', textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 600, color }}>{val}%</span>
    </div>
  );
}
function GuionCard({ s, onOpen }: { s: ScriptView; onOpen: (id: string) => void }) {
  const v = verdictOf(s), ho = hold(s), conf = confidence(s), cp = cpa(s);
  const hasThumb = !!s.thumbnail && /^https?:\/\//i.test(s.thumbnail);
  return (
    <button onClick={() => onOpen(s.id)} style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'flex', minHeight: 156 }}>
      <div style={{ width: 92, flex: 'none', alignSelf: 'stretch', position: 'relative', background: 'var(--surface-2)' }}>
        {hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.thumbnail!} alt={s.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,var(--surface-2) 0 11px,var(--border) 11px 12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 10.5, fontFamily: MONO }}>sin preview</div>
        )}
        <span title={`Confianza ${CONF[conf].label} · ${s.impressions.toLocaleString('en-US')} impr.`} style={{ position: 'absolute', top: 8, left: 8, width: 10, height: 10, borderRadius: '50%', background: CONF[conf].c, boxShadow: '0 0 0 2px rgba(255,255,255,.75)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.name}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={angleChip(s.angle)}>{angleInfo(s.angle).label}</span>
          {s.avatar && <span style={avatarChip(s.avatar)}><span style={{ width: 7, height: 7, borderRadius: '50%', background: avatarInfo(s.avatar).c }} />{avatarInfo(s.avatar).label}</span>}
          <span style={verdictChip(v)}>{VERDICT[v].label}</span>
        </div>
        {s.esImagen ? (
          <div style={{ marginTop: 'auto', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>Imagen · sin retención de video</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
            <Bar label="Hook" val={s.hookRate} color={hookColor(s.hookRate)} />
            <Bar label="Ret. CTA" val={ho} color={retColor(ho)} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>
          <span>{fmtUSD(s.spend)} · {s.days}d{cp == null ? '' : ` · ${fmtUSD(cp)}/ag`}</span>
          <span style={{ fontWeight: 600, color: s.cierres > 0 ? 'var(--good)' : s.agendas > 0 ? 'var(--accent)' : 'var(--faint)' }}>{s.agendas} agenda{s.agendas === 1 ? '' : 's'}{s.cierres > 0 ? ` · ${s.cierres} cierre${s.cierres === 1 ? '' : 's'}` : ''}</span>
        </div>
      </div>
    </button>
  );
}
// Campo de filtro (etiqueta + control) del popover de Guiones.
function FiltroCampo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)' }}>{label}</span>
      {children}
    </div>
  );
}
export function GuionesPanel({ scripts, onOpen, limit, fullHref, angles = [], avatares = [] }: { scripts: ScriptView[]; onOpen: (id: string) => void; limit?: number; fullHref?: string; angles?: AngleDef[]; avatares?: AvatarDef[] }) {
  const router = useRouter();
  const [view, setView] = useState<'preview' | 'tabla'>('preview');
  const [periodo, setPeriodo] = useState('todo');
  const [angulo, setAngulo] = useState('todos');
  const [campana, setCampana] = useState('all');
  const [adset, setAdset] = useState('all');
  const [tipo, setTipo] = useState<'todos' | 'video' | 'imagen'>('todos');
  const [avatarF, setAvatarF] = useState('todos');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [anglesOpen, setAnglesOpen] = useState(false);
  // Por defecto ordena por RESULTADOS (cierres primero, agendas de desempate) →
  // arriba quedan los guiones que más trajeron. Es lo que se ve en la preview top-8.
  const [sort, setSort] = useState<{ key: string; dir: number }>({ key: 'resultados', dir: -1 });
  // "Período" filtra por ACTIVIDAD reciente (última fecha con datos), sin recalcular
  // las métricas (que siguen siendo del histórico completo). Compara strings YYYY-MM-DD.
  const cutoff = useMemo(() => (periodo === 'todo' ? null : new Date(Date.now() - Number(periodo) * 86400000).toISOString().slice(0, 10)), [periodo]);
  const val = (a: ScriptView, k: string): number | string => {
    if (k === 'angle') return angleInfo(a.angle).label;
    if (k === 'resultados') return a.cierres * 10000 + a.agendas; // cierres dominan, agendas desempatan
    if (k === 'hold') return hold(a);
    if (k === 'cpa') { const c = cpa(a); return c == null ? Infinity : c; }
    if (k === 'verdict') return verdictOf(a);
    if (k === 'name') return a.name;
    return (a as unknown as Record<string, number>)[k];
  };
  const campanas = useMemo(() => [...new Set(scripts.map((s) => s.campana ?? 'Sin campaña'))].sort((a, b) => a.localeCompare(b)), [scripts]);
  const adsets = useMemo(() => { const pool = campana === 'all' ? scripts : scripts.filter((s) => (s.campana ?? 'Sin campaña') === campana); return [...new Set(pool.map((s) => s.adset ?? 'Sin adset'))].sort((a, b) => a.localeCompare(b)); }, [scripts, campana]);
  const filtered = useMemo(() => scripts.filter((s) =>
    (campana === 'all' || (s.campana ?? 'Sin campaña') === campana)
    && (adset === 'all' || (s.adset ?? 'Sin adset') === adset)
    && (tipo === 'todos' || (tipo === 'imagen' ? s.esImagen : !s.esImagen))
    && (angulo === 'todos' || s.angle === angulo)
    && (avatarF === 'todos' || s.avatar === avatarF)
    && (!cutoff || (!!s.lastFecha && s.lastFecha >= cutoff))
  ), [scripts, campana, adset, tipo, angulo, avatarF, cutoff]);
  const sorted = useMemo(() => filtered.slice().sort((x, y) => {
    const vx = val(x, sort.key), vy = val(y, sort.key);
    if (typeof vx === 'string' && typeof vy === 'string') return sort.dir * vx.localeCompare(vy);
    const nx = vx as number, ny = vy as number, d = nx - ny;
    return sort.dir * (Number.isFinite(d) ? d : nx === ny ? 0 : nx > ny ? 1 : -1);
  }), [filtered, sort]);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const nActive = (periodo !== 'todo' ? 1 : 0) + (angulo !== 'todos' ? 1 : 0) + (campana !== 'all' ? 1 : 0) + (adset !== 'all' ? 1 : 0) + (tipo !== 'todos' ? 1 : 0) + (avatarF !== 'todos' ? 1 : 0);
  const filtrado = nActive > 0;
  const limpiar = () => { setPeriodo('todo'); setAngulo('todos'); setCampana('all'); setAdset('all'); setTipo('todos'); setAvatarF('todos'); };
  const cols: Array<{ key: string; label: string; al: 'left' | 'right' }> = [
    { key: 'name', label: 'Anuncio', al: 'left' }, { key: 'angle', label: 'Ángulo', al: 'left' },
    { key: 'hookRate', label: 'Hook', al: 'right' }, { key: 'hold', label: 'Ret. CTA', al: 'right' },
    { key: 'spend', label: 'Spend', al: 'right' }, { key: 'freq', label: 'Frec.', al: 'right' },
    { key: 'agendas', label: 'Agendas', al: 'right' }, { key: 'cpa', label: '$/agenda', al: 'right' },
    { key: 'verdict', label: 'Veredicto', al: 'left' },
  ];
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {/* IZQUIERDA: toggle de vista (tabla/preview) + conteo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
          <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Guiones</h2>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
            {(['preview', 'tabla'] as const).map((m) => (<button key={m} onClick={() => setView(m)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, background: view === m ? 'var(--surface)' : 'transparent', color: view === m ? 'var(--ink)' : 'var(--dim)', boxShadow: view === m ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>{m === 'preview' ? 'Preview' : 'Tabla'}</button>))}
          </div>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)' }}>{sorted.length}{limit && sorted.length > limit ? ` · top ${limit}` : ''} · clic para el embudo</span>
        </div>
        {/* DERECHA: gestionar taxonomía + UN botón de Filtros (popover, como el Cuadrante) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <button onClick={() => setAnglesOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><span aria-hidden>✎</span> Ángulos y avatares</button>
          <button onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: filtrado ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><span aria-hidden>⚙</span> Filtros{nActive > 0 ? ` · ${nActive}` : ''}</button>
          {filtersOpen && (
            <>
              <div onClick={() => setFiltersOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50, width: 360, maxWidth: '92vw', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', padding: 16, boxShadow: '0 16px 40px rgba(18,21,27,.22)', display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Filtrar</span>
                  {filtrado && <button onClick={limpiar} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Limpiar ({nActive})</button>}
                </div>
                {/* filtros cortos en 2 columnas para no alargar el panel */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                  <FiltroCampo label="Período">
                    <Dropdown value={periodo} onChange={setPeriodo} ariaLabel="Período" width="100%" options={[{ value: 'todo', label: 'Todo el histórico' }, { value: '90', label: 'Activos · 90 días' }, { value: '30', label: 'Activos · 30 días' }, { value: '7', label: 'Activos · 7 días' }]} />
                  </FiltroCampo>
                  <FiltroCampo label="Tipo">
                    <Dropdown value={tipo} onChange={(t) => setTipo(t as 'todos' | 'video' | 'imagen')} ariaLabel="Tipo" width="100%" options={[{ value: 'todos', label: 'Video e imagen', icono: 'archivo' }, { value: 'video', label: 'Solo video', icono: 'video' }, { value: 'imagen', label: 'Solo imagen', icono: 'imagen' }]} />
                  </FiltroCampo>
                  <FiltroCampo label="Ángulo">
                    <Dropdown value={angulo} onChange={setAngulo} ariaLabel="Ángulo" width="100%" options={[{ value: 'todos', label: 'Todos' }, ...Object.keys(ANGLE).map((k) => ({ value: k, label: ANGLE[k].label, color: ANGLE[k].c }))]} />
                  </FiltroCampo>
                  {avatares.length > 0 && (
                    <FiltroCampo label="Avatar">
                      <Dropdown value={avatarF} onChange={setAvatarF} ariaLabel="Avatar" width="100%" options={[{ value: 'todos', label: 'Todos' }, ...avatares.map((a) => ({ value: a.key, label: a.label, color: a.color }))]} />
                    </FiltroCampo>
                  )}
                </div>
                <FiltroCampo label="Campaña">
                  <Dropdown value={campana} onChange={(c) => { setCampana(c); setAdset('all'); }} ariaLabel="Campaña" width="100%" options={[{ value: 'all', label: 'Todas las campañas' }, ...campanas.map((c) => ({ value: c, label: c }))]} />
                </FiltroCampo>
                <FiltroCampo label="Adset">
                  <Dropdown value={adset} onChange={setAdset} ariaLabel="Adset" width="100%" options={[{ value: 'all', label: 'Todos los adsets' }, ...adsets.map((a) => ({ value: a, label: a }))]} />
                </FiltroCampo>
                <div style={{ height: 1, background: 'var(--border)', margin: '1px 0' }} />
                <FiltroCampo label="Ordenar por">
                  <Dropdown value={sort.key} onChange={(k) => setSort({ key: k, dir: k === 'cpa' ? 1 : -1 })} ariaLabel="Ordenar" width="100%" options={[{ value: 'resultados', label: 'Resultados (cierres · agendas)' }, { value: 'spend', label: 'Gasto' }, { value: 'agendas', label: 'Agendas' }, { value: 'hookRate', label: 'Hook rate' }, { value: 'hold', label: 'Ret. CTA' }, { value: 'cpa', label: '$/agenda' }]} />
                </FiltroCampo>
              </div>
            </>
          )}
        </div>
      </div>
      {view === 'preview' ? (
        sorted.length === 0 ? <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin guiones para este filtro.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>{shown.map((s) => <GuionCard key={s.id} s={s} onOpen={onOpen} />)}</div>
        )
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 13 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 1000 }}>
            <thead><tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              {cols.map((c) => (<th key={c.key} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : (c.key === 'name' || c.key === 'angle' ? 1 : -1) }))} style={{ padding: `13px ${c.al === 'right' ? '14px' : '16px'}`, textAlign: c.al, fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: sort.key === c.key ? 'var(--ink)' : 'var(--dim)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>{c.label}{sort.key === c.key ? (sort.dir < 0 ? '  ▾' : '  ▴') : ''}</th>))}
            </tr></thead>
            <tbody>
              {shown.map((a) => { const v = verdictOf(a), ho = hold(a), conf = confidence(a), cp = cpa(a); return (
                <tr key={a.id} onClick={() => onOpen(a.id)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <td style={{ padding: '13px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><span title={`Confianza ${CONF[conf].label} · ${a.impressions.toLocaleString('en-US')} impres.`} style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: CONF[conf].c, boxShadow: `0 0 0 3px ${rgba(CONF[conf].c, .2)}` }} /><span style={{ fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span></div></td>
                  <td style={{ padding: '13px 14px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--dim)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: angleInfo(a.angle).c }} />{angleInfo(a.angle).label}</span></td>
                  <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: a.esImagen ? 'var(--faint)' : hookColor(a.hookRate) }}>{a.esImagen ? '—' : `${a.hookRate}%`}</td>
                  <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: a.esImagen ? 'var(--faint)' : retColor(ho) }}>{a.esImagen ? '—' : `${ho}%`}</td>
                  <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{fmtUSD(a.spend)}</td>
                  <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: fatColor(a) }}>{a.freq.toFixed(2)}</td>
                  <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: a.agendas > 0 ? 'var(--good)' : 'var(--faint)' }}>{a.agendas}</td>
                  <td style={{ padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: cp == null ? 'var(--faint)' : cp <= 300 ? 'var(--good)' : 'var(--ink)' }}>{cp == null ? '—' : fmtUSD(cp)}</td>
                  <td style={{ padding: '13px 16px' }}><span style={verdictChip(v)}>{VERDICT[v].label}</span></td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      )}
      {limit && fullHref && sorted.length > limit && (
        <div style={{ marginTop: 14, textAlign: 'center' }}><a href={fullHref} style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Ver los {sorted.length} guiones →</a></div>
      )}
      {anglesOpen && <TaxonomyManager angles={angles} avatares={avatares} onClose={() => setAnglesOpen(false)} onSaved={() => { setAnglesOpen(false); router.refresh(); }} />}
    </section>
  );
}
export function GuionesFull({ scripts, angles = [], avatares = [] }: { scripts: ScriptView[]; angles?: AngleDef[]; avatares?: AvatarDef[] }) {
  applyAngles(angles);
  applyAvatares(avatares);
  const [openAd, setOpenAd] = useState<string | null>(null);
  const range = useMemo(allHistoryRange, []);
  const sel = openAd ? scripts.find((a) => a.id === openAd) ?? null : null;
  return (
    <>
      <GuionesPanel scripts={scripts} onOpen={setOpenAd} angles={angles} avatares={avatares} />
      {sel && <AdDetailTabs key={sel.id} scriptView={sel} angles={angles} avatares={avatares} desde={range.desde} hasta={range.hasta} defaultTab="guion" onClose={() => setOpenAd(null)} />}
    </>
  );
}
