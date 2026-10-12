// =============================================================================
// ads-analyst-patrones — el veredicto, la confianza y los patrones de los guiones
// =============================================================================
// Todo determinístico (nada de esto es IA): sobre las ScriptView que arma el server
// (lib/ads-analyst.ts). Vivía adentro de app/ads-analyst/ScriptsBrowser.tsx, que es
// `'use client'`, y se mudó acá el 11/10/2026 para que lo pueda usar también el
// Dashboard (el conjunto `guiones` estampa el veredicto en cada fila y el bloque
// `patrones_guiones` arma los mismos patrones que la tab). Un `.tsx` con
// `'use client'` no le exporta valores al server: le exporta una referencia de
// cliente que falla al USARLA (AGENTS.md, «'use client' es una frontera de DATOS»).
//
// SIN `server-only`, a propósito: lo importan la tab (cliente), el lector y el bloque
// del Dashboard (server) y los tests. Una sola copia: si cambia un umbral, cambia en
// los tres.
//
// ⚠️ QUEDA UNA COPIA AFUERA: lib/api-mako/areas/ads.run.ts tiene su propia
// `verdictFromVals` (marcada como deuda en ese archivo). No es de esta corrida: el que
// la toque la cambia por un import de acá.

import type { ScriptView } from './ads-analyst';

// Umbrales ABSOLUTOS recalibrados a los datos reales (el mock usaba 20/22, pero
// la retención al CTA real ronda 8% de mediana → 22 dejaba todo abajo). Benchmarks
// FIJOS: "buen gancho ≥28% frena el scroll", "retiene al CTA ≥10% = 1 de cada 10
// llega". Alimentan el veredicto (tabla) Y las divisorias FIJAS del cuadrante.
export const HOOK_MID = 28, HOLD_MID = 10;

export function fmtUSD(n: number): string { return `$${Math.round(n).toLocaleString('en-US')}`; }
export function fmtK(n: number): string { return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`; }

export type Confianza = 'alta' | 'media' | 'baja';
/** La confianza de un anuncio sale de cuántas impresiones juntó: ≥25k alta, ≥8k media. */
export function confFromImpr(impressions: number): Confianza { return impressions >= 25000 ? 'alta' : impressions >= 8000 ? 'media' : 'baja'; }
export function confidence(a: ScriptView): Confianza { return confFromImpr(a.impressions); }
export function fatigue(a: ScriptView): 'alta' | 'media' | 'ok' { return a.freq >= 2.4 ? 'alta' : a.freq >= 1.8 ? 'media' : 'ok'; }
/** La retención al CTA: la del último bloque del guion, o la del final si no hay bloques. */
export function hold(a: ScriptView): number { return a.beats.length ? a.beats[a.beats.length - 1].ret : a.finalRet; }

export type Veredicto = 'escalar' | 'mejorar' | 'reescribir' | 'repensar' | 'validar' | 'imagen';
/** Los rótulos del veredicto, los mismos que dibuja la tab. */
export const VEREDICTO_ROTULO: Record<Veredicto, string> = {
  escalar: 'Escalar', mejorar: 'Mejorar gancho', reescribir: 'Reescribir cuerpo',
  repensar: 'Repensar', validar: 'Validar (poco spend)', imagen: 'Imagen',
};
export function verdictFromVals(hookRate: number, holdv: number, impressions: number): Veredicto {
  if (confFromImpr(impressions) === 'baja') return 'validar';
  const hi = hookRate >= HOOK_MID, ho = holdv >= HOLD_MID;
  return hi ? (ho ? 'escalar' : 'reescribir') : (ho ? 'mejorar' : 'repensar');
}
export function verdictOf(a: ScriptView): Veredicto { return a.esImagen ? 'imagen' : verdictFromVals(a.hookRate, hold(a), a.impressions); }

/** «Cuidado con la muestra chica»: confianza baja, o un gancho que frena sin agendar con poca plata. */
export function esMuestraChica(a: ScriptView): boolean {
  return confidence(a) === 'baja' || (a.hookRate >= 24 && a.agendas === 0 && a.spend < 800);
}

// ── Patrones ganadores (determinístico sobre los guiones confiables) ──
export type Polarity = 'bueno' | 'malo' | 'proceso';
export const POL: Record<Polarity, { c: string; label: string }> = {
  bueno: { c: '#1E9E57', label: 'Sigue' }, malo: { c: '#D0504A', label: 'Corta' }, proceso: { c: '#9A6A09', label: 'Proceso' },
};
export type Pattern = {
  key: string; polarity: Polarity; chip: string; big: string; bigColor: string; tlabel: string; stmt: string;
  aLabel: string; aVal: string; a: number; bLabel: string; bVal: string; b: number; max: number; ads: ScriptView[]; priority: number;
};

// Patrones positivos (seguí), negativos (cortá) y de proceso (cómo estás probando).
// `ads` = todos los guiones con señal; `reliable` = confianza != baja (≥8k impr).
// Los POSITIVOS se calculan sobre reliable (no celebrar ruido); los de proceso y
// los negativos de desperdicio sobre TODOS (su punto es justo la falta de prueba).
// `etiquetaAngulo` traduce la clave del ángulo a su nombre: el vocabulario es del
// cliente (lo edita en /configuraciones) y cada pantalla lo tiene a mano a su manera.
export function buildPatterns(ads: ScriptView[], reliable: ScriptView[], etiquetaAngulo: (k: string) => string): Pattern[] {
  const angleInfo = (k: string) => ({ label: etiquetaAngulo(k) });
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
