'use client';

// =============================================================================
// textos-de-bloque — poner en la tarjeta los textos que el bloque cambió, y encontrar el que se tocó (9/11/2026)
// =============================================================================
// La regla (qué se puede cambiar, cómo se guarda) es pura y vive en lib/disenos-textos.ts. Acá, el DOM:
//   · `aplicarTextos`: recorre los textos de la tarjeta y muestra el nuevo donde el original se cambió. React es el dueño de
//     esos nodos: si React vuelve a escribir uno (llegó otro dato), se toma lo que escribió como el original nuevo y se vuelve
//     a aplicar el cambio. El bloque lo corre al dibujarse y con un MutationObserver (./BloqueDeDiseno.tsx).
//   · `textoEnPunto`: el texto que está debajo del puntero (dos toques editando), con su original y su caja.
// ⚠️ No se usa contentEditable: escribir adentro de un nodo de React le rompe la reconciliación. El campo va ENCIMA
//    (./EditorInforme.tsx, `TapaDeDiseno`) y lo escrito se guarda en el bloque.
// =============================================================================

import { esTextoEditable, textoAMostrar, type TextosDeBloque } from '@/lib/disenos-textos';

/** Lo que el bloque escribió en cada nodo: el original del diseño y lo que puso. */
const PUESTOS = new WeakMap<Text, { original: string; puesto: string }>();

/** Adentro de esto no se tocan textos: dibujos, campos, y las filas de una tabla (son datos). */
const FUERA = 'svg, style, script, input, textarea, select, tbody, [contenteditable], .lk-diseno-vacio';

function nodosDeTexto(raiz: HTMLElement): Text[] {
  const out: Text[] = [];
  const w = raiz.ownerDocument.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && !n.parentElement.closest(FUERA) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n as Text);
  return out;
}

/** El original de un nodo: lo que el diseño escribió (si lo que hay es lo que puso el bloque) o lo que hay. */
export function originalDe(n: Text): string {
  const actual = n.nodeValue ?? '';
  const p = PUESTOS.get(n);
  return p && p.puesto === actual ? p.original : actual;
}

/** Muestra en la tarjeta los textos cambiados; un texto cuyo cambio se quitó vuelve a su original. */
export function aplicarTextos(raiz: HTMLElement | null, textos: TextosDeBloque | undefined): void {
  if (!raiz) return;
  for (const n of nodosDeTexto(raiz)) {
    const actual = n.nodeValue ?? '';
    const original = originalDe(n);
    const deseado = textoAMostrar(original, textos);
    if (deseado !== actual) n.nodeValue = deseado;
    if (deseado !== original || PUESTOS.has(n)) PUESTOS.set(n, { original, puesto: deseado });
  }
}

export type TextoTocado = { original: string; actual: string; caja: DOMRect };

function nodoEnPunto(doc: Document, x: number, y: number): Node | null {
  const d = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) return d.caretPositionFromPoint(x, y)?.offsetNode ?? null;
  return d.caretRangeFromPoint?.(x, y)?.startContainer ?? null;
}

/** El texto de la tarjeta que está en (x, y), si se puede cambiar. `tapa` (la que toma el clic editando) no cuenta. */
export function textoEnPunto(raiz: HTMLElement, x: number, y: number, tapa?: HTMLElement | null): TextoTocado | null {
  const antes = tapa?.style.pointerEvents;
  if (tapa) tapa.style.pointerEvents = 'none';
  let nodo: Node | null = null;
  try {
    nodo = nodoEnPunto(raiz.ownerDocument, x, y);
    // Sin el texto exacto (el puntero en el aire de una tarjeta), el primer texto del elemento que está ahí.
    if (!(nodo instanceof Text) || !raiz.contains(nodo)) {
      const el = raiz.ownerDocument.elementsFromPoint(x, y).find((e) => raiz.contains(e) && e !== raiz);
      nodo = el ? nodosDeTexto(el as HTMLElement).find((t) => esTextoEditable(originalDe(t))) ?? null : null;
    }
  } finally {
    if (tapa) tapa.style.pointerEvents = antes ?? '';
  }
  if (!(nodo instanceof Text) || !raiz.contains(nodo) || nodo.parentElement?.closest(FUERA)) return null;
  const original = originalDe(nodo);
  if (!esTextoEditable(original)) return null;
  const r = raiz.ownerDocument.createRange();
  r.selectNodeContents(nodo);
  return { original: original.trim(), actual: (nodo.nodeValue ?? '').trim(), caja: r.getBoundingClientRect() };
}
