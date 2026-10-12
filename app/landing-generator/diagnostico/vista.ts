// =============================================================================
// vista — lo que el panel del diagnóstico le pregunta a una VISTA de la landing
// =============================================================================
// Dos vistas, una sola forma (el panel y el recorrido no saben cuál tienen adelante):
//   · VistaNuestra.tsx: una landing nuestra dibujada en el MISMO documento con el render público
//     (`htmlDePagina`); la cita se busca en su DOM con `buscarEnTextos`.
//   · VistaAfuera.tsx: una landing de afuera en un iframe aislado; la cita se busca ADENTRO, con el
//     script de `documentoDiagnostico`, y la caja vuelve por `postMessage`.
// Sin 'use client' a propósito: sólo tipos y funciones del DOM, sin React.
// =============================================================================

import type { Caja } from '@/lib/recorridos';
import type { Coincidencia } from '@/lib/editor-landing/diagnostico';

/** Un comentario que la vista tiene que poder señalar. */
export type ObjetivoVista = { id: number; cita: string; seccionId: string | null };

/** Cómo se encontró el bloque: por la cita, por la sección (la cita ya no está), o no se encontró. */
export type Ubicacion = 'cita' | 'seccion' | null;

export interface ControlVista {
  /** Trae el bloque del comentario a la vista (sin animar) y devuelve su caja en la VENTANA. */
  ir(id: number): Promise<Caja | null>;
  /** La caja del bloque en la ventana, recortada a la vista; la vista ENTERA si no se encontró. */
  caja(id: number): Caja | null;
  /** La distancia desde el principio de la página (para ordenar el recorrido), o null. */
  posicion(id: number): number | null;
  /** `undefined` = todavía no se sabe (la vista no terminó de cargar): no es «no está». */
  ubicacion(id: number): Ubicacion | undefined;
}

/**
 * El aviso de que la vista SE MOVIÓ (scroll del iframe, cambio de tamaño): lo escucha el recorrido en
 * una `EventTarget` que le pasa el panel. Por evento y no por estado: un scroll son sesenta avisos por
 * segundo, y como estado redibujaría el panel entero (la lista) en cada uno.
 */
export const EVENTO_MOVIO = 'gdg-movio';

export const cajaDeRect = (r: DOMRect | { left: number; top: number; width: number; height: number }): Caja =>
  ({ x: r.left, y: r.top, ancho: r.width, alto: r.height });

/** La intersección de dos cajas, o la primera si no se tocan (todavía scrolleando). */
export function recortarA(a: Caja, b: Caja): Caja {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.ancho, b.x + b.ancho);
  const y2 = Math.min(a.y + a.alto, b.y + b.alto);
  return x2 - x1 > 0 && y2 - y1 > 0 ? { x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 } : a;
}

/** Lo que no es texto de la página: no se busca adentro. */
const SALTEAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'OPTION']);

/** Los nodos de texto de una raíz, en orden de lectura (lo que `buscarEnTextos` recibe). */
export function textosDelDom(raiz: Element): { nodos: Text[]; textos: string[] } {
  const nodos: Text[] = [];
  const textos: string[] = [];
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    const p = n.parentElement;
    if (!p || SALTEAR.has(p.tagName) || !n.nodeValue) continue;
    nodos.push(n);
    textos.push(n.nodeValue);
  }
  return { nodos, textos };
}

/**
 * El BLOQUE que contiene una coincidencia: el ancestro común del rango, subiendo mientras sea un
 * elemento en línea (un `<strong>`, un `<a>` de texto). Se señala el párrafo o el título, no la palabra.
 */
export function bloqueDeCoincidencia(nodos: readonly Text[], c: Coincidencia, tope: Element): Element | null {
  const a = nodos[c.desde.nodo];
  const b = nodos[c.hasta.nodo];
  if (!a || !b) return null;
  let el: Element | null;
  try {
    const r = document.createRange();
    r.setStart(a, c.desde.offset);
    r.setEnd(b, c.hasta.offset);
    const comun = r.commonAncestorContainer;
    el = comun.nodeType === Node.ELEMENT_NODE ? (comun as Element) : comun.parentElement;
  } catch {
    return null;
  }
  while (el && el !== tope) {
    const d = getComputedStyle(el).display;
    if (d && d !== 'inline' && d !== 'contents') return el;
    el = el.parentElement;
  }
  return el;
}

/** Un id para un selector `#…` (los de sección son `[A-Za-z0-9_-]`, pero no se confía). */
export const selectorDeSeccion = (id: string): string => `#t-${id.replace(/[^A-Za-z0-9_-]/g, '')}`;
