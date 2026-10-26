// =============================================================================
// pruebas/estadistica — las cuentas del juez de las pruebas A/B (PURO, sin dependencias, 25/10/2026)
// =============================================================================
// El diseño (docs/diseno-pruebas-ab.md, 2.5) pedía 20.000 sorteos de la Beta con semilla fija. Acá se INTEGRA sobre una
// grilla en vez de sortear, por dos razones:
//   · el test A/A (tests/pruebas-juez-aa.test.ts) corre el juez en decenas de miles de lecturas: con 20.000 sorteos por
//     rama y por lectura tardaba minutos; integrando, una lectura cuesta menos de un milisegundo;
//   · la integral no tiene el error de los sorteos: la misma lectura da los mismos números, y una probabilidad de 0,9799
//     no se vuelve 0,9801 por la semilla.
// Lo que se calcula, con la posterior Beta(α, β) de cada rama evaluada en la MISMA grilla (densidad f y acumulada F):
//   · P(i es la mejor)            = ∫ f_i(t) · Π_{j≠i} F_j(t) dt
//   · P(θv < s·θc)                = ∫ f_c(t) · F_v(s·t) dt          (s = 1: «peor que el control»)
//   · pérdida esperada de elegir v = E[max(θc − θv, 0)] = ∫ F_v(t) · (1 − F_c(t)) dt
//   · el intervalo del lift relativo θv/θc − 1: los cuantiles de P(θv/θc ≤ r) = ∫ f_c(t) · F_v(r·t) dt, por bisección.
// Con α, β ≥ 1 la densidad es acotada (el prior lo garantiza: lib/pruebas/juez.ts), y la trapecial es exacta a 1e-4
// (tests/pruebas-motor.test.ts la compara con la fórmula cerrada de Evan Miller).
// =============================================================================

/** ln Γ(x), Lanczos (g = 7, 9 coeficientes): error < 1e-13 para x > 0. */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** ln B(a, b). */
export const lnBeta = (a: number, b: number): number => lnGamma(a) + lnGamma(b) - lnGamma(a + b);

/** Φ(z), la normal estándar acumulada (Abramowitz-Stegun 7.1.26 sobre erf: error < 1.5e-7). */
export function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Φ⁻¹(p), Acklam (error relativo < 1.2e-9). */
export function phiInv(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error(`phiInv: ${p} fuera de (0, 1)`);
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const bajo = 0.02425;
  if (p < bajo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - bajo) return -phiInv(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Una posterior Beta(α, β). */
export type Posterior = { alfa: number; beta: number };

/** Media y desvío de una Beta. */
export const mediaDe = (p: Posterior): number => p.alfa / (p.alfa + p.beta);
export const desvioDe = (p: Posterior): number => {
  const s = p.alfa + p.beta;
  return Math.sqrt((p.alfa * p.beta) / (s * s * (s + 1)));
};

/**
 * Puntos de la grilla: con 1.500 el error contra la fórmula exacta queda en ~1e-5 (el test lo fija en 1e-4). Si una rama
 * es mucho más angosta que el rango (dos tasas muy lejos), se agregan puntos hasta tener 16 por desvío, con tope.
 */
export const PUNTOS_GRILLA = 1_500;
const TOPE_PUNTOS = 20_000;

/** Las posteriores evaluadas en una grilla común: t, la densidad f y la acumulada F de cada una. */
export type Grilla = { t: Float64Array; paso: number; f: Float64Array[]; F: Float64Array[] };

/**
 * La grilla que cubre a todas: de la menor media − 12 desvíos a la mayor + 12 (recortado a (0, 1)). Cada densidad se
 * normaliza con la trapecial sobre la misma grilla, así ∫f = 1 y F termina en 1 exacto.
 */
export function grilla(posts: readonly Posterior[], puntos = PUNTOS_GRILLA): Grilla {
  let lo = 1;
  let hi = 0;
  if (!posts.length) throw new Error('grilla: sin posteriores');
  for (const p of posts) {
    const m = mediaDe(p);
    const s = desvioDe(p);
    lo = Math.min(lo, m - 12 * s);
    hi = Math.max(hi, m + 12 * s);
  }
  lo = Math.max(lo, 1e-12);
  hi = Math.min(hi, 1 - 1e-12);
  const angosta = Math.min(...posts.map(desvioDe));
  puntos = Math.min(TOPE_PUNTOS, Math.max(puntos, Math.ceil((hi - lo) / (angosta / 16))));
  const paso = (hi - lo) / (puntos - 1);
  const t = new Float64Array(puntos);
  // ln t y ln(1 − t), una vez para todas las ramas: es lo que más cuesta.
  const lt = new Float64Array(puntos);
  const l1t = new Float64Array(puntos);
  for (let k = 0; k < puntos; k++) { t[k] = lo + k * paso; lt[k] = Math.log(t[k]); l1t[k] = Math.log(1 - t[k]); }
  const f: Float64Array[] = [];
  const F: Float64Array[] = [];
  for (const p of posts) {
    const ln = new Float64Array(puntos);
    let max = -Infinity;
    for (let k = 0; k < puntos; k++) {
      ln[k] = (p.alfa - 1) * lt[k] + (p.beta - 1) * l1t[k];
      if (ln[k] > max) max = ln[k];
    }
    const d = new Float64Array(puntos);
    for (let k = 0; k < puntos; k++) d[k] = Math.exp(ln[k] - max);
    const acum = new Float64Array(puntos);
    for (let k = 1; k < puntos; k++) acum[k] = acum[k - 1] + 0.5 * (d[k] + d[k - 1]) * paso;
    const total = acum[puntos - 1] || 1;
    for (let k = 0; k < puntos; k++) { d[k] /= total; acum[k] /= total; }
    f.push(d);
    F.push(acum);
  }
  return { t, paso, f, F };
}

/** F_i(x) por interpolación lineal (0 debajo de la grilla, 1 arriba). */
function acumuladaEn(g: Grilla, i: number, x: number): number {
  const n = g.t.length;
  if (x <= g.t[0]) return 0;
  if (x >= g.t[n - 1]) return 1;
  const pos = (x - g.t[0]) / g.paso;
  const k = Math.floor(pos);
  const w = pos - k;
  return g.F[i][k] * (1 - w) + g.F[i][Math.min(k + 1, n - 1)] * w;
}

/** ∫ h(t_k) dt con la trapecial. */
function integral(g: Grilla, h: (k: number) => number): number {
  const n = g.t.length;
  let s = 0;
  let prev = h(0);
  for (let k = 1; k < n; k++) {
    const cur = h(k);
    s += 0.5 * (prev + cur) * g.paso;
    prev = cur;
  }
  return s;
}

/** P(rama i es la mejor) para cada rama. Suman 1 (a 1e-4). */
export function probMejor(g: Grilla): number[] {
  const m = g.f.length;
  return g.f.map((_, i) => Math.min(1, Math.max(0, integral(g, (k) => {
    let prod = g.f[i][k];
    for (let j = 0; j < m; j++) if (j !== i) prod *= g.F[j][k];
    return prod;
  }))));
}

/** P(θv < s·θc): con s = 1, «v es peor que el control»; con s = 1 − tolerancia, «peor por más de la tolerancia». */
export function probMenorQue(g: Grilla, v: number, c: number, s = 1): number {
  const Fv = g.F[v];
  const p = s === 1 ? integral(g, (k) => g.f[c][k] * Fv[k]) : integral(g, (k) => g.f[c][k] * acumuladaEn(g, v, s * g.t[k]));
  return Math.min(1, Math.max(0, p));
}

/** Lo que se pierde, en promedio, por quedarse con v si el control era mejor: E[max(θc − θv, 0)]. */
export function perdidaEsperada(g: Grilla, v: number, c: number): number {
  return Math.max(0, integral(g, (k) => g.F[v][k] * (1 - g.F[c][k])));
}

/** El cuantil q del lift relativo θv/θc − 1 (por bisección sobre r = θv/θc, en escala logarítmica). */
export function cuantilLift(g: Grilla, v: number, c: number, q: number): number {
  const prob = (r: number): number => integral(g, (k) => g.f[c][k] * acumuladaEn(g, v, r * g.t[k]));
  let lo = Math.log(1e-6);
  let hi = Math.log(1e6);
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (prob(Math.exp(mid)) < q) lo = mid; else hi = mid;
  }
  return Math.exp((lo + hi) / 2) - 1;
}
