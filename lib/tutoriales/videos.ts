// =============================================================================
// EL VIDEO CHICO DE CADA TUTORIAL: el manifiesto de public/tutoriales (18/11/2026)
// =============================================================================
// Los videos de Martín (uno por pestaña y uno del recorrido general) los hace el chat «Tutoriales animados con voz» y van en
// `public/tutoriales/<key>.mp4`, con `public/tutoriales/manifiesto.json`: [{ key, archivo, duracion_s, guion, poster }].
// El motor muestra el de la pestaña leyendo el manifiesto. Si la key todavía no tiene video, NO va ningún video: nunca otro en
// su lugar (Martín, 18/11: «pusiste literalmente el video que tenemos en la landing… ¿cómo vamos a armar un tutorial con eso?»).
// =============================================================================

export const RUTA_MANIFIESTO = '/tutoriales/manifiesto.json';

export type VideoTutorial = { key: string; archivo: string; duracion_s?: number; guion?: string; poster?: string };

/** Una entrada válida del manifiesto: su `archivo` es de /tutoriales (nunca un video de otro lado). */
function entradaValida(x: unknown): x is VideoTutorial {
  if (!x || typeof x !== 'object') return false;
  const v = x as Record<string, unknown>;
  return typeof v.key === 'string' && v.key.length > 0 && typeof v.archivo === 'string' && /^(\/tutoriales\/)?[\w.-]+\.(mp4|webm)$/.test(v.archivo);
}

/** El video de una key, o null. El archivo sale con su ruta pública. */
export function videoDe(manifiesto: unknown, key: string): VideoTutorial | null {
  const lista = Array.isArray(manifiesto) ? manifiesto : manifiesto && typeof manifiesto === 'object' && Array.isArray((manifiesto as { videos?: unknown }).videos) ? (manifiesto as { videos: unknown[] }).videos : [];
  const v = lista.find((x) => entradaValida(x) && x.key === key) as VideoTutorial | undefined;
  if (!v) return null;
  const ruta = (a: string) => (a.startsWith('/') ? a : `/tutoriales/${a}`);
  return { ...v, archivo: ruta(v.archivo), ...(typeof v.poster === 'string' && v.poster ? { poster: ruta(v.poster) } : {}) };
}
