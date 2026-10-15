// =============================================================================
// Un TELÉFONO no ve el escritorio: qué hace con cada pantalla de escritorio
// =============================================================================
// Pedido de Martín (11/10/2026), con la captura de /general abierta en su celular: «Se ve
// bastante mal... La sidebar con los iconos en miniatura... Los botones muy chicos para un
// dedo... Seguro que hay cosas que deberás sacar en la versión mobile... O incluso tabs que
// solo se puedan abrir en la versión de desktop».
//
// Tres respuestas, y las decide esta función PURA (sin server-only: la leen el proxy, el
// componente cliente y el test):
//   · 'nada'        → no es una pantalla de escritorio que haya que tapar (ya es /m, es
//                     pública, es el login o un paso que existe para abrirse igual);
//   · 'movil'       → tiene equivalente en MaKo Mobile (`rutaMovil`): el PROXY sirve esa
//                     página en ESTA MISMA URL (`pedidoMovil`, más abajo). Nadie navega;
//   · 'computadora' → no va al teléfono: se dice, con la salida a MaKo Mobile y la opción de
//                     abrirla igual (la cookie de «Versión completa», 12 h).
//
// ⚠️ HASTA EL 13/10/2026 'movil' se llamaba 'ir' y <DesvioMovil> NAVEGABA a /m/…: el teléfono
// terminaba en otra URL. Martín (12/10): «lo que esta mal es que funcione por rutas... Las rutas
// deben ser las mismas, solo debe detectar si estoy en mobile». Desde ahí la decisión la ejecuta
// el proxy con un rewrite, y el componente sólo tapa lo que se usa en la computadora.
// =============================================================================

import { esRutaMovil, respaldoEscritorio, rutaEscritorio, rutaMovil } from './movil-rutas';
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

export type Desvio = { tipo: 'nada' } | { tipo: 'movil'; destino: string } | { tipo: 'computadora' };

/**
 * Pantallas que se abren igual en el teléfono aunque no sean de /m (además de las públicas, que no
 * se tapan nunca): el login, el wizard del onboarding (al que manda /m/configurar), las legales, el
 * alumno del curso, la ventana de prueba del Pixel, lo que se comparte con alguien de afuera y la
 * API. Y /inicio, el repartidor: no dibuja nada, redirige (en un teléfono, a /general). Sin él acá,
 * el proxy le servía Today en la URL /inicio. Prefijos con barra: «/login» no atrapa «/logins».
 */
const SE_ABREN_IGUAL = [
  '/login', '/logout', '/onboarding', '/privacidad', '/terminos', '/compartido', '/mi-curso',
  '/integraciones/escuchando', '/vsl', '/api', '/inicio',
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
  if (destino) return { tipo: 'movil', destino };
  return { tipo: 'computadora' };
}

/**
 * ¿Lo que se ve en ESTA URL es la versión del teléfono? Sí en una ruta /m (un link viejo antes de su
 * redirect) y, en un teléfono, en toda URL que el proxy reescribe a /m. Lo preguntan los del layout
 * raíz (el Sidebar, los avisos de escritorio, los pollers): con LAS MISMAS RUTAS el navegador dice
 * /crm y no /m/crm, así que `esRutaMovil(pathname)` sola ya no alcanza.
 */
export function esVistaMovil(pathname: string | null | undefined, search: string, telefono: boolean): boolean {
  if (esRutaMovil(pathname)) return true;
  return telefono && decidirDesvio(pathname, search).tipo === 'movil';
}

/** Lo que el proxy hace con un pedido de PÁGINA con sesión (las de /api no pasan por acá). */
export type PedidoMovil = { tipo: 'seguir' } | { tipo: 'redirigir'; destino: string } | { tipo: 'reescribir'; destino: string };

/**
 * La decisión del proxy (proxy.ts), pura y con test. Va DESPUÉS de los chequeos de sesión y nunca
 * para /api ni lo público (el proxy es el choke point de seguridad: AGENTS.md). `search` con o sin «?».
 *
 *   · Una URL /m/… (un favorito, un aviso o un acceso directo viejos) → se REDIRIGE a su ruta de
 *     escritorio, con la query intacta: /m es la carpeta interna, nunca una URL. Sólo GET y HEAD: un
 *     POST (una server action de una pestaña vieja) sigue a la página que la tiene.
 *   · Un teléfono sin «Versión completa» en una pantalla con equivalente → se REESCRIBE a la página
 *     de /m. La URL del navegador no cambia.
 *   · Una computadora en una URL que sólo existe en el teléfono (/mas, /crm/12/chat…) → se REDIRIGE
 *     a la pantalla de escritorio que corresponde (`respaldoEscritorio`).
 */
export function pedidoMovil(p: { pathname: string; search: string; metodo: string; telefono: boolean }): PedidoMovil {
  const path = p.pathname.replace(/\/+$/, '') || '/';
  if (path === '/api' || path.startsWith('/api/')) return { tipo: 'seguir' };
  const lee = p.metodo === 'GET' || p.metodo === 'HEAD';
  const search = p.search.replace(/^\?/, '');
  if (esRutaMovil(path)) {
    if (!lee) return { tipo: 'seguir' };
    const destino = rutaEscritorio(search ? `${path}?${search}` : path);
    // Una /m que no está en la tabla vuelve igual: se sigue (404 como antes), nunca un redirect en bucle.
    return esRutaMovil(destino.split(/[?#]/)[0]) ? { tipo: 'seguir' } : { tipo: 'redirigir', destino };
  }
  if (!p.telefono) {
    const respaldo = lee ? respaldoEscritorio(path) : null;
    return respaldo ? { tipo: 'redirigir', destino: search ? `${respaldo}?${search}` : respaldo } : { tipo: 'seguir' };
  }
  // ⚠️ EL REPARTIDOR, EN UN TELÉFONO, SE RESUELVE ACÁ EN EL BORDE (14/10/2026). /inicio es el
  // `start_url` de la app instalada y el destino de cada login. En un teléfono siempre va a /general
  // (app/inicio/page.tsx: «telefono → /general»; el admin sin cliente después recibe su `?ws=` de
  // requireMovil). Hecho en la página, el redirect salía DESPUÉS de dibujar: Vercel registró
  // `GET /inicio 200` y recién después `GET /general` (2,5-3,8 s), y mientras tanto el teléfono
  // mostraba /inicio con el layout de escritorio, la Sidebar angosta y el resto en blanco. Lo vio
  // Martín al abrir la app. Desde el borde es un 307 de ~70 ms y no se dibuja nada.
  if (path === '/inicio') return lee ? { tipo: 'redirigir', destino: search ? `/general?${search}` : '/general' } : { tipo: 'seguir' };
  const d = decidirDesvio(path, search);
  if (d.tipo !== 'movil') return { tipo: 'seguir' };
  return { tipo: 'reescribir', destino: urlReescrita(d.destino, search) };
}

/**
 * La URL interna del rewrite: el path de /m y la query ORIGINAL entera (el `?ws=` incluido: el
 * proxy pone el header del workspace desde el pedido original), más lo que la página de /m lee y
 * escritorio dice de otra forma (`?hoja=comercial` de /comercial). Lo de la página de /m gana.
 */
export function urlReescrita(destino: string, searchOriginal: string): string {
  const [path, qDestino = ''] = destino.split('?');
  const q = new URLSearchParams(searchOriginal.replace(/^\?/, ''));
  for (const [k, v] of new URLSearchParams(qDestino)) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
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
