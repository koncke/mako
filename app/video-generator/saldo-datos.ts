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
import { CREDITOS_POR_DURACION } from '@/lib/costo-clip';

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
    // ⚠️ SE VALIDA AL LEER, no sólo al escribir. El 150 del workspace del dueño ya
    // está guardado, y un guard que sólo mira lo que entra no lo saca nunca.
    // Un valor imposible se descarta y se cae a la estimación, que al menos se
    // anuncia como tal.
    if (costoClipPlausible(n)) return { creditos: n, medido: true };
  } catch { /* sin medición, va la estimación */ }
  return { creditos: COSTO_CLIP_ESTIMADO, medido: false };
}

export async function guardarCostoMedido(creditos: number): Promise<void> {
  // Un costo absurdo no se guarda: si la resta dio negativo o gigante, algo pasó
  // en el medio (otra generación a mano, una recarga) y ese número contaminaría
  // todas las cuentas que vienen después.
  //
  // ⚠️ EL TECHO ERA 200 Y TENÍA QUE SER 15, Y ESO DEJÓ ENTRAR UN 150 A PRODUCCIÓN.
  //
  // Medido el 01/09/2026: `video-generator.costo-clip` valía **150** en el
  // workspace del dueño. Un clip no puede costar 150 — el máximo que existe es un
  // clip de 10 s, que sale 15 (`CREDITOS_POR_DURACION`). 150 es diez clips.
  //
  // La causa está escrita, textual, en el llamador: «Una sola toma por vez, así
  // que la diferencia ES el costo de un clip». Era cierto cuando se escribió, y
  // **«filmar todas» lo dejó de ser**: con siete tomas en vuelo, el saldo que se
  // lee después de que termina UNA ya tiene descontadas las que terminaron en el
  // medio, y la resta mide el LOTE.
  //
  // Y el daño no era sólo el número: se muestra SIN el «(estimado)» —porque
  // `medido: true`— o sea con la autoridad de un hecho, y `alcanzaTodo` lo usa
  // para decidir si al cliente le alcanza el saldo. Con 150 en vez de 12, la app
  // le dice que no puede pagar un anuncio que puede pagar diez veces.
  //
  // El techo ahora sale de la tabla exacta que el dueño midió contra Flow, así
  // que no hay dos fuentes de verdad para el mismo precio.
  if (!Number.isFinite(creditos) || creditos <= 0 || creditos > COSTO_CLIP_MAXIMO) return;
  await setSetting(KEY_COSTO_CLIP, String(Math.round(creditos)));
}

/**
 * Lo que puede costar un clip como MÁXIMO: el de 10 s, la duración más larga que
 * Flow genera. Cualquier medición por encima no es un clip, es un lote.
 */
const COSTO_CLIP_MAXIMO = Math.max(...Object.values(CREDITOS_POR_DURACION));

/**
 * Repara una medición que quedó guardada por encima del máximo posible.
 *
 * ⚠️ NO se limpia en `guardarCostoMedido`: ese guard protege lo que ENTRA, y el
 * 150 ya está adentro. Lo que quedó mal escrito hay que corregirlo donde se LEE,
 * o el workspace que lo tiene sigue con el número malo hasta que alguien genere
 * un clip nuevo — y mientras tanto la pantalla afirma un precio falso.
 */
export function costoClipPlausible(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n <= COSTO_CLIP_MAXIMO;
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
