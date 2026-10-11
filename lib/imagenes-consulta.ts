// =============================================================================
// imagenes-consulta — qué se le pregunta al banco de fotos (Openverse), en orden
// =============================================================================
// Puro y SIN `server-only` a propósito: lo usa lib/imagenes-stock.ts (que sí lo tiene) y así se
// puede testear (tests/editor-landing-server.test.ts).
// =============================================================================

const VACIAS_EN = new Set([
  'a', 'an', 'the', 'your', 'you', 'my', 'our', 'their', 'his', 'her', 'its', 'we', 'i', 'to', 'of', 'for',
  'and', 'or', 'in', 'on', 'at', 'with', 'by', 'from', 'is', 'are', 'be', 'this', 'that', 'it', 'how', 'what',
  'why', 'who', 'now', 'get', 'more', 'all', 'do', 'does', 'can', 'will', 'us', 'me',
]);

/**
 * Las consultas a probar, de la más fiel a la más floja: la frase, sin palabras vacías, las dos
 * últimas palabras de contenido y la más larga. Sin repetir.
 *
 * ⚠️ Openverse exige TODAS las palabras, y con la licencia CC0/PDM una frase entera casi nunca
 * trae nada. Medido el 11/10/2026: el selector de imágenes abre con el título de la sección
 * («Agenda tu llamada gratis» → «Book your free call») y contestaba «No se encontraron
 * resultados»; «book call» y «free call» traen 240 cada una. El «your» solo la dejaba en cero.
 */
export function consultasRelajadas(texto: string): string[] {
  const t = texto.trim().replace(/\s+/g, ' ');
  if (!t) return [];
  const palabras = t.split(' ');
  const contenido = palabras.filter((p) => !VACIAS_EN.has(p.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const largas = [...contenido].sort((x, y) => y.length - x.length);
  const out = [t, contenido.join(' '), contenido.slice(-2).join(' '), largas[0] ?? ''];
  return [...new Set(out.filter(Boolean))];
}
