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
// que da Google para su dominio), bajado el 12/11/2026 y guardado en public/vsl-assets/logos/apps/<archivo>.png (128 px). Se
// dibujan sobre un recuadro blanco: así se ven sobre fondo claro y oscuro (el de Facebook negro sobre negro no se veía).
// =============================================================================

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
    apps: [app('ManyChat', 'manychat'), app('SetSmart', 'setsmart')] },
  { trabajo: 'Cursos y comunidad', funcion: 'Classroom', landing: null, familia: 'Vender',
    apps: [app('Skool', 'skool'), app('Kajabi', 'kajabi'), app('Hotmart', 'hotmart'), app('Circle', 'circle')] },
  { trabajo: 'Dashboards', funcion: 'Dashboard', landing: 'dashboard', familia: 'Medir y ordenar',
    apps: [app('Looker Studio', 'lookerstudio'), app('Reportei', 'reportei'), app('AgencyAnalytics', 'agencyanalytics'), app('DashThis', 'dashthis')] },
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
export const STACK_TIPICO: readonly { app: AppQueReemplaza; trabajo: string; plan: string; precioUsd: number; fuente: string }[] = [
  { app: app('GoHighLevel', 'gohighlevel'), trabajo: 'CRM y embudos', plan: 'Starter', precioUsd: 97, fuente: 'https://www.gohighlevel.com/pricing' },
  { app: app('ManyChat', 'manychat'), trabajo: 'Respuestas automáticas', plan: 'Pro', precioUsd: 39, fuente: 'https://help.manychat.com/hc/en-us/articles/25800228332572' },
  { app: app('Canva', 'canva'), trabajo: 'Diseño', plan: 'Pro', precioUsd: 18, fuente: 'https://www.canva.com/pricing/' },
  { app: app('CapCut', 'capcut'), trabajo: 'Edición de video', plan: 'Pro', precioUsd: 19.99, fuente: 'https://www.capcut.com/pricing' },
  // Llamada con Leila (13/11/2026): OpusClip junto a CapCut y HeyGen junto a Higgsfield, cada una en el plan que se paga para usarla
  // de verdad (el Cerebro, 13/11: «HeyGen Creator y Opus Clip Pro»), buscado el 13/11/2026: OpusClip Pro US$29 por mes pagando mes a
  // mes; HeyGen Creator US$29 por mes. Contra MaKo Pro (US$97).
  { app: app('OpusClip', 'opusclip'), trabajo: 'Clips para redes', plan: 'Pro', precioUsd: 29, fuente: 'https://www.opus.pro/pricing' },
  // Martín, 13/11/2026: «no incluiste muchas otras apps que un emprendedor sí pagaría… no quiero que exageres», y después: «antes de
  // Foreplay prefiero el más famoso, que es Higgsfield» y «puedes agregar Gamma, Skool y Mailchimp también». El plan más barato de
  // cada una que sirve para ese trabajo, pagando mes a mes (Skool: Pro, el que no se queda con el 10 % de cada venta).
  { app: app('Higgsfield', 'higgsfield'), trabajo: 'Videos con IA', plan: 'Starter', precioUsd: 19, fuente: 'https://higgsfield.ai/pricing' },
  { app: app('HeyGen', 'heygen'), trabajo: 'Avatares con IA', plan: 'Creator', precioUsd: 29, fuente: 'https://www.heygen.com/pricing' },
  { app: app('Notion', 'notion'), trabajo: 'Tareas y prioridades', plan: 'Plus', precioUsd: 12, fuente: 'https://www.notion.com/pricing' },
  { app: app('Gamma', 'gamma'), trabajo: 'Páginas y presentaciones', plan: 'Plus', precioUsd: 10, fuente: 'https://gamma.app/pricing' },
  { app: app('Skool', 'skool'), trabajo: 'Cursos y comunidad', plan: 'Pro', precioUsd: 99, fuente: 'https://www.skool.com/pricing' },
  { app: app('Mailchimp', 'mailchimp'), trabajo: 'Email', plan: 'Standard', precioUsd: 20, fuente: 'https://mailchimp.com/pricing/' },
];

/**
 * La TIRA de la portada: sólo las MÁS CONOCIDAS, las que la mayoría ya paga (el audio de feedback que pasó Martín, 14/11/2026: «yo pondría
 * apps extremadamente conocidas… ManyChat, Canva, Notion, Skool, CapCut, Higgsfield, Kajabi, Hotmart, Circle… no las que son poco
 * conocidas», como Framer, Foreplay, Minea o BigSpy). La comparación trabajo por trabajo sigue con todas (`appsQueReemplaza`).
 */
const CONOCIDAS = ['ManyChat', 'Canva', 'CapCut', 'Notion', 'Skool', 'GoHighLevel', 'Kajabi', 'Hotmart', 'Circle', 'Systeme.io', 'ClickFunnels',
  'HubSpot', 'Mailchimp', 'ActiveCampaign', 'HeyGen', 'Higgsfield', 'Gamma', 'OpusClip', 'Descript', 'Pipedrive'] as const;
export function appsDeLaTira(): AppQueReemplaza[] {
  const todas = appsQueReemplaza();
  return CONOCIDAS.flatMap((n) => todas.filter((a) => a.nombre === n));
}

/** Todas, una vez cada una, en el orden de la lista: la comparación. */
export function appsQueReemplaza(): AppQueReemplaza[] {
  const vistas = new Set<string>();
  return STACK_QUE_REEMPLAZA.flatMap((t) => t.apps).filter((a) => (vistas.has(a.logo) ? false : (vistas.add(a.logo), true)));
}
