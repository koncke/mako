// =============================================================================
// grabadores/grabadora — la «Grabadora de MaKo» como lectora de reuniones (04/11/2026)
// =============================================================================
// Las llamadas que se graban desde la ficha del lead o desde Cold Calling (lib/grabar-llamada.ts) viven en `llamadas_grabadas`,
// no en un grabador de afuera. Lo que el Closing y la ficha de una llamada piden POR SU CLAVE (la transcripción, la reunión) lo
// contesta esto, con la misma forma que cualquier grabador. No lista nada: los crons no la recorren (no está en `LECTORES` de
// lib/grabadores/index.ts), porque su análisis lo dispara la propia grabación.
// =============================================================================

import 'server-only';
import { GrabadorSinRespuestaError } from './errores';
import type { Reunion, TurnoReunion } from './reunion';

export async function leerGrabadora(id: string): Promise<Reunion> {
  const { reunionDeId } = await import('../grabar-llamada');
  const r = await reunionDeId(id);
  if (!r) throw new GrabadorSinRespuestaError('grabadora', 'No encuentro esa llamada grabada.');
  return r;
}

export async function transcripcionDeGrabadora(id: string): Promise<TurnoReunion[]> {
  return (await leerGrabadora(id)).transcripcion ?? [];
}
