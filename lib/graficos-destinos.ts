// =============================================================================
// graficos-destinos — a dónde lleva el «Ver … →» del pie de un bloque del Dashboard
// =============================================================================
// Martín, 1/11/2026, sobre las referencias de codeandchill (docs/templates-dashboard-propuesta.md §7.1): Corbel termina cada
// KPI en un link al lugar donde se TRABAJA ese número («Ver órdenes», «Ver analytics»). Es la respuesta a «¿tabs adentro del
// Dashboard?»: no hacen falta, hace falta que cada bloque sepa a qué tab de MaKo te manda. Un bloque, un destino.
//
// ⚠️ UNA LISTA CERRADA, Y NO UNA URL. El link lo escribe el código (AGENTS.md: «un link que lee un modelo lo escribe el
//    código»): una plantilla, la API de MaKo o MaKo eligen un `id` de acá; el camino y el rótulo salen de esta tabla. Un id
//    que no está se tira en el saneo (`destinoDe`), y el bloque queda sin pie.
// ⚠️ SÓLO CAMINOS DE MaKo, y se navegan con el Link de la casa (app/_ui/Link): lleva el `?ws=` de la pestaña.
// ⚠️ Una hoja del Dashboard (`/dashboard?hoja=<plantilla>`) también es un destino: si el informe no la tiene, la agrega
//    (`hojaDestino`, lib/graficos-plantillas.ts).
// ⚠️ Puro y sin server-only: lo leen el catálogo (el saneo), la pantalla, la API y los tests.
// =============================================================================

export type DestinoGrafico = { id: string; ruta: string; rotulo: string };

/** Los destinos, en el orden en que la API los ofrece. El rótulo va sin la flecha: la pone la pantalla. */
export const DESTINOS_GRAFICO = [
  { id: 'crm', ruta: '/crm', rotulo: 'Ver el CRM' },
  { id: 'clients', ruta: '/classroom/clients', rotulo: 'Ver Clients' },
  { id: 'plan', ruta: '/plan', rotulo: 'Ver el Plan' },
  { id: 'calendario', ruta: '/calendario', rotulo: 'Ver el Calendario' },
  { id: 'chats', ruta: '/chats', rotulo: 'Ver los chats' },
  { id: 'automations', ruta: '/automations', rotulo: 'Ver Automations' },
  { id: 'ads-manager', ruta: '/ads-manager', rotulo: 'Ver Ads Manager' },
  { id: 'ads-writer', ruta: '/ads-writer', rotulo: 'Ver Ads Writer' },
  { id: 'web-generator', ruta: '/web-generator', rotulo: 'Ver Web Generator' },
  { id: 'video-generator', ruta: '/video-generator', rotulo: 'Ver Video Generator' },
  { id: 'classroom', ruta: '/classroom', rotulo: 'Ver Classroom' },
  { id: 'offer', ruta: '/offer', rotulo: 'Ver Offer' },
  { id: 'cobranza', ruta: '/dashboard?hoja=cobranza', rotulo: 'Ver Cobranza' },
  { id: 'closing', ruta: '/dashboard?hoja=closing', rotulo: 'Ver Closing' },
  { id: 'marketing', ruta: '/dashboard?hoja=marketing', rotulo: 'Ver Marketing' },
  { id: 'comercial', ruta: '/dashboard?hoja=comercial', rotulo: 'Ver Comercial' },
] as const satisfies readonly DestinoGrafico[];

export type IdDestino = (typeof DESTINOS_GRAFICO)[number]['id'];

/** Los ids, para el `enum` de la API. */
export const IDS_DESTINO: readonly IdDestino[] = DESTINOS_GRAFICO.map((d) => d.id);

/** El destino de un id, o null si no es uno de la lista. */
export function destinoDe(id: unknown): DestinoGrafico | null {
  return typeof id === 'string' ? DESTINOS_GRAFICO.find((d) => d.id === id) ?? null : null;
}
