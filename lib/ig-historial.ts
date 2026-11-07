// =============================================================================
// ig-historial — las piezas de Instagram que YA se escribieron, por workspace
// =============================================================================
// Item 129 del barrido del 6/11: «si el cliente recarga la página pierde toda la
// conversación». Hasta hoy las piezas que escribía el motor (lib/ig-writer.ts) vivían en
// un `useState` de la pantalla: salir, recargar o rotar el teléfono se las llevaba.
//
// SIN TABLA NUEVA, a propósito. Se reusa `app_settings` —que YA es por-workspace (PK
// workspace_id+key) y YA guarda listas JSON con tope en media docena de libs de la casa
// (lib/razones.ts, lib/avatares.ts, lib/campana-funnel.ts…)— en vez de pedir una migración
// que Martín tiene que aplicar contra producción. Es el mismo lugar donde vivía el
// historial de Reels antes de que la tab se retirara (`reels.historial`, tope 10). Si
// algún día hace falta historial CROSS-formato, con búsqueda o con más de diez, eso sí es
// una tabla con migración coordinada: no se sube este tope.
//
// Aislamiento: `getSetting`/`setSetting` (lib/settings.ts) scopean solos. LEER sin
// workspace (una agencia sin impersonar) no trae nada —`WS_NINGUNO`, nunca el dueño— y
// ESCRIBIR sin workspace TIRA (`wsObligatorio`). Acá no hay ningún `?? OWNER_WS`.
// =============================================================================

import 'server-only';
import { cambiarSettingSi, getSetting } from './settings';
import type { FormatoIg } from './ig-formatos';
import type { PiezaIg } from './ig-writer';

/** Cuántas piezas por formato se guardan. Las más viejas se caen del final. */
export const TOPE_HISTORIAL_IG = 10;

/**
 * Una pieza guardada.
 *  · `at`        = ISO de cuándo se escribió. Es el id de la entrada y el orden (desc).
 *  · `etiqueta`  = el rótulo YA RESUELTO que la pantalla muestra («Venta», «Conexión»).
 *    Se guarda el texto y no el id del objetivo a propósito: si mañana el catálogo cambia
 *    un rótulo, la pieza vieja sigue diciendo con qué objetivo se escribió, que es lo que
 *    era cierto ese día. Y la pantalla no necesita ningún mapeo ni fallback.
 *  · `pieza`     = la pieza tipada, tal como la devolvió el saneo del motor.
 */
export type ItemHistorialIg = {
  at: string;
  formato: FormatoIg;
  etiqueta: string;
  pieza: PiezaIg;
};

const CLAVE = (formato: FormatoIg) => `ig.historial.${formato}`;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Un item crudo de la base normalizado, o null si no se puede dibujar. Tolerante a
 * propósito: una entrada escrita por una versión anterior (o a medio guardar) NO tiene que
 * voltear el historial entero — se cae esa sola.
 *
 * La `pieza` no se vuelve a sanear acá: el saneo es del motor y pide cosas que un item
 * viejo no tiene por qué cumplir hoy. Lo que se exige es lo que la pantalla LEE: que sea
 * un objeto con el `formato` que se pidió.
 */
export function normalizarItemIg(raw: unknown, formato: FormatoIg): ItemHistorialIg | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const at = str(o.at);
  if (!at || Number.isNaN(Date.parse(at))) return null;
  const pieza = (o.pieza && typeof o.pieza === 'object' ? o.pieza : null) as PiezaIg | null;
  if (!pieza || (pieza as { formato?: unknown }).formato !== formato) return null;
  return { at, formato, etiqueta: str(o.etiqueta), pieza };
}

/** Lo guardado del formato, de lo más nuevo a lo más viejo. Nunca tira: sin nada, `[]`. */
export async function getHistorialIg(formato: FormatoIg): Promise<ItemHistorialIg[]> {
  let raw: string | null = null;
  try { raw = await getSetting(CLAVE(formato)); } catch { return []; }
  return leerHistorialIg(raw, formato);
}

/** El parseo puro de lo que hay en `app_settings` (separado para poder ejecutarlo en un test). */
export function leerHistorialIg(raw: string | null, formato: FormatoIg): ItemHistorialIg[] {
  if (!raw) return [];
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => normalizarItemIg(x, formato))
    .filter((x): x is ItemHistorialIg => x !== null)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, TOPE_HISTORIAL_IG);
}

/**
 * Guarda una pieza al frente del historial del formato y devuelve el item guardado.
 *
 * Es BEST-EFFORT por contrato: devuelve el item igual si la escritura no entró, porque lo
 * que la persona pidió es la pieza y no el historial — perder el guardado no puede hacer
 * fallar la generación que ya se pagó. Quien llama igual tiene que envolverlo (el motivo
 * del fallo no le sirve a nadie en pantalla).
 *
 * La escritura es un compare-and-set con UN reintento (`cambiarSettingSi`), no un
 * read-modify-write pelado: dos piezas que terminan a la vez se pisaban una a la otra, y
 * ese era el defecto conocido del historial de Reels. Si el segundo intento también
 * pierde, se deja así: la pieza está en pantalla y la siguiente escritura reordena.
 */
export async function guardarEnHistorialIg(
  formato: FormatoIg,
  pieza: PiezaIg,
  etiqueta = '',
): Promise<ItemHistorialIg> {
  const item: ItemHistorialIg = { at: new Date().toISOString(), formato, etiqueta: str(etiqueta), pieza };
  const clave = CLAVE(formato);
  for (let intento = 0; intento < 2; intento++) {
    const raw = await getSetting(clave);
    const lista = [item, ...leerHistorialIg(raw, formato)].slice(0, TOPE_HISTORIAL_IG);
    if (await cambiarSettingSi(clave, raw, JSON.stringify(lista))) return item;
  }
  return item;
}
