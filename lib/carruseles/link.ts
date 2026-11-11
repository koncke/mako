// =============================================================================
// El link de una publicación de Instagram (6/11/2026; módulo propio desde el 11/11/2026)
// =============================================================================
// Sin dependencias: lo usan la biblioteca (./biblioteca.ts, que lo reexporta), el script de la PC y la pantalla de los outliers,
// que ofrece «Traer este carrusel» cuando lo escrito en el buscador es un link (app/image-editor/carruseles/ExplorarCarruseles.tsx).
// =============================================================================

/** De dónde puede venir un link de una publicación de Instagram: `/p/`, `/reel/`, `/reels/` o `/tv/`, con o sin `@usuario` antes. */
const LINK_DE_PUBLICACION = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)?instagram\.com\/(?:[^/\s?#]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]{3,30})(?:[/?#]|$)/i;

/**
 * El link de una publicación de Instagram, normalizado: su `ref` (el shortcode, que es la identidad de la pieza, igual que en
 * `piezasDeApify`) y la dirección con que se le pide al actor. null si no es un link de una publicación.
 *
 * ⚠️ La dirección sale siempre como `/p/<ref>/`: el shortcode es único en Instagram y el actor lo resuelve igual venga de un
 * reel o de un tv. La `url` que se GUARDA no es ésta, es el `permalink` que devuelve el actor (`filasDeLectura`).
 * ⚠️ Un shortcode suelto NO cuenta: sin el dominio no se puede saber si es un link, un nombre de cuenta o cualquier palabra.
 */
export function linkDeInstagram(texto: string | null | undefined): { ref: string; url: string } | null {
  const m = String(texto ?? '').trim().match(LINK_DE_PUBLICACION);
  return m ? { ref: m[1], url: `https://www.instagram.com/p/${m[1]}/` } : null;
}
