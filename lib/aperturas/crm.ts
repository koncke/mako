// =============================================================================
// La apertura del CRM: lo que MaKo pregunta primero en la estrella del tablero (PURO; 5/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («CRM y Chats · estrella»), T7. Con el CRM vacío (cero leads en TODO el negocio, no en el funnel
// que se mira: un funnel nuevo no es un negocio sin clientes), MaKo pregunta un HECHO, «¿Dónde tienes hoy a tus clientes?», y
// cada respuesta lleva a donde se cargan: la planilla o el otro CRM al importador del tablero (`/crm?importar=1`, el mismo pop-up
// de «Importar leads» del «⋯»), su WhatsApp a conectarlo ahí mismo (`/chats?conectar=whatsapp`, el QR de siempre).
//
// Sólo para quien administra el negocio: un closer o un setter no carga la base (plan.md §2.7, «por rol»). Con leads, calla: las
// sugerencias medidas del panel (`/api/crm/mako`) son las que hablan.
//
// ⚠️ LA DEL FUNNEL «SIN DECLARAR» (plan.md §4, la otra fila del CRM) NO ESTÁ: necesita el canal y el diagnóstico en la estrella y
// declarar con `declararEntradasAction`. Queda en docs/relevo/nube-iniciativa.md. El onboarding ya declara el funnel principal
// con el tipo que recomienda `recomendarFunnel` (lib/funnel-recomendado.ts).
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosCrm = {
  /** Cuántos leads tiene el NEGOCIO (todos los funnels). null = no se pudo leer: calla (una lectura caída no es «no tienes»). */
  leads: number | null;
  /** ¿Administra el negocio? Un closer o un setter no carga la base. */
  esAdmin: boolean;
  /** El funnel que se mira: el importador carga ahí. */
  funnelId: number | null;
};

export const ID_CLIENTES = 'crm:clientes';

/** El link del importador del tablero, en el funnel que se mira. */
export const hrefImportar = (funnelId: number | null): string => `/crm?importar=1${funnelId ? `&funnel=${funnelId}` : ''}`;
/** Conectar su WhatsApp: el QR de siempre, en Chats (AGENTS.md, «el link a una conexión es contrato»). */
export const HREF_WHATSAPP = '/chats?conectar=whatsapp';

export function aperturaCrm(h: HechosCrm, _r: Respuestas): Apertura<never> | null {
  if (!h.esAdmin || h.leads == null || h.leads > 0) return null;
  return {
    id: ID_CLIENTES, alcance: 'negocio', corto: '¿Dónde están tus clientes?',
    texto: 'Tu CRM todavía está vacío. ¿Dónde tienes hoy a tus clientes?',
    botones: [
      { tipo: 'ir', rotulo: 'En una planilla', href: hrefImportar(h.funnelId) },
      { tipo: 'ir', rotulo: 'En otro CRM', href: hrefImportar(h.funnelId) },
      { tipo: 'ir', rotulo: 'En mi WhatsApp', href: HREF_WHATSAPP },
      { tipo: 'callar', rotulo: 'Ahora no' },
    ],
  };
}

export const SUPERFICIE_CRM: Superficie<HechosCrm> = { id: 'crm', acciones: [], apertura: aperturaCrm };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_CLIENTES, cuando: 'Quien administra el negocio, con cero leads en todos sus funnels.' },
];

export const EJEMPLOS: readonly { nombre: string; h: HechosCrm; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'el admin con el CRM vacío', h: { leads: 0, esAdmin: true, funnelId: 4 }, r: {}, espera: ID_CLIENTES, primerPaso: true },
  { nombre: 'con leads: hablan las sugerencias medidas', h: { leads: 12, esAdmin: true, funnelId: null }, r: {}, espera: null },
  { nombre: 'un closer no carga la base', h: { leads: 0, esAdmin: false, funnelId: null }, r: {}, espera: null },
  { nombre: 'la lectura cayó: calla', h: { leads: null, esAdmin: true, funnelId: null }, r: {}, espera: null },
];
