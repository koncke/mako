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

import { urlIcono, ORIGEN_ICONOS } from './iconos-catalogo';

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

// ── De DÓNDE puede venir la foto de una persona (6/11/2026) ───────────────────
// ⚠️ `usuarios.foto_url` LO ESCRIBE EL CLIENTE Y LO DIBUJA MARTÍN. `POST /api/perfil`
// (`action: 'perfil'`) está abierto a todos los roles a propósito —el Sidebar de un closer
// lee ahí su nombre y su foto— y hasta acá guardaba la URL tal cual (`setPerfil`: un
// `.trim()`) y la servía con un `/^https:\/\//` (`aFila` de lib/tickets-db.ts,
// lib/comunidad-datos.ts). Cualquier https pasaba.
//
// Lo que eso compra, sin ningún exploit: un cliente pone de foto
// `https://servidor-suyo/pixel.gif`, levanta un ticket, y su log le dice CUÁNDO Martín abre
// la bandeja, desde qué IP y con qué navegador. Es un web bug clásico, y la bandeja de
// tickets es el peor lugar para tenerlo: la abre siempre la misma persona.
//
// ⚠️ Y «SÓLO EL STORAGE PROPIO Y GOOGLE» SE LLEVA PUESTOS DOS AVATARES QUE SÍ SON NUESTROS.
// Desde el 26/10 la foto de una persona también puede ser un EMOJI (un SVG en una URL
// `data:`, acá arriba) o un ÍCONO de Iconify (`fotoDeCambio`). Una lista de hosts https
// deja a los dos afuera y rompe el selector sin que nada avise: el emoji ni siquiera es
// https. Por eso la lista son cuatro orígenes, no dos.
//
// El `data:` del emoji no se acepta como vino: se le lee el emoji y se VUELVE A DIBUJAR con
// `fotoDeEmoji`, así lo que entre en ese SVG no es lo que sale. No hace falta para que sea
// inerte (un `data:` en `<img src>` no ejecuta nada), pero el valor que se guarda y se
// dibuja es entonces siempre uno que armamos nosotros.
//
// Gravatar entra porque es el RESPALDO que arma `caraDeUsuario` (lib/gravatar.ts), no algo
// que el cliente elija: filtrar ahí sin tenerlo en la lista se comería su propia salida.

/** El host del storage propio, el de `NEXT_PUBLIC_SUPABASE_URL`. null si no está cargada. */
export function hostDelStoragePropio(): string | null {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) return null;
  try { return new URL(v).hostname.toLowerCase(); } catch { return null; }
}

/**
 * Los dominios de terceros de los que SÍ se dibuja la foto de una persona. Ninguno lo elige
 * el cliente: Google es el `picture` de su login, Iconify el ícono del selector y Gravatar el
 * respaldo que armamos nosotros con el hash de su email.
 */
const DOMINIOS = [
  'googleusercontent.com',           // lh3.googleusercontent.com — el login con Google
  new URL(ORIGEN_ICONOS).hostname,   // api.iconify.design — el ícono del selector
  'gravatar.com',                    // el respaldo de `caraDeUsuario`
] as const;

const deDominio = (host: string, d: string) => host === d || host.endsWith(`.${d}`);

/**
 * La foto de una persona si viene de un origen nuestro, o null.
 *
 * Es el filtro de las DOS CAPAS: se llama al GUARDAR (`setPerfil`) para que no entre, y al
 * DIBUJAR (`caraDeUsuario`, `aFila`) porque las filas que ya están en la base no se
 * reescriben solas.
 *
 * `storage` es para los tests: sin él sale de `NEXT_PUBLIC_SUPABASE_URL`.
 */
export function fotoDePersonaSegura(url: string | null | undefined, opts?: { storage?: string | null }): string | null {
  const v = (url ?? '').trim();
  if (!v) return null;

  // El emoji: se vuelve a dibujar, no se copia.
  const emoji = emojiDeFoto(v);
  if (emoji) return fotoDeEmoji(emoji);

  let u: URL;
  try { u = new URL(v); } catch { return null; }
  // Sólo https: un `http://` viaja en claro, y cualquier otro esquema (`javascript:`, otro
  // `data:`) no es una foto nuestra.
  if (u.protocol !== 'https:') return null;
  // `https://api.iconify.design@servidor-suyo/x.gif` lo pide a servidor-suyo. `new URL` ya lo
  // parsea bien (hostname = servidor-suyo), pero un usuario/clave en la URL nunca es nuestro.
  if (u.username || u.password) return null;

  const host = u.hostname.toLowerCase();
  const propio = opts?.storage !== undefined ? opts.storage : hostDelStoragePropio();
  if (propio && host === propio) return v;
  return DOMINIOS.some((d) => deDominio(host, d)) ? v : null;
}
