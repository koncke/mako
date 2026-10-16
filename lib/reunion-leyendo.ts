import 'server-only';

// =============================================================================
// reunion-leyendo — UNA lectura a la vez de cada reunión (el candado)
// =============================================================================
// 16/10/2026, «Fathom sin fricción». Desde ese día una reunión se puede empezar a leer por TRES
// lados: el cron de cada hora, el webhook de Fathom al terminar la reunión, y el botón «Extraer» /
// «Leer igual» del modal, que ya no espera (corre en `after()`). Los tres llegan al mismo extractor,
// que es lo caro: una reunión larga son decenas de llamadas de IA. Sin un candado, el webhook y el
// cron de la misma hora podían leerla dos veces, y dos lecturas que terminan casi juntas se pisan el
// borrador.
//
// El candado es una setting por reunión con la HORA en que se tomó, y se toma con compare-and-set
// (`cambiarSettingSi`): de dos que compiten, gana una. Vence sola a los 330 s —más que el
// `maxDuration` de 300 s de cualquiera de las tres rutas—, así que una lectura que se murió a mitad
// no deja la reunión trabada para siempre.
// =============================================================================

import { getSetting, setSetting, cambiarSettingSi } from './settings';

const KEY = (recordingId: number): string => `mako.reunion.leyendo.${recordingId}`;
/** Más que el `maxDuration` (300 s) de la ruta que la lea: si sigue «leyendo» después, se murió. */
export const VIGENCIA_LECTURA_MS = 330_000;
const LIBRE = 'libre';

const vigente = (valor: string | null, ahora = Date.now()): boolean => {
  const t = valor ? Date.parse(valor) : NaN;
  return Number.isFinite(t) && ahora - t < VIGENCIA_LECTURA_MS;
};

/** ¿Alguien la está leyendo AHORA? */
export async function leyendoAhora(recordingId: number): Promise<boolean> {
  return vigente(await getSetting(KEY(recordingId)).catch(() => null));
}

/** Toma el candado. `false` = otro la está leyendo (o no se pudo escribir: ante la duda, no se lee
 *  dos veces). */
export async function tomarLectura(recordingId: number): Promise<boolean> {
  const actual = await getSetting(KEY(recordingId)).catch(() => undefined);
  if (actual === undefined) return false;
  if (vigente(actual)) return false;
  return cambiarSettingSi(KEY(recordingId), actual, new Date().toISOString()).catch(() => false);
}

/** Suelta el candado. Best-effort: si falla, vence solo. */
export async function soltarLectura(recordingId: number): Promise<void> {
  await setSetting(KEY(recordingId), LIBRE).catch(() => {});
}
