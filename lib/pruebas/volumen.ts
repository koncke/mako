// =============================================================================
// pruebas/volumen — cuánta gente necesita una prueba A/B ANTES de arrancar (PURO, 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md (2.5, con la crítica A.1): el n por rama se calcula ANTES de arrancar y es el horizonte del
// juez (lib/pruebas/juez.ts): «gana» sólo se decide cuando todas las ramas lo tienen. Es el tamaño de muestra de dos
// proporciones con el MISMO umbral que usa el juez (un lado, Bonferroni con k ramas) y potencia 80 %:
//   n = (z₁₋α·√(2·p̄·(1 − p̄)) + z₁₋β·√(p₁(1 − p₁) + p₂(1 − p₂)))² / (p₂ − p₁)²,   p₂ = p₁·(1 + mde)
// Con el volumen de MaKo la mayoría de las pruebas no llega: el plan lo dice ANTES («No llega en 60 días: prueba un cambio
// más grande»), con el efecto que sí se notaría. El ritmo lo pone quien llama (los últimos 30 días del mismo lugar, o el
// cupo de WhatsApp si es menor: crítica, punto 21).
// =============================================================================

import { phiInv } from './estadistica';
import { UMBRAL_GANA, umbralGana } from './juez';

export const POTENCIA = 0.8;
/** Menos de esto por rama no es una prueba, aunque el efecto sea enorme. */
export const MIN_POR_RAMA = 20;

const tasaValida = (p: number): boolean => Number.isFinite(p) && p > 0 && p < 1;

/** Personas MADURAS por rama para ver un salto relativo `mdeRel` sobre la tasa `base`. */
export function nPorRama(o: { base: number; mdeRel: number; ramas?: number; potencia?: number }): number {
  if (!tasaValida(o.base)) throw new Error(`nPorRama: la tasa base ${o.base} tiene que estar entre 0 y 1`);
  if (!(o.mdeRel > 0)) throw new Error(`nPorRama: el efecto ${o.mdeRel} tiene que ser mayor que 0`);
  const p1 = o.base;
  const p2 = Math.min(0.999, p1 * (1 + o.mdeRel));
  const za = phiInv(o.ramas ? umbralGana(o.ramas) : UMBRAL_GANA);
  const zb = phiInv(o.potencia ?? POTENCIA);
  const pm = (p1 + p2) / 2;
  const n = (za * Math.sqrt(2 * pm * (1 - pm)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2;
  return Math.max(MIN_POR_RAMA, Math.ceil(n));
}

/** El salto relativo más chico que se notaría con `n` personas por rama (la inversa de `nPorRama`). */
export function efectoQueSeNota(o: { base: number; n: number; ramas?: number; potencia?: number }): number {
  let lo = 1e-3;
  let hi = 50;
  if (nPorRama({ ...o, mdeRel: hi }) > o.n) return Infinity;
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (nPorRama({ ...o, mdeRel: mid }) > o.n) lo = mid; else hi = mid;
  }
  return hi;
}

export type PlanPrueba = {
  nPorRama: number;
  /** Días hasta el horizonte: juntar la gente, más la ventana para que madure, nunca menos que el mínimo. */
  dias: number;
  llega: boolean;
  /** Si no llega: el salto que sí se notaría en `maxDias`. */
  mdeQueLlega: number | null;
  texto: string;
};

const pct = (x: number): string => `${Math.round(x * 1000) / 10} %`;

/**
 * EL PLAN DE UNA PRUEBA, en números y en palabras. `ritmoPorDia` son las personas que entran por día a la prueba entera
 * (se reparten entre las ramas por sus pesos; acá, en partes iguales: la rama más chica manda si no lo son).
 */
export function planDePrueba(o: { base: number; mdeRel: number; ramas: number; ritmoPorDia: number; ventanaDias: number; minDias: number; maxDias: number; pesoMinimo?: number }): PlanPrueba {
  const n = nPorRama({ base: o.base, mdeRel: o.mdeRel, ramas: o.ramas });
  // La rama con menos peso es la que tarda: con 70/30, la B junta el 30 % del ritmo.
  const porRama = o.ritmoPorDia * ((o.pesoMinimo ?? 100 / o.ramas) / 100);
  const dias = porRama > 0 ? Math.max(o.minDias, Math.ceil(n / porRama) + o.ventanaDias) : Infinity;
  const llega = dias <= o.maxDias;
  const salto = `de ${pct(o.base)} a ${pct(Math.min(0.999, o.base * (1 + o.mdeRel)))}`;
  if (llega) {
    return { nPorRama: n, dias, llega, mdeQueLlega: null,
      texto: `Con tu ritmo (≈${Math.round(o.ritmoPorDia)} por día) esta prueba distingue un salto ${salto} en ~${dias} días.` };
  }
  const nAlTope = Math.floor(porRama * Math.max(0, o.maxDias - o.ventanaDias));
  const mde = nAlTope >= MIN_POR_RAMA ? efectoQueSeNota({ base: o.base, n: nAlTope, ramas: o.ramas }) : Infinity;
  const otro = Number.isFinite(mde) && o.base * (1 + mde) < 1
    ? ` En ${o.maxDias} días sólo se nota un salto de ${pct(o.base)} a ${pct(o.base * (1 + mde))}: prueba un cambio más grande.`
    : ' Con este ritmo no se nota ningún cambio: hace falta más gente.';
  return { nPorRama: n, dias, llega, mdeQueLlega: Number.isFinite(mde) ? mde : null,
    texto: `No llega en ${o.maxDias} días (necesita ${n} por rama para ver un salto ${salto}).${otro}` };
}
