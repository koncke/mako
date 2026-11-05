// =============================================================================
// La apertura del Web Generator: la página sin publicar (PURO; 5/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («Web Generator · editor»), T13. Con la página abierta SIN publicar y la charla vacía, el chat
// del editor pregunta un HECHO, «¿Ya está lista para que la vean?»; «Sí, ya está» abre «Publicar» con la dirección que MaKo ya
// propone (el diálogo de siempre: ahí se mira que la dirección esté libre, el tope del plan y el aviso de cobro, que publicar
// por fuera se saltearía); «Ahora no» calla unos días. Lo contestado vale para ESA página (alcance `entidad`).
//
// El dominio propio queda en el diálogo, donde ya está (preguntarlo primero era configuración antes del default). La segunda del
// plan («¿Vas a pautar esta página en Meta?», el Pixel) necesita saber si el funnel lleva anuncios: queda en el relevo.
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosWeb = { pagina: string | null; publicada: boolean; charlaVacia: boolean };

export const ACCIONES_WEB = ['publicar'] as const;
export type AccionWeb = (typeof ACCIONES_WEB)[number];

export const ID_LISTA = 'web:lista';

export function aperturaWeb(h: HechosWeb, _r: Respuestas): Apertura<AccionWeb> | null {
  if (!h.pagina || h.publicada || !h.charlaVacia) return null;
  return {
    id: ID_LISTA, alcance: 'entidad', entidad: h.pagina,
    texto: '¿Ya está lista para que la vean?',
    botones: [
      { tipo: 'hacer', rotulo: 'Sí, ya está', accion: 'publicar' },
      { tipo: 'callar', rotulo: 'Ahora no' },
    ],
  };
}

export const SUPERFICIE_WEB: Superficie<HechosWeb, AccionWeb> = { id: 'web', acciones: ACCIONES_WEB, apertura: aperturaWeb };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_LISTA, cuando: 'La página abierta sin publicar, con la charla vacía.' },
];

const PAGINA = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
export const EJEMPLOS: readonly { nombre: string; h: HechosWeb; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'sin publicar', h: { pagina: PAGINA, publicada: false, charlaVacia: true }, r: {}, espera: ID_LISTA, primerPaso: true },
  { nombre: 'ya publicada', h: { pagina: PAGINA, publicada: true, charlaVacia: true }, r: {}, espera: null },
  { nombre: 'con la charla empezada', h: { pagina: PAGINA, publicada: false, charlaVacia: false }, r: {}, espera: null },
];
