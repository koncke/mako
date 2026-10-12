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
import { esPublica } from './rutas-publicas';
import { conWs } from './ws-tab';

/**
 * EL INTERRUPTOR de MaKo Mobile: si un teléfono entra solo a /m (por /inicio) y si las pantallas
 * de escritorio se le tapan (<DesvioMovil> en el layout raíz).
 *
 * PRENDIDO el 11/10/2026 con la v2 (docs/diseno-mako-mobile-v2.md). Martín, a las 21:54: «Entré
 * desde mi celular a la web de MaKo y no se ven los cambios... No solamente tienes que hacerlo
 * como "app" sino a cualquiera que entre desde mobile le debe salir este diseño.» O sea: no
 * alcanza con la app instalada; CUALQUIER teléfono que abra MaKo ve /m.
 *
 * Historia: salió apagado (v1, 11/10 a la tarde) porque ninguna pantalla se había podido ver en un
 * navegador, y siguió apagado cuando Martín rechazó la v1 («No se ve para nada como lo que es
 * MaKo»: oscuro por defecto, el ícono equivocado y al centro, demasiado texto).
 */
export const MOVIL_ACTIVO = true;

export type Desvio = { tipo: 'nada' } | { tipo: 'ir'; destino: string } | { tipo: 'computadora' };

/**
 * Pantallas que se abren igual en el teléfono aunque no sean de /m (además de las públicas, que no
 * se tapan nunca): el login, el wizard del onboarding (al que manda /m/configurar), las legales, el
 * alumno del curso, la ventana de prueba del Pixel, lo que se comparte con alguien de afuera y la
 * API. Prefijos con barra: «/login» no atrapa «/logins».
 */
const SE_ABREN_IGUAL = [
  '/login', '/logout', '/onboarding', '/privacidad', '/terminos', '/compartido', '/mi-curso',
  '/integraciones/escuchando', '/vsl', '/api',
];

const empieza = (p: string, base: string) => p === base || p.startsWith(base + '/');

export function decidirDesvio(pathname: string | null | undefined, search = ''): Desvio {
  const p = (pathname ?? '').replace(/\/+$/, '') || '/';
  if (p === '/' || esRutaMovil(p)) return { tipo: 'nada' };
  // ⚠️ LO PÚBLICO NO SE TAPA NUNCA (lib/rutas-publicas.ts): lo abre un VISITANTE sin cuenta de
  // MaKo —el comprador que vuelve de pagar (/pagar/<token>/listo), los reembolsos, una landing
  // publicada (/l/…)— y `prefiereMovil` sólo mira el teléfono, no la sesión. Sin esto, el cliente
  // de un negocio que paga desde el celular leía «Esta pantalla se usa en la computadora».
  if (esPublica(p)) return { tipo: 'nada' };
  if (SE_ABREN_IGUAL.some((b) => empieza(p, b))) return { tipo: 'nada' };
  const destino = rutaMovil(search ? `${p}?${search.replace(/^\?/, '')}` : p);
  if (destino) return { tipo: 'ir', destino };
  return { tipo: 'computadora' };
}

/**
 * ¿Se desvía ESTE request? El interruptor y un teléfono sin «Versión completa». Nadie más queda afuera.
 *
 * ⚠️ EL ADMIN GLOBAL SIN CLIENTE TAMBIÉN SE DESVÍA, a SU negocio (`wsPropioMovil`). La versión del
 * 11/10/2026 lo excluía para cortar un bucle (/m → /inicio → /customer-success → /m/cs → /inicio), y con
 * eso le dejaba el escritorio en el teléfono justo a quien pidió la app: Martín, 12/10, «No aún no veo la
 * versión mobile, me sale todo igual...». El bucle se corta en la RAÍZ: `requireMovil` ya no manda a ese
 * admin a /inicio sino a /m de la plataforma (lib/movil-guard.ts).
 */
export function seDesvia(p: { activo: boolean; telefono: boolean }): boolean {
  return p.activo && p.telefono;
}

/**
 * El destino del desvío con el negocio que tiene que ver la pestaña. Con un cliente elegido (`wsPestana`,
 * el `?ws=`), el router de app/_ui/Link ya lo lleva: no se toca. El admin global SIN cliente no tiene
 * pestaña, y sin `?ws=` /m no sabe de qué negocio es: va al suyo (`wsPropio`, el workspace de plataforma).
 */
export function destinoMovil(destino: string, wsPestana: number | null, wsPropio: number | null): string {
  return wsPestana == null && wsPropio != null ? conWs(destino, wsPropio) : destino;
}
