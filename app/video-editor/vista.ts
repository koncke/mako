// =============================================================================
// Qué muestra `/video-editor` según su query (9/11/2026), copiado de app/image-editor/vista.ts
// =============================================================================
// Martín, 9/11/2026: «Tal como en imágenes… vas a ver tus outliers primero». Sin `ver`, los OUTLIERS (./OutliersVideo.tsx); con
// `?ver=crear`, la pantalla de Create con las plantillas de «Nuevo video». `?replicar=<plantilla guiada>` abre «Nuevo video» y
// arma ese proyecto al toque (el «Replicar» de una tarjeta): la plantilla se valida contra el catálogo.
// Puro: lo leen la página, la pantalla y los tests.
// =============================================================================

import { plantillaGuiada } from '@/lib/video-plantillas';
import { esFamiliaEdicion, type FamiliaEdicion } from '@/lib/video-outliers';

type Query = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const RUTA_CREAR_VIDEO = '/video-editor?ver=crear';

/**
 * 11/11/2026, Martín: «ya no depender de "Encuentra tu siguiente outlier", sino que sea directamente todo el sistema de edición
 * primero». La tab abre en «Nuevo video» y el editor; los outliers viven ADENTRO del editor (Multimedia › «Outliers», junto a
 * «Importar»: _opencut/outliers/registro.ts). La portada sigue en `?ver=outliers`.
 */
export function vistaDeVideo(q: Query): 'outliers' | 'crear' {
  return primero(q.ver) === 'outliers' && primero(q.replicar) == null ? 'outliers' : 'crear';
}

/** La plantilla guiada que pidió «Replicar», validada; null si no vino o no existe. */
export function replicarDe(q: Query): string | null {
  return plantillaGuiada(primero(q.replicar)?.slice(0, 60))?.id ?? null;
}

export const rutaReplicar = (plantilla: string): string => `/video-editor?ver=crear&replicar=${encodeURIComponent(plantilla)}`;

/** El filtro de la portada por familia de edición (`?patron=`), validado contra la lista; null = todos. */
export function familiaDe(q: Query): FamiliaEdicion | null {
  const f = primero(q.patron)?.slice(0, 40);
  return esFamiliaEdicion(f) ? f : null;
}
