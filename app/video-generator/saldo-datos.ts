import 'server-only';

// =============================================================================
// El saldo de Flow, y si alcanza para este anuncio
// =============================================================================
// El dueño: *«si tenemos el saldo, y un usuario quiere generar un video, y ya de
// antemano sabemos por la cantidad de tokens que consume cada clip y la cantidad
// de clips que hay, si le alcanzará o no»*.
//
// Es la pregunta correcta y llega antes que el botón. Un anuncio que se corta en
// la toma cinco por falta de créditos no dejó cinco quintos de anuncio: dejó
// cinco clips pagados y nada que publicar.
//
// ── El costo por clip: MEDIDO, y se re-mide solo ────────────────────────────
// El arranque son 15 créditos por clip de 10 s, que es el número verificado
// contra la propia pantalla de Flow (docs/hallazgos-generativa.md). ⚠️ Toda tabla
// de costos que circula por internet sobre Flow estuvo mal alguna vez — este
// proyecto ya planificó con una que estaba AL DOBLE.
//
// Por eso el número no se queda quieto: cada generación guarda el saldo de antes
// y el de después, y la diferencia reemplaza a la estimación. Un costo estimado
// que nunca se corrige es una tabla de internet más.

import { getSetting, setSetting } from '@/lib/settings';

export const KEY_SALDO = 'video-generator.saldo';
export const KEY_COSTO_CLIP = 'video-generator.costo-clip';

/** El arranque, verificado contra la UI de Flow. Se reemplaza al primer medido. */
export const COSTO_CLIP_ESTIMADO = 15;

export type SaldoFlow = {
  creditos: number | null;
  /** ISO. Cuándo se leyó. Un saldo sin fecha no se puede juzgar. */
  at: string | null;
  /** El plan de la cuenta, tal como lo reporta Google. */
  tier: string;
};

export async function leerSaldoGuardado(): Promise<SaldoFlow> {
  try {
    const raw = await getSetting(KEY_SALDO);
    if (!raw) return { creditos: null, at: null, tier: '' };
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      creditos: typeof o.creditos === 'number' ? o.creditos : null,
      at: typeof o.at === 'string' ? o.at : null,
      tier: typeof o.tier === 'string' ? o.tier : '',
    };
  } catch {
    return { creditos: null, at: null, tier: '' };
  }
}

export async function guardarSaldo(creditos: number, tier: string): Promise<void> {
  await setSetting(KEY_SALDO, JSON.stringify({ creditos, tier, at: new Date().toISOString() }));
}

/**
 * Cuánto cuesta un clip, en créditos.
 *
 * Devuelve el MEDIDO si ya hubo una generación de la que se pudo sacar la
 * diferencia; si no, la estimación. Y dice cuál de los dos es, porque no es lo
 * mismo decirle a alguien «te alcanza» con un número medido que con uno heredado
 * de una tabla.
 */
export async function costoPorClip(): Promise<{ creditos: number; medido: boolean }> {
  try {
    const raw = await getSetting(KEY_COSTO_CLIP);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return { creditos: n, medido: true };
  } catch { /* sin medición, va la estimación */ }
  return { creditos: COSTO_CLIP_ESTIMADO, medido: false };
}

export async function guardarCostoMedido(creditos: number): Promise<void> {
  // Un costo absurdo no se guarda: si la resta dio negativo o gigante, algo pasó
  // en el medio (otra generación a mano, una recarga) y ese número contaminaría
  // todas las cuentas que vienen después.
  if (!Number.isFinite(creditos) || creditos <= 0 || creditos > 200) return;
  await setSetting(KEY_COSTO_CLIP, String(Math.round(creditos)));
}

export type Alcanza = {
  clips: number;
  costoTotal: number;
  creditos: number | null;
  medido: boolean;
  /** null = no se sabe (nunca se leyó el saldo). No es lo mismo que «no alcanza». */
  alcanza: boolean | null;
  /** Cuántos anuncios como este entran con lo que hay. */
  anuncios: number | null;
};

export async function alcanzaParaAnuncio(clips: number): Promise<Alcanza> {
  const [saldo, costo] = await Promise.all([leerSaldoGuardado(), costoPorClip()]);
  const costoTotal = clips * costo.creditos;
  return {
    clips,
    costoTotal,
    creditos: saldo.creditos,
    medido: costo.medido,
    // ⚠️ `null` cuando no hay saldo leído, y la pantalla lo trata distinto de
    // `false`. Decirle «no te alcanza» a alguien que sí tiene créditos es peor
    // que no decirle nada.
    alcanza: saldo.creditos == null ? null : saldo.creditos >= costoTotal,
    anuncios: saldo.creditos == null ? null : Math.floor(saldo.creditos / Math.max(1, costoTotal)),
  };
}
