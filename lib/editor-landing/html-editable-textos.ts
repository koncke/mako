// =============================================================================
// editor-landing/html-editable-textos — los TEXTOS de un «Diseño editable», para que la IA los cambie sin tocar la forma
// =============================================================================
// Pedido de Martín (24/10/2026), textual: «Todas las paginas de MaKo no son editables, clickeo y no se pueden editar las
// secciones... Eso esta mal. Deben serlo. Y eso no implica romper el diseño, en todo caso agregar funcionalidades al
// editor web.»
//
// Las páginas de MaKo (la de hola-mako.com y las ocho de cada funnel) son secciones de «Diseño editable»
// (html-editable.ts): el HTML de Claude Design tal cual. Para la IA del chat eran una caja cerrada: viajaban como
// `{"t":"conservar"}` (ia-bloques.ts) y MaKo no veía ni una palabra; pedirle «cambia el título» no hacía nada.
//
// LA REGLA: la IA ve la lista de TEXTOS de la sección, en orden, y devuelve la MISMA cantidad; cada texto vuelve a su
// lugar exacto en el HTML. Las etiquetas, las clases, los estilos en línea y los atributos no se tocan: el diseño queda
// igual, cambia lo que dice. Si la cantidad no es la misma, no se adivina dónde iba cada uno: la sección queda como estaba.
// Un texto que la IA devuelve igual deja su pedazo de HTML byte por byte (con sus `&nbsp;` y sus saltos).
//
// ⚠️ PURO, sin DOM ni parser (lo importa ia-bloques.ts, que corre en el server, en el navegador y en los tests). El HTML
//    que llega acá ya pasó por el saneo del server (html-editable-seguro.ts): sin scripts ni comentarios raros. Lo que se
//    escribe se escapa (`&`, `<`, `>`): un texto de la IA nunca abre una etiqueta.
// =============================================================================

/** Una etiqueta (con sus atributos entre comillas, que pueden traer `>`) o un comentario. */
const ETIQUETA = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;
/** Lo que adentro NO es texto para leer: estilos, scripts, íconos dibujados. */
const CRUDOS = new Set(['script', 'style', 'svg', 'noscript', 'template', 'textarea', 'title']);
/** Más textos que esto en UNA sección no viajan a la IA (la sección queda cerrada, como antes). */
export const TOPE_TEXTOS_DISENO = 400;

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith('#x')) { const n = parseInt(k.slice(2), 16); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    if (k.startsWith('#')) { const n = parseInt(k.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENTIDADES[k] ?? m;
  });
}

export function codificar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Lo que ve la IA de un pedazo de texto: decodificado, con los espacios juntados. */
const visible = (crudo: string): string => decodificar(crudo).replace(/\s+/g, ' ').trim();

/**
 * Recorre los pedazos de TEXTO del HTML que se leen (no los de adentro de un estilo, un script o un ícono), en orden,
 * y deja que `f` devuelva su reemplazo (o `null` para dejarlo como está). Devuelve el HTML rearmado.
 */
function recorrer(html: string, f: (texto: string, i: number) => string | null): string {
  let out = '';
  let ultimo = 0;
  let crudo: string | null = null;
  let i = 0;
  const texto = (s: string) => {
    if (crudo || !s.trim()) return s;
    const v = visible(s);
    if (!v) return s;
    const nuevo = f(v, i++);
    if (nuevo === null || nuevo === v) return s;
    const antes = s.match(/^\s*/)?.[0] ?? '';
    const despues = s.match(/\s*$/)?.[0] ?? '';
    return antes + codificar(nuevo) + despues;
  };
  for (const m of html.matchAll(ETIQUETA)) {
    const pos = m.index ?? 0;
    out += texto(html.slice(ultimo, pos));
    const tag = m[0];
    const nombre = /^<\/?([a-zA-Z][\w-]*)/.exec(tag)?.[1]?.toLowerCase() ?? '';
    if (crudo) { if (tag.startsWith('</') && nombre === crudo) crudo = null; }
    else if (!tag.startsWith('</') && !tag.endsWith('/>') && CRUDOS.has(nombre)) crudo = nombre;
    out += tag;
    ultimo = pos + tag.length;
  }
  out += texto(html.slice(ultimo));
  return out;
}

/** Los textos de la sección, en orden, como los ve la IA. */
export function textosDeHtmlEditable(html: string): string[] {
  const xs: string[] = [];
  recorrer(html, (t) => { xs.push(t); return null; });
  return xs;
}

/**
 * Pone los textos nuevos en su lugar, uno por uno. `null` si la cantidad no es la de la sección (no se adivina dónde va
 * cada uno) o si alguno no es texto. Uno igual al de antes deja su pedazo intacto.
 */
export function conTextos(html: string, textos: readonly unknown[]): string | null {
  const antes = textosDeHtmlEditable(html);
  if (!Array.isArray(textos) || textos.length !== antes.length || !textos.every((t) => typeof t === 'string')) return null;
  return recorrer(html, (_v, i) => (textos[i] as string).replace(/\s+/g, ' ').trim());
}
