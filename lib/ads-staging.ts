// =============================================================================
// ads-staging — el staging de los creativos: cómo se llama un archivo y cuándo sobra
// =============================================================================
// Puro y sin `server-only`, a propósito: lo usan las dos rutas que tocan el staging
// (creative-signurl lo nombra, creative-upload lo borra) y el test. El formato del nombre
// vive en UN lugar porque el barrido lee la hora del propio nombre: si una ruta lo armara
// distinto, el barrido no lo reconocería y el archivo quedaría para siempre, sin error.
//
// Por qué existe el barrido (revisión de la #59, 07/10/2026): al bajar la espera del POST
// de creative-upload de 150 a 25 s, borrar el staging de un video pasó a depender de que
// el NAVEGADOR siga preguntando (el GET borra con el veredicto de Meta). Cerrar Agregar
// anuncio / Agregar conjunto, o quitar la tarjeta en Nueva campaña, corta ese sondeo, y el
// archivo quedaba en el bucket para siempre: nada más limpia ese bucket.
// =============================================================================

export const STAGING_CARPETA = 'nueva';

/**
 * Cuánto vive un archivo del staging antes de que el barrido lo dé por sobrante. Meta lo
 * baja de una URL firmada por 1 h (creative-upload, `createSignedUrl(path, 3600)`), y la
 * transcripción lo baja dentro de los 300 s del POST: a las 6 h no le sirve a nadie.
 */
export const VIDA_STAGING_MS = 6 * 60 * 60_000;

/** El path de un archivo nuevo del staging: `nueva/<ms>-<azar>-<nombre>`. */
export function pathNuevoDeStaging(nombreSeguro: string, ahoraMs: number = Date.now(), azar: () => number = Math.random): string {
  return `${STAGING_CARPETA}/${ahoraMs}-${azar().toString(36).slice(2, 8)}-${nombreSeguro}`;
}

/** Un path de staging que las rutas aceptan borrar: los que nombra pathNuevoDeStaging. */
export function esPathDeStaging(p: string | null | undefined): p is string {
  return !!p && p.startsWith(`${STAGING_CARPETA}/`) && !p.includes('..') && !p.includes('\\') && p.length < 300;
}

/**
 * ¿Este archivo (su nombre adentro de la carpeta, como lo devuelve `list`) ya sobra? Lee la
 * hora del propio nombre. Un nombre que no tiene la forma de pathNuevoDeStaging NO sobra:
 * no lo puso esta ruta, y no se borra lo que no se sabe de quién es.
 */
export function stagingVencido(nombre: string, ahoraMs: number, vidaMs: number = VIDA_STAGING_MS): boolean {
  const m = /^(\d{13})-[a-z0-9]{1,8}-./.exec(nombre);
  if (!m) return false;
  const t = Number(m[1]);
  return Number.isFinite(t) && ahoraMs - t > vidaMs;
}
