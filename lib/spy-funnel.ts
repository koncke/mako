// =============================================================================
// Competitors Spy — qué hay detrás de la web de un competidor: píxeles, checkout y video
// =============================================================================
// Pedido de Martín (3/11/2026). `mirarCompetidor` ya bajaba la landing y `pixelesMetaDe` ya leía el
// píxel de Meta, pero lo guardaba en `etiquetas` (`meta-px:`), que `nombresDe` descarta al dibujar y
// la poda tacha a los 30 días. O sea: se leía y se tiraba. Esto lo lee aparte y lo guarda en una
// columna propia (`spy_piezas.funnel`, migración 0373).
//
// Puro y sin `server-only`, como lib/landing-analisis.ts: lo que se puede equivocar es la DETECCIÓN
// sobre un texto, y tiene que poder probarse con un string. Lo llaman el servidor con el HTML que ya
// bajó, y la interpretación de lo que manda la extensión con las direcciones que vio el navegador.
//
// ⚠️ SE ANCLA EN LA FORMA DE CARGARLO, NO EN EL TEXTO SUELTO. En un bundle minificado o en un artículo
// que enseña a instalar un píxel, `GTM-XXXXXX` y `G-1234567` aparecen por cualquier motivo. Por eso
// cada id se busca en la dirección o la llamada que lo carga, y lo que parece un relleno se descarta.
//
// ⚠️ `HOSTS_VIDEO` SE LEE Y NO SE TOCA: es el flujo del Pixel de los clientes, y sumarle un host les
// haría llegar avisos falsos («le agregaste un video»). Los reproductores nuevos viven acá.
//
// ⚠️ UNA LECTURA NO DESMIENTE A LA OTRA. Hay dos lectores que ven cosas distintas: el servidor no ve lo
// que carga Tag Manager, y el navegador de la persona no ve lo que su bloqueador frena. Por eso cada
// uno escribe su lugar (`pagina` y `navegador`) y la pantalla dibuja la unión.
//
// Las trampas: docs/hallazgos-competitors-spy.md.
// =============================================================================

import { HOSTS_VIDEO, hostDePieza, pixelesMetaDe } from './landing-analisis';
import { esAgregador } from './spy-otras-redes-reglas';
import { nombreParaBuscar } from './spy-reglas';

export const PROVEEDORES_PIXEL = ['meta', 'ga4', 'gtm', 'google-ads', 'tiktok', 'taboola'] as const;
export type ProveedorPixel = (typeof PROVEEDORES_PIXEL)[number];

export const NOMBRE_PIXEL: Record<ProveedorPixel, string> = {
  meta: 'Meta',
  ga4: 'Google Analytics',
  gtm: 'Tag Manager',
  'google-ads': 'Google Ads',
  tiktok: 'TikTok',
  taboola: 'Taboola',
};

/** `ids` vacío = se ve que lo carga, y no se ve con qué cuenta. No es lo mismo que no tenerlo. */
export type PixelLeido = { proveedor: ProveedorPixel; ids: string[] };
export type CheckoutLeido = { nombre: string; url: string };
export type LecturaFunnel = { pixeles: PixelLeido[]; checkouts: CheckoutLeido[]; videos: string[]; leidoEn: string };
/** Lo que vio cada lector. Se escriben por separado: ver la cabecera. */
export type Funnel = { pagina: LecturaFunnel | null; navegador: LecturaFunnel | null };

// ─────────────────────────────────────────────────────────────────────────────
// Los píxeles
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que sigue a `?` antes del parámetro: `gtm.js?l=dl&id=GTM-X` trae el id en segundo lugar. */
const OTROS = String.raw`(?:[^"'\s<>]*?&)?`;

type Patron = {
  proveedor: ProveedorPixel;
  /** El primer grupo es el id. */
  ids: RegExp[];
  /** Se ve que lo carga aunque no se vea la cuenta. */
  marca?: RegExp;
  /** Cómo se escribe el id al guardarlo (la conversión de Google Ads llega sin su `AW-`). */
  normal?: (id: string) => string;
};

const PATRONES: Patron[] = [
  {
    proveedor: 'meta',
    ids: [
      new RegExp(String.raw`facebook\.com/tr/?\?${OTROS}id=(\d{6,20})`, 'g'),
      /signals\/config\/(\d{6,20})/g,
    ],
    marca: /connect\.facebook\.net\/[\w-]+\/fbevents\.js/,
  },
  {
    proveedor: 'ga4',
    ids: [
      new RegExp(String.raw`gtag/js\?${OTROS}id=(G-[A-Z0-9]{6,12})\b`, 'g'),
      /[?&]tid=(G-[A-Z0-9]{6,12})\b/g,
      /gtag\(\s*["']config["']\s*,\s*["'](G-[A-Z0-9]{6,12})["']/g,
      /measurementId["']?\s*[:=]\s*["'](G-[A-Z0-9]{6,12})["']/g,
    ],
  },
  {
    proveedor: 'gtm',
    ids: [
      new RegExp(String.raw`(?:gtm\.js|ns\.html)\?${OTROS}id=(GTM-[A-Z0-9]{4,10})\b`, 'g'),
      /["']dataLayer["']\s*,\s*["'](GTM-[A-Z0-9]{4,10})["']/g,
      /(?:gtmId|containerId)["']?\s*[:=]\s*["'](GTM-[A-Z0-9]{4,10})["']/g,
    ],
  },
  {
    proveedor: 'google-ads',
    ids: [
      new RegExp(String.raw`gtag/js\?${OTROS}id=(AW-\d{7,12})\b`, 'g'),
      /gtag\(\s*["']config["']\s*,\s*["'](AW-\d{7,12})["']/g,
      /send_to["']?\s*:\s*["'](AW-\d{7,12})\b/g,
      /[?&]tid=(AW-\d{7,12})\b/g,
      /pagead\/(?:viewthrough)?conversion\/(\d{7,12})/g,
    ],
    normal: (id) => (id.startsWith('AW-') ? id : `AW-${id}`),
  },
  {
    proveedor: 'tiktok',
    ids: [
      /ttq\.load\(\s*["']([A-Z0-9]{16,24})["']/g,
      new RegExp(String.raw`analytics\.tiktok\.com/i18n/pixel/events\.js\?${OTROS}sdkid=([A-Z0-9]{16,24})`, 'g'),
    ],
    marca: /analytics\.tiktok\.com\/i18n\/pixel/,
  },
  {
    proveedor: 'taboola',
    // ⚠️ `libtrc/<editor>/loader.js` NO es el píxel: es el widget de quien PUBLICA notas de Taboola en
    // su sitio. El del anunciante es `unip`.
    ids: [
      /cdn\.taboola\.com\/libtrc\/unip\/(\d{5,10})\/tfa\.js/g,
      /trc\.taboola\.com\/(\d{5,10})\/log/g,
      /_tfa\.push\(\s*\{[^}]*?\bid\s*:\s*["']?(\d{5,10})/g,
    ],
    marca: /cdn\.taboola\.com\/libtrc\/unip\//,
  },
];

/** El relleno de un tutorial o de una plantilla sin configurar: `GTM-XXXXXX`, `000000000`, `123456789`. */
function esRelleno(id: string): boolean {
  const s = id.replace(/^(?:G|GTM|AW)-/, '');
  return /^X+$/i.test(s) || /^(\d)\1+$/.test(s) || '12345678901234567890'.startsWith(s);
}

const TOPE_IDS = 4;

function pixelesDe(texto: string): PixelLeido[] {
  const out: PixelLeido[] = [];
  for (const p of PATRONES) {
    const ids = new Set<string>();
    for (const re of p.ids) {
      for (const m of texto.matchAll(re)) {
        const id = p.normal ? p.normal(m[1]) : m[1];
        if (!esRelleno(id)) ids.add(id);
      }
    }
    if (p.proveedor === 'meta') for (const id of pixelesMetaDe(texto)) if (!esRelleno(id)) ids.add(id);
    if (ids.size || p.marca?.test(texto)) out.push({ proveedor: p.proveedor, ids: [...ids].slice(0, TOPE_IDS) });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// El checkout: a dónde manda a pagar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ SE EXIGE EL CAMINO, NO SÓLO EL DOMINIO. Un bundle puede nombrar `hotmart.com` en una lista de
 * integraciones y no vender nada; `pay.hotmart.com/A123` es un producto de verdad.
 *
 * Cubre los hosts de `RE_CHECKOUT` (lib/landing-conversion.ts), lo fija tests/spy-funnel.test.ts, pero
 * no la reusa: esa es la señal del Pixel de los clientes («fue a pagar») y sumarle plataformas le
 * cambiaría el diagnóstico a quien no pidió nada.
 */
const CHECKOUTS: Array<{ nombre: string; re: RegExp }> = [
  { nombre: 'Stripe', re: /(?:buy|checkout)\.stripe\.com\/[\w/-]+/ },
  { nombre: 'Hotmart', re: /(?:pay|go)\.hotmart\.com\/[\w-]+/ },
  { nombre: 'Mercado Pago', re: /(?:mpago\.(?:la|li)\/\w+|link\.mercadopago\.com(?:\.[a-z]{2})?\/[\w-]+|(?:www\.)?mercadopago\.com(?:\.[a-z]{2})?\/checkout[\w/-]*)/ },
  { nombre: 'Kiwify', re: /pay\.kiwify\.com(?:\.br)?\/[\w-]+/ },
  { nombre: 'Eduzz', re: /(?:sun|chk)\.eduzz\.com\/[\w-]+/ },
  { nombre: 'Monetizze', re: /(?:app\.)?monetizze\.com\.br\/(?:checkout|r)\/[\w-]+/ },
  { nombre: 'Braip', re: /ev\.braip\.com\/(?:checkout|ref)[\w/-]*/ },
  { nombre: 'Ticto', re: /payment\.ticto\.app\/[\w-]+/ },
  { nombre: 'Kirvano', re: /pay\.kirvano\.com\/[\w-]+/ },
  { nombre: 'Cakto', re: /pay\.cakto\.com\.br\/[\w-]+/ },
  { nombre: 'Hubla', re: /(?:pay\.)?hub\.la\/[\w-]+/ },
  { nombre: 'ClickBank', re: /[\w-]+\.(?:pay|hop)\.clickbank\.net\b[\w/-]*/ },
  { nombre: 'Gumroad', re: /(?:[\w-]+\.)?gumroad\.com\/l\/[\w-]+/ },
  { nombre: 'ThriveCart', re: /[\w-]+\.thrivecart\.com\/[\w-]+/ },
  { nombre: 'SamCart', re: /[\w-]+\.samcart\.com\/products\/[\w-]+/ },
  { nombre: 'Shopify', re: /(?:checkout\.shopify\.com\/[\w/-]+|[\w-]+\.myshopify\.com\/(?:cart|checkouts)\b[\w/-]*)/ },
  { nombre: 'PayPal', re: /(?:(?:www\.)?paypal\.com\/(?:checkoutnow|webapps\/shoppingcart|cgi-bin\/webscr)\b[\w/-]*|paypal\.me\/[\w-]+)/ },
  { nombre: 'Lemon Squeezy', re: /[\w-]+\.lemonsqueezy\.com\/(?:checkout|buy)\/[\w/-]+/ },
  { nombre: 'Whop', re: /whop\.com\/checkout\/[\w/-]+/ },
  { nombre: 'Creem', re: /creem\.io\/(?:checkout|payment)\/[\w/-]+/ },
  { nombre: 'Kajabi', re: /[\w-]+\.mykajabi\.com\/offers\/[\w-]+/ },
];

const TOPE_POR_CHECKOUT = 3;
const TOPE_CHECKOUTS = 8;

/**
 * Sin la consulta, a propósito: es donde viajan el cupón, el afiliado y, en un link armado a mano, el
 * correo de quien lo recibió. Lo que dice qué vende es el camino.
 */
function checkoutsDe(texto: string): CheckoutLeido[] {
  const out: CheckoutLeido[] = [];
  for (const { nombre, re } of CHECKOUTS) {
    // Con el `//` adelante: el host tiene que EMPEZAR la dirección, y `otro.com/pay.hotmart.com/x` no.
    const vistas = new Set<string>();
    for (const m of texto.matchAll(new RegExp(String.raw`(?:https?:)?//(${re.source})`, 'gi'))) {
      vistas.add(`https://${m[1].replace(/\/+$/, '')}`);
      if (vistas.size >= TOPE_POR_CHECKOUT) break;
    }
    for (const url of vistas) out.push({ nombre, url });
  }
  return out.slice(0, TOPE_CHECKOUTS);
}

// ─────────────────────────────────────────────────────────────────────────────
// El video
// ─────────────────────────────────────────────────────────────────────────────

/** Los que `HOSTS_VIDEO` no conoce. El embed trae su script ADENTRO de un `<script>`: `sinRuido` los borraría. */
const VIDEOS_DE_VENTA: Array<{ nombre: string; re: RegExp }> = [
  { nombre: 'VTurb', re: /converteai\.net|vturb\.com|vturb-smartplayer/i },
  { nombre: 'Vidalytics', re: /vidalytics\.com|vidalytics_embed_/i },
];

/** «un video de Panda» → «Panda». Los nombres salen del catálogo, para no tener otra copia. */
const nombreDeVideo = (frase: string): string =>
  frase === 'un video' ? 'Video propio' : frase.replace(/^un video de /, '');

function videosDe(texto: string, piezas: readonly string[]): string[] {
  const out = new Set<string>();
  for (const p of piezas) {
    const h = hostDePieza(p);
    if (h) out.add(nombreDeVideo(h.nombre));
  }
  for (const v of VIDEOS_DE_VENTA) if (v.re.test(texto)) out.add(v.nombre);
  return [...out];
}

/**
 * Las piezas de video que se ven en direcciones que el navegador de verdad cargó. Es la misma marca
 * que usa el analizador (`reBundle`, siempre un dominio), y acá no tiene su problema: lo cargado no es
 * una URL escrita en un bundle que quizá nadie ejecuta.
 */
export const piezasDeVideoEn = (direcciones: string): string[] =>
  HOSTS_VIDEO.filter((h) => h.reBundle?.test(direcciones)).map((h) => h.pieza);

// ─────────────────────────────────────────────────────────────────────────────
// La lectura
// ─────────────────────────────────────────────────────────────────────────────

/** Los comentarios no cargan nada, y `<pre>` / `<code>` son una página que ENSEÑA a instalar un píxel. */
const sinLoQueNoCorre = (html: string): string =>
  html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(pre|code|textarea)\b[\s\S]*?<\/\1>/gi, ' ');

/** Lo que `__NEXT_DATA__` y los bundles escriben escapado: `https:\/\/pay.hotmart.com\/X`, `&`. */
const sinEscapes = (t: string): string =>
  t.replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');

/** Alcanza y sobra: 8 chunks de una landing real suman 621 KB, y los patrones son lineales. */
const TOPE_TEXTO = 8_000_000;

export function leerFunnel(entrada: {
  /** El HTML que se bajó. Crudo, con sus `<script>`: ahí vive el `init`. */
  html: string;
  /** El JavaScript propio de la página. */
  bundle?: string;
  /** Las piezas que ya vio el analizador: de ahí salen los videos conocidos. */
  piezas?: readonly string[];
  ahora?: Date;
}): LecturaFunnel {
  const texto = sinEscapes(`${sinLoQueNoCorre(entrada.html)}\n${entrada.bundle ?? ''}`).slice(0, TOPE_TEXTO);
  return {
    pixeles: pixelesDe(texto),
    checkouts: checkoutsDe(texto),
    videos: videosDe(texto, entrada.piezas ?? []),
    leidoEn: (entrada.ahora ?? new Date()).toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La columna: leerla sin creerle, escribir un solo lugar y unir para dibujar
// ─────────────────────────────────────────────────────────────────────────────

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : []);

function lecturaDe(v: unknown): LecturaFunnel | null {
  if (!esObjeto(v)) return null;
  const pixeles = (Array.isArray(v.pixeles) ? v.pixeles : []).filter(esObjeto)
    .filter((p) => (PROVEEDORES_PIXEL as readonly unknown[]).includes(p.proveedor))
    .map((p) => ({ proveedor: p.proveedor as ProveedorPixel, ids: textos(p.ids) }));
  const checkouts = (Array.isArray(v.checkouts) ? v.checkouts : []).filter(esObjeto)
    // ⚠️ `https://` y nada más: esto termina en un `href`, y un `javascript:` en la columna sería ejecutable.
    .filter((c) => typeof c.nombre === 'string' && typeof c.url === 'string' && c.url.startsWith('https://'))
    .map((c) => ({ nombre: c.nombre as string, url: c.url as string }));
  return { pixeles, checkouts, videos: textos(v.videos), leidoEn: typeof v.leidoEn === 'string' ? v.leidoEn : '' };
}

/** La columna tal como está en la base. Una fila vieja, vacía o rara es `null`: «no se leyó todavía». */
export function funnelDeFila(v: unknown): Funnel | null {
  if (!esObjeto(v)) return null;
  const pagina = lecturaDe(v.pagina);
  const navegador = lecturaDe(v.navegador);
  return pagina || navegador ? { pagina, navegador } : null;
}

/** Escribe el lugar de un lector y deja el del otro como estaba. */
export const conLectura = (antes: Funnel | null, lector: keyof Funnel, lectura: LecturaFunnel): Funnel => ({
  pagina: antes?.pagina ?? null, navegador: antes?.navegador ?? null, [lector]: lectura,
});

/** Lo que se dibuja: lo que vio cualquiera de los dos. */
export const funnelUnido = (f: Funnel): Omit<LecturaFunnel, 'leidoEn'> => unirLecturas([f.pagina, f.navegador]);

/**
 * Lo mismo para todas las páginas guardadas de un competidor: su VSL y su página de venta no tienen por
 * qué cargar lo mismo. `null` = ninguna se leyó. `vioElNavegador` dice si lo de Tag Manager ya se pudo ver.
 */
export function funnelDeLasPaginas(filas: readonly unknown[]): (Omit<LecturaFunnel, 'leidoEn'> & { vioElNavegador: boolean }) | null {
  const funnels = filas.map(funnelDeFila).filter((f): f is Funnel => !!f);
  if (!funnels.length) return null;
  return { ...unirLecturas(funnels.flatMap((f) => [f.pagina, f.navegador])), vioElNavegador: funnels.some((f) => !!f.navegador) };
}

function unirLecturas(todas: ReadonlyArray<LecturaFunnel | null>): Omit<LecturaFunnel, 'leidoEn'> {
  const lecturas = todas.filter((x): x is LecturaFunnel => !!x);
  const ids = new Map<ProveedorPixel, Set<string>>();
  for (const l of lecturas) {
    for (const p of l.pixeles) {
      const s = ids.get(p.proveedor) ?? new Set<string>();
      p.ids.forEach((i) => s.add(i));
      ids.set(p.proveedor, s);
    }
  }
  const checkouts = new Map<string, CheckoutLeido>();
  for (const l of lecturas) for (const c of l.checkouts) if (!checkouts.has(c.url)) checkouts.set(c.url, c);
  return {
    pixeles: PROVEEDORES_PIXEL.filter((p) => ids.has(p)).map((proveedor) => ({ proveedor, ids: [...(ids.get(proveedor) as Set<string>)].slice(0, TOPE_IDS) })),
    checkouts: [...checkouts.values()].slice(0, TOPE_CHECKOUTS),
    videos: [...new Set(lecturas.flatMap((l) => l.videos))],
  };
}

/**
 * Los checkouts de a una plataforma: el primer enlace y cuántos más hay. ⚠️ SIN ESTO SE REPETÍAN: un sitio con tres
 * productos en Hotmart y tres en Stripe se dibujaba como «Stripe Stripe Stripe Hotmart Hotmart Hotmart» (julioiero.com,
 * en producción, 12/11/2026). Es la misma forma que los píxeles: el nombre y un «+2».
 */
export function checkoutsPorPlataforma(checkouts: readonly CheckoutLeido[]): Array<{ nombre: string; url: string; urls: string[] }> {
  const por = new Map<string, string[]>();
  for (const c of checkouts) por.set(c.nombre, [...(por.get(c.nombre) ?? []), c.url]);
  return [...por.entries()].map(([nombre, urls]) => ({ nombre, url: urls[0], urls }));
}

/** Para MaKo y la API: una línea por cosa, y nada si no hay nada. */
export function funnelEnPalabras(f: Funnel): string[] {
  const u = funnelUnido(f);
  const out: string[] = [];
  if (u.pixeles.length) out.push(`Píxeles: ${u.pixeles.map((p) => (p.ids.length ? `${NOMBRE_PIXEL[p.proveedor]} (${p.ids.join(', ')})` : NOMBRE_PIXEL[p.proveedor])).join(' · ')}`);
  if (u.checkouts.length) out.push(`Cobra con: ${[...new Set(u.checkouts.map((c) => c.nombre))].join(' · ')}`);
  if (u.videos.length) out.push(`Video: ${u.videos.join(' · ')}`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// «Ver sus anuncios»
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que se busca en la Biblioteca para encontrar sus anuncios, cuando no está su Página guardada (4/11/2026). Martín, mirando a Den
 * Borg: «En su biblioteca de anuncios la buscó como su página [su web], cuando debió buscarla por su Instagram, todo el mundo
 * publicita con su cuenta personal, o de última con el nombre del negocio». Su web era beacons.page: la búsqueda trajo 54 anuncios
 * de cualquiera que usa Beacons.
 *
 * El orden: su nombre (el de su perfil, sin lo que va después de « - »: así se llama la Página con la que pauta), o su @ de Instagram
 * sin la arroba, y recién al final el dominio de SU web. ⚠️ Una página de enlaces (beacons, linktree…) NUNCA: es de todos.
 */
export function busquedaDeSusAnuncios(c: { nombre?: string | null; instagram?: string | null; landing_url?: string | null }): string | null {
  const nombre = nombreParaBuscar(c.nombre ?? '').replace(/^@/, '').trim();
  if (nombre.length >= 3) return nombre;
  const ig = (c.instagram ?? '').trim().replace(/^@/, '');
  if (ig.length >= 3) return ig;
  if (c.landing_url && !esAgregador(c.landing_url)) {
    try { return new URL(c.landing_url).hostname.replace(/^www\./, '') || null; } catch { return null; }
  }
  return null;
}

/**
 * La Biblioteca de Anuncios abierta en este competidor. Es un enlace para que lo mire la persona, y
 * por eso no tiene ningún problema de términos: MaKo no lee nada.
 *
 * Con su Página guardada (`pagina_anuncios`, si es un id) va directo; sin ella busca su nombre o su @ (`busquedaDeSusAnuncios`).
 * `country=ALL` cuando no se sabe el país: con un país equivocado la lista sale vacía, y una lista vacía se lee como «no pauta».
 *
 * ⚠️ FRASE EXACTA Y ENTRE COMILLAS. Medido el 3/11/2026 con `q=acquisition.com`: con `keyword_unordered`
 * parte el dominio en dos palabras y da ~24.000 anuncios de cualquiera (el primero, de Naukri.com); con
 * `keyword_exact_phrase` y `"acquisition.com"`, los de Alex Hormozi. Sin esto el enlace abre, y miente.
 */
/**
 * Todas las formas de buscarlo en la Biblioteca, en orden y sin repetir (4/11/2026; el Cerebro, con Víctor Heras: por su nombre
 * dio 0, «probá por su @ o por el nombre de la Página… si sigue en 0, dilo»). Su nombre, su @ y el dominio de su web.
 */
export function busquedasDeSusAnuncios(c: { nombre?: string | null; instagram?: string | null; landing_url?: string | null }): string[] {
  const out: string[] = [];
  const sumar = (t: string | null | undefined) => {
    const v = (t ?? '').replace(/^@/, '').trim();
    if (v.length >= 3 && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  };
  sumar(nombreParaBuscar(c.nombre ?? ''));
  sumar(c.instagram);
  if (c.landing_url && !esAgregador(c.landing_url)) {
    try { sumar(new URL(c.landing_url).hostname.replace(/^www\./, '')); } catch { /* sin web, nada */ }
  }
  return out;
}

export function enlaceSusAnuncios(
  c: { pagina_anuncios?: string | null; landing_url?: string | null; nombre?: string | null; instagram?: string | null; pais?: string | null },
  /** Otra forma de buscarlo (`busquedasDeSusAnuncios`). Sin esto, la primera. Con su Página, no se usa. */
  termino?: string,
): string {
  const p = new URLSearchParams({ active_status: 'active', ad_type: 'all', country: (c.pais ?? '').toUpperCase() || 'ALL', media_type: 'all' });
  const pagina = (c.pagina_anuncios ?? '').trim();
  if (/^\d{5,25}$/.test(pagina)) {
    p.set('search_type', 'page');
    p.set('view_all_page_id', pagina);
  } else {
    p.set('search_type', 'keyword_exact_phrase');
    p.set('q', `"${termino?.trim() || busquedaDeSusAnuncios(c) || (c.nombre ?? '').trim()}"`);
  }
  return `https://www.facebook.com/ads/library/?${p.toString()}`;
}
