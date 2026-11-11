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
//   · `relevo`: las de los gurús y referentes del nicho, curadas a mano (`RELEVO_LANDINGS`, abajo): el relevo entero, con por
//     qué funciona cada una, está en docs/web-generator/outliers-landings.md.
//
// LAS REGLAS (las mismas de Video):
//   · «No pude leer» no es «no hay»: una fuente que falla vuelve `{ ok: false, motivo }` y la portada lo dice.
//   · El dato de un tercero no se republica: la tarjeta lleva el link al original. La imagen es la captura que sacamos nosotros
//     de la página pública (relevo) o la imagen para compartir que la misma página publica (`og:image`, Spy); null si no hay.
//   · «Replicar» abre Replicar con esa página arrancando sola (`/web-generator?replicar=<url>`, panel-reglas.ts).
//
// Puro (sin `server-only`): lo usan el lector, la pantalla y los tests.
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
  /** La imagen de la tarjeta (ver la cabecera). null = no hay: la tarjeta dibuja el sitio con su nombre. */
  imagen: string | null;
  idioma: 'es' | 'en';
};

export type CaidaLandings = { fuente: string; nombre: string; motivo: string };
export type PortadaLandings = { outliers: readonly OutlierLanding[]; caidas: readonly CaidaLandings[] };

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

/** Las de Spy primero; sin repetir la misma página (una del relevo que el negocio ya sigue va como la de Spy). */
export function unirOutliers(spy: readonly OutlierLanding[], relevo: readonly OutlierLanding[]): OutlierLanding[] {
  const vistas = new Set<string>();
  const out: OutlierLanding[] = [];
  for (const x of [...spy, ...relevo]) {
    const k = urlLimpia(x.url).replace(/\/$/, '').toLowerCase();
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(x);
  }
  return out;
}

/** La imagen para compartir de una página (`og:image` o `twitter:image`), absoluta, o null. Sólo https: nada de `data:`. */
export function ogImagenDe(html: string, base: string): string | null {
  const m = /<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/i.exec(html);
  const c = m ? /content\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1] : null;
  if (!c) return null;
  try {
    const u = new URL(c.replace(/&amp;/g, '&'), base);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

/** La imagen de la captura de una del relevo: public/web-generator/outliers/<id>.jpg (scripts/capturas-outliers-landings.mjs). */
export const imagenDelRelevo = (id: string): string => `/web-generator/outliers/${id}.jpg`;

type Relevo = Omit<OutlierLanding, 'fuente' | 'imagen' | 'quien' | 'id'> & { id: string; nombre: string; nicho: string };

/**
 * EL RELEVO (11/11/2026): landings de gurús y referentes del nicho, verificadas a mano (que abren sin login y venden algo), con su
 * captura en public/. El detalle y el criterio, en docs/web-generator/outliers-landings.md. Se suma acá y se saca la captura.
 */
export const RELEVO: readonly Relevo[] = [
  // ── En español primero: la mayoría de los negocios de MaKo vende en español ──
  { id: 'clara-perez-clase', url: 'https://clase.highticketclarity.com/', nombre: 'Clara Pérez (High Ticket Clarity)', nicho: 'Coaches high ticket', tipo: 'webinar', idioma: 'es',
    titulo: 'Imagina agregar 10K AL MES a tu facturación',
    porque: 'Resultado concreto para un público muy definido (coaches, consultoras y dueñas de agencia), una masterclass en vivo que se da una sola vez y cupos limitados.' },
  { id: 'clara-perez-vsl', url: 'https://vender-en-redes.highticketclarity.com/', nombre: 'Clara Pérez (High Ticket Clarity)', nicho: 'Coaches high ticket', tipo: 'vsl', idioma: 'es',
    titulo: 'Sin publicidad y sin reels virales: las claves para escalar tu negocio en redes',
    porque: 'La clase gratis de 11 minutos queda detrás de un formulario que califica (facturación, seguidores, problema), y después el equipo te contacta por WhatsApp: precalifica antes de vender.' },
  { id: 'masterclass-de-ventas', url: 'https://masterclassdeventas.com/', nombre: 'Josué Peña (Digital Closer Academy)', nicho: 'Closers de ventas', tipo: 'webinar', idioma: 'es',
    titulo: 'Las Empresas Están Contratando Personas Para Atender Sus Llamadas de Ventas',
    porque: 'Gancho de oportunidad laboral con la comisión por llamada en el subtítulo, masterclass en vivo con fecha y hora, testimonios con país y el botón de reservar repetido en toda la página.' },
  { id: 'momentum-vsl', url: 'https://programa.formacionmomentum.com/video', nombre: 'Programa Momentum', nicho: 'Eventos presenciales', tipo: 'vsl', idioma: 'es',
    titulo: 'Genera una nueva línea de ingresos',
    porque: 'Embudo VSL en dos pasos (ver el video y agendar la llamada) con un filtro de facturación mínima para atraer sólo negocios que ya venden.' },
  { id: 'vilma-ai-training', url: 'https://ai.vilmanunez.com/ai-training', nombre: 'Vilma Núñez', nicho: 'IA para negocios', tipo: 'venta', idioma: 'es',
    titulo: 'Ya no basta con chatear con la IA. Tienes que saber construir con ella.',
    porque: 'Titular que rompe una creencia («chatear» contra «construir»), video corto de la autora, método con nombre propio, precio bajo de pago único con descuento y bonos.' },
  { id: 'mercatitlan-ia', url: 'https://ia.mercatitlan.com/registro', nombre: 'Juan Lombana (Mercatitlán)', nicho: 'Video con IA', tipo: 'webinar', idioma: 'es',
    titulo: 'Haz videos que sí venden, en minutos y sin saber editar',
    porque: 'Promesa concreta y sin fricción (videos que venden, con IA y sin saber editar), masterclass gratuita de una hora y muchos testimonios con nombre y oficio.' },
  { id: 'transformateca', url: 'https://latransformateca.com/sesion-estrategica/', nombre: 'Franck Scipion (La Transformateca)', nicho: 'Negocios digitales', tipo: 'venta', idioma: 'es',
    titulo: '¿TE FALTA CLARIDAD SOBRE LOS PASOS QUE TIENES QUE DAR PARA LLEGAR A TU METAS?',
    porque: 'Titular en forma de pregunta sobre el dolor, una sesión de pago con un entregable claro (plan a 12 meses), el cliente ideal bien descrito y escasez real de pocas plazas al mes.' },
  { id: 'oscar-feito', url: 'https://www.oscarfeito.com/', nombre: 'Oscar Feito', nicho: 'Negocio online', tipo: 'lead-magnet', idioma: 'es',
    titulo: 'MILLONES DE PROFESIONALES YA ESTÁN CREANDO UN PLAN «B» PARA COMPLEMENTAR SU SUELDO Y VIVIR MEJOR…',
    porque: 'Página de captura que abre con prueba social («millones ya lo hacen»), regala una hoja de ruta a cambio del correo y muestra testimonios con nombre y empresa.' },
  { id: 'isra-bravo', url: 'https://www.israbravo.com/', nombre: 'Isra Bravo', nicho: 'Copywriting', tipo: 'lead-magnet', idioma: 'es',
    titulo: 'Desde 2017 mando un email diario.',
    porque: 'Lo mínimo posible: una frase que da autoridad por constancia y un solo campo de correo, sin promesas ni diseño, para vender después con el correo diario.' },
  // ── Los gurús en inglés ──
  { id: 'hormozi-libros', url: 'https://www.acquisition.com/books', nombre: 'Alex Hormozi (Acquisition.com)', nicho: 'Ofertas y leads', tipo: 'libro', idioma: 'en',
    titulo: 'THE $100M BOOK SERIES',
    porque: 'Regala los audiolibros a cambio del correo y un curso en video por cada libro, y desde ahí escala hacia los workshops presenciales.' },
  { id: 'monetise', url: 'https://www.monetise.com/', nombre: 'Iman Gadzhi (Monetise)', nicho: 'Productos digitales con IA', tipo: 'venta', idioma: 'en',
    titulo: 'Let My AI System Build You A Profitable Digital Product',
    porque: 'Promesa grande que responde la objeción en el subtítulo (sin experiencia y sin mostrar la cara), pila de valor con software y bonos, garantía de seguir hasta que ganes y cierre con cuenta regresiva.' },
  { id: 'dotcom-secrets', url: 'https://www.dotcomsecrets.com/', nombre: 'Russell Brunson', nicho: 'Embudos', tipo: 'libro', idioma: 'en',
    titulo: 'How To Launch And Scale Your Company Online With Simple Sales Funnels...!',
    porque: 'El clásico «gratis + envío»: video de venta arriba, respaldos de figuras conocidas, bonos con valor declarado, garantía de devolver el envío y escasez por tirada limitada.' },
  { id: 'expert-secrets', url: 'https://www.expertsecrets.com/', nombre: 'Russell Brunson', nicho: 'Expertos y coaches', tipo: 'libro', idioma: 'en',
    titulo: 'Find Your Message... Build A Tribe, And Change The World!',
    porque: 'La misma estructura de libro gratis + envío, con testimonios de alumnos con nombre, cinco bonos con valor declarado, una garantía con nombre propio y ventas adicionales en el pago.' },
  { id: 'sell-like-crazy', url: 'https://selllikecrazybook.com/free/', nombre: 'Sabri Suby', nicho: 'Marketing y ventas', tipo: 'libro', idioma: 'en',
    titulo: "Breaking News: Shark Tank Investor Releases 10,000 Copies of His $10.2 Billion 'Selling System' For Free",
    porque: 'Titular en formato noticia con el libro gratis y sólo el envío a tu cargo, tres bonos apilados, garantía de devolver el envío y escasez de stock limitado.' },
  { id: 'king-kong-sesion', url: 'https://kingkong.co/30-minute-strategy-session/', nombre: 'Sabri Suby (King Kong)', nicho: 'Agencia de marketing', tipo: 'aplicacion', idioma: 'en',
    titulo: 'Last Step: Schedule Your Free 30-Min Strategy Session Call Now',
    porque: 'Página de «último paso» que regala la sesión y un mapa de crecimiento, con un formulario por pasos que califica presupuesto, facturación y compromiso antes de dejarte agendar.' },
  { id: 'get-clients', url: 'https://www.getclients.com/', nombre: 'Dan Henry', nicho: 'Escalar negocios', tipo: 'aplicacion', idioma: 'en',
    titulo: 'READY TO SCALE YOUR BUSINESS?',
    porque: 'Una aplicación corta que filtra por facturación y reemplaza la llamada de ventas por un chat de WhatsApp en 24 horas, sin la fricción de agendar.' },
  { id: 'hyros', url: 'https://hyros.com/', nombre: 'Alex Becker (Hyros)', nicho: 'Seguimiento de anuncios', tipo: 'aplicacion', idioma: 'en',
    titulo: 'Tracking that grows ads Custom Made For You.',
    porque: 'Software presentado como servicio a medida con llamada de demo, logos de marcas conocidas como prueba social y la garantía «resultados o no pagas».' },
  { id: 'cardone-webinar', url: 'https://cardonefreetraining.com/', nombre: 'Grant Cardone', nicho: 'Inversión inmobiliaria', tipo: 'webinar', idioma: 'en',
    titulo: 'How to Find, Fund, and Close Your First Real Estate Deal in 2026',
    porque: 'Webinar en vivo con una promesa de tres verbos (encontrar, financiar, cerrar), un libro de regalo por registrarte, cuenta regresiva y cupos limitados.' },
  { id: 'cardone-10x', url: 'https://10xbusinesslive.com/business-summit-main-2027', nombre: 'Grant Cardone', nicho: 'Negocios', tipo: 'evento', idioma: 'en',
    titulo: '10X Your Business',
    porque: 'Evento de 3 días con una promesa concreta (los 7 sistemas que le faltan a tu negocio), entradas por niveles, cuenta regresiva y un nivel agotado como escasez.' },
  { id: 'robbins-upw', url: 'https://www.tonyrobbins.com/events/unleash-the-power-within/', nombre: 'Tony Robbins', nicho: 'Desarrollo personal', tipo: 'evento', idioma: 'en',
    titulo: 'Unleash the Power Within',
    porque: 'Evento con precios por niveles, agenda día por día, testimonios de asistentes y una oferta 2x1 por tiempo limitado que empuja a comprar.' },
];

export const RELEVO_LANDINGS: readonly OutlierLanding[] = RELEVO.map((r) => ({
  id: `relevo:${r.id}`, fuente: 'relevo', url: r.url, titulo: r.titulo, quien: { nombre: r.nombre, nicho: r.nicho, competidorId: null },
  tipo: r.tipo, porque: r.porque, imagen: imagenDelRelevo(r.id), idioma: r.idioma,
}));
