// =============================================================================
// tienda — la app de iPhone de las tiendas se reconoce por su marca en el user agent (3/11/2026)
// =============================================================================
// Plan: docs/tiendas-play-appstore.md, paso 3. La app de iPhone es hola-mako.com dentro de Capacitor, y Capacitor le suma
// `MaKoApp-iOS` al user agent (`ios.appendUserAgent`, nativo/ios/capacitor.config.json). Con esa marca:
//   · no hay botón de Google: Google prohíbe su OAuth dentro de un WebView (riesgo R3, T6);
//   · no se ve lo que Apple lee como relleno: «Coming soon» y «En la computadora» (guía 2.1, riesgo R6);
//   · no se abre nada de lo que vende (guía 3.1.1(a), T5, riesgo R2).
//
// ⚠️ ANDROID NO TIENE MODO, y no es un olvido: la TWA es Chrome y comparte el user agent, las cookies y el storage. Una marca
//    ahí se filtraría al navegador. Por eso el teléfono no vende en NINGÚN teléfono, sin preguntar cuál es.
// ⚠️ ES UNA REGLA DE PRODUCTO, NO DE SEGURIDAD: el user agent lo escribe quien hace el pedido. Nada que proteja algo se
//    decide con esto; lo único que cambia es qué se dibuja, y sin la marca todo queda como siempre.
// ⚠️ PURO (sin `server-only`): lo leen el proxy, las páginas, la pantalla y los tests.
// =============================================================================

import type { FilaMas, GrupoMasCompleto } from './movil-rutas';

/** La misma que `ios.appendUserAgent` de nativo/ios/capacitor.config.json (tests/tienda.test.ts las compara). */
export const MARCA_APP_IOS = 'MaKoApp-iOS';

export const esAppIos = (userAgent: string | null | undefined): boolean => String(userAgent ?? '').includes(MARCA_APP_IOS);

/**
 * Lo que vende: la landing de venta (la raíz), los planes, los links de pago y los de los partners. Adentro de la app de
 * iPhone no se abre (`esRutaDeVenta` en proxy.ts): un link universal o un toque en un correo no pueden terminar en un cobro
 * sin compra integrada de Apple. Afuera de la app sigue igual: el comprador de un negocio paga desde su navegador.
 */
export const RUTAS_DE_VENTA = ['/planes', '/pagar', '/r', '/mako-partners', '/reembolsos', '/vsl', '/vsl-assets'] as const;

export function esRutaDeVenta(pathname: string): boolean {
  return pathname === '/' || RUTAS_DE_VENTA.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Las tabs que existen para vender MaKo a otros (la cartera de una agencia, el programa de partners): en iPhone no van. */
export const TABS_QUE_VENDEN: readonly string[] = ['agency', 'partners'];

/** More sin lo que en la app de iPhone se lee como relleno o como venta: lo que no tiene pantalla, «Coming soon» y lo de arriba. */
export function masParaAppIos(grupos: GrupoMasCompleto[], rutaPronto: string): GrupoMasCompleto[] {
  const conPantalla = (f: FilaMas) => f.tipo === 'pantalla' && !f.href.startsWith(`${rutaPronto}/`) && !TABS_QUE_VENDEN.includes(f.key);
  return grupos
    .map((g) => ({ ...g, filas: g.filas.filter(conPantalla) }))
    .filter((g) => g.filas.length > 0);
}
