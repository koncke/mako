// =============================================================================
// graficos-plantillas-etiquetas — para qué negocio es cada plantilla del Dashboard y de General
// =============================================================================
// Lo que lee `ordenarConSugeridas` (lib/plantillas-sugeridas.ts) para poner primero, con un «Sugerido» sutil, las que
// le sirven a ESTE negocio (Martín, 16/10/2026). Una fila por plantilla de la galería, y el test exige que estén TODAS
// (tests/plantillas-sugeridas.test.ts): una plantilla nueva sin su fila no pasa. `{}` es una decisión, no un olvido: la
// plantilla no se sugiere nunca (la General de siempre ya es la que arranca; la de IA no depende de cómo vende).
//
// Cómo se eligen: por la PREGUNTA que contesta la plantilla, no por los conjuntos que lee. Closing es para quien vende
// por llamada; Cobranza, para quien cobra una suscripción (hay cuotas que vencen cada mes). Pocas por fila: cada
// etiqueta de más la hace sugerida para más negocios, y «Sugerido» en todas no dice nada.
// ⚠️ UNA PLANTILLA DE UN CANAL NO LLEVA UN EJE GENÉRICO. Los ejes SUMAN por separado: con `cuello: ['conversion']`,
//    «Ventas por WhatsApp» salía sugerida a quien vende por llamada (visto en el arnés el 16/10/2026). Closing, los
//    funnels de llamadas y de WhatsApp y Chat Analyst se sugieren sólo por su canal y sus entradas.
// =============================================================================

import type { EtiquetasPlantilla } from './plantillas-sugeridas';

/** La galería del Dashboard (`PLANTILLAS_HOJA`). */
export const ETIQUETAS_DASHBOARD: Readonly<Record<string, EtiquetasPlantilla>> = {
  marketing: { entrada: ['formulario_anuncio', 'landing'] },
  comercial: { canal: ['llamadas', 'conversaciones'], cuello: ['conversion'] },
  'ads-analyst': { entrada: ['formulario_anuncio'] },
  'hooks-retencion': { entrada: ['formulario_anuncio'] },
  landing: { entrada: ['landing', 'carrito'], canal: ['carrito'] },
  closing: { canal: ['llamadas'], entrada: ['agenda_sola'] },
  productividad: { cuello: ['sistema', 'delegacion', 'foco'] },
  'vsl-analyst': { entrada: ['landing'], canal: ['webinar'] },
  'cs-analyst': { cobro: ['suscripcion'] },
  'chat-analyst': { canal: ['conversaciones'], entrada: ['chat_entrante', 'chat_saliente'] },
  cobranza: { cobro: ['suscripcion'] },
  automatizaciones: { entrada: ['chat_entrante', 'chat_saliente'], cuello: ['sistema'] },
  'ia-contenido': {},
  // Por RUBRO: las sugeridas no tienen un eje de rubro (canal, entrada, cobro y cuello), así que no se sugiere; se encuentra por nombre.
  inmobiliaria: {},
  // Para quien sale a buscar (escribe o llama primero, en frío). NO por el canal «llamadas»: con eso le ganaba el lugar a Marketing a
  // quien vende por llamada con leads que entran solos de anuncios (tests/plantillas-sugeridas.test.ts, 04/11/2026).
  'cold-calling': { entrada: ['chat_saliente'] },
  // La de los clientes de una agencia inmobiliaria (6/11/2026). Sin etiquetas, como Inmobiliaria: con «llamadas» y «anuncios» le
  // sacaba el lugar a Marketing a quien vende por llamada con leads de anuncios (tests/plantillas-sugeridas.test.ts). Se encuentra
  // por su nombre y por «inmobiliaria», «primer contacto» o «grabar».
  'velocidad-llamada': {},
};

/** La galería de General (`PLANTILLAS_GENERAL`). */
export const ETIQUETAS_GENERAL: Readonly<Record<string, EtiquetasPlantilla>> = {
  general: {},
  foco: { cuello: ['foco'] },
  'mi-dia': { cuello: ['foco'] },
  operacion: { cuello: ['sistema', 'delegacion'] },
  servicio: { cobro: ['suscripcion'] },
  curso: { canal: ['carrito', 'webinar'] },
  instagram: { entrada: ['formulario_anuncio'] },
};
