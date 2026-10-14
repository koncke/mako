// =============================================================================
// api-mako/recursos — los RECURSOS de la API (el segundo tramo de la ruta REST), con nombre
// =============================================================================
// La documentación de GitHub agrupa los endpoints en categoría → subcategoría (Issues →
// Comments, Labels, Milestones…), y cada subcategoría es una página con todos sus
// endpoints uno abajo del otro. Acá la categoría es el ÁREA y la subcategoría es el
// RECURSO: el segundo tramo de la ruta REST (`/crm/leads/{leadId}` → `leads`), que es el
// sustantivo con que lib/api-mako/rest.ts ya nombró cada cosa. No hay una tercera lista
// que mantener: el recurso sale de la ruta, y su título de la ruta más este diccionario.
//
// Las búsquedas viven en `/{area}/busqueda/{recurso}` (la regla de rest.ts), así que
// «Búsqueda» es un recurso más de cada área.
//
// SIN `server-only`: puro (lo usan la referencia en markdown, la pantalla y los tests).
// =============================================================================

import { rutaRestDe } from './rest';

/** El recurso de una operación (`leads`, `campanas`…), o undefined si no sale por HTTP. */
export function recursoDe(operacion: string): string | undefined {
  const r = rutaRestDe(operacion);
  if (!r) return undefined;
  return r.ruta.split('/').filter(Boolean)[1];
}

/** Los recursos cuyo nombre no sale de poner acentos y mayúscula. */
const TITULOS: Record<string, string> = {
  'agente-claude': 'Agente de Claude',
  'borradores-mensaje': 'Borradores de mensaje',
  'borradores-plantilla': 'Borradores de plantilla',
  'casos-ensayo': 'Casos de ensayo',
  'ciclo-venta': 'Ciclo de venta',
  'conjuntos-anuncios': 'Conjuntos de anuncios',
  'cuotas-ia': 'Cuotas de IA',
  'diagnostico-fase': 'Diagnóstico de fase',
  'dominio-envio': 'Dominio de envío',
  'google-calendar': 'Google Calendar',
  'limites-instagram': 'Límites de Instagram',
  'motivos-venta-llamada': 'Motivos de venta por llamada',
  'personalidad-voz': 'Personalidad y voz',
  'scores-mensuales': 'Scores mensuales',
  'segundo-cerebro': 'Second Brain',
  'lead-magnets': 'Lead magnets',
  'links-pago': 'Links de pago',
  cac: 'CAC',
  kpis: 'KPIs',
  mrr: 'MRR',
  vsl: 'VSL',
  panda: 'Panda Video',
  flow: 'Flow',
};

/** Las palabras que en la ruta van sin acento (las rutas son ASCII) y en el título con él. */
const ACENTOS: Record<string, string> = {
  analisis: 'análisis', angulos: 'ángulos', busqueda: 'búsqueda', campanas: 'campañas',
  diagnostico: 'diagnóstico', diagnosticos: 'diagnósticos', estadisticas: 'estadísticas',
  metricas: 'métricas', numeros: 'números', pixeles: 'píxeles', pixel: 'píxel',
  publicos: 'públicos', senales: 'señales', envio: 'envío', limites: 'límites', mias: 'mías',
};

/** «anuncios-con-problemas» → «Anuncios con problemas»; «campanas» → «Campañas». */
export function tituloRecurso(slug: string): string {
  if (TITULOS[slug]) return TITULOS[slug];
  const t = slug.split('-').map((w) => ACENTOS[w] ?? w).join(' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
