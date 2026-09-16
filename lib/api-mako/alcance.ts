// =============================================================================
// api-mako/alcance — qué puede pedir un token, leído del token mismo
// =============================================================================
// El alcance viaja en el PREFIJO del token, no en un setting aparte:
//   mkoag_<hex>     → proponer   (los tokens acuñados antes de que existiera esto)
//   mkoag_l_<hex>   → lectura
//   mkoag_p_<hex>   → proponer
//   mkoag_e_<hex>   → ejecutar
// Así rotar el token resetea el alcance junto con él, no hay dos escrituras que
// puedan quedar desfasadas, y un token de ayer no gana poder porque salió un deploy.
//
// FAIL-CLOSED: cualquier cosa que no sea un prefijo conocido es `lectura`, salvo el
// formato viejo (sin letra), que es `proponer` porque eso es lo que esos tokens ya
// hacen hoy (POST /api/agente/plan y /lead).
//
// SIN `server-only`: puro, con test.
// =============================================================================

import { ALCANCES, type Alcance, type OperacionDef } from './tipos';
import { alcanceMinimo } from './tipos';

const ORDEN: Record<Alcance, number> = { lectura: 0, proponer: 1, ejecutar: 2 };
const LETRA: Record<Alcance, string> = { lectura: 'l', proponer: 'p', ejecutar: 'e' };

export const esAlcance = (s: unknown): s is Alcance => typeof s === 'string' && (ALCANCES as readonly string[]).includes(s);

/** El alcance que carga un token. */
export function alcanceDeToken(token: string): Alcance {
  const t = (token ?? '').trim();
  const m = /^mkoag_([lpe])_[0-9a-f]{16,}$/i.exec(t);
  if (m) return m[1].toLowerCase() === 'e' ? 'ejecutar' : m[1].toLowerCase() === 'p' ? 'proponer' : 'lectura';
  if (/^mkoag_[0-9a-f]{16,}$/i.test(t)) return 'proponer';
  return 'lectura';
}

/** El prefijo con el que se acuña un token de este alcance. */
export const prefijoDeAlcance = (alcance: Alcance): string => `mkoag_${LETRA[alcance]}_`;

/** ¿Este alcance alcanza para esta operación? */
export function permite(alcance: Alcance, def: OperacionDef): boolean {
  return ORDEN[alcance] >= ORDEN[alcanceMinimo(def)];
}

/** Lo que significa cada nivel, para la pantalla que acuña y para la referencia.
 *  Español neutro: lo lee el cliente. */
export const TEXTO_ALCANCE: Record<Alcance, { titulo: string; que: string }> = {
  lectura: { titulo: 'Solo leer', que: 'El agente consulta tu negocio y tus números. No deja nada pendiente ni propone cambios.' },
  proponer: { titulo: 'Leer y proponer', que: 'Además deja propuestas y acciones pendientes que tú confirmas en MaKo o por WhatsApp. Nada se escribe sin tu confirmación.' },
  ejecutar: { titulo: 'Leer, proponer y ejecutar', que: 'Además puede confirmar por sí mismo las acciones que dejó pendientes (mover un lead, pausar una campaña). Lo que gasta plata sigue pasando por una pantalla.' },
};
