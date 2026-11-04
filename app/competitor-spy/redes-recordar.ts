// =============================================================================
// Cuándo se buscan SOLAS sus otras redes al abrir una ficha (4/11/2026)
// =============================================================================
// Martín, 4/11: «Lo de "Buscar sus otras redes" debe ser automático, no un botón». Se busca al dar de alta y al abrir
// la ficha de alguien a quien le falta una red, pero NO en cada apertura: cada búsqueda gasta una corrida de Google
// (US$0,00455) y lecturas del cupo, del negocio. Una vez por semana por competidor y por navegador alcanza: sus redes no
// cambian todos los días, y lo que no se encontró se puede pegar a mano.
//
// ⚠️ LA CLAVE LLEVA EL NEGOCIO (AGENTS.md, «Lo que se guarda en el NAVEGADOR lleva el workspace en la clave»): el super
// admin abre varios negocios en pestañas del mismo origen, y el id 16 de uno no es el 16 de otro.
// ⚠️ Y `localStorage` PUEDE NO ESTAR (ventana privada, sitio bloqueado): sin él, se busca. Nunca tira.
// =============================================================================

import { esAgregador } from '@/lib/spy-otras-redes-reglas';

/** Cuántos días pasan antes de volver a buscar solas las redes de un competidor. */
export const DIAS_SIN_REPETIR_REDES = 7;

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

// `v2` (4/11/2026): la búsqueda pasó a ser una cadena (su bio, su página de enlaces, su mismo usuario, Google) y tiene que
// volver a correr una vez en cada competidor que ya se había buscado con la de antes.
const claveDe = (ws: number, id: number) => `mako.spy.redes.v2.${ws}.${id}`;

function almacenDelNavegador(): Almacen | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** ¿Le falta alguna red que se pueda buscar, o su web (sin web, o con su página de enlaces en lugar de su web)? */
export const leFaltaUnaRed = (c: { instagram: string | null; youtube_id: string | null; tiktok: string | null; landing_url?: string | null }): boolean =>
  !c.instagram || !c.youtube_id || !c.tiktok || !c.landing_url || esAgregador(c.landing_url);

/**
 * ¿Se buscan sus redes al abrir su ficha? Sí, si le falta alguna y no se buscaron en los últimos
 * `DIAS_SIN_REPETIR_REDES` días desde este navegador para este negocio.
 */
export function debeBuscarRedes(
  c: { id: number; instagram: string | null; youtube_id: string | null; tiktok: string | null; landing_url?: string | null },
  ws: number | null,
  ahora: number = Date.now(),
  almacen: Almacen | null = almacenDelNavegador(),
): boolean {
  if (!leFaltaUnaRed(c)) return false;
  if (ws == null || !almacen) return true;
  let antes: number;
  try { antes = Number(almacen.getItem(claveDe(ws, c.id))); } catch { return true; }
  return !(Number.isFinite(antes) && antes > 0 && ahora - antes < DIAS_SIN_REPETIR_REDES * 86_400_000);
}

/** Anota que se buscaron, para no repetir hasta dentro de una semana. */
export function marcarRedesBuscadas(ws: number | null, id: number, ahora: number = Date.now(), almacen: Almacen | null = almacenDelNavegador()): void {
  if (ws == null || !almacen) return;
  try { almacen.setItem(claveDe(ws, id), String(ahora)); } catch { /* sin almacenamiento: la próxima se vuelve a buscar */ }
}
