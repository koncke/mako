// =============================================================================
// spy-que-es — qué es lo que se escribió o se pegó (se mudó de lib/spy.ts el 3/11/2026)
// =============================================================================
// Sin `server-only`, y por eso existe: el modal de «Mirar a alguien más» tiene que saber qué es lo
// escrito ANTES de gastar una búsqueda. Un enlace de YouTube o un sitio no se buscan en Instagram.
// Si el navegador tuviera su propia expresión, un enlace podría ofrecerse como sitio en la pantalla y
// guardarse como otra cosa en el servidor: es UNA sola función, y `agregarCompetidor` usa la misma.
// =============================================================================

import { TOPES } from './spy-reglas';
import { canalDeUrl } from './spy-youtube';
import { redDeUrl } from './spy-otras-redes-reglas';
import { usuarioDeUrlInstagram } from './instagram-buscar';

/**
 * Lo que se pega para agregar un competidor: UN campo, no un formulario. Un @ de Instagram, un link
 * de YouTube, el link de su landing o su nombre. Es el mismo patrón del link pegado del Web
 * Generator: la persona pega lo que tiene y el código resuelve qué es.
 */
export function queEs(crudo: string): { campo: 'instagram' | 'youtube_id' | 'tiktok' | 'landing_url' | 'nombre'; valor: string } | null {
  const s = (crudo ?? '').trim();
  if (!s) return null;
  // Un @ suelto, o un link de Instagram.
  const arroba = s.match(/^@([A-Za-z0-9._]{2,30})$/);
  if (arroba) return { campo: 'instagram', valor: arroba[1].toLowerCase() };
  // ⚠️ CON O SIN https, Y UN POST NO ES UN PERFIL (4/11/2026). «instagram.com/herasmedia» pegado sin el protocolo caía
  // en la regla del dominio pelado y se guardaba como su LANDING; y «instagram.com/reel/ABC» se leía como el @ «reel».
  // `usuarioDeUrlInstagram` es la que ya sabe qué tramos no son un usuario.
  if (/^(?:https?:\/\/)?(?:[a-z]+\.)?instagram\.com\//i.test(s)) {
    const u = usuarioDeUrlInstagram(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u ? { campo: 'instagram', valor: u } : null;
  }
  // Un canal de YouTube. `canalDeUrl` ya sabe qué formas puede resolver y cuáles no (un `/c/<alias>`
  // no tiene endpoint y devuelve null, en vez de adivinar).
  if (/youtube\.com|youtu\.be/i.test(s)) {
    const c = canalDeUrl(s);
    if (c && 'id' in c) return { campo: 'youtube_id', valor: c.id };
    // Un @handle o un /user/ se resuelven con una llamada: se guardan como vinieron y `mirarCompetidor` los resuelve.
    if (c && 'handle' in c) return { campo: 'youtube_id', valor: `@${c.handle}` };
    if (c && 'usuario' in c) return { campo: 'youtube_id', valor: `user:${c.usuario}` };
    return null;
  }
  // Su TikTok (0365). ⚠️ Va ANTES de la regla de «cualquier link es su sitio»: sin esto, un link a
  // su TikTok en la bio se guardaba como su LANDING. Lo lee `redDeUrl`, la misma función que lee los
  // resultados de la búsqueda: así un candidato confirmado entra con el mismo @ que se ofreció.
  const tt = redDeUrl(s);
  if (tt?.red === 'tiktok') return { campo: 'tiktok', valor: tt.ref };
  if (/^https?:\/\//i.test(s)) return { campo: 'landing_url', valor: s.slice(0, 500) };
  // Un dominio pelado también es una landing («acme.com»).
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return { campo: 'landing_url', valor: `https://${s}`.slice(0, 500) };
  return { campo: 'nombre', valor: s.slice(0, TOPES.nombre) };
}
