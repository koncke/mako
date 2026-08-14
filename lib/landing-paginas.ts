// =============================================================================
// landing-paginas — las páginas del workspace, guardadas
// =============================================================================
// Hasta el 14/08/2026 la lista de landings salía de `landing_visits.landing_url`:
// las páginas que se habían OBSERVADO, no las que el negocio dice tener. Eso
// alcanzaba para ofrecerlas en la prueba, pero no se podía corregir una URL mal
// escrita, ni borrar una que se dio de baja, ni agregar la que todavía no
// recibió una sola visita — que es justo la que uno quiere probar.
//
// Guardadas en `app_settings` y no en una tabla propia: son un puñado de URLs
// por workspace, sin relaciones ni historial, y el patrón ya existe acá al lado
// (`landing_token`, `landing.snippet_version`). Una tabla para esto sería una
// migración y un modelo nuevo para guardar una lista de strings.
//
// El módulo NO lleva `server-only`: la normalización y el dedupe son la parte
// que se puede equivocar (dos URLs que son la misma con distinta barra final) y
// tiene que poder testearse.
// =============================================================================

export const PAGINAS_KEY = 'landing.paginas';

/** Tope: si alguien tiene más de esto, el desplegable dejó de ser un desplegable. */
export const MAX_PAGINAS = 12;

/**
 * Normaliza una URL para poder compararlas.
 *
 * Sin esto, `https://x.com/` y `https://x.com` son dos entradas distintas en la
 * lista y el mismo lugar aparece dos veces. Se saca la barra final, se baja el
 * host a minúsculas (el path NO: hay servidores que distinguen) y se tira el
 * hash, que nunca identifica una página distinta para lo que hacemos acá.
 */
export function normalizarUrl(crudo: string): string | null {
  const s = (crudo ?? '').trim();
  if (!s) return null;
  // Sin esquema no se puede rutear ni abrir: se asume https en vez de rechazar,
  // porque «tu-pagina.com» es lo que la gente escribe.
  const conEsquema = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(conEsquema);
    if (!u.hostname.includes('.')) return null;
    u.hash = '';
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ''}${path}${u.search}`;
  } catch {
    return null;
  }
}

/** Las páginas guardadas, saneadas y sin repetidos. Tolera un JSON roto. */
export function parsearPaginas(crudo: string | null): string[] {
  if (!crudo?.trim()) return [];
  let lista: unknown;
  try { lista = JSON.parse(crudo); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  const out: string[] = [];
  for (const x of lista) {
    const u = typeof x === 'string' ? normalizarUrl(x) : null;
    if (u && !out.includes(u)) out.push(u);
  }
  return out.slice(0, MAX_PAGINAS);
}

/**
 * Agrega o REEMPLAZA una página. `anterior` es lo que convierte «guardar» en
 * «editar»: sin eso, corregir una URL mal escrita deja las dos en la lista.
 *
 * Devuelve la lista nueva, o null si la URL no es válida — el caller decide qué
 * decirle a la persona; acá no se inventa un valor para no fallar.
 */
export function conPagina(actuales: string[], url: string, anterior?: string | null): string[] | null {
  const nueva = normalizarUrl(url);
  if (!nueva) return null;
  const prev = anterior ? normalizarUrl(anterior) : null;
  // Se conserva la POSICIÓN al editar: la lista es un desplegable y que un
  // renglón salte al final porque le corregiste una letra es desconcertante.
  const base = prev ? actuales.map((u) => (u === prev ? nueva : u)) : [...actuales, nueva];
  const sinRepetir: string[] = [];
  for (const u of base) if (!sinRepetir.includes(u)) sinRepetir.push(u);
  return sinRepetir.slice(0, MAX_PAGINAS);
}

/** Saca una página de la lista. */
export function sinPagina(actuales: string[], url: string): string[] {
  const u = normalizarUrl(url);
  return u ? actuales.filter((x) => x !== u) : actuales;
}
