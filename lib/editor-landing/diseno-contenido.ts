// =============================================================================
// diseno-contenido — TODO lo que dice y muestra una sección de diseño, en una lista (28/10/2026)
// =============================================================================
// Martín (28/10, por el Cerebro): «Es super importante que la replica de las landing, no solo replique, sino que luego sea
// editable absolutamente todo... Debe ser todo editable». Con el clic se llega a lo que se ve. Una copia idéntica trae su
// HTML sin el JavaScript de la página, y lo que ese JavaScript mostraba queda OCULTO para siempre: la respuesta de cada
// pregunta frecuente, el menú que se abre, las otras pestañas, los textos que rotaban, las opciones de un `<select>`. Y lo
// que está debajo de otra capa (un degradado, una caja transparente) no se toca con el mouse. Nada de eso se podía cambiar.
// Esto es la lista de «Contenido» de la barrita (app/web-generator/editor/nodos/HtmlEditableVista.tsx): cada texto, cada
// imagen (también las de fondo), cada enlace o botón y cada campo de la sección, en orden, visibles u ocultos, para
// cambiarlos ahí mismo. No toca nada: junta.
// 4/11/2026 (nube, al rearmar la etiqueta rescate/replica-editable-2810): también cada ÍCONO (un `<svg>`) y cada VIDEO (un
// `<video>`, un reproductor en `<iframe>` o la agenda de `[data-calendly]`). La matriz del 29/10 dejó dicho que no se sabía si
// la lista los traía, y no los traía: un ícono o un video oculto (el de una pestaña que no se ve) no se podía cambiar ni quitar.
// ⚠️ Sin `window` ni `document`: lo de afuera (si algo se ve, su imagen de fondo) lo dice quien llama, con el
//    `getComputedStyle` del iframe. Lo prueba tests/replica-editable.test.ts con un DOM de mentira.
// =============================================================================

/** Lo mínimo de un nodo del DOM que se recorre: un elemento (1) o un texto (3). */
export interface NodoContenido {
  nodeType: number;
  /** El texto de un nodo de texto. */
  data?: string;
  tagName?: string;
  childNodes: ArrayLike<NodoContenido>;
  parentElement: NodoContenido | null;
  getAttribute?(n: string): string | null;
}

export type ItemContenido =
  | { tipo: 'texto'; nodo: NodoContenido; dueno: NodoContenido; valor: string; oculto: boolean }
  | { tipo: 'imagen'; el: NodoContenido; src: string; alt: string; oculto: boolean }
  | { tipo: 'fondo'; el: NodoContenido; url: string; oculto: boolean }
  | { tipo: 'enlace'; el: NodoContenido; texto: string; href: string | null; oculto: boolean }
  | { tipo: 'campo'; el: NodoContenido; ayuda: string; oculto: boolean }
  | { tipo: 'icono'; el: NodoContenido; oculto: boolean }
  | { tipo: 'video'; el: NodoContenido; src: string; oculto: boolean };

export type ContenidoDiseno = { items: ItemContenido[]; recortado: boolean };

/** Adentro de esto no hay texto para leer (estilos, scripts, íconos dibujados): lo mismo que la IA (html-editable-textos.ts). */
const CRUDOS = new Set(['script', 'style', 'svg', 'noscript', 'template', 'title']);
/** Más que esto en una sección no se lista (una página entera en una sola sección): se dice. */
export const TOPE_CONTENIDO = 800;

const etiqueta = (n: NodoContenido) => (n.tagName ?? '').toLowerCase();
const atributo = (n: NodoContenido, a: string) => n.getAttribute?.(a) ?? null;
const textoDe = (n: NodoContenido): string => {
  if (n.nodeType === 3) return n.data ?? '';
  if (CRUDOS.has(etiqueta(n))) return '';
  let s = '';
  for (let i = 0; i < n.childNodes.length; i++) s += textoDe(n.childNodes[i]);
  return s;
};
const juntar = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * El contenido de la sección, en el orden del HTML. `oculto(el)`: si el elemento no se ve (él o uno de afuera); `fondo(el)`:
 * la URL de su imagen de fondo, o null. Un enlace o botón también lista sus textos (se cambian como cualquier texto); un
 * campo lista su texto de ayuda; un `<select>`, sus opciones como textos.
 */
export function contenidoDeDiseno(
  raiz: NodoContenido,
  op: { oculto?: (el: NodoContenido) => boolean; fondo?: (el: NodoContenido) => string | null; tope?: number } = {},
): ContenidoDiseno {
  const tope = op.tope ?? TOPE_CONTENIDO;
  const items: ItemContenido[] = [];
  let recortado = false;
  const sumar = (it: ItemContenido) => { if (items.length < tope) items.push(it); else recortado = true; };
  const visitar = (n: NodoContenido, ocultoArriba: boolean) => {
    if (recortado) return;
    if (n.nodeType === 3) {
      const valor = juntar(n.data ?? '');
      if (valor && n.parentElement) sumar({ tipo: 'texto', nodo: n, dueno: n.parentElement, valor, oculto: ocultoArriba });
      return;
    }
    if (n.nodeType !== 1) return;
    const t = etiqueta(n);
    if (CRUDOS.has(t) && t !== 'svg') return;
    const oculto = ocultoArriba || (n !== raiz && !!op.oculto?.(n));
    if (n !== raiz) {
      if (t === 'svg') sumar({ tipo: 'icono', el: n, oculto });
      if (t === 'video' || t === 'iframe' || atributo(n, 'data-calendly') !== null) {
        sumar({ tipo: 'video', el: n, src: atributo(n, 'src') ?? atributo(n, 'data-calendly') ?? '', oculto });
        // Lo de adentro de un reproductor (sus `<source>`, la ficha de la agenda) es suyo: se cambia con él.
        return;
      }
      if (t === 'img') sumar({ tipo: 'imagen', el: n, src: atributo(n, 'src') ?? '', alt: atributo(n, 'alt') ?? '', oculto });
      if (t === 'a' || t === 'button' || atributo(n, 'role') === 'button') {
        sumar({ tipo: 'enlace', el: n, texto: juntar(textoDe(n)) || juntar(atributo(n, 'aria-label') ?? ''), href: atributo(n, 'href'), oculto });
      }
      if ((t === 'input' && !/^(hidden|submit|button|checkbox|radio|file|image|reset)$/i.test(atributo(n, 'type') ?? '')) || t === 'textarea') {
        sumar({ tipo: 'campo', el: n, ayuda: atributo(n, 'placeholder') ?? '', oculto });
      }
    }
    const url = op.fondo?.(n) ?? null;
    if (url) sumar({ tipo: 'fondo', el: n, url, oculto });
    if (t === 'svg') return;
    for (let i = 0; i < n.childNodes.length; i++) visitar(n.childNodes[i], oculto);
  };
  visitar(raiz, false);
  return { items, recortado };
}

/**
 * Cambia un texto de la lista conservando los espacios de los bordes (un texto entre dos etiquetas los necesita para no
 * pegarse). Vacío no vale: para sacar un texto se quita su elemento.
 */
export function ponerTextoDeNodo(nodo: { data?: string }, valor: string): boolean {
  const limpio = valor.replace(/\s+/g, ' ').trim();
  if (!limpio || typeof nodo.data !== 'string') return false;
  const antes = nodo.data.match(/^\s*/)?.[0] ?? '';
  const despues = nodo.data.match(/\s*$/)?.[0] ?? '';
  nodo.data = (antes ? ' ' : '') + limpio + (despues ? ' ' : '');
  return true;
}
