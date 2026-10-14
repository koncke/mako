// =============================================================================
// editor-landing/origen-landings — DÓNDE viven las landings publicadas (tanda 4, 14/10/2026)
// =============================================================================
// Decisión de Martín (14/10/2026): «Las landings enteras, como gamma.site». Compró hola-mako.site:
// una landing publicada se sirve en `https://hola-mako.site/<slug>` (y sus páginas en
// `/<slug>/<ruta>`); la APP sigue en hola-mako.com. Si la landing tiene DOMINIO PROPIO del cliente,
// sigue sirviéndose también ahí, como antes. El porqué: lo que publica un cliente (HTML personalizado
// con JavaScript, «Replicar» que copia páginas ajenas) no puede vivir bajo el dominio de la app ni el
// del mail. Si Google Safe Browsing marca una página, que marque hola-mako.site y no hola-mako.com
// (docs/hallazgos-editor-landing.md, «Tanda 4»).
//
// Lo que vive acá es PURO —sin `process.env`, sin node:*, sin React— porque lo importan a la vez el
// proxy, next.config.ts (por dominios-reglas.ts), el navegador y los tests:
//
//   · el host de las landings (`HOST_LANDINGS`, `esHostDeLandings`);
//   · la BASE de las landings: lo que va ANTES del slug. `https://hola-mako.site` en producción y
//     `<app>/l` en local y en los previews (un preview no tiene el dominio): `baseLandingsPara`;
//   · las URLs que se arman con una base (`urlLandingEn`, `urlVistaEn`) y la vuelta (`slugDeUrlLanding`);
//   · lo que contesta el proxy en el host de las landings (`decidirLandings`) y lo que contesta la APP
//     a un `/l/…` en producción (`decidirLEnApp`), con test (tests/editor-landing-origen.test.ts).
//
// ⚠️ LA BASE ACTUAL NO SE CALCULA ACÁ: depende de `VERCEL_ENV`, que sólo el server conoce en ejecución.
//    Vive en lib/app-url.ts (`baseLandings`, `basesLandings`, `urlPublicaLanding`, `urlVistaLanding`
//    de la app), al lado de APP_BASE_URL: las dos contestan «¿por dónde nos encuentra alguien de
//    afuera?» y se mudan juntas. El navegador NO puede calcularla (no sabe en qué entorno corre: en un
//    componente cliente `process.env.VERCEL_ENV` es undefined y daría la base de local EN PRODUCCIÓN):
//    la recibe del server (`LandingCompleta.baseLandings`, la prop `bases` del Panel).
// =============================================================================

import { PREFIJO_PUBLICO, rutaValida, slugValido } from './doc';
import { PREFIJO_HTML_LIBRE, RE_TOKEN_VISTA } from './html-libre';

// ─────────────────────────────────────────────────────────────────────────────
// El host
// ─────────────────────────────────────────────────────────────────────────────

/** El dominio de las landings publicadas (comprado en Porkbun el 14/10/2026; `www.` lo manda Vercel al apex). */
export const HOST_LANDINGS = 'hola-mako.site';
export const ORIGEN_LANDINGS = `https://${HOST_LANDINGS}`;

/**
 * ¿Este host (ya normalizado: minúsculas, sin puerto) es el de las landings? El apex y CUALQUIER
 * subdominio: en positivo, todo lo que cuelga de hola-mako.site es contenido de clientes y nunca la
 * app (un `<slug>.hola-mako.site` futuro no podría abrir una pantalla de MaKo por un descuido).
 */
export function esHostDeLandings(host: string): boolean {
  return host === HOST_LANDINGS || host.endsWith('.' + HOST_LANDINGS);
}

// ─────────────────────────────────────────────────────────────────────────────
// La base y las URLs
// ─────────────────────────────────────────────────────────────────────────────

/** Sin barras al final. */
const sinBarra = (s: string): string => s.replace(/\/+$/, '');

/**
 * La base de las landings (lo que va antes del slug, sin barra final). En producción, el dominio de
 * las landings; en local y en los previews, la ruta de siempre en el host de la app (`<app>/l`).
 */
export function baseLandingsPara(e: { produccion: boolean; appBaseUrl: string }): string {
  return e.produccion ? ORIGEN_LANDINGS : `${sinBarra(e.appBaseUrl)}${PREFIJO_PUBLICO}`;
}

/**
 * TODAS las bases donde una landing nuestra se pudo ver, la vigente primero: en producción
 * `hola-mako.site` y la vieja `<app>/l` (redirige, pero un link copiado antes de la mudanza, una visita
 * medida antes o un análisis guardado con ella siguen siendo de esa landing). En local, una sola.
 */
export function basesLandingsPara(e: { produccion: boolean; appBaseUrl: string }): string[] {
  const vigente = baseLandingsPara(e);
  const app = baseLandingsPara({ produccion: false, appBaseUrl: e.appBaseUrl });
  return vigente === app ? [vigente] : [vigente, app];
}

/** La URL pública de una landing (`ruta` '' = la de inicio) en esa base. */
export function urlLandingEn(base: string, slug: string, ruta = ''): string {
  return `${sinBarra(base)}/${slug}${ruta ? `/${ruta}` : ''}`;
}

/** El segmento del link privado del borrador: `<base>/vista/<token>`. En el host de la app, `/l/vista/<token>`. */
export const SEGMENTO_VISTA = 'vista';

/** El link privado al BORRADOR (`ruta` '' = la de inicio) en esa base. */
export function urlVistaEn(base: string, token: string, ruta = ''): string {
  return `${sinBarra(base)}/${SEGMENTO_VISTA}/${token}${ruta ? `/${ruta}` : ''}`;
}

/**
 * El slug de una URL pública de landing en alguna de esas bases (`<base>/<slug>` o
 * `<base>/<slug>/<ruta>`), o null. Compara el host sin `www.` y sin mayúsculas; el slug, tal cual.
 */
export function slugDeUrlLanding(url: string | null | undefined, bases: readonly string[]): string | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  for (const b of bases) {
    let bu: URL;
    try { bu = new URL(sinBarra(b)); } catch { continue; }
    if (bu.hostname.toLowerCase().replace(/^www\./, '') !== host || bu.port !== u.port) continue;
    const pre = sinBarra(bu.pathname) + '/';
    if (!u.pathname.startsWith(pre)) continue;
    const seg = u.pathname.slice(pre.length).split('/')[0];
    if (seg && slugValido(seg)) return seg;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que contesta el proxy en hola-mako.site
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las sub-rutas FIJAS de una landing con un tercer segmento (`/<slug>/<fija>/<id>`, con la forma del
 * id). HOY NINGUNA. ⚠️ Una carpeta fija nueva bajo `app/l/[slug]/` se suma ACÁ, con su test, el MISMO
 * día que la carpeta existe: en hola-mako.site sólo se reescribe lo que tiene una forma conocida, y
 * declarar una que no existe manda al not-found de la APP (con su layout) en el dominio de los clientes.
 * Pasó con `pagar` (revisión de la tanda 4): el paquete del pago de un bloque todavía no existe, y
 * `/<slug>/pagar/<id>` se reescribía a una ruta que no hay. Lo mismo vale para su POST
 * (`/api/landing-generator/pagar`): hoy es un 404 como todo /api. Cuando llegue, lo suma ese paquete
 * con `Origin` exigido (ausente o igual a `https://<host del pedido>`; 403 si no), tope por IP e
 * idempotencia por bloque y visitante, y el monto, la moneda y el workspace nunca del pedido.
 */
export const SUBRUTAS_FIJAS: Readonly<Record<string, RegExp>> = Object.freeze({});

export type DecisionLandings =
  /** Una página de una landing (o del borrador): se REESCRIBE a la ruta interna `destino` (la query viaja). */
  | { tipo: 'reescribir'; destino: string }
  /** Algo que la página pide a su propio host (hoy, sólo el HTML libre): pasa tal cual. */
  | { tipo: 'pasar' }
  /** Mismo host, otra dirección (mayúsculas, el `/l/…` de antes): 308 a `destino`, con la query. */
  | { tipo: 'redirigir'; destino: string }
  /** La raíz de hola-mako.site: no es de nadie. El proxy manda a la landing de venta de MaKo. */
  | { tipo: 'raiz' }
  /** Todo lo demás —la app, /api, los estáticos que pasan por el proxy—: 404. */
  | { tipo: 'no-existe' }
  /** Un método que una página no acepta: 405. */
  | { tipo: 'metodo' };

const LEER = new Set(['GET', 'HEAD']);

const esPrefijo = (p: string, pre: string): boolean => p === pre || p.startsWith(pre + '/');

/** Un segmento de slug o de ruta que en minúsculas sí vale (para el 308), o null. */
const enMinusculas = (seg: string, vale: (s: string) => boolean): string | null => {
  const m = seg.toLowerCase();
  return m !== seg && vale(m) ? m : null;
};

/**
 * Qué contesta el proxy a un pedido en hola-mako.site. Sólo se sirven las landings: `/<slug>`,
 * `/<slug>/<ruta>`, las sub-rutas de `SUBRUTAS_FIJAS` (hoy ninguna), el borrador `/vista/<token>[/<ruta>]` y el HTML libre
 * `/l/html/…` (que se pide RELATIVO desde la página, así que viaja con ella a su host). La raíz manda
 * a MaKo. Nada de la app ni de /api: ni el Pixel ni /api/track pasan por acá
 * (la página los pide ABSOLUTOS a hola-mako.com, `lineaCargador` de lib/pixel-cargador.ts).
 *
 * Que la landing EXISTA y esté publicada no se decide acá: lo decide la ruta interna (404 si no).
 */
export function decidirLandings(pathname: string, metodo: string): DecisionLandings {
  const m = metodo.toUpperCase();
  if (esPrefijo(pathname, '/api')) return { tipo: 'no-existe' };
  if (!LEER.has(m)) return { tipo: 'metodo' };
  if (pathname === '/' || pathname === '') return { tipo: 'raiz' };

  // El HTML libre: la página lo pide relativo (`/l/html/<doc>/<bloque>`) y llega a ESTE host.
  if (esPrefijo(pathname, PREFIJO_HTML_LIBRE)) return { tipo: 'pasar' };
  // `/l/<algo>` es la dirección de la APP: acá es `/<algo>`. Un slug no puede ser `l` (3 o más).
  // ⚠️ Lo que queda se decide con las MISMAS reglas que una dirección directa, y sólo se redirige a
  //    una landing (o a la raíz): `/l//evil.com` dejaba `//evil.com`, que en una `Location` es una
  //    URL relativa al protocolo, o sea OTRO host. Era una redirección abierta con la marca de MaKo, y
  //    desde la app se llegaba con `hola-mako.com/l/l//evil.com` (revisión de la tanda 4).
  if (esPrefijo(pathname, PREFIJO_PUBLICO)) {
    const resto = pathname.slice(PREFIJO_PUBLICO.length) || '/';
    const d = decidirLandings(resto, m);
    if (d.tipo === 'reescribir') return { tipo: 'redirigir', destino: resto };
    if (d.tipo === 'redirigir') return d;
    if (d.tipo === 'raiz') return { tipo: 'redirigir', destino: '/' };
    return { tipo: 'no-existe' };
  }

  const segs = pathname.slice(1).split('/');
  if (segs.some((s) => !s)) return { tipo: 'no-existe' };

  // El borrador por el link privado. `vista` es un slug reservado (doc.ts): no tapa ninguna landing.
  if (segs[0] === SEGMENTO_VISTA) {
    const [, token, ruta = ''] = segs;
    if (segs.length > 3 || !token || !RE_TOKEN_VISTA.test(token)) return { tipo: 'no-existe' };
    if (rutaValida(ruta)) return { tipo: 'reescribir', destino: `${PREFIJO_PUBLICO}${pathname}` };
    const min = enMinusculas(ruta, rutaValida);
    return min ? { tipo: 'redirigir', destino: `/${SEGMENTO_VISTA}/${token}/${min}` } : { tipo: 'no-existe' };
  }

  const [slug, ruta = '', id] = segs;
  if (segs.length > 3) return { tipo: 'no-existe' };
  if (segs.length === 3) {
    const forma = Object.prototype.hasOwnProperty.call(SUBRUTAS_FIJAS, ruta) ? SUBRUTAS_FIJAS[ruta] : null;
    if (!forma || !forma.test(id)) return { tipo: 'no-existe' };
    if (slugValido(slug)) return { tipo: 'reescribir', destino: `${PREFIJO_PUBLICO}${pathname}` };
    const min = enMinusculas(slug, slugValido);
    return min ? { tipo: 'redirigir', destino: `/${min}/${ruta}/${id}` } : { tipo: 'no-existe' };
  }
  if (slugValido(slug) && rutaValida(ruta)) return { tipo: 'reescribir', destino: `${PREFIJO_PUBLICO}${pathname}` };
  const slugMin = slugValido(slug) ? slug : enMinusculas(slug, slugValido);
  const rutaMin = rutaValida(ruta) ? ruta : enMinusculas(ruta, rutaValida);
  if (!slugMin || rutaMin === null) return { tipo: 'no-existe' };
  return { tipo: 'redirigir', destino: `/${slugMin}${rutaMin ? `/${rutaMin}` : ''}` };
}

/**
 * La `Location` de un 308 que NO cambia de host: la ruta `destino` más la query, en `https://<host>`
 * (`host` ya normalizado: minúsculas, sin puerto). null si el resultado cae en OTRO host: `//evil.com`
 * (y `/\evil.com`, que el parser lee igual) es una URL relativa al protocolo, y `new URL(destino, base)`
 * la saca de MaKo. Lo usa el proxy en los dos 308 que arma con la ruta del pedido (hola-mako.site y el
 * dominio de un cliente): aunque una decisión se equivoque mañana, la redirección no sale del host.
 */
export function redireccionEnElHost(destino: string, search: string, host: string): string | null {
  if (!destino.startsWith('/') || !host) return null;
  let u: URL;
  try { u = new URL(destino + search, `https://${host}`); } catch { return null; }
  return u.host === host ? u.toString() : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que contesta la APP a un /l/… en producción
// ─────────────────────────────────────────────────────────────────────────────

export type DecisionLEnApp =
  /** No es de /l: sigue el flujo de la app. */
  | { tipo: 'seguir' }
  /** Una landing (o su borrador): 308 a hola-mako.site, misma ruta sin `/l`, con la query. */
  | { tipo: 'mudar'; destino: string }
  /** El HTML libre ya no se sirve bajo el dominio de la app: 404. */
  | { tipo: 'no-existe' };

/**
 * En PRODUCCIÓN, en un host de la app: `/l/<…>` se muda a hola-mako.site (308, la query entera: los
 * utm_* son la atribución del anuncio) y `/l/html/…` deja de servirse (el HTML de un cliente con
 * JavaScript no vive bajo hola-mako.com: la página que lo enmarca ya vive en hola-mako.site o en el
 * dominio del cliente, y lo pide relativo a SU host). Nadie de la app usa /l/html: el editor y el
 * Diagnóstico dibujan el bloque con `srcdoc` (render.ts sin `htmlLibre`). En local y en los
 * previews el proxy no llama a esto y /l sigue sirviendo.
 */
export function decidirLEnApp(pathname: string, search: string): DecisionLEnApp {
  if (!esPrefijo(pathname, PREFIJO_PUBLICO)) return { tipo: 'seguir' };
  if (esPrefijo(pathname, PREFIJO_HTML_LIBRE)) return { tipo: 'no-existe' };
  const resto = pathname.slice(PREFIJO_PUBLICO.length) || '/';
  return { tipo: 'mudar', destino: `${ORIGEN_LANDINGS}${resto}${search}` };
}
