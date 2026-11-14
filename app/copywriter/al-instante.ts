// =============================================================================
// Copywriting responde en el mismo clic: qué cuenta como «abrir otra pantalla» (14/11/2026)
// =============================================================================
// Martín, 14/11/2026: «sigue tardando en abrirme la página. Debería abrirme automáticamente y de última ponerle el loader de
// MaKo, pero no que yo le clique y que no haga nada». Medido en producción (ws 9): abrir un guion dejaba la pantalla QUIETA
// 1,06 s (el server arma la página entera antes de que Next cambie de ruta) y «Replicar» o una plantilla, ~2 s más (primero
// crea la página y recién después navega). La capa de ./AlInstante.tsx tapa la pantalla en el clic; esto decide cuándo.
// Sin 'use client' y sin React: lo prueba tests/copywriter-abre-al-instante.test.ts.
// =============================================================================

/** Las pantallas de Copywriting que arma el server: la portada, una página (escritorio o teléfono). */
const RUTA_COPY = /^\/(?:m\/)?copywriter(?:\/[A-Za-z0-9_-]+)?\/?$/;

/** La ruta y la query, con la query ordenada: `?ws=9&nueva=1` y `?nueva=1&ws=9` son la misma pantalla. */
function clave(u: URL): string {
  const q = [...u.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
  return `${u.pathname.replace(/\/$/, '')}?${q}`;
}

/**
 * ¿El link lleva a OTRA pantalla de Copywriting? Entonces el clic espera al server y la capa va en el acto. Uno a la misma
 * pantalla (sólo cambia el `#`), a otra tab o a otro sitio, no: Next no espera nada de Copywriting.
 */
export function abreOtraPantallaDeCopy(destino: string, actual: string): boolean {
  let a: URL;
  let d: URL;
  try { a = new URL(actual); d = new URL(destino, a); } catch { return false; }
  if (d.origin !== a.origin || !RUTA_COPY.test(d.pathname)) return false;
  return clave(d) !== clave(a);
}

/** Lo que espera la capa antes de decir que está tardando: la portada fría de Vercel llegó a 4,9 s, y crear suma ~1,2 s. */
export const MS_TARDA = 15_000;
