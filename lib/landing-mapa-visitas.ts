// =============================================================================
// Qué visitas pueden ser de UNA página: el filtro que se le pide a la base
// =============================================================================
// Lo usa `verificarPagina` (lib/landing-token.ts), que contesta «¿esta página tiene el Pixel, y qué versión?» y
// que el mapa de calor pregunta cada vez que abre una página.
//
// ⚠️ ANTES LEÍA TODAS LAS VISITAS DEL HOST, EN SERIE (relevo v5, área D): `ilike '%host%'` de 30 días, paginado
// por id, para quedarse con la versión de la más nueva. En el ws1 eran 7.180 filas (8 páginas una detrás de la
// otra) en cada apertura del mapa, sólo para saber un número. Ahora es UNA consulta acotada: las más nuevas de
// ESTA dirección (`regexDeLaPagina`), con tope, ordenadas por fecha. Quién es esta página lo sigue decidiendo
// `normalizarUrl` con una igualdad exacta en memoria (una cosa, un lugar): la regex sólo trae CANDIDATOS, y no
// se puede quedar corta.
//
// SIN `server-only`: es lo que se puede equivocar (una regex que deja afuera una forma real de la dirección dice
// «no instalada» sobre una página que mide) y tiene test (tests/landing-mapa-vivo.test.ts).
// =============================================================================

/** Cuántas visitas se leen como mucho: el tope de una página de PostgREST, en UNA consulta. */
export const TOPE_VISITAS_VERIFICAR = 1000;

const escRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * La regex (POSIX de Postgres, se usa con `imatch`: sin mayúsculas) que trae todas las filas cuya
 * `landing_url` PUEDE normalizar a `url` (que ya viene de `normalizarUrl`). Cubre lo que `normalizarUrl` funde:
 *   · http o https (se separan después, en memoria);
 *   · el prefijo de un deploy de Netlify (`<hash>--sitio.netlify.app`, `hostCanonico`);
 *   · las barras finales;
 *   · cualquier query o fragmento (los de medición se descartan al normalizar; los demás se separan en memoria).
 * Y deja afuera lo que nunca puede ser esta página: otro host, otro camino, un camino más largo (`/vsl-2` no es
 * `/vsl`). `null` si `url` no se puede leer.
 */
export function regexDeLaPagina(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  const puerto = u.port ? `:${escRegex(u.port)}` : '';
  const camino = u.pathname.replace(/\/+$/, '');
  return `^https?://([0-9a-f]{20,}--)?${escRegex(host)}${puerto}${escRegex(camino)}/*([?#].*)?$`;
}
