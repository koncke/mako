// =============================================================================
// propuestas-tipos — qué pantalla revisa cada TIPO de propuesta
// =============================================================================
// `propuestas` (mig 0128) es UNA tabla para todo lo que un canal propone y una
// persona confirma, y cada `tipo` se revisa en una pantalla distinta. Este mapa
// es el único lugar que dice cuál: antes la bandeja del CRM linkeaba toda fila a
// /crm/revisar/<id>, cuya página solo renderiza leads, así que una propuesta
// `accion` caía en «no es tuya» sin serlo.
//
// SIN `server-only`, a propósito: lo importan páginas de servidor Y componentes
// cliente. Es un mapa de rutas; el `import type` de abajo se borra al compilar.
// =============================================================================

import type { TipoPropuesta } from './propuestas';

export const PANTALLA_DE_PROPUESTA: Record<TipoPropuesta, { pantalla: string; bandeja: string; nombre: string }> = {
  lead: { pantalla: '/crm/revisar', bandeja: '/crm/revisar', nombre: 'Contactos para revisar' },
  accion: { pantalla: '/mako/revisar', bandeja: '/mako/revisar', nombre: 'Acciones de MaKo para revisar' },
};

/** La URL relativa donde se revisa una propuesta. Un tipo que no está en el mapa
 *  (una fila vieja con un tipo que ya no existe) cae en la genérica de MaKo, que
 *  sabe decir «esto no es una acción» en vez de romperse. */
export function rutaDePropuesta(tipo: TipoPropuesta, id: string): string {
  const p = PANTALLA_DE_PROPUESTA[tipo] ?? PANTALLA_DE_PROPUESTA.accion;
  return `${p.pantalla}/${encodeURIComponent(id)}`;
}
