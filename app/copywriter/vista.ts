// =============================================================================
// Qué muestra `/copywriter` según su query (11/11/2026, D18), copiado de app/video-editor/vista.ts
// =============================================================================
// Como Image y Video: sin nada, los OUTLIERS (./OutliersCopy.tsx). «Crear desde cero» son las plantillas de siempre
// (`?nueva`, o `?nuevo=<tipo>` de las rutas viejas: D16-D17). «Mis guiones» (`?ver=guiones`) es lo que antes hacía
// `/copywriter`: la última página tocada. Puro: lo leen la página, la pantalla y los tests.
// =============================================================================

type Query = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const RUTA_CREAR_COPY = '/copywriter?nueva';
export const RUTA_GUIONES_COPY = '/copywriter?ver=guiones';

export function vistaDeCopy(q: Query): 'outliers' | 'crear' | 'guiones' {
  if (q.nueva !== undefined || primero(q.nuevo) != null) return 'crear';
  return primero(q.ver) === 'guiones' ? 'guiones' : 'outliers';
}
