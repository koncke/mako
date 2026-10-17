// =============================================================================
// api-tab — de qué TAB es una ruta de app/api, para que el plan del negocio también corte la API (17/10/2026)
// =============================================================================
// «El corte por capa es de PANTALLA, no de API» (docs/hallazgos-planes-y-cobro.md): 64 páginas miran la capa y de las
// rutas de app/api sólo un puñado. Un negocio con un plan que no compró el Ads Manager no lo VE, pero su `fetch` a
// /api/ads-manager contestaba igual. Esta tabla dice de qué tab es cada API, y el corte vive en UN lugar:
// `resolverDesdeCookies` (lib/workspace.ts) no le da workspace a una sesión que pide una API de una tab fuera de su
// plan — sin workspace no hay datos que leer ni cuenta que operar (fail-closed, como un negocio pausado).
//
// Puro y sin dependencias: lo importa también el proxy, que es el que le pasa la ruta al server (HEADER_RUTA).
//
// ⚠️ SÓLO LAS APIs QUE USA UNA SOLA TAB. Medido el 17/10/2026 con un grep de cada prefijo en app/ y lib/: /api/crm la
// llaman los componentes compartidos y Automations; /api/offer, el onboarding (que hacen todos); /api/flujos, la barra;
// /api/email, Automations; /api/experimentos, /api/ad-insights y /api/landing-analyst, el Dashboard (que un plan chico
// SÍ compra); /api/ads-analyst, ocho pantallas. Cortarlas por tab rompería lo que el plan sí incluye: para esas, el
// dueño de cada ENDPOINT tiene que decirlo, no la carpeta. Están en `COMPARTIDAS` para que una próxima mano no las
// sume a ciegas (tests/api-tab.test.ts).
// =============================================================================

/** El header por el que el proxy le dice al server qué ruta se pidió. Lo pone SÓLO el proxy (borra el que mande el cliente). */
export const HEADER_RUTA = 'x-mako-ruta';

/** Prefijo de app/api → key de nav (la que pasa la página de esa tab a `requireRolWs`/`requireCapa`). */
export const TAB_DE_API: ReadonlyArray<readonly [string, string]> = [
  ['/api/ads-manager', 'ads-manager'],
  ['/api/meta-write', 'ads-manager'],
  ['/api/meta-health', 'ads-manager'],
  ['/api/meta-recommendations', 'ads-manager'],
  ['/api/entity-insights', 'ads-manager'],
  ['/api/account-insights', 'ads-manager'],
  ['/api/crm-auto', 'crm'],
  ['/api/landing-generator', 'landing-writer'],
  ['/api/automations', 'setting'],
  ['/api/chat-agent', 'setting'],
  ['/api/chats', 'chats'],
];

/** Las APIs que usan VARIAS tabs: no se cortan por carpeta (ver la cabecera). */
export const COMPARTIDAS: readonly string[] = [
  '/api/crm', '/api/offer', '/api/flujos', '/api/email', '/api/experimentos', '/api/ad-insights', '/api/landing-analyst', '/api/ads-analyst',
];

/** La tab de una ruta de API, o null si no es de una sola tab. El prefijo se compara por segmento entero. */
export function tabDeRutaApi(ruta: string | null | undefined): string | null {
  if (!ruta || !ruta.startsWith('/api/')) return null;
  for (const [prefijo, tab] of TAB_DE_API) {
    if (ruta === prefijo || ruta.startsWith(`${prefijo}/`)) return tab;
  }
  return null;
}
