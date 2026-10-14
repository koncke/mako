// =============================================================================
// fuentes-leads-catalogo — cuáles son las FUENTES QUE AVISAN (datos puros)
// =============================================================================
// Las integraciones cuyo trabajo es que el propio público del negocio entre solo al CRM (Leads
// Scraper, 14/10/2026, docs/diseno-leads-scraper.md). La puerta que las escribe es
// lib/fuentes-leads.ts (server-only); esto es lo que necesitan saber también el navegador y los
// tests, así que va SIN `server-only` y sin importar nada.
//
// Lo lee app/integraciones/IntegracionesBoard.tsx: como las pasarelas de pago, una fuente sin
// configurar NO es un pendiente. La mayoría de los negocios no vende por Hotmart ni tiene un
// Skool; contarlas en el medidor le bajaría el «N/M conectados» a todos el día que aparecen.

export type FuenteQueAvisa = 'hotmart' | 'skool';

/** Cómo se llama cada fuente en el historial del lead y en `origen_lead`. */
export const NOMBRE_FUENTE: Readonly<Record<FuenteQueAvisa, string>> = { hotmart: 'Hotmart', skool: 'Skool' };

// `hasOwn` y no `in`: con `in`, «toString» o «constructor» serían una fuente.
export const esFuenteQueAvisa = (v: unknown): v is FuenteQueAvisa => typeof v === 'string' && Object.hasOwn(NOMBRE_FUENTE, v);
