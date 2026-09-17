// =============================================================================
// ctx-bandeja — el Ctx con el que la app confirma o descarta EN NOMBRE DE UNA
// PERSONA logueada (bandeja de pendientes y pantalla genérica de propuestas)
// =============================================================================
// Las dos pantallas de /mako escriben de verdad (ejecutan lo que un canal
// propuso), así que el contexto sale SIEMPRE de la sesión y del workspace del
// request — jamás del input del formulario. `bandeja: true` es lo que le dice a
// lib/api-mako/acciones.ts que ve todo el workspace y que puede confirmar.
//
// Solo el admin del workspace: el Ctx lleva `rol: 'admin'` fijo, y eso es
// verdad únicamente porque acá se comprueba. Un closer/setter tiene /mako en
// su whitelist (nav.ts) y sin este guard podría ejecutar una acción con
// `gating.rolMinimo: 'admin'` desde la bandeja.
// =============================================================================

import 'server-only';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import type { Ctx } from '@/lib/api-mako/tipos';

/** La clave de scope de lo que se confirma desde la app. La bandeja no filtra
 *  por clave (ve todo el workspace), pero el Ctx la exige. */
export const CANAL_KEY_BANDEJA = 'bandeja';

export async function ctxDeBandeja(): Promise<{ ctx: Ctx } | { error: string }> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'Tu sesión venció. Vuelve a entrar para continuar.' };
  const rol = await getRolWsEfectivo();
  if (rol !== 'admin') return { error: 'Solo el administrador del workspace puede confirmar acciones.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'No hay un workspace activo para esta sesión.' };
  return {
    ctx: { ws, canal: 'app', canalKey: CANAL_KEY_BANDEJA, alcance: 'ejecutar', rol: 'admin', bandeja: true, actor: sesion.email },
  };
}
