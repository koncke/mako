// =============================================================================
// ruta-web-generator — dónde vive la tab Web Generator (ex Landing Generator), y sus URLs viejas
// =============================================================================
// Pedido de Martín (15/10/2026, feedback de la tanda 6, punto 1), textual: «Quiero que todo se
// llame ahora "Web Generator", la ruta, en la sidebar, todo...»
//
// La carpeta pasó de app/landing-generator a app/web-generator y la ruta de /landing-generator a
// /web-generator. Es el mismo molde que /chatbot → /automations (lib/ruta-automations.ts).
// ⚠️ LO QUE NO CAMBIÓ, Y NO SE CAMBIA, son las CLAVES y los otros contratos: la key
// `landing-writer` del nav (capas, roles, `onboarding.tab.landing-writer` y sus pasos), el área
// `landing` de la API de MaKo y sus operaciones, la API interna /api/landing-generator/* y la REST
// /api/v1/landing/*, las tablas y los buckets, los proyectos del tablero («Feature: Landing
// Generator», «Landing Generator») y la carpeta /admin/dev/landing-generator (el registro del
// área). Cambiar una clave guardada deja a los clientes con el onboarding reabierto o la tab sin
// permiso, y eso no lo ve ningún test: se ve en la cuenta de un cliente.
//
// Sin `server-only` y sin 'use client': lo leen el nav (cliente), MaKo Mobile, el redirect (server)
// y el guard de tests/web-generator-renombre.test.ts.

import { destinoConQuery } from './ruta-automations';

/** La ruta de la tab. */
export const RUTA_WEB_GENERATOR = '/web-generator';

/**
 * Las URLs viejas de la tab, que REDIRIGEN acá y que el nav (y MaKo Mobile) siguen marcando como
 * Web Generator.
 *
 * ⚠️ SE REDIRIGEN, NO SE BORRAN: hay links afuera del repo que nadie puede editar —el link del
 * editor que MaKo ya mandó por chat o por WhatsApp (`/landing-generator/<id>?ws=N`), los avisos,
 * los marcadores, las tareas del plan, el `/landing-writer?url=` del Landing Analyst—. Ésta es la
 * ÚNICA lista donde `/landing-generator` puede aparecer como cadena en el producto, además de su
 * propia página de redirect (app/landing-generator/[[...resto]]/page.tsx): lo cuida el guard.
 */
export const RUTAS_VIEJAS_WEB_GENERATOR = ['/landing-generator', '/landing-writer'] as const;

/**
 * El destino de una URL vieja de la tab: el MISMO camino bajo /web-generator, con la query ENTERA.
 * `/landing-generator/12?ws=3` → `/web-generator/12?ws=3`; `/landing-generator/crear?url=…` →
 * `/web-generator/crear?url=…` (que a su vez abre «Crear con IA» en el Panel).
 *
 * ⚠️ LA QUERY ES EL DESTINO: `?diagnostico=`, `?url=`, `?paso=` dicen QUÉ abrir, y el `?ws=` en
 * cuál negocio. Un redirect pelado abre el Panel vacío y no dice nada.
 *
 * Cada tramo viaja codificado y los `.`/`..` (o vacíos) se descartan: el destino nunca sale de
 * /web-generator.
 */
export function destinoWebGenerator(
  resto: readonly string[] | undefined,
  sp: Record<string, string | string[] | undefined>,
): string {
  const tramos = (resto ?? []).filter((t) => t !== '' && t !== '.' && t !== '..').map(encodeURIComponent);
  const ruta = tramos.length ? `${RUTA_WEB_GENERATOR}/${tramos.join('/')}` : RUTA_WEB_GENERATOR;
  return destinoConQuery(ruta, sp);
}
