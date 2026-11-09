// =============================================================================
// Las plantillas GUIADAS de la tab Video: las que copian un outlier y MaKo lleva paso a paso (PURO; 9/11/2026)
// =============================================================================
// Distintas de las plantillas de anuncio del editor (lib/editor-video/plantillas.ts), que arman una línea de tiempo con huecos:
// una guiada arranca de un video que funciona y pide las piezas (personaje, voz, guion…) en el chat de MaKo. Hoy hay una,
// «Mensaje para…» (./mensaje-para.ts). Una nueva: su módulo al lado, su fila acá, y su outlier en lib/video-outliers.ts.
// =============================================================================

import { PLANTILLA_MENSAJE_PARA } from './mensaje-para';

export type PlantillaGuiada = typeof PLANTILLA_MENSAJE_PARA;

export const PLANTILLAS_GUIADAS: readonly PlantillaGuiada[] = [PLANTILLA_MENSAJE_PARA];

export function plantillaGuiada(id: string | null | undefined): PlantillaGuiada | null {
  if (!id) return null;
  return PLANTILLAS_GUIADAS.find((p) => p.id === id) ?? null;
}
