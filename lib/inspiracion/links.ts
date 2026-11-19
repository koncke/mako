// =============================================================================
// INSPIRACIÓN: ¿este mensaje de WhatsApp es un link de Instagram para guardar? (19/11/2026, docs/inspiracion/diseno.md §1)
// =============================================================================
// Martín, 19/11: «agarras, copias el link de compartir y se lo envías al chat de MaKo en WhatsApp… cuando detecta que es un
// link de Instagram (normalmente no se le va a enviar un link de Instagram para otra cosa), lo guarda automáticamente».
//
// Puro, sin dependencias: lo usa el doer (lib/mako-doer-in.ts) y lo prueba tests/inspiracion-links.test.ts.
//
// ⚠️ `linkDeInstagram` (lib/carruseles/link.ts) NO sirve acá: su regex arranca con `^` (sólo ve el link si el mensaje EMPIEZA
// con él) y devuelve uno solo. Martín manda varios por mensaje, y la ventana de silencio del doer junta varios mensajes en uno.
// =============================================================================

export type TipoLink = 'reel' | 'post' | 'cuenta';
export interface LinkDeInstagram { ref: string; url: string; tipo: TipoLink }

/** Una publicación: `/p/`, `/reel/`, `/reels/` o `/tv/`, con o sin `@usuario/` antes. */
const PUBLICACION = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?instagram\.com\/(?:[A-Za-z0-9._]{1,30}\/)?(p|reels?|tv)\/([A-Za-z0-9_-]{3,40})/gi;
/** Una cuenta entera: `instagram.com/usuario` (lo que no es una ruta de Instagram). */
const CUENTA = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?=$|[\s?#,;)\]>"'])/gi;
/** Las rutas de Instagram que NO son una cuenta. */
const NO_SON_CUENTA = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct', 'about', 'developer', 'legal', 's', 'share', 'web', 'api', 'challenge']);

/**
 * Todos los links de Instagram de un texto, en el orden en que aparecen y sin repetidos (por `ref`). Las publicaciones salen
 * como `/p/<ref>/` (el shortcode es único en Instagram: lo mismo que hace `linkDeInstagram`); las cuentas, como
 * `instagram.com/<usuario>/`. Un link de una historia (`/stories/`) no cuenta: se borra a las 24 h.
 */
export function linksDeInstagram(texto: string | null | undefined): LinkDeInstagram[] {
  const s = String(texto ?? '');
  const hallados: Array<LinkDeInstagram & { pos: number }> = [];
  const vistos = new Set<string>();
  for (const m of s.matchAll(PUBLICACION)) {
    const ref = m[2];
    if (vistos.has(ref)) continue;
    vistos.add(ref);
    const tipo: TipoLink = m[1].toLowerCase() === 'p' ? 'post' : 'reel';
    hallados.push({ ref, url: `https://www.instagram.com/${tipo === 'reel' ? 'reel' : 'p'}/${ref}/`, tipo, pos: m.index ?? 0 });
  }
  for (const m of s.matchAll(CUENTA)) {
    const usuario = m[1].replace(/\.+$/, '');
    const clave = '@' + usuario.toLowerCase();
    if (!usuario || NO_SON_CUENTA.has(usuario.toLowerCase()) || vistos.has(clave)) continue;
    vistos.add(clave);
    hallados.push({ ref: clave, url: `https://www.instagram.com/${usuario}/`, tipo: 'cuenta', pos: m.index ?? 0 });
  }
  return hallados.sort((a, b) => a.pos - b.pos).map(({ ref, url, tipo }) => ({ ref, url, tipo }));
}

/** El texto sin los links de Instagram (lo que la persona escribió alrededor). */
export function sinLinksDeInstagram(texto: string | null | undefined): string {
  return String(texto ?? '')
    .replace(/\S*instagram\.com\S*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿Lo que escribió junto al link PIDE algo? Si pide («replicá este reel», «hacé un carrusel como este», «transcribime esto»,
 * «¿qué opinás?»), el link no se guarda solo: sigue el turno de siempre, que ya sabe replicar y contestar. Un comentario
 * («mirá este», «buenísimo», «para la serie de ventas») NO pide nada: se guarda y la frase queda como nota.
 */
// ⚠️ `` no sirve con tildes («hacé»: entre la «é» y el espacio no hay borde para JS): los bordes son letras Unicode.
const B = String.raw`(?<!\p{L})`, F = String.raw`(?!\p{L})`;
const PEDIDO = new RegExp(
  [
    // verbos de hacer algo con el link (voseo, tuteo e infinitivo): por la raíz
    String.raw`${B}(replic|copi|calc|imit|recre|adapt|transcrib|traduc|analiz|resum|explic|desarm|escrib|redact|mejor|reescrib|gener)\p{L}*`,
    String.raw`${B}(hac[eé]|haz|hacelo|hazlo|hacer|hagamos|arm[aá]|armar|armame|cre[aá]|crear|creame|dame|decime|dime|contame|cuéntame|pasame|pásame)${F}`,
    String.raw`${B}qu[eé] (opin|te parece|pens|dice)`,
    String.raw`${B}c[oó]mo (lo |la )?(hago|hacemos|hizo|hicieron|se hace)`,
    String.raw`${B}(pod[eé]s|puedes)${F}`,
  ].join('|'),
  'iu',
);

export function pideAlgo(textoSinLinks: string | null | undefined): boolean {
  const t = String(textoSinLinks ?? '').trim();
  if (!t) return false;
  if (t.includes('?') || t.includes('¿')) return true; // una pregunta se contesta: no es «guardalo»
  return PEDIDO.test(t);
}

/**
 * Lo que hace el doer con un mensaje: `null` si no es para Inspiración (no hay links, o pide algo con ellos); si es, los links
 * y la nota (lo que escribió alrededor, que el clasificador lee: «para la serie de ventas» es la mejor pista que hay).
 */
export function paraInspiracion(texto: string | null | undefined): { links: LinkDeInstagram[]; nota: string } | null {
  const links = linksDeInstagram(texto);
  if (!links.length) return null;
  const nota = sinLinksDeInstagram(texto).slice(0, 300);
  if (pideAlgo(nota)) return null;
  return { links, nota };
}
