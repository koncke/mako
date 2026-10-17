import 'server-only';

// =============================================================================
// reunion-parcial — la MARCA de una reunión leída a medias, en la base (17/10/2026)
// =============================================================================
// La regla y el porqué están en lib/lectura-por-partes.ts (puro). Acá sólo se lee y se escribe la setting
// `mako.reunion.parcial.<id>` del workspace en contexto. Vacía = no hay lectura a medias (no hay «borrar setting»).
// Best-effort a propósito: no poder escribir la marca deja la reunión como estaba antes de que existiera (se relee
// entera), nunca rompe la lectura que ya terminó.
// =============================================================================

import { getSetting, setSetting } from './settings';
import { KEY_PARCIAL, leerMarca, unirLeidas, type MarcaParcial } from './lectura-por-partes';

export async function leerParcial(recordingId: number): Promise<MarcaParcial | null> {
  return leerMarca(await getSetting(KEY_PARCIAL(recordingId)).catch(() => null));
}

/**
 * Anota lo que leyó esta vuelta. Con `fresca`, la marca de antes no cuenta (una lectura que releyó todo desde cero:
 * «Volver a analizar»); si no, se SUMA a la de antes. Devuelve la marca que quedó.
 */
export async function anotarParcial(recordingId: number, p: { partes: number; leidas: readonly number[]; ref?: string; fresca?: boolean }): Promise<MarcaParcial> {
  const previa = p.fresca ? null : await leerParcial(recordingId);
  const deOtroTroceado = previa && previa.partes !== p.partes;
  const base = deOtroTroceado ? null : previa;
  const marca: MarcaParcial = {
    partes: p.partes,
    leidas: unirLeidas(base?.leidas ?? [], p.leidas),
    refs: [...new Set([...(base?.refs ?? []), ...(p.ref ? [p.ref] : [])])].slice(-20),
    ts: new Date().toISOString(),
  };
  await setSetting(KEY_PARCIAL(recordingId), JSON.stringify(marca)).catch((e) => {
    console.error(`[reunion-parcial] no pude anotar la lectura a medias de ${recordingId}: ${e instanceof Error ? e.message : String(e)}`);
  });
  return marca;
}

/** La reunión quedó leída entera: la marca se vacía. */
export async function cerrarParcial(recordingId: number): Promise<void> {
  await setSetting(KEY_PARCIAL(recordingId), '').catch(() => {});
}
