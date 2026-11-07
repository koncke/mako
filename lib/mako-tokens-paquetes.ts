// =============================================================================
// Lo que se le VENDE al cliente: el clip como unidad, los topes por plan y los paquetes (7/11/2026)
// =============================================================================
// `mako-tokens-reglas.ts` dice lo que las cosas CUESTAN. Esto dice lo que se COBRA, que es otra
// decisión y la toma Martín. Van separados a propósito: el costo se mide, el precio se decide.
//
// ── La unidad es el CLIP de 10 segundos ─────────────────────────────────────
//
// No es arbitrario: 10 s es el TOPE de Omni Flash (`invalid duration 60, must be one of 4/6/8/10`)
// y es el más barato POR SEGUNDO, porque el modelo cobra US$0,15 fijos + US$0,025 por segundo. Un
// clip de 4 s sale US$0,0625 el segundo; uno de 10 s, US$0,040. **Partir una pieza en clips cortos
// la encarece sin que nadie lo note.** Al cliente se le habla en MINUTOS: seis clips.
//
// ── El piso, y el que NO es piso ────────────────────────────────────────────
//
// ⚠️ EL ÚNICO PISO ES EL MARGINAL: lo que cuesta cada clip de más al subir de Pro a Growth
// (US$50 ÷ 30 clips = US$1,67). Es la única alternativa real que tiene el cliente, y si el paquete
// sale menos que eso, a un Pro le conviene recargar antes que subir y el escalón de planes se borra.
//
// ⚠️ Y LO QUE PARECE UN PISO Y NO LO ES: lo que el plan cobra por clip en promedio (US$97 ÷ 36 =
// US$2,69). El 7/11 lo usé como piso y me llevó a recomendar US$3, que daba un paquete de US$90 por
// 5 minutos **contra un plan de US$97 que da 6 minutos Y todo el producto**. Lo cazó Martín.
// La causa del error: **el plan no cobra clips, cobra el producto.** Los 97 dólares compran la app
// entera y los 6 minutos vienen adentro; dividir ese precio por los clips no da el precio de un
// clip, da un promedio que no significa nada. `rateDelPlan` queda abajo para poder MIRARLO, pero
// `respetaElPiso` no lo usa, y esa distinción es justamente lo que este archivo existe para fijar.
// =============================================================================

import { type Plan } from './mako-tokens-reglas';

/** Lo que cuesta generar un clip de 10 s con su imagen de referencia. MEDIDO el 7/11. */
export const USD_POR_CLIP = 0.412;

/** Seis clips de 10 s. Es como se le cuenta al cliente: «un minuto». */
export const CLIPS_POR_MINUTO = 6;

/**
 * Lo que se cobra por un clip suelto, fuera del plan. **US$2, decidido por Martín el 7/11.**
 * El minuto le sale US$12, deja 79,4% de margen y queda 20% arriba del piso marginal.
 */
export const USD_POR_CLIP_SUELTO = 2;

/** Cuántos MT vale un clip. Redondo hacia arriba desde los 412 de costo: deja aire y se lee. */
export const MT_POR_CLIP = 500;

/**
 * Los clips que trae cada nivel al mes.
 *
 * ⚠️ `free` NO es un plan: es la prueba de 7 días (Martín, 7/11: «no quiero que exista un plan
 * free»). Da UN clip, no un video entero.
 * ⚠️ Y el Pro da UN minuto a propósito: «el plan de 47 está más que nada pensado para que tengas
 * otras funcionalidades… si querés generación de video, te incentivo a que compres el de 97».
 */
export const CLIPS_POR_MES: Record<Plan, number> = {
  free: 1,
  pro: 6,
  growth: 36,
};

/** El precio de cada plan, para calcular el piso sin cablearlo. */
export const USD_DEL_PLAN: Record<Plan, number> = { free: 0, pro: 47, growth: 97 };

/** Los minutos que trae un plan, que es como se le dice al cliente. */
export const minutosDelPlan = (plan: Plan): number => CLIPS_POR_MES[plan] / CLIPS_POR_MINUTO;

/**
 * EL PISO: lo que cuesta cada clip de más al subir de un plan al siguiente.
 * Devuelve null si no hay clips de diferencia — no 0 ni Infinity, que invitarían a comparar.
 */
export function pisoMarginal(de: Plan = 'pro', a: Plan = 'growth'): number | null {
  const clips = CLIPS_POR_MES[a] - CLIPS_POR_MES[de];
  const usd = USD_DEL_PLAN[a] - USD_DEL_PLAN[de];
  return clips > 0 ? usd / clips : null;
}

/**
 * Lo que el plan sale por clip en promedio. **NO ES UN PISO** (ver la cabecera): el plan cobra el
 * producto, no los clips. Está para poder mirarlo y para que nadie lo vuelva a usar como piso sin
 * leer por qué no lo es.
 */
export function rateDelPlan(plan: Plan = 'growth'): number | null {
  const clips = CLIPS_POR_MES[plan];
  return clips > 0 && USD_DEL_PLAN[plan] > 0 ? USD_DEL_PLAN[plan] / clips : null;
}

/** Si un precio por clip respeta el piso. Mira el marginal y SOLO el marginal. */
export function respetaElPiso(usdPorClip: number): boolean {
  const m = pisoMarginal();
  return m != null && usdPorClip > m;
}

export type Paquete = {
  /** US$ que paga el cliente. */
  readonly usd: number;
  readonly clips: number;
  readonly minutos: number;
  readonly mt: number;
};

/** Cómo queda un paquete de `minutos` al precio vigente. */
export function paqueteDeMinutos(minutos: number): Paquete {
  const clips = minutos * CLIPS_POR_MINUTO;
  return { usd: clips * USD_POR_CLIP_SUELTO, clips, minutos, mt: clips * MT_POR_CLIP };
}

/**
 * Los paquetes que se ofrecen, nombrados por MINUTOS porque es lo que la persona entiende:
 * «un minuto de video, US$12» no necesita explicar ni clips ni tokens.
 */
export const PAQUETES: readonly Paquete[] = [1, 2, 4, 8].map(paqueteDeMinutos);

/** Lo que deja un paquete. */
export const gananciaDe = (p: Paquete): number => p.usd - p.clips * USD_POR_CLIP;

/** El margen de un paquete, de 0 a 1. */
export const margenDe = (p: Paquete): number => (p.usd > 0 ? gananciaDe(p) / p.usd : 0);
