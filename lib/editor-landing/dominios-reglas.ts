// =============================================================================
// editor-landing/dominios-reglas — lo PURO del dominio propio de una landing (T7)
// =============================================================================
// Pedido de Martín (11/10/2026), punto 10 de la tanda 2: «falta la opción de publicar, ya sea con
// una URL creada por MaKo, como lo hace Gamma, o la opción de traer tu dominio». Diseño:
// docs/diseno-editor-landing.md → T7. Lo que habla con Vercel y con la base vive en
// lib/editor-landing/dominios.ts (server-only); acá queda lo que se puede probar sin red y lo que
// necesitan a la vez el proxy, la ruta, el server y la pantalla:
//
//   · normalizar y validar lo que la persona escribe (`normalizarDominio`, `motivoDominioInvalido`);
//   · qué hosts son de MaKo (`esHostDeMako`) y, para un host que NO lo es, qué contesta el proxy
//     (`decidirHost`); la dirección de hoy de una landing escrita con la de antes (`urlLandingVigente`);
//   · los registros DNS que hay que cargar, armados con lo que contesta Vercel (`registrosDns`), y el
//     veredicto de «verificado» (`estaVerificado`, `queFalta`);
//   · los tipos del pedido y de la respuesta de /api/landing-generator/dominio, y la query con que el
//     proxy le pasa a esa ruta QUÉ se pidió en el dominio (`consultaDelDominio` ↔ `pedidoDelDominio`);
//   · el dominio que SIRVE una landing, leído de su fila (`dominioQueSirve`, `dominioDeLectura`).
//
// SIN server-only, sin node:*, sin React: lo importan proxy.ts, la pantalla (DialogoPublicar) y el
// test. Un `import` de node:crypto acá rompería el bundle del navegador.
// =============================================================================

import { rutaValida, slugValido } from './doc';
import { ORIGEN_LANDINGS, RUTA_PAGAR_LANDING, SUBRUTAS_FIJAS, esHostDeLandings, origenDelMismoHost } from './origen-landings';

// ─────────────────────────────────────────────────────────────────────────────
// Los hosts de MaKo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los dominios DE LA APP que son o fueron de MaKo, con todos sus subdominios. El canónico sirve la
 * app; los demás, el cartel de mudanza de proxy.ts. ⚠️ UNA MUDANZA DE DOMINIO SUMA EL ANTERIOR ACÁ
 * (es un renglón más del checklist de lib/app-url.ts): un dominio viejo que falte se trataría como el
 * dominio de un cliente y contestaría 404 en vez de mandar a la gente al nuevo.
 *
 * ⚠️ hola-mako.site (las landings, tanda 4) NO va acá: es de MaKo pero no es la app. Lo que mira
 * esta lista —el HSTS de MaKo y las redirecciones de next.config.ts, el cartel de mudanza— no se
 * aplica en el dominio de las landings. «¿Es de MaKo?» (`esHostDeMako`) sí lo incluye.
 */
export const DOMINIOS_DE_MAKO: readonly string[] = Object.freeze(['hola-mako.com', 'makodigital.app']);

/** Los hosts de los deploys de Vercel (`<proyecto>.vercel.app`, `<deploy>-<equipo>.vercel.app`). */
const SUFIJO_VERCEL = 'vercel.app';

const esOSubdominioDe = (host: string, base: string): boolean => host === base || host.endsWith('.' + base);

/**
 * ¿Este host es de MaKo (la app: el canónico, uno viejo o un deploy de Vercel; o el de las landings,
 * hola-mako.site)? En positivo: lo demás es de un cliente.
 *
 * ⚠️ hola-mako.site TIENE que estar acá (tanda 4): `motivoDominioInvalido` y `dominioValido` miran
 * esto, y `puedeSoltarseDeVercel` exige `dominioValido`. Sin él, cualquier admin podía «conectar»
 * hola-mako.site a SU landing (Vercel lo da por verificado: ya está en el proyecto) — el mismo agujero
 * que el 409 idempotente de la tanda 2 con un dominio de MaKo fuera de la lista.
 */
export function esHostDeMako(host: string): boolean {
  return DOMINIOS_DE_MAKO.some((d) => esOSubdominioDe(host, d)) || esOSubdominioDe(host, SUFIJO_VERCEL) || esHostDeLandings(host);
}

/**
 * La dirección de HOY de una página de landing nuestra escrita con la de ANTES de la mudanza (tanda 4):
 * `https://<dominio de la app>/l/<slug>[/<ruta>]` → `https://hola-mako.site/<slug>[/<ruta>]`, con la
 * query. Cualquier otra URL vuelve TAL CUAL: la de hoy, el dominio de un cliente, localhost, un preview,
 * el HTML libre, el borrador, una con mayúsculas o con más segmentos.
 *
 * Es para COMPARAR, y se traducen las DOS puntas: una página que el negocio declaró antes de la mudanza
 * (el producto de una landing, la página de gracias: `landing.config`) o una visita medida antes tiene la
 * vieja, y lo que manda el Pixel desde el 14/10 tiene la nueva. Sin esto no coinciden y el lead cae en el
 * embudo del negocio, o la de gracias deja de pasarlo a Ganado, sin un solo error (revisión de la tanda 4).
 * No depende del entorno: en local y en los previews las landings viven en `<app>/l` y su host no es de
 * `DOMINIOS_DE_MAKO`, así que no se tocan. Espera una URL ya NORMALIZADA (sin barra final).
 */
export function urlLandingVigente(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  const host = hostDeCabecera(u.hostname).replace(/^www\./, '');
  if (u.port || !DOMINIOS_DE_MAKO.includes(host)) return url;
  const m = /^\/l\/([^/]+)(?:\/([^/]+))?$/.exec(u.pathname);
  if (!m || !slugValido(m[1]) || !rutaValida(m[2] ?? '')) return url;
  return `${ORIGEN_LANDINGS}/${m[1]}${m[2] ? `/${m[2]}` : ''}${u.search}${u.hash}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalizar y validar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un nombre de dominio: etiquetas de letras, dígitos y guiones (sin guion en las puntas, hasta 63),
 * al menos un punto, y un TLD de letras (o IDN en punycode). El mismo patrón que el CHECK de la
 * columna (supabase/migrations/0263_landing_dominios.sql): si cambia uno, cambia el otro.
 */
export const DOMINIO_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/**
 * Lo que la persona escribió, como un host: sin protocolo, ruta, puerto ni punto final, en
 * minúsculas y con los acentos en punycode (lo hace `URL`, igual en el navegador y en Node).
 * null si no se puede leer como un host. NO saca el `www.`: `www.tunegocio.com` es un subdominio
 * legítimo y el que se carga en el DNS es ése.
 */
export function normalizarDominio(entrada: string | null | undefined): string | null {
  let s = String(entrada ?? '').trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = 'http://' + s;
  let host: string;
  try { host = new URL(s).hostname; } catch { return null; }
  host = host.replace(/\.+$/, '');
  return host || null;
}

/** El host de una cabecera `Host`/`x-…`: minúsculas, sin puerto ni punto final. '' si no viene. */
export function hostDeCabecera(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase().split(':')[0].replace(/\.+$/, '');
}

/**
 * Por qué ese dominio NO se puede conectar, o null si se puede. El texto es el que se dibuja
 * (corto). Una IP no es un dominio: el patrón exige un TLD de letras.
 */
export function motivoDominioInvalido(d: string | null): string | null {
  if (!d) return 'Escribe tu dominio';
  if (!DOMINIO_RE.test(d)) return 'No es un dominio válido';
  if (esHostDeMako(d)) return 'Ese dominio es de MaKo';
  return null;
}

/** ¿Se puede conectar (y soltar de Vercel)? En POSITIVO: un dominio bien formado que no es de MaKo. */
export function dominioValido(d: string | null | undefined): d is string {
  return typeof d === 'string' && motivoDominioInvalido(d) === null;
}

/**
 * ¿Se le puede pedir a Vercel que SUELTE este dominio del proyecto? Es lo único destructivo del
 * dominio propio: quitar `hola-mako.com` (o un deploy `*.vercel.app`) del proyecto apaga MaKo
 * entera. En POSITIVO (AGENTS.md, «Un guard sobre algo destructivo se escribe en POSITIVO»): un
 * dominio de cliente bien formado Y que MaKo AGREGÓ al proyecto (`landing_docs.dominio_agregado_por_mako`,
 * mig 0263: se pone sólo cuando la API de Vercel contestó 2xx al POST de ESTA landing, o se hereda del
 * reclamo vencido que ésta reemplazó). Lo mira el ÚNICO camino que le pide a Vercel un DELETE
 * (`quitarDeVercel`, lib/editor-landing/dominios.ts), y ése sólo recibe lo que guarda la FILA de la
 * landing, nunca lo que manda la pantalla.
 *
 * ⚠️ Revisión de la tanda 2 (12/10/2026, MEDIA): antes alcanzaba con «válido y que no esté en
 * `DOMINIOS_DE_MAKO`», y un 409 de Vercel («ya está en el proyecto») se daba por bueno. El día que el
 * proyecto sumara un dominio de MaKo que no está en la lista (una mudanza, uno de marketing),
 * cualquier admin lo «conectaba» y al «quitarlo» lo sacaba de producción. Con la marca, lo que ya
 * estaba en el proyecto antes de esta landing no se suelta nunca.
 */
export function puedeSoltarseDeVercel(guardado: string | null | undefined, agregadoPorMako: boolean | null | undefined): guardado is string {
  return agregadoPorMako === true && dominioValido(guardado);
}

// ─────────────────────────────────────────────────────────────────────────────
// El reclamo PENDIENTE: vence, tiene tope, y el dueño del DNS se lo puede quitar a otro
// ─────────────────────────────────────────────────────────────────────────────
// Revisión de la tanda 2 (12/10/2026, MEDIA): el índice único de la 0263 vale también para los
// pendientes, así que cualquier admin con la capa podía escribir `clientereal.com` sin probar nada y
// dejarlo RESERVADO para siempre: el dueño real recibía «ya está en otra landing» sin salida. Ahora un
// pendiente vence (`PLAZO_PENDIENTE_MS`), quien carga SU TXT `_mako` se lo puede quitar a un pendiente
// ajeno aunque no haya vencido, y un negocio no puede tener más de `TOPE_PENDIENTES` sin verificar.
// Uno VERIFICADO no se le quita a nadie: se está sirviendo.

/** Cuánto reserva un dominio un reclamo sin verificar: pasado esto, otra landing se lo puede quedar. */
export const PLAZO_PENDIENTE_MS = 72 * 3_600_000;
/** Cuántos dominios sin verificar (y sin vencer) puede tener un negocio a la vez. */
export const TOPE_PENDIENTES = 5;

/** ¿Venció este reclamo? Sin fecha legible, NO (lo conservador: el que tenga el DNS igual lo puede quitar con su TXT). */
export function pendienteVencido(reclamadoAt: string | null | undefined, ahora: number): boolean {
  const t = typeof reclamadoAt === 'string' ? Date.parse(reclamadoAt) : NaN;
  return Number.isFinite(t) && ahora - t >= PLAZO_PENDIENTE_MS;
}

/**
 * ¿Se le puede quitar el dominio a la landing que lo tiene, y por qué? En positivo: sólo a un
 * PENDIENTE, y sólo si venció o si quien lo pide ya cargó el TXT `_mako` con el valor de SU landing
 * (`txtPropio === true`: un `null` —el DNS no contestó— no prueba nada). null = no se toca.
 */
export function motivoParaQuitarReclamo(
  ajeno: { estado: string | null; reclamadoAt: string | null },
  ahora: number,
  txtPropio: boolean | null,
): 'vencido' | 'txt' | null {
  if (ajeno.estado !== 'pendiente') return null;
  if (pendienteVencido(ajeno.reclamadoAt, ahora)) return 'vencido';
  return txtPropio === true ? 'txt' : null;
}

/** Los pendientes de un negocio que todavía RESERVAN algo (los vencidos ya no cuentan para el tope). */
export function pendientesVigentes(filas: readonly { dominio_estado: string | null; dominio_reclamado_at: string | null }[], ahora: number): number {
  return filas.filter((f) => f.dominio_estado === 'pendiente' && !pendienteVencido(f.dominio_reclamado_at, ahora)).length;
}

/**
 * Lo que lee quien quiere un dominio que otra landing tiene. Si es un pendiente que todavía no venció,
 * le dice cómo probar que es suyo: el TXT de SU landing (el valor no se adivina: es un HMAC). Uno
 * verificado no tiene salida desde acá, y el texto no la promete.
 */
export function textoDominioOcupado(dominio: string, estadoAjeno: string | null, valorTxtMako: string): string {
  if (estadoAjeno !== 'pendiente') return 'Ese dominio ya está en otra landing.';
  const nombre = etiquetaDns(`${PREFIJO_TXT_MAKO}.${dominio}`, apexDe(dominio));
  return `Otra landing lo tiene reservado sin verificar. Si es tuyo, carga en tu DNS un registro TXT «${nombre}» con el valor «${valorTxtMako}» y vuelve a añadirlo.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Los hosts de MaKo, como los lee next.config.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El patrón de los hosts de MaKo para un `has: [{ type: 'host', value }]` de next.config.ts (Next lo
 * compila como `^(…)$` contra el host sin puerto y en minúsculas): los `DOMINIOS_DE_MAKO` y sus
 * subdominios. Lo usa la cabecera HSTS (revisión de la tanda 2, MEDIA): con `includeSubDomains` y dos
 * años, en el dominio propio de un cliente le forzaba HTTPS a TODOS sus subdominios. En positivo: sólo
 * los hosts de MaKo la llevan (un deploy `*.vercel.app` ya viene en la lista precargada de HSTS).
 * Grupos sin captura: un grupo con captura le pondría `host` a los parámetros de la regla.
 */
export const PATRON_HOSTS_DE_MAKO = `(?:[a-z0-9-]+\\.)*(?:${DOMINIOS_DE_MAKO.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;

/**
 * El patrón de los hosts donde corre la APP, para las redirecciones y reescrituras de next.config.ts
 * (tanda 4): los de MaKo (`PATRON_HOSTS_DE_MAKO`), los deploys `*.vercel.app` (los previews), y
 * `localhost` y una IPv4 (el dev local, también desde el teléfono por la red de la casa). Las
 * redirecciones corren ANTES del proxy y no miran el host: en hola-mako.site, `/todo` (un slug válido)
 * se iba a /plan antes de que el proxy lo leyera como la landing `todo`; en el dominio de un cliente,
 * `/extension` llevaba a la ficha de la extensión de MaKo.
 *
 * ⚠️ NO es el del HSTS: `localhost` con HSTS de dos años le fuerza HTTPS a TODO puerto de localhost en
 * el navegador del que desarrolla (si alguna vez lo sirve por https). El HSTS sigue con
 * `PATRON_HOSTS_DE_MAKO`. Ni hola-mako.site ni un dominio de cliente entran en ninguno de los dos.
 * Un host de desarrollo que no está acá (un túnel tipo ngrok) se queda sin esas redirecciones: es un
 * 404 en /leads, no una pantalla de MaKo en el dominio de otro.
 */
export const PATRON_HOSTS_DE_LA_APP = `(?:${PATRON_HOSTS_DE_MAKO}|(?:[a-z0-9-]+\\.)*vercel\\.app|localhost|\\d{1,3}(?:\\.\\d{1,3}){3})`;

// ─────────────────────────────────────────────────────────────────────────────
// La decisión del proxy para un host que no es de MaKo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * app/api/landing-generator/dominio: el POST es la API de la pestaña «Dominios» (con sesión de
 * admin) y el GET es el destino interno al que el proxy reescribe las páginas de un dominio propio.
 */
export const RUTA_DOMINIO = '/api/landing-generator/dominio';
/**
 * La cabecera con la que el proxy le dice a esa ruta qué dominio se pidió. La pone SÓLO el proxy, en
 * la reescritura, pisando la que traiga el pedido; y `seguir` (proxy.ts) la BORRA de todo lo demás,
 * igual que el header del workspace: nadie la puede mandar a mano.
 */
export const HEADER_DOMINIO = 'x-mako-dominio-landing';
/** Lo que la página publicada necesita del dominio además de sus páginas: el HTML libre (T6). */
export const PREFIJO_PASA = '/l/html';

/**
 * La sub-ruta fija del paso de pago (`/pagar/<productoId>`, tanda 4). Es la clave de `SUBRUTAS_FIJAS`
 * (origen-landings.ts) y `SEGMENTO_PAGO` de pago-landing.ts, que no se importa acá a propósito (trae la
 * moneda y las pasarelas, y a este módulo lo cargan proxy.ts y next.config.ts): el test ata los tres.
 */
export const SUBRUTA_PAGO = 'pagar';

export type DecisionHost =
  /** Un host de MaKo (o ninguno): sigue el flujo de siempre (la app, o el cartel de mudanza). */
  | { tipo: 'app' }
  /** Una página del sitio: se reescribe a `RUTA_DOMINIO?ruta=<ruta>` ('' = la de inicio). */
  | { tipo: 'sitio'; ruta: string }
  /** El paso de pago (`/pagar/<producto>`): se reescribe a `RUTA_DOMINIO?ruta=pagar&bloque=<producto>`. */
  | { tipo: 'pago'; producto: string }
  /** Algo que la página necesita (el HTML libre, el POST del paso de pago): pasa tal cual. */
  | { tipo: 'pasar' }
  /** El POST del paso de pago con un `Origin` de OTRO sitio: 403. */
  | { tipo: 'prohibido' }
  /** Una ruta con mayúsculas que en minúsculas es válida: 308 a `destino`, en el MISMO dominio. */
  | { tipo: 'minusculas'; destino: string }
  /** Todo lo demás de la app, `/api` incluida: 404. */
  | { tipo: 'no-existe' }
  /** Un método que una página no acepta: 405. */
  | { tipo: 'metodo' };

const LEER = new Set(['GET', 'HEAD']);

/**
 * ¿Qué host es? (tanda 4) La primera pregunta del proxy, en positivo:
 *   · 'landings' — hola-mako.site (y sus subdominios): SÓLO las landings publicadas, en cualquier
 *     entorno; nunca la app, nunca la cookie de sesión (`decidirLandings`, origen-landings.ts);
 *   · 'propio'   — un dominio bien formado que no es de MaKo: el de la landing de un cliente
 *     (`decidirHost`, sólo en producción);
 *   · 'app'      — lo demás: los hosts de MaKo, los previews, localhost, una IP o un host vacío.
 */
export type TipoHost = 'app' | 'landings' | 'propio';
export function tipoDeHost(hostCrudo: string | null | undefined): TipoHost {
  const host = hostDeCabecera(hostCrudo);
  if (esHostDeLandings(host)) return 'landings';
  // Un host que ni parece un dominio (vacío, una IP) sigue el flujo de siempre: el cartel de mudanza.
  if (!host || !DOMINIO_RE.test(host) || esHostDeMako(host)) return 'app';
  return 'propio';
}

/**
 * Qué contesta el proxy según el host. En un dominio de cliente se sirve SÓLO su landing: la raíz
 * y una página por segmento (`/gracias`), más el HTML libre. Nada de la app ni de `/api` —ni
 * siquiera las exentas del cartel de mudanza (cron, webhooks, track): el Pixel de la página habla
 * con hola-mako.com y los crons y webhooks llegan por los hosts de MaKo—.
 *
 * Y EL PASO DE PAGO, como en hola-mako.site (Paquete 2 de la tanda 6, lo que la tanda 4 dejó sin
 * hacer: «El paso de pago no se sirve EN el dominio propio»). Antes el botón de una landing con
 * dominio sacaba al comprador a hola-mako.site justo antes de pagar. Ahora `/pagar/<producto>` (con la
 * forma de `SUBRUTAS_FIJAS.pagar`) es 'pago', y el POST de su formulario —que postea RELATIVO, o sea
 * a ESTE host— pasa con el MISMO contrato que en hola-mako.site (`decidirLandings`): sólo POST, sólo
 * la ruta exacta `RUTA_PAGAR_LANDING`, y sólo con un `Origin` ausente o igual a `https://<este host>`
 * (403 si no). La ruta lo vuelve a mirar en positivo (`origenDelPago` da 'dominio' y `esDelDominio`
 * confirma que el dominio es el de ESA landing), con sus topes. `origin` es la cabecera del pedido:
 * sin ella, el POST se decide como si no la trajera (la ruta, sin Origin, contesta 403).
 * ⚠️ Una sub-ruta fija NUEVA de `SUBRUTAS_FIJAS` no entra sola acá: la ruta del dominio sabe servir
 * sólo el paso de pago (en el dominio quedaría 404, que es lo seguro).
 *
 * Que el dominio esté VERIFICADO y la landing publicada no se decide acá (necesita la base): lo
 * decide la ruta interna, que contesta 404 si no. Acá sólo se mira la forma del pedido.
 */
export function decidirHost(hostCrudo: string | null | undefined, pathname: string, metodo: string, origin?: string | null): DecisionHost {
  // El de las landings tampoco es de un cliente: lo atiende `decidirLandings` antes de llegar acá.
  if (tipoDeHost(hostCrudo) !== 'propio') return { tipo: 'app' };

  const m = metodo.toUpperCase();
  if (pathname === PREFIJO_PASA || pathname.startsWith(PREFIJO_PASA + '/')) return LEER.has(m) ? { tipo: 'pasar' } : { tipo: 'metodo' };
  if (pathname === RUTA_PAGAR_LANDING && m === 'POST') {
    return origenDelMismoHost(origin, hostDeCabecera(hostCrudo)) ? { tipo: 'pasar' } : { tipo: 'prohibido' };
  }
  if (pathname === '/api' || pathname.startsWith('/api/')) return { tipo: 'no-existe' };
  if (!LEER.has(m)) return { tipo: 'metodo' };
  if (pathname === '/' || pathname === '') return { tipo: 'sitio', ruta: '' };

  const seg = pathname.slice(1);
  const partes = seg.split('/');
  if (partes.length === 2 && partes[0] === SUBRUTA_PAGO) {
    return SUBRUTAS_FIJAS[SUBRUTA_PAGO].test(partes[1]) ? { tipo: 'pago', producto: partes[1] } : { tipo: 'no-existe' };
  }
  if (partes.length > 1) return { tipo: 'no-existe' };
  if (rutaValida(seg)) return { tipo: 'sitio', ruta: seg };
  const min = seg.toLowerCase();
  if (min !== seg && rutaValida(min)) return { tipo: 'minusculas', destino: '/' + min };
  return { tipo: 'no-existe' };
}

/** Lo que el proxy reescribe a `RUTA_DOMINIO`: una página del sitio o el paso de pago. */
export type PedidoDelDominio = Extract<DecisionHost, { tipo: 'sitio' } | { tipo: 'pago' }>;

/**
 * La query de la reescritura a `RUTA_DOMINIO` (con su `?`). Una página es `?ruta=<ruta>`; el paso de
 * pago, `?ruta=pagar&bloque=<producto>` (lo que sería `/<slug>/pagar/<bloque>` en hola-mako.site). La
 * arma SÓLO el proxy, desde cero: la query del visitante no viaja, así que un `?bloque=` escrito a mano
 * en `/pagar` (una PÁGINA que se llama así) nunca llega a la ruta. La lee `pedidoDelDominio`.
 */
export function consultaDelDominio(p: PedidoDelDominio): string {
  const q = new URLSearchParams();
  if (p.tipo === 'pago') {
    q.set('ruta', SUBRUTA_PAGO);
    q.set('bloque', p.producto);
  } else {
    q.set('ruta', p.ruta);
  }
  return `?${q.toString()}`;
}

/**
 * Lo que la ruta del dominio lee de la query que armó el proxy (`consultaDelDominio`): sin `bloque`,
 * una página (la ruta la valida `responderPublico`); con `bloque`, el paso de pago, sólo con la forma
 * de `SUBRUTAS_FIJAS.pagar`. null = nada que el proxy haya podido mandar: 404 sin tocar la base.
 */
export function pedidoDelDominio(q: URLSearchParams): PedidoDelDominio | null {
  const ruta = q.get('ruta') ?? '';
  const bloque = q.get('bloque');
  if (bloque === null) return { tipo: 'sitio', ruta };
  return ruta === SUBRUTA_PAGO && SUBRUTAS_FIJAS[SUBRUTA_PAGO].test(bloque) ? { tipo: 'pago', producto: bloque } : null;
}

/**
 * El 404 que contesta el PROXY en un dominio de cliente (lo que no es una página del sitio). Mismo
 * texto que `TEXTO_NO_EXISTE` de lib/editor-landing/pagina-publica.ts, que no se importa acá a
 * propósito: ese módulo trae el Pixel y la base, y el proxy los cargaría en cada pedido.
 */
export function paginaNoExisteDominio(): string {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex"><title>404</title>'
    + '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#252527;background:#fff}</style>'
    + '</head><body><p>Parece que esta página no existe (404).</p></body></html>';
}

// ─────────────────────────────────────────────────────────────────────────────
// Los registros DNS y el veredicto
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que Vercel recomienda cuando no contesta otra cosa (sus valores genéricos, documentados). */
export const IPV4_VERCEL = '76.76.21.21';
export const CNAME_VERCEL = 'cname.vercel-dns.com';
/** El registro TXT con el que la landing PRUEBA que quien la conectó controla el DNS de ese dominio. */
export const PREFIJO_TXT_MAKO = '_mako';
export const CLAVE_TXT_MAKO = 'mako-verificacion=';

export type TipoRegistro = 'A' | 'CNAME' | 'TXT';
export type RegistroDns = {
  tipo: TipoRegistro;
  /** El «Nombre» / «Host» como lo pide el panel del DNS: `@` para la raíz, o la etiqueta relativa a ella. */
  nombre: string;
  /** El «Valor» / «Datos». */
  valor: string;
  /** true = ya está; false = falta; null = no se pudo leer. */
  listo: boolean | null;
  /** Para qué sirve (el `title` de la fila). */
  para: 'apuntar' | 'vercel' | 'mako';
};

/**
 * El dominio raíz (el que se compró) de un host, para cuando Vercel no lo dice. Vercel SÍ lo dice
 * (`apexName`) en cuanto el dominio está en el proyecto, así que esto es sólo el respaldo: las dos
 * últimas etiquetas, o tres si la segunda es un sufijo de segundo nivel conocido (`.com.mx`).
 */
const SEGUNDO_NIVEL = new Set(['com', 'net', 'org', 'gob', 'gov', 'edu', 'co', 'ac', 'nom', 'mil', 'int']);
export function apexDe(host: string): string {
  const p = host.split('.');
  if (p.length <= 2) return host;
  const n = p[p.length - 2];
  const tld = p[p.length - 1];
  return SEGUNDO_NIVEL.has(n) && tld.length === 2 ? p.slice(-3).join('.') : p.slice(-2).join('.');
}

/** El «Nombre» de un registro: `@` si es la raíz, o lo que sobra antes de `.apex`. */
export function etiquetaDns(nombreCompleto: string, apex: string): string {
  if (nombreCompleto === apex) return '@';
  return nombreCompleto.endsWith('.' + apex) ? nombreCompleto.slice(0, -(apex.length + 1)) : nombreCompleto;
}

const sinPuntoFinal = (s: string) => s.replace(/\.+$/, '');

export type EntradaRegistros = {
  dominio: string;
  /** `apexName` de Vercel; si no viene, `apexDe(dominio)`. */
  apex?: string | null;
  /** `recommendedIPv4[rank 1].value` de /v6/domains/{d}/config (varias IP). */
  ipv4?: readonly string[] | null;
  /** `recommendedCNAME[rank 1].value`. */
  cname?: string | null;
  /** `verification[]` del dominio del proyecto, si Vercel pide probar que es tuyo (TXT `_vercel`). */
  verificacionVercel?: readonly { tipo: string; dominio: string; valor: string }[] | null;
  /** El valor del TXT de MaKo para ESTA landing (lo calcula el server). */
  valorTxtMako: string;
  apunta: boolean | null;
  vercel: boolean | null;
  mako: boolean | null;
};

/**
 * Los registros a cargar, en el orden en que conviene cargarlos. Para la raíz, un `A` por cada IP;
 * para un subdominio, un `CNAME` (un CNAME en la raíz no lo acepta ningún DNS). Después el TXT de
 * Vercel si lo pide, y siempre el de MaKo.
 */
export function registrosDns(e: EntradaRegistros): RegistroDns[] {
  const apex = e.apex && esOSubdominioDe(e.dominio, e.apex) ? e.apex : apexDe(e.dominio);
  const out: RegistroDns[] = [];
  if (e.dominio === apex) {
    const ips = (e.ipv4 ?? []).map((v) => v.trim()).filter(Boolean);
    for (const ip of ips.length ? ips : [IPV4_VERCEL]) out.push({ tipo: 'A', nombre: '@', valor: ip, listo: e.apunta, para: 'apuntar' });
  } else {
    out.push({ tipo: 'CNAME', nombre: etiquetaDns(e.dominio, apex), valor: sinPuntoFinal(e.cname?.trim() || CNAME_VERCEL), listo: e.apunta, para: 'apuntar' });
  }
  for (const v of e.verificacionVercel ?? []) {
    if (String(v.tipo).toUpperCase() !== 'TXT' || !v.valor) continue;
    out.push({ tipo: 'TXT', nombre: etiquetaDns(sinPuntoFinal(v.dominio), apex), valor: v.valor, listo: e.vercel, para: 'vercel' });
  }
  out.push({ tipo: 'TXT', nombre: etiquetaDns(`${PREFIJO_TXT_MAKO}.${e.dominio}`, apex), valor: e.valorTxtMako, listo: e.mako, para: 'mako' });
  return out;
}

export type Comprobacion = {
  /** El dominio está en el proyecto de Vercel. */
  enVercel: boolean;
  /** Vercel lo da por verificado (`verified`). */
  vercel: boolean | null;
  /** El DNS ya apunta a Vercel (`misconfigured === false`). */
  apunta: boolean | null;
  /** El TXT de MaKo tiene el valor de ESTA landing. */
  mako: boolean | null;
};

/**
 * ¿Se puede servir la landing en ese dominio? Las cuatro, en positivo y con `true` estricto: un
 * `null` (no se pudo leer) no verifica nada. El TXT de MaKo es lo que impide que OTRA cuenta de MaKo
 * se quede con un dominio cuyo DNS ya apunta a Vercel (el de un cliente que lo soltó y dejó el
 * registro): sin él, Vercel lo verifica para cualquiera que lo agregue al proyecto, que es UNO solo
 * para todas las landings.
 */
export function estaVerificado(c: Comprobacion): boolean {
  return c.enVercel && c.vercel === true && c.apunta === true && c.mako === true;
}

/**
 * Lo que falta, en una frase corta, o null si anda. `verificado` = lo que dice la fila: una vez
 * verificado no se vuelve atrás por una lectura (un DNS que parpadea apagaría un sitio que anda);
 * sólo se avisa.
 *
 * `vencido` = el reclamo PENDIENTE pasó `PLAZO_PENDIENTE_MS` (`pendienteVencido` con la fecha de la
 * fila). Pendiente chico de la tanda 2: la pestaña «Dominios» no lo avisaba, y desde ese momento otra
 * landing se lo puede quedar sin probar nada. Va ANTES que los registros porque es lo único que se
 * pierde sin que la persona haga nada: mientras nadie lo tome, cargar el DNS todavía lo verifica
 * (`comprobar` no mira la fecha). Quitarlo y añadirlo lo vuelve a reservar 72 h (`reclamar` pone la
 * fecha; «Conectar de nuevo» con el mismo dominio NO la renueva). Uno verificado no vence nunca.
 */
export function queFalta(c: Comprobacion, verificado: boolean, vencido = false): string | null {
  if (!c.enVercel) return 'Hay que conectarlo de nuevo';
  if (verificado) return c.apunta === false ? 'El DNS ya no apunta a MaKo' : null;
  if (vencido) return 'Reserva vencida: conéctalo de nuevo';
  if (c.vercel === false || c.apunta === false || c.mako === false) return 'Faltan registros DNS';
  if (c.vercel === null || c.apunta === null || c.mako === null) return 'No pude leer el DNS';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// El contrato de /api/landing-generator/dominio
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoDominioPublico = 'pendiente' | 'verificado';

export type EstadoDominio = {
  dominio: string;
  estado: EstadoDominioPublico;
  verificadoAt: string | null;
  enVercel: boolean;
  registros: RegistroDns[];
  falta: string | null;
};

export type PedidoDominio =
  | { accion: 'estado'; id: number; verificar?: boolean }
  | { accion: 'conectar'; id: number; dominio: string }
  | { accion: 'quitar'; id: number };

/** `dominio: null` = la landing no tiene dominio propio. */
export type RespuestaDominio = { ok: true; dominio: EstadoDominio | null };

/** La URL de la landing en su dominio (`https://<dominio>`). */
export const urlDeDominio = (d: string): string => `https://${d}`;

/**
 * Los enlaces entre páginas de una foto publicada apuntan a la URL de MaKo
 * (`https://hola-mako.site/<slug>[/<ruta>]` desde la tanda 4; `https://hola-mako.com/l/<slug>…` en una
 * foto de antes: el render los resuelve con `urlBase` al publicar), así que servida en el dominio
 * propio el menú del sitio y los botones entre páginas sacarían al visitante del dominio. La ruta lo
 * llama una vez por cada base conocida (`basesLandings`, lib/app-url.ts).
 * Se reescriben AL SERVIR, no al publicar (integración de la tanda 2), por tres cosas:
 * vale también para lo publicado ANTES de verificar el dominio; no hace falta «volver a publicar al
 * verificar», que publicaría el BORRADOR guardado (publicar promueve lo guardado, AGENTS.md); y quitar
 * el dominio no deja una foto con enlaces a un dominio que ya no sirve nada.
 *
 * Sólo la base EXACTA seguida de un fin de URL (`/`, comillas, `?`, `#`, `&`, `<`, espacio o el final):
 * la base de `…/abc` no toca un enlace a `…/abcd`, que es OTRA landing.
 *
 * EL BOTÓN DE PAGO TAMBIÉN (`<base>/pagar/<productoId>` → `https://<dominio>/pagar/<id>`). Desde la
 * revisión de la tanda 4 se dejaba en la base de MaKo con un `(?!/pagar/)`, porque `decidirHost`
 * contestaba 404 a toda ruta de dos segmentos y el comprador veía «Parece que esta página no existe»
 * (en hola-mako.com/l/<slug> el MISMO botón andaba: el dueño, probándolo, lo veía funcionar). Paquete 2
 * de la tanda 6: el dominio ya sirve el paso (`decidirHost` → 'pago', la ruta del dominio con su slug) y
 * deja pasar su POST, así que el comprador no sale del dominio hasta el checkout. ⚠️ Antes de volver a
 * exceptuar algo acá, lo que el proxy contesta a CADA enlace reescrito (el test lo recorre).
 */
export function conEnlacesDelDominio(html: string, baseMako: string, baseDominio: string): string {
  if (!html || !baseMako || !baseDominio || baseMako === baseDominio) return html;
  const escapada = baseMako.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`${escapada}(?=[/"'?#&<\\s]|$)`, 'g'), () => baseDominio);
}

/**
 * El dominio que SIRVE una landing según su fila: sólo el VERIFICADO (uno pendiente todavía no sirve
 * nada, y otra cuenta se lo puede quitar) y bien formado. Lo usan la lista del Panel (`aResumen`) y lo
 * que se dice antes de despublicar (`antesDeDespublicar`, server.ts).
 */
export function dominioQueSirve(f: { dominio?: unknown; dominio_estado?: unknown } | null | undefined): string | null {
  return f && f.dominio_estado === 'verificado' && typeof f.dominio === 'string' && dominioValido(f.dominio) ? f.dominio : null;
}

/**
 * El dominio que sirve una landing, de una lectura APARTE de `dominio, dominio_estado` (Paquete 2 de la
 * tanda 6, el resumen de despublicar). Tolera SÓLO la columna que falta (42703: sin la mig 0263 no hay
 * dominio que nombrar), como `borrar`; cualquier otro error TIRA: «no pude leer» no es «no tiene
 * dominio», y callarlo es volver a esconder que el dominio también deja de mostrarla.
 */
export function dominioDeLectura(data: unknown, error: { code?: string; message?: string } | null | undefined): string | null {
  if (error) {
    if (error.code === '42703') return null;
    throw new Error(error.message || 'no pude leer el dominio de la landing');
  }
  return dominioQueSirve(data as { dominio?: unknown; dominio_estado?: unknown } | null);
}

/** El slug que devuelve la base para un dominio, si es uno que se puede servir. */
export const slugServible = (s: unknown): s is string => typeof s === 'string' && slugValido(s);
