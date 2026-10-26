// =============================================================================
// acciones-diseno — la barra «Texto» sobre el texto de un «Diseño editable» (su iframe)
// =============================================================================
// Martín (26/10/2026): «La barra de texto me aparece en gris, no es editable». La barra (BarraFormato, modo fija) lee y
// escribe la selección de ProseMirror; en una sección de diseño el cursor está en el documento del iframe
// (nodos/HtmlEditableVista.tsx) y la barra quedaba apagada. Con ./puente-diseno.ts sabe qué documento tiene el cursor, y
// esto hace en ese documento lo mismo que la barra hace en un bloque: estado, formatos, color, tamaño, alineación,
// estilos de texto y enlace. Todo con los comandos de edición del documento (`execCommand`), que dejan el HTML que el
// diseño ya guarda: lo de adentro sigue siendo su HTML, sin nodos del editor.
//
// Lo que NO se ofrece en un diseño (y la barra lo apaga): la etiqueta (es una marca de ProseMirror) y los estilos que no
// son una etiqueta HTML (antetítulo, texto grande o pequeño, lista de tareas). Un estilo que SÍ es una etiqueta (h1…h4,
// p) cambia la etiqueta y se queda con los atributos, así no pierde el estilo del diseño.
// =============================================================================

import type { TamanoTexto } from '@/lib/editor-landing/doc';
import type { TipoBloqueTexto } from './BarraFormato';

/** El tamaño de cada escalón de la barra, relativo al texto donde se pone (en un diseño no hay variables del tema). */
export const TAM_EN_DISENO: Record<TamanoTexto, string> = { xs: '0.75em', s: '0.875em', m: '1em', l: '1.125em', xl: '1.375em', '2xl': '1.75em' };

/** Los estilos de texto que un diseño puede tomar: los que son una etiqueta HTML. */
const ETIQUETA_DE_TIPO: Partial<Record<TipoBloqueTexto, string>> = { titulo: 'h1', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', parrafo: 'p' };
export const tipoPermitidoEnDiseno = (t: TipoBloqueTexto): boolean =>
  !!ETIQUETA_DE_TIPO[t] || t === 'vinetas' || t === 'numerada' || t === 'cita';

const BLOQUES = 'h1,h2,h3,h4,h5,h6,p,li,blockquote';

/** El estilo de texto de una etiqueta (lo que la barra marca en «Estilos de texto»). */
export function tipoDeEtiqueta(tag: string | null | undefined): TipoBloqueTexto | null {
  const t = (tag ?? '').toLowerCase();
  if (t === 'h1' || t === 'h2' || t === 'h3' || t === 'h4') return t;
  if (t === 'h5' || t === 'h6') return 'h4';
  if (t === 'p') return 'parrafo';
  if (t === 'blockquote') return 'cita';
  return null;
}

/** «start», «-webkit-left»… al valor de la barra. */
export function alineacionDe(v: string | null | undefined): 'left' | 'center' | 'right' {
  const s = (v ?? '').toLowerCase();
  if (s.includes('center')) return 'center';
  if (s.includes('right') || s === 'end') return 'right';
  return 'left';
}

const elementoDe = (n: Node | null): Element | null => (!n ? null : n.nodeType === 1 ? (n as Element) : n.parentElement);

/** La selección del documento, si está adentro de su body. */
function seleccionDe(doc: Document): Selection | null {
  const s = doc.getSelection();
  if (!s || !s.rangeCount || !s.anchorNode || !doc.body.contains(s.anchorNode)) return null;
  return s;
}

const consulta = (doc: Document, cmd: string): boolean => { try { return doc.queryCommandState(cmd); } catch { return false; } };
/** Un comando de edición. Si el documento no lo hizo (el foco quedó en un campo de la barra), le devuelve el foco y repite. */
const comando = (doc: Document, cmd: string, valor?: string): boolean => {
  try {
    if (doc.execCommand(cmd, false, valor)) return true;
    doc.defaultView?.focus();
    return doc.execCommand(cmd, false, valor);
  } catch { return false; }
};

export type EstadoDiseno = {
  vacia: boolean;
  negrita: boolean;
  cursiva: boolean;
  subrayado: boolean;
  tachado: boolean;
  tipo: TipoBloqueTexto | null;
  alinea: 'left' | 'center' | 'right';
  enlace: string | null;
  enlaceNueva: boolean;
};

/** Lo que la barra marca, leído de la selección del diseño. null = el cursor no está en su texto. */
export function estadoDeDiseno(doc: Document): EstadoDiseno | null {
  const s = seleccionDe(doc);
  if (!s) return null;
  const el = elementoDe(s.anchorNode);
  if (!el) return null;
  const bloque = el.closest(BLOQUES);
  const a = el.closest('a');
  const vista = doc.defaultView;
  const lista = el.closest('ul,ol');
  return {
    vacia: s.isCollapsed,
    negrita: consulta(doc, 'bold'),
    cursiva: consulta(doc, 'italic'),
    subrayado: consulta(doc, 'underline'),
    tachado: consulta(doc, 'strikeThrough'),
    tipo: lista ? (lista.tagName.toLowerCase() === 'ol' ? 'numerada' : 'vinetas') : tipoDeEtiqueta(bloque?.tagName),
    alinea: alineacionDe(vista ? vista.getComputedStyle(bloque ?? el).textAlign : null),
    enlace: a ? a.getAttribute('href') ?? '' : null,
    enlaceNueva: a?.getAttribute('target') === '_blank',
  };
}

const CMD_MARCA = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough' } as const;

/** Negrita, cursiva, subrayado o tachado sobre lo elegido. */
export function marcarEnDiseno(doc: Document, nombre: keyof typeof CMD_MARCA): boolean {
  // ⚠️ Sin `styleWithCSS`, Chrome tacha con un `<strike>` (etiqueta vieja que el saneo del server no tenía: se perdía al
  // guardar). Con él, un `<span style="text-decoration-line: line-through">`. El saneo igual lo pasa a `<s>`.
  if (nombre === 'strike') comando(doc, 'styleWithCSS', 'true');
  return comando(doc, CMD_MARCA[nombre]);
}

export const quitarFormatoEnDiseno = (doc: Document): boolean => comando(doc, 'removeFormat');

/** El color del texto (un hex o un color del tema ya resuelto a su valor), o el que hereda (null). */
export function colorEnDiseno(doc: Document, valor: string | null): boolean {
  comando(doc, 'styleWithCSS', 'true');
  if (valor) return comando(doc, 'foreColor', valor);
  // Sin color: el que hereda el bloque (el de su diseño).
  const s = seleccionDe(doc);
  const el = elementoDe(s?.anchorNode ?? null)?.closest(BLOQUES) ?? null;
  const heredado = el?.parentElement && doc.defaultView ? doc.defaultView.getComputedStyle(el.parentElement).color : null;
  return heredado ? comando(doc, 'foreColor', heredado) : false;
}

export function resaltadoEnDiseno(doc: Document, valor: string | null): boolean {
  comando(doc, 'styleWithCSS', 'true');
  return comando(doc, 'hiliteColor', valor ?? 'transparent');
}

/**
 * El tamaño: `fontSize` sólo sabe de los 7 tamaños de HTML, así que se pone el 7 y se cambia por el del escalón (o se
 * saca, con «Predeterminado»). Lo que el 7 deja es un `<span style="font-size: xxx-large">` o un `<font size="7">`.
 */
export function tamanoEnDiseno(doc: Document, tam: TamanoTexto | null): boolean {
  comando(doc, 'styleWithCSS', 'true');
  if (!comando(doc, 'fontSize', '7')) return false;
  const valor = tam ? TAM_EN_DISENO[tam] : '';
  doc.querySelectorAll<HTMLElement>('span[style*="xxx-large"], font[size="7"]').forEach((el) => {
    if (el.tagName.toLowerCase() === 'font') {
      const span = doc.createElement('span');
      if (valor) span.style.fontSize = valor;
      while (el.firstChild) span.appendChild(el.firstChild);
      el.replaceWith(span);
      return;
    }
    el.style.fontSize = valor;
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
  });
  return true;
}

export function alinearEnDiseno(doc: Document, valor: 'left' | 'center' | 'right'): boolean {
  comando(doc, 'styleWithCSS', 'true');
  return comando(doc, valor === 'center' ? 'justifyCenter' : valor === 'right' ? 'justifyRight' : 'justifyLeft');
}

/** Cambia la etiqueta de un elemento y se queda con sus atributos y su contenido (no pierde el estilo del diseño). */
export function cambiarEtiqueta(el: Element, tag: string): Element {
  if (el.tagName.toLowerCase() === tag) return el;
  const nuevo = el.ownerDocument.createElement(tag);
  for (const at of Array.from(el.attributes)) nuevo.setAttribute(at.name, at.value);
  while (el.firstChild) nuevo.appendChild(el.firstChild);
  el.replaceWith(nuevo);
  return nuevo;
}

/** Un estilo de texto: una etiqueta (h1…h4, p), una lista o una cita. Los que no son una etiqueta, no (false). */
export function tipoEnDiseno(doc: Document, tipo: TipoBloqueTexto): boolean {
  if (!tipoPermitidoEnDiseno(tipo)) return false;
  if (tipo === 'vinetas') return comando(doc, 'insertUnorderedList');
  if (tipo === 'numerada') return comando(doc, 'insertOrderedList');
  if (tipo === 'cita') return comando(doc, 'formatBlock', 'blockquote');
  const s = seleccionDe(doc);
  const bloque = elementoDe(s?.anchorNode ?? null)?.closest('h1,h2,h3,h4,h5,h6,p') ?? null;
  const tag = ETIQUETA_DE_TIPO[tipo];
  if (!bloque || !tag) return false;
  cambiarEtiqueta(bloque, tag);
  return true;
}

/**
 * El enlace: en un enlace que ya existe, le cambia el destino; con texto elegido, lo hace enlace; sin texto, escribe el
 * texto con el enlace. `nueva` = abre en otra pestaña.
 */
export function enlaceEnDiseno(doc: Document, href: string, nueva: boolean, etiqueta: string): boolean {
  const s = seleccionDe(doc);
  if (!s) return false;
  const marcar = (a: HTMLAnchorElement) => {
    a.setAttribute('href', href);
    if (nueva && /^https?:/i.test(href)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    else { a.removeAttribute('target'); a.removeAttribute('rel'); }
  };
  const actual = elementoDe(s.anchorNode)?.closest('a') as HTMLAnchorElement | null;
  if (actual) { marcar(actual); return true; }
  if (s.isCollapsed) {
    const a = doc.createElement('a');
    a.textContent = etiqueta || href;
    marcar(a);
    s.getRangeAt(0).insertNode(a);
    return true;
  }
  if (!comando(doc, 'createLink', href)) return false;
  const r = s.rangeCount ? s.getRangeAt(0) : null;
  doc.querySelectorAll<HTMLAnchorElement>(`a[href="${CSS.escape(href)}"]`).forEach((a) => { if (!r || r.intersectsNode(a)) marcar(a); });
  return true;
}

/** Saca el enlace donde está el cursor (el texto se queda). */
export function quitarEnlaceEnDiseno(doc: Document): boolean {
  const s = seleccionDe(doc);
  const a = elementoDe(s?.anchorNode ?? null)?.closest('a') ?? null;
  if (!a) return comando(doc, 'unlink');
  a.replaceWith(...Array.from(a.childNodes));
  return true;
}
