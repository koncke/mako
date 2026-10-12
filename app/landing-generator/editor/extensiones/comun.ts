// =============================================================================
// extensiones/comun — lo que comparten los nodos y las marcas del documento
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1, D3).
//
// Tres piezas chicas que usan todos los nodos de esta carpeta:
//   · `especificar`: la forma HTML que arma lib/editor-landing/especificacion.ts (paquete A)
//     vista como el `DOMOutputSpec` que pide TipTap. Es la MISMA forma que serializa render.ts
//     para la página publicada: lo que se edita es lo que se publica (D3).
//   · `attrsSinParseo`: los atributos de un nodo para TipTap. Cada uno con `parseHTML: () => null`
//     y `rendered: false`, a propósito: sin su `parseHTML`, TipTap lee `getAttribute(<nombre>)`
//     del elemento, y el `id` de una sección se leería «t-abc» (el id del DOM) en vez de «abc».
//     Lo que se lee lo decide UNA función por nodo (`getAttrs` de su regla), que pasa por el
//     normalizador de especificacion.ts (las listas cerradas de doc.ts).
//   · El JSON del portapapeles (`ATTR_JSON`): al copiar, cada nodo propio viaja con sus
//     atributos ENTEROS en un `data-gm-json` (lo agrega plugins.ts sólo en el portapapeles, nunca
//     en el DOM del editor ni en `getHTML()`). Sin eso, copiar y pegar una sección perdía las
//     notas del orador, los datos de un gráfico (el SVG no se puede leer de vuelta) y los campos
//     de un formulario. Lo que llega se normaliza igual que lo que guarda el server: un pegado
//     armado a mano no mete nada que el saneo no deje.
//
// ⚠️ PURO salvo `vistaDom`, que usa `document` SÓLO cuando ProseMirror la llama (en el
//    navegador). El test arma el esquema en node con este módulo.
// =============================================================================

import type { DOMOutputSpec, Node as NodoPM } from '@tiptap/pm/model';
import { DOMSerializer } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import type { Attributes } from '@tiptap/core';
import { NORMALIZAR_NODOS, type NodoArbol } from '@/lib/editor-landing/especificacion';
import { svgIcono } from '@/lib/editor-landing/iconos';

/** La forma de especificacion.ts como `DOMOutputSpec`. Nunca lleva `HtmlCrudo` (eso sólo lo agrega render.ts). */
export function especificar(spec: NodoArbol): DOMOutputSpec {
  return spec as unknown as DOMOutputSpec;
}

/** Atributos de TipTap con su default, sin parseo propio (lo hace el `getAttrs` de la regla) ni render (lo hace el nodo). */
export function attrsSinParseo(defaults: Record<string, unknown>): Attributes {
  const out: Attributes = {};
  for (const [k, v] of Object.entries(defaults)) out[k] = { default: v, parseHTML: () => null, rendered: false };
  return out;
}

/** El atributo donde viajan los atributos enteros de un nodo copiado (sólo en el portapapeles). */
export const ATTR_JSON = 'data-gm-json';

/**
 * Los atributos de un nodo pegado, si vinieron en el JSON del portapapeles, ya normalizados.
 * `null` = no vinieron (un pegado de afuera): se leen del HTML.
 */
export function attrsDelJson(el: HTMLElement, tipo: string): Record<string, unknown> | null {
  const crudo = el.getAttribute(ATTR_JSON);
  const norm = NORMALIZAR_NODOS[tipo];
  if (!crudo || !norm || crudo.length > 200_000) return null;
  try {
    return norm(JSON.parse(crudo));
  } catch {
    return null;
  }
}

/** El valor de un `data-*`, o null. */
export const dato = (el: Element, nombre: string): string | null => el.getAttribute(`data-${nombre}`);

/** El primer descendiente (o el elemento mismo) que coincide con el selector. */
export function hijo(el: Element, selector: string): HTMLElement | null {
  if (el.matches(selector)) return el as HTMLElement;
  return el.querySelector<HTMLElement>(selector);
}

/**
 * El `url("…")` de un `background-image` escrito por especificacion.ts (crudo, del atributo
 * `style`, no del estilo calculado: el navegador lo reescribe).
 */
export function urlDeFondo(el: Element | null): string | null {
  const s = el?.getAttribute('style') ?? '';
  const m = /background-image:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i.exec(s);
  return m ? m[1] : null;
}

/** «12.5% 80%» de un `background-position`, como dos números. */
export function focoDeFondo(el: Element | null): [number, number] | null {
  const s = el?.getAttribute('style') ?? '';
  const m = /background-position:\s*(-?[\d.]+)%\s+(-?[\d.]+)%/i.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * Escribe un juego de atributos en un elemento: los que vienen con valor se ponen, los que vienen
 * `undefined`/`null` se SACAN. (El `attrs` de los NodeViews de TipTap sólo sabe poner: un
 * `data-oculta` que deja de valer quedaría escrito como «undefined».)
 */
export function aplicarAttrs(el: HTMLElement, attrs: Record<string, string | null | undefined>, previos?: Set<string>): Set<string> {
  const puestos = new Set<string>();
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') continue;
    if (v == null) { if (el.hasAttribute(k)) el.removeAttribute(k); continue; }
    puestos.add(k);
    if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  }
  if (previos) for (const k of previos) if (!puestos.has(k) && !(k in attrs)) el.removeAttribute(k);
  return puestos;
}

/** Los atributos (objeto) del elemento raíz de una forma. */
export function attrsDeRaiz(spec: NodoArbol): Record<string, string | undefined> {
  const a = spec[1];
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, string | undefined>) : {};
}

/** Las clases de la raíz de una forma, como lista. */
export function clasesDeRaiz(spec: NodoArbol): string[] {
  return (attrsDeRaiz(spec).class ?? '').split(/\s+/).filter(Boolean);
}

/** Llena los `[data-icono]` vacíos de un subárbol con el SVG del catálogo (lo que especificacion.ts deja vacío). */
export function llenarIconos(raiz: HTMLElement, tam = 24): void {
  raiz.querySelectorAll<HTMLElement>('[data-icono]').forEach((s) => {
    const n = s.getAttribute('data-icono') ?? '';
    if (s.getAttribute('data-icono-puesto') === n) return;
    s.innerHTML = svgIcono(n, tam);
    s.setAttribute('data-icono-puesto', n);
  });
}

/**
 * Un NodeView de DOM puro (sin React) que dibuja la forma de especificacion.ts y:
 *   · marca `contenteditable=false` todo lo que no es el hueco del contenido (la marca de un ítem,
 *     el ícono de un recuadro): si no, el navegador deja escribir ahí adentro y ProseMirror lee
 *     ese texto como un cambio que no sabe dónde poner;
 *   · llena los íconos (`[data-icono]`) con el SVG del catálogo;
 *   · si cambian los atributos, devuelve `false` y ProseMirror lo vuelve a dibujar (son nodos
 *     chicos: no vale la pena un diff a mano).
 * `alMontar` permite colgarle algo propio (el `<details>` del desplegable, siempre abierto).
 */
export function vistaDom(
  forma: (n: NodoPM) => NodoArbol,
  alMontar?: (dom: HTMLElement, contentDOM: HTMLElement | null, n: NodoPM) => Partial<NodeView> | void,
): (props: { node: NodoPM }) => NodeView {
  return ({ node }) => {
    const { dom, contentDOM } = DOMSerializer.renderSpec(document, especificar(forma(node)));
    const raiz = dom as HTMLElement;
    const cont = (contentDOM as HTMLElement | undefined) ?? null;
    // Lo que no es el hueco (ni lo contiene) no se edita.
    const marcar = (el: HTMLElement) => {
      for (const h of Array.from(el.children) as HTMLElement[]) {
        if (h === cont) continue;
        if (cont && h.contains(cont)) marcar(h);
        else h.setAttribute('contenteditable', 'false');
      }
    };
    marcar(raiz);
    llenarIconos(raiz);
    let actual = node;
    const extra = alMontar?.(raiz, cont, node) ?? {};
    return {
      dom: raiz,
      contentDOM: cont,
      update: (n: NodoPM) => {
        if (n.type !== actual.type) return false;
        if (JSON.stringify(n.attrs) !== JSON.stringify(actual.attrs)) return false;
        actual = n;
        return true;
      },
      ...extra,
    };
  };
}
