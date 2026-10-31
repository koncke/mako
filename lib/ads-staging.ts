// =============================================================================
// ads-staging — el staging de los creativos: cómo se llama un archivo y cuándo sobra
// =============================================================================
// Puro y sin `server-only`, a propósito: lo usan la firma (lib/ads-staging-firma.ts, que llaman creative-signurl y la API de
// MaKo), «Subir creativos» del Media Buyer (lib/media-buyer/subir.ts, que sólo toma paths de acá) y el test. El formato del nombre vive en UN lugar porque el
// barrido lee la hora del propio nombre: si una ruta lo armara distinto, el barrido no lo reconocería y el archivo quedaría
// para siempre, sin error.
//
// Por qué existe el barrido (revisión de la #59, 07/10/2026): borrar el staging dependía de que el NAVEGADOR siguiera
// preguntando, y cerrar el modal cortaba ese sondeo: el archivo quedaba en el bucket para siempre. Hasta el 27/10/2026 barría
// `creative-upload` (la subida a Meta del Ads Manager viejo); con esa ruta borrada, barre `creative-signurl` en cada firma.
// =============================================================================

export const STAGING_CARPETA = 'nueva';

/**
 * Cuánto vive un archivo del staging antes de que el barrido lo dé por sobrante. Zernio lo baja de una URL firmada
 * (lib/media-buyer/subir.ts) dentro de la subida: a las 6 h no le sirve a nadie.
 */
export const VIDA_STAGING_MS = 6 * 60 * 60_000;

/** El nombre de un archivo como lo guarda el staging: sin espacios ni símbolos, y los últimos 80 caracteres (la extensión). */
export function nombreSeguroDeStaging(nombre: string): string {
  const base = nombre.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80);
  return base || 'creativo';
}

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
