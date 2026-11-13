// =============================================================================
// tienda — la app de iPhone de las tiendas se reconoce por su marca en el user agent (3/11/2026)
// =============================================================================
// Plan: docs/tiendas-play-appstore.md, paso 3. La app de iPhone es hola-mako.com dentro de Capacitor, y Capacitor le suma
// `MaKoApp-iOS` al user agent (`ios.appendUserAgent`, nativo/ios/capacitor.config.json). Con esa marca:
//   · no hay botón de Google: Google prohíbe su OAuth dentro de un WebView (riesgo R3, T6);
//   · no se ve lo que Apple lee como relleno: «Coming soon» y «En la computadora» (guía 2.1, riesgo R6);
//   · no se abre nada de lo que vende (guía 3.1.1(a), T5, riesgo R2).
// Y en CUALQUIER teléfono (4/11/2026): ni MaKo Partners (`TABS_QUE_VENDEN`). El Agency Dashboard volvió el 13/11/2026 (#94),
// sin lo que se le debe a MaKo: ver y entrar a cada cliente (app/m/agency).
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

/**
 * La ruta de un link universal o de un aviso tocado, si es de MaKo. Lo que no es de hola-mako.com no se abre adentro de la app: la app
 * corre con la sesión de la persona, y un link que llega de afuera no elige a dónde lleva esa sesión.
 */
export function rutaDeLinkDeLaApp(url: string | null | undefined, host = 'hola-mako.com'): string | null {
  try {
    const u = new URL(String(url ?? ''));
    if (u.protocol !== 'https:' || u.hostname !== host || u.username || u.password) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/**
 * Las tabs que existen para vender MaKo a otros (la cartera de una agencia, el programa de partners). NO VAN EN NINGÚN
 * TELÉFONO desde el 4/11/2026 (hasta ese día, sólo en la app de iPhone). Martín lo decidió así: en la clasificación de edad
 * de Google Play se contestó que la app no da premios en dinero, y MaKo Partners del teléfono decía «Ya cobraste»; Agency
 * Dashboard decía «Falta pagar», «Esperando su pago» y «Renovación pendiente». Y Android no se distingue de Chrome.
 *
 * Lo leen los dos lugares por donde se llegaba: More (`masCompleto` → `sinLoQueVende`) y la página de cada una, que vuelve a
 * More (app/m/partners, app/m/agency). Lo de abajo de esas páginas queda para el día que una vuelva: sacarla de esta lista
 * la devuelve a los teléfonos. En la computadora no cambia nada.
 */
// ⚠️ 'agency' SALIÓ el 13/11/2026 (ticket #94; Martín: «Soluciona esto»): la cartera de una agencia no vende nada si no dice
//    lo que se le debe a MaKo, y eso lo sacó app/m/agency. More la muestra sólo a una agencia (app/m/mas/page.tsx).
export const TABS_QUE_VENDEN: readonly string[] = ['partners'];

/** ¿Esta tab (key de nav.ts) existe para vender MaKo a otros? Entonces no va en el teléfono. */
export const esTabQueVende = (key: string): boolean => TABS_QUE_VENDEN.includes(key);

/** More sin las tabs que venden MaKo a otros, en cualquier teléfono: ni su fila ni la de adentro de un desplegable. */
export function sinLoQueVende(grupos: GrupoMasCompleto[]): GrupoMasCompleto[] {
  return sinFilas(grupos, esTabQueVende);
}

/** More sin las filas de estas keys (ni la de adentro de un desplegable), y sin los grupos que quedan vacíos. */
export function sinFilas(grupos: GrupoMasCompleto[], quitar: (key: string) => boolean): GrupoMasCompleto[] {
  const limpiar = (filas: FilaMas[]): FilaMas[] => filas
    .filter((f) => !quitar(f.key))
    .map((f) => (f.tipo === 'grupo' ? { ...f, filas: limpiar(f.filas) } : f))
    .filter((f) => f.tipo !== 'grupo' || f.filas.length > 0);
  return grupos
    .map((g) => ({ ...g, filas: limpiar(g.filas) }))
    .filter((g) => g.filas.length > 0);
}

/**
 * More sin lo que en la app de iPhone se lee como relleno: lo que no tiene pantalla y «Coming soon». Lo que vende ya salió
 * en `masCompleto` (`sinLoQueVende`), para todos los teléfonos.
 */
export function masParaAppIos(grupos: GrupoMasCompleto[], rutaPronto: string): GrupoMasCompleto[] {
  const conPantalla = (f: FilaMas) => f.tipo === 'pantalla' && !f.href.startsWith(`${rutaPronto}/`);
  return grupos
    .map((g) => ({ ...g, filas: g.filas.filter(conPantalla) }))
    .filter((g) => g.filas.length > 0);
}
