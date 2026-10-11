// =============================================================================
// puerta — la puerta de las rutas de Closing: admin o closer, con el Dashboard en la capa
// =============================================================================
// La regla está en ./puerta-regla.ts (pura, con test). Esto junta los tres datos y la aplica. La usan
// /api/closing/{llamada,sync,analyze,revise,transcript}; NO /api/closing/analizar-lead (ver la regla).
// Contesta como las rutas: `{ ok: false, error }` con su código, así la pantalla muestra el motivo tal cual.

import 'server-only';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { integracionConectada } from '@/lib/credenciales';
import { reglaDePuerta } from './puerta-regla';

/**
 * `null` = entra. Si no, la respuesta que hay que devolver tal cual.
 * @param opts.fathom  exige Fathom conectado (todas menos el transcript, que contesta vacío sin él).
 */
export async function puertaClosing(opts: { fathom: boolean }): Promise<Response | null> {
  const rol = await getRolWsEfectivo();
  if (rol == null) return cerrar(reglaDePuerta(rol, false, null));
  const [capa, fathom] = await Promise.all([getCapaActual(), opts.fathom ? integracionConectada('fathom') : Promise.resolve(null)]);
  return cerrar(reglaDePuerta(rol, tabEnCapa('graphics', capa), fathom));
}

function cerrar(c: ReturnType<typeof reglaDePuerta>): Response | null {
  return c ? Response.json({ ok: false, error: c.error }, { status: c.status, headers: { 'Cache-Control': 'no-store' } }) : null;
}
