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

/**
 * Lo que se compara: minúsculas, sin acentos (la «ñ» queda), y todo lo que no es letra ni número pasa a un espacio
 * (signos, emojis). «¡GUÍA!» y «guia» son lo mismo; «Fiesta 🎉» es «fiesta».
 */
export function normalizarComentario(s: string): string {
  return s
    .toLowerCase()
    .replace(/ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0000/g, 'ñ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

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
  const lista = (palabras ?? []).map(normalizarComentario).filter(Boolean);
  if (!lista.length) return true;
  const t = normalizarComentario(texto ?? '');
  if (!t) return false;
  if (modo === 'exacta') return lista.includes(t);
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
