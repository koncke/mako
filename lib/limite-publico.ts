// =============================================================================
// limite-publico — el tope de pedidos de una ruta que se atiende SIN sesión
// =============================================================================
// Lo que está abierto al mundo y escribe es lo caro: un bombardeo al opt-in de una landing no
// «tira el sitio» primero, le LLENA EL CRM de basura a un cliente y le gasta IA (cada alta dispara
// automatizaciones). Al 15/10/2026, una de cada diez rutas de app/api tenía límite
// (docs/relevo/ciberseguridad.md → punto 1); las públicas que escriben, casi ninguna.
//
// Es el limitador en memoria de lib/rate-limit.ts: por instancia, best-effort. NO para un ataque
// distribuido (eso es Cloudflare o un store compartido, anotado en el relevo); SÍ corta el flood de
// una IP, que es el ataque barato. Los topes son GENEROSOS a propósito: detrás de un NAT de
// operador móvil cientos de personas comparten una IP, y un opt-in que contesta 429 es un lead
// perdido (el snippet de la landing lo manda una vez y no mira la respuesta).
//
// Los webhooks NO llevan límite, y es a propósito: se autentican por firma (lo que no firma muere
// barato, en un 401) y un 429 a un proveedor lo hace reintentar y después deshabilitar la
// suscripción en silencio (pasó dos veces con Calendly). El guard que lo exige ruta por ruta, con
// las exentas nombradas: tests/rutas-publicas-limite.test.ts.
// =============================================================================

import { clientIp, rateLimit } from './rate-limit';

/**
 * null si el pedido entra; si no, el 429 listo para devolver (con `Retry-After`).
 * `nombre` separa los contadores de cada ruta: el tope de una no se come el de otra.
 */
export function limitePorIp(
  req: Request,
  nombre: string,
  max: number,
  ventanaMs: number,
  headers: Record<string, string> = {},
): Response | null {
  if (rateLimit(`${nombre}:${clientIp(req)}`, max, ventanaMs)) return null;
  return Response.json(
    { ok: false, error: 'Demasiados pedidos seguidos. Espera un momento y vuelve a intentar.' },
    { status: 429, headers: { ...headers, 'Retry-After': String(Math.ceil(ventanaMs / 1000)) } },
  );
}

/** Lo mismo, con una clave que no es la IP (el workspace de un token, por ejemplo). */
export function limitePorClave(nombre: string, clave: string | number, max: number, ventanaMs: number): Response | null {
  if (rateLimit(`${nombre}:${clave}`, max, ventanaMs)) return null;
  return Response.json(
    { ok: false, error: 'Demasiados pedidos seguidos. Espera un momento y vuelve a intentar.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(ventanaMs / 1000)) } },
  );
}
