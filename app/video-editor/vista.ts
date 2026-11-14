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
import { recetaDe } from '@/lib/video-recetas';
import { leerClaveDesarme } from '@/lib/video-desarmar';

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

/** ¿Se entra a la tab sin pedir nada? Entonces abre el EDITOR (el último proyecto o uno nuevo): ./VideoEditorCliente.tsx. */
export function abreElEditor(q: Query): boolean {
  return primero(q.ver) == null && primero(q.replicar) == null && primero(q.receta) == null && primero(q.desarme) == null;
}

/**
 * El video DESARMADO que pidió «Abrir en el editor» (`?desarme=<red>.<id>`, ticket 97, ./Desarmar.tsx), validado con la forma de
 * `claveDeDesarme`; null si no vino o no es una. Va por la entrada de la tab, como `?receta=`: la página de un proyecto lee SÓLO
 * `desde`, `plantilla` y `propuesta` (tests/video-editor-integracion.test.ts, 2b). La plantilla la arma el server con lo que
 * guardó el negocio (lib/video-desarmar-servidor.ts → `desarmadoParaElEditor`).
 */
export function desarmePedido(q: Query): string | null {
  const c = leerClaveDesarme(primero(q.desarme));
  return c ? `${c.red}.${c.id}` : null;
}

/** «Abrir en el editor» de un video desarmado: la plantilla «toca para reemplazar» en un proyecto nuevo. */
export const rutaAbrirDesarme = (clave: string): string => `/video-editor?ver=crear&desarme=${encodeURIComponent(clave)}`;

/** La receta que pidió «Replicar» de un reel (`?receta=`), validada contra lib/video-recetas.ts; null si no vino o no existe. */
export function recetaPedida(q: Query): string | null {
  return recetaDe(primero(q.receta)?.slice(0, 60))?.id ?? null;
}

/** «Replicar» de una receta: arma el proyecto vertical con su nombre y MaKo dice la receta en el chat. */
export const rutaReplicarReceta = (receta: string): string => `/video-editor?ver=crear&receta=${encodeURIComponent(receta)}`;

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
