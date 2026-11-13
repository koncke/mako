// =============================================================================
// thumbnails/verticales-servidor — las miniaturas VERTICALES (9:16) del negocio: las portadas de los reels que Spy ya trajo
// =============================================================================
// 13/11/2026 (Martín, por el Cerebro): «miniaturas verticales en Image, para shorts y reels». Salen de las cuentas que el negocio
// sigue en Competitors Spy (lib/video-outliers-servidor.ts → `leerReelsDeSpy`, el mismo lector de la portada de Video pero SIN
// su criterio de edición: acá importa la portada, no el montaje). No llama a Apify ni a Meta: lee lo que ya está. Lo puro:
// ./verticales.ts.
// =============================================================================

import 'server-only';
import { leerReelsDeSpy } from '../video-outliers-servidor';
import { esIdDeVertical, verticalesDe, type Vertical } from './verticales';

/** Lo que llega a la pantalla. `ok: false` = no se pudo leer (no es «no hay»). */
export type BibliotecaVerticales = { ok: true; verticales: Vertical[] } | { ok: false; error: string };

export async function leerVerticales(): Promise<BibliotecaVerticales> {
  try {
    const r = await leerReelsDeSpy();
    if (!r.ok) {
      console.warn('[thumbnails] no pude leer los reels de Spy para las verticales:', r.motivo);
      return { ok: false, error: 'No pude leer los reels de las cuentas que sigues.' };
    }
    return { ok: true, verticales: verticalesDe(r.outliers) };
  } catch (e) {
    console.warn('[thumbnails] no pude leer las verticales:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude leer los reels de las cuentas que sigues.' };
  }
}

/** Una vertical del negocio, por su id (lo que manda «Editar»): se vuelve a leer de SU Spy, nunca lo que mande el navegador. */
export async function verticalPorId(id: string): Promise<Vertical | null> {
  if (!esIdDeVertical(id)) return null;
  const r = await leerVerticales();
  if (!r.ok) throw new Error(r.error);
  return r.verticales.find((v) => v.id === id) ?? null;
}
