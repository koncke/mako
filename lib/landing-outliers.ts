// =============================================================================
// Los outliers de landings: la portada de Web Generator (`/web-generator`), el contrato (PURO; 11/11/2026)
// =============================================================================
// Martín, 11/11/2026 (por el Cerebro): «generar lo mismo que venimos haciendo con el resto de tabs, de outliers, para sacar outliers
// de páginas que estén buenas… empezar por la competencia… por las páginas de todos los gurús… hacer un relevo de páginas que nos
// podrían llegar a interesar, y ponerlas ahí como outlier». COPIADO de Video (lib/video-outliers.ts), que copia a Image: la
// portada son los ejemplos y «Crear desde cero» lleva al Panel (`?panel=1`).
//
// DE DÓNDE SALEN (lib/landing-outliers-servidor.ts):
//   · `spy`: las landings de los competidores que el negocio sigue en Competitors Spy (`spy_competidores.landing_url`), primero;
//   · `relevo`: las que tienen su captura larga (./landing-outliers-datos.ts: gurús, la competencia de cada función de MaKo y la
//     de los negocios en Spy). Una landing de Spy entra con su captura larga, o no entra.
//
// LAS REGLAS (las mismas de Video):
//   · «No pude leer» no es «no hay»: una fuente que falla vuelve `{ ok: false, motivo }` y la portada lo dice.
//   · El dato de un tercero no se republica: la tarjeta lleva el link al original. La imagen es la captura que sacamos nosotros
//     de la página pública.
//   · «Replicar» abre Replicar con esa página arrancando sola (`/web-generator?replicar=<url>`, panel-reglas.ts).
//
// Puro (sin `server-only`) y LIVIANO: lo importa la pantalla del navegador. El manifiesto de capturas va en ./landing-outliers-datos.ts.
// =============================================================================

export type TipoLanding = 'vsl' | 'webinar' | 'aplicacion' | 'lead-magnet' | 'venta' | 'evento' | 'libro' | 'sitio';

export const NOMBRE_TIPO: Record<TipoLanding, string> = {
  vsl: 'VSL', webinar: 'Webinar', aplicacion: 'Agendar llamada', 'lead-magnet': 'Lead magnet', venta: 'Página de venta',
  evento: 'Evento', libro: 'Libro', sitio: 'Sitio',
};

export type OutlierLanding = {
  /** `<fuente>:<id>`: único entre fuentes y estable. */
  id: string;
  fuente: 'spy' | 'relevo';
  /** La página, tal cual se abre sin login. */
  url: string;
  /** El titular de la página, tal cual (o el nombre del sitio si no se leyó). */
  titulo: string;
  /** De quién es. `competidorId`: su ficha en Competitors Spy (null = no es de Spy). */
  quien: { nombre: string; nicho: string | null; competidorId?: number | null };
  tipo: TipoLanding;
  /** Por qué funciona, en una frase (null = todavía no se analizó: las de Spy). */
  porque: string | null;
  /** La captura LARGA de la página (la página entera, 640 de ancho): la tarjeta la muestra y la scrollea al pasar el cursor. */
  imagen: string | null;
  /** El alto de esa captura, en px: cuánto dura el scroll de la tarjeta. */
  alto?: number | null;
  idioma: 'es' | 'en';
};

export type CaidaLandings = { fuente: string; nombre: string; motivo: string };
/** `sinCaptura`: las landings de tu competencia en Spy que todavía no tienen su captura larga (no entran hasta tenerla). */
export type PortadaLandings = { outliers: readonly OutlierLanding[]; caidas: readonly CaidaLandings[]; sinCaptura?: number };

/** El dominio sin `www.`, para mostrar y para no repetir. */
export function hostDeLanding(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 60); }
}

/**
 * Las páginas de «link en la bio» no son landings: no hay nada que replicar (medido el 11/11/2026: 4 de los 9 competidores con
 * landing en Spy apuntan a beacons, linktree o un acortador).
 */
const LINK_EN_BIO = /(^|\.)(beacons\.(page|ai)|linktr\.ee|linktw\.in|lnk\.bio|bio\.link|campsite\.bio|taplink\.(cc|at)|msha\.ke|later\.com|carrd\.co|allmylinks\.com|solo\.to|komi\.io|stan\.store)$/i;
export function esLinkEnBio(url: string): boolean {
  const h = hostDeLanding(url);
  let camino = '';
  try { camino = new URL(url).pathname; } catch { /* ignorado */ }
  return LINK_EN_BIO.test(h) || /\/(linktree|links?|bio)[-/]?/i.test(camino);
}

/** Sin los parámetros de campaña: dos links a la misma página con otro `utm_` son la misma. */
export function urlLimpia(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|el$|htrafficsource$|fbclid$|gclid$)/i.test(k)) u.searchParams.delete(k);
    u.hash = '';
    return u.toString();
  } catch { return url; }
}

/**
 * La misma página escrita de distintas formas da la misma clave: sin parámetros de campaña, sin la barra final, y sin el protocolo
 * ni el `www.` (en Spy viralidad.com está como `http://www.…` y su captura, como `https://…`: 11/11/2026).
 */
export const clavePagina = (u: string): string => urlLimpia(u).replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();

/** Las de Spy primero; sin repetir la misma página (una del relevo que el negocio ya sigue va como la de Spy). */
export function unirOutliers(spy: readonly OutlierLanding[], relevo: readonly OutlierLanding[]): OutlierLanding[] {
  const vistas = new Set<string>();
  const out: OutlierLanding[] = [];
  for (const x of [...spy, ...relevo]) {
    const k = clavePagina(x.url);
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(x);
  }
  return out;
}

