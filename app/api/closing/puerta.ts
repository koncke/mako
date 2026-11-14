// =============================================================================
// puerta — la puerta de las rutas de Closing: admin o closer, con el Dashboard en la capa, y de MaKo Pro
// =============================================================================
// La regla está en ./puerta-regla.ts (pura, con test). Esto junta los tres datos y la aplica. La usan
// /api/closing/{llamada,sync,analyze,revise,transcript}; NO /api/closing/analizar-lead (ver la regla).
// Contesta como las rutas: `{ ok: false, error }` con su código, así la pantalla muestra el motivo tal cual.
//
// ⚠️ Y EL ANÁLISIS DE LAS LLAMADAS ES SÓLO DE MaKo Pro (14/11/2026, lib/closing-solo-pro.ts): estas rutas son la hoja Closing
//    (su ficha de una llamada, sincronizar, re-analizar, revisar y el transcript que se lee desde la ficha). Al Esencial, 403
//    con el texto del candado y `pasarAPro`, DESPUÉS de la regla de siempre (sin sesión sigue siendo 401). Ante la duda, pasa.

import 'server-only';
import { getCapaActual, getRolWsEfectivo, rutaConWs } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
// «¿Puede leer reuniones?» = CUALQUIER grabador conectado (Fathom, tl;dv, Fireflies, Zoom, Read AI: lib/grabadores, 26/10/2026).
import { hayGrabadorConectado } from '@/lib/grabadores';
import { esEsencialDeLaSesion } from '@/lib/plan-esencial';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import { TEXTO_CLOSING_SOLO_PRO } from '@/lib/closing-solo-pro';
import { reglaDePuerta } from './puerta-regla';

/**
 * `null` = entra. Si no, la respuesta que hay que devolver tal cual.
 * @param opts.fathom  exige un grabador conectado (todas menos el transcript, que contesta vacío sin él). Se llama `fathom`
 *                     de cuando Fathom era el único.
 */
export async function puertaClosing(opts: { fathom: boolean }): Promise<Response | null> {
  const rol = await getRolWsEfectivo();
  if (rol == null) return cerrar(reglaDePuerta(rol, false, null));
  const [capa, fathom] = await Promise.all([getCapaActual(), opts.fathom ? hayGrabadorConectado() : Promise.resolve(null)]);
  const cerrada = cerrar(reglaDePuerta(rol, tabEnCapa('graphics', capa), fathom));
  if (cerrada) return cerrada;
  return candadoDeProClosing();
}

/** El candado de Pro de Closing (lo usa también /api/closing/analizar-lead, que no pasa por la puerta). null = entra. */
export async function candadoDeProClosing(): Promise<Response | null> {
  if (!(await esEsencialDeLaSesion())) return null;
  return Response.json(
    { ok: false, error: TEXTO_CLOSING_SOLO_PRO, pasarAPro: await rutaConWs(RUTA_CAMBIAR_PLAN) },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}

function cerrar(c: ReturnType<typeof reglaDePuerta>): Response | null {
  return c ? Response.json({ ok: false, error: c.error }, { status: c.status, headers: { 'Cache-Control': 'no-store' } }) : null;
}
