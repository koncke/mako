import 'server-only';

// =============================================================================
// doer-links-server — leer los links del mensaje con las barandas de siempre (lib/landing-fetch.ts: sólo http/https, IPs públicas,
// redirects revalidados, tope de tamaño y de tiempo). Lo puro y el porqué, en lib/doer-links.ts.
// =============================================================================

import { htmlDePagina } from './landing-fetch';
import { LINKS_POR_MENSAJE, linksDelTexto, metaDelHtml, type LinkLeido } from './doer-links';

/** El turno no espera más que esto por un link: un sitio lento no frena la respuesta. */
export const PLAZO_DEL_LINK_MS = 6_000;

/** Lee hasta `LINKS_POR_MENSAJE` links del texto, en paralelo. Nunca tira: lo que no se pudo leer vuelve con su `error`. */
export async function leerLinksDelTexto(texto: string, plazoMs = PLAZO_DEL_LINK_MS): Promise<LinkLeido[]> {
  const urls = linksDelTexto(texto).slice(0, LINKS_POR_MENSAJE);
  return Promise.all(urls.map(async (url): Promise<LinkLeido> => {
    let reloj: ReturnType<typeof setTimeout> | undefined;
    try {
      const html = await Promise.race([
        htmlDePagina(url, { talCual: true }),
        new Promise<never>((_ok, mal) => { reloj = setTimeout(() => mal(new Error('tardó demasiado')), plazoMs); }),
      ]);
      return { url, meta: metaDelHtml(html) };
    } catch (e) {
      return { url, error: (e instanceof Error ? e.message : String(e)).slice(0, 120) };
    } finally {
      if (reloj) clearTimeout(reloj);
    }
  }));
}
