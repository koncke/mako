// =============================================================================
// palabras-clave — el disparador «comenta tu publicación o Reel» con palabras clave, como ManyChat (28/10/2026)
// =============================================================================
// Leandro (Fiesta Music, ws10, ticket #17), por audio en su grupo: «cuando alguien comente la palabra fiesta o la palabra
// guía… en una publicación de Instagram de la cuenta, que se responda el comentario», y por texto: «Tal cual como lo hace
// manychat». El CRON de comentario arrancaba con CUALQUIER comentario: no había dónde poner la palabra.
//
// La regla (el Cerebro, 28/10): una lista de palabras («fiesta», «guía»), «contiene» o «exacta», sin distinguir mayúsculas
// ni acentos; VACÍA = cualquier comentario, como hasta hoy (lo que ya anda no se rompe). El texto que se mira es el del
// comentario que llega en CADA evento (`disparaPorEvento`, lib/disparadores.ts), no el que se guardó cuando nació el lead:
// si no, quien ya comentó una vez no volvía a disparar con la palabra.
// Puro: lo usan el disparador, la pantalla y el test.
// =============================================================================

/** Hasta cuántas palabras y de qué largo (ManyChat no pone tope a la vista; éste alcanza y no infla la fila). */
export const TOPE_PALABRAS = 20;
export const TOPE_LARGO_PALABRA = 60;

/** «contiene»: la palabra aparece en el comentario. «exacta»: el comentario ES la palabra (sin contar signos ni emojis). */
export type Coincidencia = 'contiene' | 'exacta';
export const COINCIDENCIAS: ReadonlyArray<{ value: Coincidencia; label: string }> = [
  { value: 'contiene', label: 'Contiene' },
  { value: 'exacta', label: 'Es exactamente' },
];

/** Un emoji (🔥, 🎉, ❤): cuenta como una palabra propia. */
const EMOJI = /\p{Extended_Pictographic}/u;
const EMOJIS = /\p{Extended_Pictographic}/gu;
/** Lo que acompaña a un emoji y no cambia cuál es: la variante (U+FE0E/FE0F), el tono de piel y el pegamento de las familias. */
const ADORNO_DE_EMOJI = /[\u{FE0E}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu;

/**
 * Lo que se compara: minúsculas, sin acentos (la «ñ» queda), signos fuera, y cada EMOJI como una palabra propia
 * («Fiesta🎉» es «fiesta 🎉»). «¡GUÍA!» y «guia» son lo mismo.
 * ⚠️ EL EMOJI CUENTA (28/10/2026, la revisión del Cerebro): se tiraba con los signos, y una palabra clave «🔥» quedaba
 * vacía: se descartaba al guardar y el CRON arrancaba con CUALQUIER comentario. En ManyChat un emoji es una palabra clave.
 */
export function normalizarComentario(s: string): string {
  return s
    .toLowerCase()
    .replace(ADORNO_DE_EMOJI, '')
    .replace(EMOJIS, ' $& ')
    .replace(/ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0000/g, 'ñ')
    .replace(/[^\p{L}\p{N}\p{Extended_Pictographic}]+/gu, ' ')
    .trim();
}

/** El texto ya normalizado, sin sus emojis: «fiesta 🎉» → «fiesta» (para «exacta» con una palabra que no tiene emoji). */
const sinEmojis = (normalizado: string): string => normalizado.replace(EMOJIS, ' ').replace(/\s+/g, ' ').trim();

/** La lista saneada: sin vacías ni repetidas (por cómo se comparan), con su tope. Se guarda como la escribió la persona. */
export function sanearPalabras(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const vistas = new Set<string>();
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const p = x.trim().replace(/\s+/g, ' ').slice(0, TOPE_LARGO_PALABRA);
    const k = normalizarComentario(p);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    out.push(p);
    if (out.length >= TOPE_PALABRAS) break;
  }
  return out;
}

export const esCoincidencia = (v: unknown): v is Coincidencia => v === 'contiene' || v === 'exacta';

/**
 * ¿ESTE COMENTARIO DISPARA? Sin palabras, siempre (lo de siempre). Con palabras, sin texto, nunca: un comentario que no
 * se pudo leer no puede caer en «entonces todos». «contiene» busca la palabra como palabra entera dentro del comentario
 * («guía» está en «quiero la guía!», no en «guiar»); «exacta», el comentario entero.
 */
export function comentarioDispara(texto: string | null | undefined, palabras: readonly string[] | null | undefined, modo: Coincidencia | null | undefined = 'contiene'): boolean {
  // Sin palabras, cualquier comentario (lo de siempre). ⚠️ CON palabras que no se pueden leer, NINGUNO: antes una lista que
  // quedaba vacía al normalizar caía en «sin palabras» y arrancaba con todos (la revisión del Cerebro, 28/10/2026).
  if (!(palabras ?? []).length) return true;
  const lista = (palabras ?? []).map(normalizarComentario).filter(Boolean);
  if (!lista.length) return false;
  const t = normalizarComentario(texto ?? '');
  if (!t) return false;
  // «exacta»: el comentario entero; con una palabra SIN emoji, los emojis del comentario no cuentan («Fiesta 🎉» es «fiesta»).
  if (modo === 'exacta') return lista.some((p) => p === t || (!EMOJI.test(p) && p === sinEmojis(t)));
  const conBordes = ` ${t} `;
  return lista.some((p) => conBordes.includes(` ${p} `));
}

/** Lo que dice la tarjeta CRON: «con «fiesta» o «guía»» / «que sea «fiesta»». Vacía = nada que agregar. */
export function textoDePalabras(palabras: readonly string[] | null | undefined, modo: Coincidencia | null | undefined): string {
  const lista = (palabras ?? []).filter((p) => p.trim());
  if (!lista.length) return '';
  const unidas = lista.length === 1 ? `«${lista[0]}»` : `${lista.slice(0, -1).map((p) => `«${p}»`).join(', ')} o «${lista[lista.length - 1]}»`;
  return modo === 'exacta' ? `que sea ${unidas}` : `con ${unidas}`;
}

/** Lo que se escribe en la caja: las palabras separadas por coma. */
export const palabrasDeTexto = (s: string): string[] => sanearPalabras(s.split(','));
