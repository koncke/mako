// =============================================================================
// Un TELÉFONO no ve el escritorio: qué hace con cada pantalla de escritorio
// =============================================================================
// Pedido de Martín (11/10/2026), con la captura de /general abierta en su celular: «Se ve
// bastante mal... La sidebar con los iconos en miniatura... Los botones muy chicos para un
// dedo... Seguro que hay cosas que deberás sacar en la versión mobile... O incluso tabs que
// solo se puedan abrir en la versión de desktop».
//
// Tres respuestas, y las decide esta función PURA (sin server-only: la lee el componente
// cliente y el test):
//   · 'nada'        → no es una pantalla de escritorio que haya que tapar (ya es /m, es
//                     pública, es el login o un paso que existe para abrirse igual);
//   · 'ir'          → tiene equivalente en MaKo Mobile (`rutaMovil`): se va ahí;
//   · 'computadora' → no va al teléfono: se dice, con la salida a MaKo Mobile y la opción de
//                     abrirla igual (la cookie de «Versión completa», 12 h).
// =============================================================================

import { esRutaMovil, rutaMovil } from './movil-rutas';

/**
 * EL INTERRUPTOR de MaKo Mobile: si un teléfono entra solo a /m (por /inicio) y si las pantallas
 * de escritorio se le tapan (<DesvioMovil> en el layout raíz). APAGADO: Martín vio /m el 11/10/2026
 * y la rechazó («No se ve para nada como lo que es MaKo, se ve bastante feo»; modo oscuro por
 * defecto, ícono de MaKo equivocado y al centro, demasiado texto). Se prende después del rediseño.
 */
export const MOVIL_ACTIVO = false;

export type Desvio = { tipo: 'nada' } | { tipo: 'ir'; destino: string } | { tipo: 'computadora' };

/**
 * Pantallas que se abren igual en el teléfono aunque no sean de /m: el login, el wizard del
 * onboarding (al que manda /m/configurar), las legales, la ventana de prueba del Pixel y lo
 * que se comparte con alguien de afuera. Prefijos con barra: «/login» no atrapa «/logins».
 */
const SE_ABREN_IGUAL = [
  '/login', '/logout', '/onboarding', '/privacidad', '/terminos', '/compartido', '/mi-curso',
  '/integraciones/escuchando', '/vsl', '/api',
];

const empieza = (p: string, base: string) => p === base || p.startsWith(base + '/');

export function decidirDesvio(pathname: string | null | undefined, search = ''): Desvio {
  const p = (pathname ?? '').replace(/\/+$/, '') || '/';
  if (p === '/' || esRutaMovil(p)) return { tipo: 'nada' };
  if (SE_ABREN_IGUAL.some((b) => empieza(p, b))) return { tipo: 'nada' };
  const destino = rutaMovil(search ? `${p}?${search.replace(/^\?/, '')}` : p);
  if (destino) return { tipo: 'ir', destino };
  return { tipo: 'computadora' };
}
