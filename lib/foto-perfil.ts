// =============================================================================
// foto-perfil — la foto de perfil de una PERSONA: foto, ícono o emoji, siempre como una imagen (26/10/2026)
// =============================================================================
// Martín, desde el teléfono: «la foto de perfil, elimina los 2 botones, hazla más grande y que se pueda clickear en la foto para
// eliminarla o cambiarla, que funcione como las demás fotos de perfil que tenemos en la app, incluso que se pueda poner un
// emoji». Las demás fotos (clientes, proyectos, workspaces) se eligen con `IdentidadPicker` (emoji · íconos · subir · quitar);
// el perfil ahora también.
//
// ⚠️ LA FOTO DE UNA PERSONA ES UNA URL (`usuarios.foto_url`), Y LA LEEN TODOS LOS AVATARES DE LA APP (la barra, el equipo, los
// chats, el teléfono) como `<img src>`. Un emoji guardado como texto no lo dibujaría nadie. Por eso el emoji y el ícono se
// guardan COMO IMAGEN: el emoji, un SVG chico en una URL `data:` (marcado para poder leerlo de vuelta y que el selector sepa qué
// hay); el ícono, su URL de Iconify. Ningún avatar tuvo que cambiar.
// Puro (lo leen los tests).
// =============================================================================

import { urlIcono } from './iconos-catalogo';

const PREFIJO = 'data:image/svg+xml,';
/** La marca del SVG de un emoji: sin ella, un `data:` cualquiera no se lee como emoji. */
const MARCA = 'data-mako-emoji';

/** El emoji como imagen: un círculo claro con el glifo al centro. */
export function fotoDeEmoji(emoji: string): string {
  const e = emoji.trim().replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${MARCA}="1">`
    + '<rect width="100" height="100" fill="#EEF1F6"/>'
    + `<text x="50" y="54" font-size="60" text-anchor="middle" dominant-baseline="middle">${e}</text></svg>`;
  return PREFIJO + encodeURIComponent(svg);
}

/** El emoji de una foto hecha con `fotoDeEmoji`, o null si la foto es otra cosa (una foto, un ícono, nada). */
export function emojiDeFoto(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(PREFIJO)) return null;
  let svg = '';
  try { svg = decodeURIComponent(url.slice(PREFIJO.length)); } catch { return null; }
  if (!svg.includes(MARCA)) return null;
  const m = /<text[^>]*>([^<]*)<\/text>/.exec(svg);
  return m && m[1].trim() ? m[1].trim() : null;
}

/** Lo que manda el selector (`CambioIdentidad` de app/_components/IdentidadPicker.tsx). */
export type CambioFoto = { emoji?: string; icono?: string | null; y?: number | null };

/**
 * La foto nueva para lo que se eligió: la URL que va a `foto_url`, '' para quitarla, o null si el cambio no toca la foto (un
 * encuadre: el perfil no lo guarda, y el selector se abre sin él).
 */
export function fotoDeCambio(c: CambioFoto): string | null {
  if (typeof c.emoji === 'string' && c.emoji.trim()) return fotoDeEmoji(c.emoji);
  if (c.icono === null) return '';
  if (typeof c.icono === 'string' && c.icono.trim()) {
    const v = c.icono.trim();
    // Azul de la casa: un ícono negro (el default de Iconify) no se ve sobre el círculo oscuro del modo oscuro.
    return v.startsWith('icon:') ? urlIcono(v, { tam: 96, color: '#2563EB' }) ?? '' : v;
  }
  return null;
}
