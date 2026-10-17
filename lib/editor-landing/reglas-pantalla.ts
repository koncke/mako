// =============================================================================
// reglas-pantalla — reglas puras del editor que la API de MaKo también necesita (17/10/2026)
// =============================================================================
// «Restablecer estilo» (el panel Estilo de una sección) y el tema que MaKo sugiere para un objetivo (Crear con IA)
// vivían en archivos 'use client' (EstiloSeccion.tsx, SelectorTemaCrear.tsx), y la API de MaKo
// (lib/api-mako/areas/landing-contenido.helpers.ts) no podía importarlos: los tenía COPIADOS, con tests que comparaban
// las copias (deuda de la tanda 7). Viven acá y las dos puntas importan lo mismo.
// Sin 'use client' ni 'server-only'.
// =============================================================================

import { ATTRS_TARJETA_DEFAULT, type AttrsTarjeta } from './doc';
import { TEMAS, TEMA_DEFAULT_ID } from './temas';
import { PLANTILLAS, type CategoriaPlantilla } from './plantillas';
import type { ObjetivoLanding } from '../landing-spec';

/** Lo que «Restablecer estilo» vuelve a su default: la imagen y el diseño se quedan. */
export const ESTILO_RESTABLECIDO: Readonly<Partial<AttrsTarjeta>> = {
  fondo: ATTRS_TARJETA_DEFAULT.fondo,
  fondoColor: ATTRS_TARJETA_DEFAULT.fondoColor,
  fondoDegradado: ATTRS_TARJETA_DEFAULT.fondoDegradado,
  ancho: ATTRS_TARJETA_DEFAULT.ancho,
  alineacion: ATTRS_TARJETA_DEFAULT.alineacion,
  alto: ATTRS_TARJETA_DEFAULT.alto,
  superposicion: ATTRS_TARJETA_DEFAULT.superposicion,
  imagenAjuste: ATTRS_TARJETA_DEFAULT.imagenAjuste,
  imagenFocoX: ATTRS_TARJETA_DEFAULT.imagenFocoX,
  imagenFocoY: ATTRS_TARJETA_DEFAULT.imagenFocoY,
};

/** Qué categoría de plantilla resuelve cada objetivo de la página. */
const CATEGORIA_DE_OBJETIVO: Record<ObjetivoLanding, CategoriaPlantilla> = {
  agendar: 'Agendar',
  vender: 'Vender',
  registrar: 'Captar contactos',
  descargar: 'Captar contactos',
};

/**
 * El tema que MaKo sugiere para un objetivo: el de la primera plantilla de esa categoría.
 * Si esa plantilla nombra un tema que el catálogo ya no tiene, el default — nunca un id que
 * `temaPorId` resolvería a otra cosa sin avisar.
 */
export function temaSugerido(objetivo: ObjetivoLanding): string {
  const id = PLANTILLAS.find((p) => p.categoria === CATEGORIA_DE_OBJETIVO[objetivo])?.tema;
  return id && TEMAS.some((t) => t.id === id) ? id : TEMA_DEFAULT_ID;
}
