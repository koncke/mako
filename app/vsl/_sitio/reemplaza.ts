// =============================================================================
// Las apps que MaKo reemplaza, trabajo por trabajo (12/11/2026)
// =============================================================================
// Martín (12/11/2026), de la comparación de 8 apps: «deberías fijarte porque realmente MaKo reemplaza muchísimas más apps. Desde
// Higgsfield… reemplaza Notion… te quedaste muy corto con esas 8. Pero fíjate que siempre los logos sean los logos reales
// originales».
//
// De dónde sale cada app: los competidores de cada función en docs/competencia/landings-por-funcion.md (la investigación del
// 11/11, con su URL) y los `reemplaza` de lib/funciones-mako.ts. Sólo trabajos que MaKo hace hoy, con su landing. No van las apps
// con las que MaKo se CONECTA (Calendly, Cal.com, Fathom, Stripe, Mercado Pago): ésas no se reemplazan, se suman.
// Ningún precio ni ninguna afirmación sobre lo que hace otra app: sólo su nombre y su logo.
//
// Los logos: el ícono ORIGINAL que cada app publica en su sitio (su apple-touch-icon o el ícono de su manifest; si no tiene, el
// que da Google para su dominio), bajado el 12/11/2026 y guardado en public/vsl-assets/logos/apps/<archivo>.png (128 px).
// 14/11/2026 (Martín: «muchos son un cuadrado blanco con el logo adentro… tienen que ser sólo el logo»): a nueve se les sacó el
// fondo blanco (relleno desde los bordes, sin tocar el blanco de adentro; el script y cuáles quedaron como estaban, en
// docs/hallazgos-landing.md → «Comparaciones y lo que pagas hoy»), y ya no se dibujan sobre un recuadro blanco.
// =============================================================================

// Make (14/11/2026): su sitio sólo publica un favicon chico estirado (se veía borroso); el suyo es la forma de Simple Icons
// (make.svg) con los colores muestreados de ese favicon, dibujada a 128 px (el script, en docs/hallazgos-landing.md).
export type AppQueReemplaza = { nombre: string; logo: string };
export type TrabajoQueReemplaza = {
  /** El trabajo, como lo dice el dueño del negocio. */
  trabajo: string;
  /** La función de MaKo que lo hace. */
  funcion: string;
  /** Su landing en /vsl, o null si no tiene (Classroom). */
  landing: string | null;
  /** La familia de la tabla de la comparación. */
  familia: 'Crear' | 'Marketing' | 'Vender' | 'Medir y ordenar';
  apps: readonly AppQueReemplaza[];
};

const app = (nombre: string, archivo: string): AppQueReemplaza => ({ nombre, logo: `/vsl-assets/logos/apps/${archivo}.png` });

export const STACK_QUE_REEMPLAZA: readonly TrabajoQueReemplaza[] = [
  { trabajo: 'Anuncios con tu cara', funcion: 'AI Avatar', landing: 'ai-avatar', familia: 'Crear',
    apps: [app('HeyGen', 'heygen'), app('Higgsfield', 'higgsfield'), app('Arcads', 'arcads'), app('Creatify', 'creatify')] },
  { trabajo: 'Video', funcion: 'Video', landing: 'video', familia: 'Crear',
    apps: [app('CapCut', 'capcut'), app('Submagic', 'submagic'), app('Captions', 'captions'), app('OpusClip', 'opusclip'), app('Descript', 'descript')] },
  { trabajo: 'Imágenes y carruseles', funcion: 'Image', landing: 'image', familia: 'Crear',
    apps: [app('Canva', 'canva'), app('PostNitro', 'postnitro'), app('AdCreative.ai', 'adcreative'), app('Predis.ai', 'predis')] },
  { trabajo: 'Textos', funcion: 'Copywriting', landing: 'copywriting', familia: 'Crear',
    apps: [app('Jasper', 'jasper'), app('Copy.ai', 'copyai')] },
  { trabajo: 'Páginas de venta', funcion: 'Web Generator', landing: 'web-generator', familia: 'Crear',
    apps: [app('Gamma', 'gamma'), app('ClickFunnels', 'clickfunnels'), app('Framer', 'framer'), app('Systeme.io', 'systemeio')] },
  { trabajo: 'Espiar a la competencia', funcion: 'Competitor Spy', landing: 'competitor-spy', familia: 'Marketing',
    apps: [app('Foreplay', 'foreplay'), app('Minea', 'minea'), app('BigSpy', 'bigspy')] },
  { trabajo: 'Anuncios de Meta', funcion: 'Marketing CoPilot', landing: 'ads', familia: 'Marketing',
    apps: [app('Madgicx', 'madgicx')] },
  { trabajo: 'Analizar tus anuncios', funcion: 'Ads Analyst', landing: 'script', familia: 'Marketing',
    apps: [app('Motion (anuncios)', 'motionapp'), app('Atria', 'atria'), app('Gethookd', 'gethookd')] },
  { trabajo: 'Email', funcion: 'Email', landing: 'email', familia: 'Marketing',
    apps: [app('Mailchimp', 'mailchimp'), app('ActiveCampaign', 'activecampaign'), app('Kit', 'kit'), app('MailerLite', 'mailerlite')] },
  { trabajo: 'CRM', funcion: 'CRM', landing: 'crm', familia: 'Vender',
    apps: [app('GoHighLevel', 'gohighlevel'), app('HubSpot', 'hubspot'), app('Pipedrive', 'pipedrive'), app('Clientify', 'clientify')] },
  { trabajo: 'Chats', funcion: 'Chats', landing: 'whatsapp', familia: 'Vender',
    apps: [app('respond.io', 'respondio'), app('Kommo', 'kommo'), app('Leadsales', 'leadsales'), app('Wati', 'wati')] },
  { trabajo: 'Setter con IA', funcion: 'Automations', landing: 'seguimiento', familia: 'Vender',
    // Zapier y Make, sumados por Martín el 14/11/2026 («Sí, súmalos»). El archivo de Zapier es `zap.png` y no el nombre en minúscula:
    // tests/puente-leads-retirado.test.ts prohíbe esa key entre comillas (el puente de leads que se retiró el 23/10).
    apps: [app('ManyChat', 'manychat'), app('SetSmart', 'setsmart'), app('Zapier', 'zap'), app('Make', 'make')] },
  { trabajo: 'Cursos y comunidad', funcion: 'Classroom', landing: null, familia: 'Vender',
    apps: [app('Skool', 'skool'), app('Kajabi', 'kajabi'), app('Hotmart', 'hotmart'), app('Circle', 'circle')] },
  { trabajo: 'Dashboards', funcion: 'Dashboard', landing: 'dashboard', familia: 'Medir y ordenar',
    apps: [app('Looker Studio', 'lookerstudio'), app('Reportei', 'reportei'), app('AgencyAnalytics', 'agencyanalytics'), app('DashThis', 'dashthis'), app('Metricool', 'metricool')] },
  { trabajo: 'Atribución de ventas', funcion: 'Funnels', landing: 'funnel', familia: 'Medir y ordenar',
    apps: [app('Hyros', 'hyros')] },
  { trabajo: 'Tareas y prioridades', funcion: 'Plan', landing: 'prioridades', familia: 'Medir y ordenar',
    // De gestión, sólo Notion (llamada con Leila, 13/11/2026: «sin Trello»). Motion, ClickUp, Asana y Trello se fueron.
    apps: [app('Notion', 'notion')] },
];

/**
 * El ahorro de la portada (Martín, 13/11/2026: «haz un pequeño cálculo de cuántos estarían ahorrando, que sea realista… no de las 54,
 * porque nadie estaría pagando las 54»). UN stack típico de quien vende High Ticket, una app por trabajo, sólo trabajos que MaKo Pro
 * hace (lib/planes-comparacion.ts: CRM, chats y agente en todos los planes; los editores de imagen y video, desde Pro), más las que
 * Martín pidió sumar el 13/11 (Higgsfield, Gamma, Skool y Mailchimp).
 * El precio: el de lista mensual en dólares, pagando mes a mes, buscado el 13/11/2026 (las fuentes, en `fuente`). Si cambia, se
 * cambia acá: la portada hace la cuenta.
 */
/**
 * Para qué sirve cada app del ahorro: los grupos de la cuenta (Martín, 14/11/2026, de la lista en dos columnas: «está todo muy junto
 * y no se llega a entender muy bien de quién es el precio, si el de 97 es de HighLevel o es el de ManyChat»). La cuenta va en este
 * orden; dentro de cada grupo, en el de STACK_TIPICO.
 */
export const GRUPOS_DEL_AHORRO = ['Vender', 'Crear contenido', 'Marketing', 'Entregar y organizarte'] as const;
export type GrupoDelAhorro = (typeof GRUPOS_DEL_AHORRO)[number];

export const STACK_TIPICO: readonly { app: AppQueReemplaza; trabajo: string; grupo: GrupoDelAhorro; plan: string; precioUsd: number; fuente: string }[] = [
  { app: app('GoHighLevel', 'gohighlevel'), trabajo: 'CRM y embudos', grupo: 'Vender', plan: 'Starter', precioUsd: 97, fuente: 'https://www.gohighlevel.com/pricing' },
  { app: app('ManyChat', 'manychat'), trabajo: 'Respuestas automáticas', grupo: 'Vender', plan: 'Pro', precioUsd: 39, fuente: 'https://help.manychat.com/hc/en-us/articles/25800228332572' },
  { app: app('Canva', 'canva'), trabajo: 'Diseño', grupo: 'Crear contenido', plan: 'Pro', precioUsd: 18, fuente: 'https://www.canva.com/pricing/' },
  { app: app('CapCut', 'capcut'), trabajo: 'Edición de video', grupo: 'Crear contenido', plan: 'Pro', precioUsd: 19.99, fuente: 'https://www.capcut.com/pricing' },
  // Llamada con Leila (13/11/2026): OpusClip junto a CapCut y HeyGen junto a Higgsfield, cada una en el plan que se paga para usarla
  // de verdad (el Cerebro, 13/11: «HeyGen Creator y Opus Clip Pro»), buscado el 13/11/2026: OpusClip Pro US$29 por mes pagando mes a
  // mes; HeyGen Creator US$29 por mes. Contra MaKo Pro (US$97).
  { app: app('OpusClip', 'opusclip'), trabajo: 'Clips para redes', grupo: 'Crear contenido', plan: 'Pro', precioUsd: 29, fuente: 'https://www.opus.pro/pricing' },
  // Martín, 13/11/2026: «no incluiste muchas otras apps que un emprendedor sí pagaría… no quiero que exageres», y después: «antes de
  // Foreplay prefiero el más famoso, que es Higgsfield» y «puedes agregar Gamma, Skool y Mailchimp también». El plan más barato de
  // cada una que sirve para ese trabajo, pagando mes a mes (Skool: Pro, el que no se queda con el 10 % de cada venta).
  { app: app('Higgsfield', 'higgsfield'), trabajo: 'Videos con IA', grupo: 'Crear contenido', plan: 'Starter', precioUsd: 19, fuente: 'https://higgsfield.ai/pricing' },
  // HeyGen salió el 14/11/2026, noche (Martín: «quitaría HeyGen»): la lista quedaba larga, y el avatar con IA no se vende todavía
  // (lib/planes-comparacion.ts, `AI_AVATAR_SE_VENDE`).
  { app: app('Notion', 'notion'), trabajo: 'Tareas y prioridades', grupo: 'Entregar y organizarte', plan: 'Plus', precioUsd: 12, fuente: 'https://www.notion.com/pricing' },
  { app: app('Gamma', 'gamma'), trabajo: 'Páginas y presentaciones', grupo: 'Marketing', plan: 'Plus', precioUsd: 10, fuente: 'https://gamma.app/pricing' },
  { app: app('Skool', 'skool'), trabajo: 'Cursos y comunidad', grupo: 'Entregar y organizarte', plan: 'Pro', precioUsd: 99, fuente: 'https://www.skool.com/pricing' },
  { app: app('Mailchimp', 'mailchimp'), trabajo: 'Email', grupo: 'Marketing', plan: 'Standard', precioUsd: 20, fuente: 'https://mailchimp.com/pricing/' },
  // Martín, 14/11/2026: «agrega Metricool y Make o Zapier… el que salga más caro». Pagando mes a mes, buscado el 14/11/2026 (en sitios
  // que siguen precios; las páginas oficiales no se leyeron directo): Zapier Professional US$29,99 (Make Core, unos US$12: queda
  // afuera del ahorro); Metricool Starter US$25.
  { app: app('Zapier', 'zap'), trabajo: 'Automatizaciones', grupo: 'Vender', plan: 'Professional', precioUsd: 29.99, fuente: 'https://zapier.com/pricing' },
  { app: app('Metricool', 'metricool'), trabajo: 'Redes y métricas', grupo: 'Marketing', plan: 'Starter', precioUsd: 25, fuente: 'https://metricool.com/pricing/' },
];

/**
 * La TIRA de la portada: sólo las MÁS CONOCIDAS, las que la mayoría ya paga (el audio de feedback que pasó Martín, 14/11/2026: «yo pondría
 * apps extremadamente conocidas… ManyChat, Canva, Notion, Skool, CapCut, Higgsfield, Kajabi, Hotmart, Circle… no las que son poco
 * conocidas», como Framer, Foreplay, Minea o BigSpy). La comparación trabajo por trabajo sigue con todas (`appsQueReemplaza`).
 */
// El orden, mezclado (Martín, 14/11/2026: «desordena esas apps para que no estén todas juntas por categoría»): nunca dos del mismo
// trabajo seguidas. Están TODAS las del ahorro (STACK_TIPICO), y se fueron Descript y Pipedrive (pedido de Martín, 14/11/2026).
const CONOCIDAS = ['ManyChat', 'Canva', 'GoHighLevel', 'Metricool', 'CapCut', 'Skool', 'Zapier', 'Gamma', 'Mailchimp', 'Notion',
  'Kajabi', 'OpusClip', 'HubSpot', 'Make', 'Higgsfield', 'Hotmart', 'ClickFunnels', 'ActiveCampaign', 'Circle', 'Systeme.io'] as const;
export function appsDeLaTira(): AppQueReemplaza[] {
  const todas = appsQueReemplaza();
  return CONOCIDAS.flatMap((n) => todas.filter((a) => a.nombre === n));
}

/** Todas, una vez cada una, en el orden de la lista: la comparación. */
export function appsQueReemplaza(): AppQueReemplaza[] {
  const vistas = new Set<string>();
  return STACK_QUE_REEMPLAZA.flatMap((t) => t.apps).filter((a) => (vistas.has(a.logo) ? false : (vistas.add(a.logo), true)));
}
