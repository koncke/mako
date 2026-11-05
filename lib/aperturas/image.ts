// =============================================================================
// La apertura del Image Editor: el diseño en blanco (PURO; 5/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («Image»), T12. Con el diseño EN BLANCO (una página sin nada) y la charla vacía, el chat del
// editor pregunta un HECHO, «¿Dónde lo vas a publicar?», y cada respuesta pone el lienzo a la medida de ese lugar, sin IA
// (`editor.pages.resize`, el mismo del panel de tamaño). Lo contestado vale para ESE diseño (alcance `entidad`).
//
// El plan nombra cuatro lugares (Historia, Carrusel, Anuncio, Miniatura): con el botón de callar obligatorio entran tres
// (`MAX_BOTONES`), y la miniatura de YouTube no es de las piezas de un negocio que vende por Instagram y anuncios. Queda en el
// panel de tamaño, donde ya está. Las plantillas «sugeridas de esa familia» llegan con las de plantillas-reales (README §3.3).
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosImage = { diseno: string | null; enBlanco: boolean; charlaVacia: boolean };

export const ACCIONES_IMAGE = ['historia', 'carrusel', 'anuncio'] as const;
export type AccionImage = (typeof ACCIONES_IMAGE)[number];

/** La medida de cada lugar, en píxeles: la historia 9:16, el carrusel 4:5 (Instagram), el anuncio 1:1 (el feed de Meta). */
export const MEDIDA_DE: Readonly<Record<AccionImage, { ancho: number; alto: number }>> = {
  historia: { ancho: 1080, alto: 1920 },
  carrusel: { ancho: 1080, alto: 1350 },
  anuncio: { ancho: 1080, alto: 1080 },
};

export const ID_DONDE = 'image:donde';

export function aperturaImage(h: HechosImage, _r: Respuestas): Apertura<AccionImage> | null {
  if (!h.diseno || !h.enBlanco || !h.charlaVacia) return null;
  return {
    id: ID_DONDE, alcance: 'entidad', entidad: h.diseno,
    texto: '¿Dónde lo vas a publicar?',
    botones: [
      { tipo: 'hacer', rotulo: 'En una historia', accion: 'historia' },
      { tipo: 'hacer', rotulo: 'En un carrusel', accion: 'carrusel' },
      { tipo: 'hacer', rotulo: 'En un anuncio', accion: 'anuncio' },
      { tipo: 'callar', rotulo: 'Lo edito yo' },
    ],
  };
}

export const SUPERFICIE_IMAGE: Superficie<HechosImage, AccionImage> = { id: 'image', acciones: ACCIONES_IMAGE, apertura: aperturaImage };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_DONDE, cuando: 'Un diseño con una página sin nada, y la charla vacía.' },
];

const DISENO = '7c1e4a90-2b3d-4f5e-8a6b-9c0d1e2f3a4b';
export const EJEMPLOS: readonly { nombre: string; h: HechosImage; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'el diseño en blanco', h: { diseno: DISENO, enBlanco: true, charlaVacia: true }, r: {}, espera: ID_DONDE, primerPaso: true },
  { nombre: 'con algo en la página', h: { diseno: DISENO, enBlanco: false, charlaVacia: true }, r: {}, espera: null },
  { nombre: 'con la charla empezada', h: { diseno: DISENO, enBlanco: true, charlaVacia: false }, r: {}, espera: null },
  { nombre: 'sin diseño abierto', h: { diseno: null, enBlanco: true, charlaVacia: true }, r: {}, espera: null },
];
