'use client';

// =============================================================================
// EditorRico — editar un texto «como si fuera un Word», con imágenes y archivos adentro
// =============================================================================
// Pedido de Martín (07/10/2026, item 17): «Se debería poder adjuntar cosas a la descripción…
// Imágenes, PDF, archivos, etc.. Y mejora bastante las opciones de editar texto allí, se debería
// poder editar el texto completo, como si fuera un word. Obvio que hay cosas que no hacen falta,
// pero sí una buena edición de texto». Diseño y contrato: docs/diseno-curso-skool.md, D4.
//
// Contrato:
//   <EditorRico valor={html} onCambio={(html) => …}
//     subirAdjunto={(file, onProgreso?) => Promise<{ ref, nombre, mime }>}
//     urlDeAdjunto={(ref) => string} placeholder soloLectura? />
//
// Es TipTap 3 (ProseMirror). No es el `contentEditable` + `execCommand` de app/plan/board/RichText.tsx
// ni el de app/agencia/EditorMensaje.tsx: aquellos sirven para tres marcas, y con listas, tareas,
// títulos, links, imágenes y archivos el DOM de un contentEditable deja de ser un modelo — cada
// navegador pega, borra y parte las listas distinto. ProseMirror tiene un documento con un esquema,
// y eso ES una lista blanca: lo que el esquema no conoce no entra al documento.
//
// ── LO QUE NO HACE, A PROPÓSITO ───────────────────────────────────────────
// · NO SANEA LO QUE GUARDA. Lo que emite `onCambio` es lo que dibuja el editor; el saneo que vale
//   es el del SERVER (`sanearHtml`, lib/html-seguro.ts) al guardar. Acá se limpia el PEGADO para
//   que lo que se ve sea lo que va a quedar, no para proteger nada.
// · NO SABE DEL CURSO. Sube con `subirAdjunto` y dibuja con `urlDeAdjunto`: quien lo monta decide
//   a qué bucket va y quién puede ver qué. La comunidad (D8) lo puede montar con lo suyo.
// · NO GUARDA LA URL DE UNA IMAGEN. En el HTML va la referencia (`mako-adjunto:<uuid>`), y la URL
//   la pone `urlDeAdjunto` al dibujar: es de quien mira, vence, y no puede vivir en la base.
//
// ── LAS TRAMPAS QUE ESQUIVA ───────────────────────────────────────────────
// 1. EL VALOR DE AFUERA NO SE REESCRIBE EN CADA TECLA. El editor es la fuente mientras se escribe;
//    `valor` se vuelve a cargar sólo si cambió desde AFUERA y dice OTRA cosa (se compara el
//    DOCUMENTO, no el string: el server devuelve `<br />` donde el editor escribió `<br>`, y por
//    esa diferencia el cursor saltaría al principio).
// 2. LA BARRA NO LE ROBA EL FOCO AL TEXTO (`onMouseDown` + `preventDefault`): si se lo roba, el
//    clic en «Negrita» pierde la selección y no hay nada que poner en negrita.
// 3. UNA IMAGEN SE INSERTA DONDE SE SOLTÓ, aunque se siga escribiendo mientras sube: la posición
//    se corre con cada cambio del documento (`transaction.mapping`), no se guarda fija.
// 4. LA BARRA DE PROGRESO LA ALIMENTA UN XHR (lo arma quien pasa `subirAdjunto`, con
//    `subirConProgreso`): `fetch` no expone el progreso de subida (AGENTS.md, «tres topes»).
// 5. LOS PANELES (color, resaltado, enlace, «Más», tabla) SE PORTALEAN AL BODY y se registran en
//    la pila de modales (`useCapaModal`, anidada): el editor puede vivir adentro de una caja con
//    `overflow` o de un modal, y un Escape en el panel no puede cerrar el modal de abajo.
//
// ── LA TANDA DEL 08/10/2026 (items 3, 4 y 10 del pedido de Martín) ──────────
// 6. LA BARRA ES UN SOLO RENGLÓN, SIEMPRE. «Intenta que las opciones en la barra de edición no se
//    salten de línea... Que si tiene mucho zoom que haya un desplegable». Lo que no entra va al
//    botón «Más» del final. Cuántas entran lo decide `repartoDeBarra` (editor-rico-reglas.ts) con
//    los anchos de una REGLA escondida que dibuja todas las piezas siempre —nunca con la barra,
//    donde las que se fueron a «Más» no están: medir lo que la decisión cambia es un ping-pong—, y
//    se vuelve a decidir cuando cambia el ancho de la barra (`ResizeObserver`) o la ventana (el
//    zoom es una ventana más angosta en px CSS). Las piezas son UNA lista: la barra y «Más» dibujan
//    la misma, así un botón nuevo aparece en los dos lugares sin que nadie se acuerde.
// 7. UNA IMAGEN TIENE TAMAÑO. «Si subo una imagen en la descripción se ve enorme, no tengo manera de
//    editar el tamaño». Seleccionada, muestra 25 / 50 / 75 / 100 %, izquierda o centro, quitar, y
//    una esquina para arrastrar (salta de a 5 %). Se guarda en `data-ancho` / `data-alinea`, con
//    los valores de una lista cerrada (`ANCHOS_IMAGEN`, HtmlSeguro.tsx): nunca un `style`. Y una
//    imagen NUEVA entra a su tamaño natural o al 60 % del texto, lo que sea menos.
// 8. TABLAS. «Y también falta una opción en la descripción de agregar tabla». La extensión oficial
//    de TipTap (`@tiptap/extension-table`, la misma versión que el resto). Con el cursor adentro,
//    el botón «Tabla» y un botón en la esquina de la tabla abren filas, columnas, títulos y borrar.
// 9. BORRAR UNA TABLA O SACAR UNA IMAGEN CON UN BOTÓN DEJA 5 SEGUNDOS DE «DESHACER» (item 18), que
//    vuelve a poner el MISMO nodo donde estaba (corrido con cada cambio, como las subidas): así el
//    deshacer no se lleva lo que se escribió después, que es lo que haría el Ctrl+Z. Y como el
//    editor guarda solo, deshacer también escribe en el server.
// 10. LA LETRA ES LA DEL CURSO (item 3): ver `CSS_RICO`. El editor no pone familia propia.
// 11. EL TEXTO NO LLEVA EL ARO DEL CURSO (revisión final del 08/10/2026). La hoja del curso pinta
//    `.ahdoc .ugc [tabindex]:focus-visible` con un contorno de 3 px en tinta, y ProseMirror lleva
//    `tabindex` (y un contentEditable cuenta como `:focus-visible` hasta con el mouse): cada clic en la
//    descripción dibujaba un marco negro adentro del aro azul de `:focus-within` — medido en el banco de
//    la lección real, `outline: solid 3px` con foco. La regla del curso pesa 4 (dos clases, el
//    atributo y la pseudoclase) y la hoja del curso carga DESPUÉS: con 4 contra 4 ganaba ella (medido).
//    Por eso la clase del editor va DOBLE: 5 contra 4, sin depender del orden de las hojas.
//
// ── LO INSERTADO (08/10/2026, items 14 y 15 del audio) ─────────────────────
// 12. «INSERTAR»: un video o una agenda adentro del texto (24:30: «que lo pueda embeber cosas como… el
//    Calendar, que se puedan embeber ahí mismo»). Se pega un link o el código que da el proveedor, pasa
//    por `embedDe` (lib/embeds.ts: https, un host de la lista, el `src` lo vuelve a armar ese módulo) y
//    queda como un bloque `insertado` que se guarda como el MISMO `<iframe>` que escribe el saneo del
//    server (`atributosDeIframe`): si el editor escribiera otra cosa, el server la devolvería distinta y
//    el documento se recargaría con el cursor al principio (trampa 1). Pegar SÓLO un código lo inserta
//    (`esCodigoParaInsertar`). Elegido, se quita con su «Deshacer» de 5 segundos, como una imagen.
// 13. EN EL EDITOR, EL IFRAME NO RECIBE EL MOUSE HASTA QUE SE ELIGE EL BLOQUE: un clic adentro de un
//    iframe se lo queda el iframe (es otra página), y el bloque no se podría elegir ni quitar. El primer
//    clic lo elige; elegido, se puede usar (dar play, mirar la agenda).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as EventoTecla, type ReactNode, type Ref, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import { Extension, Node as NodoTiptap, createDocument, type JSONContent } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory, undoDepth } from '@tiptap/pm/history';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Dropdown } from '@/app/components/Dropdown';
import { useCapaModal } from '@/app/_components/pila-modales';
import { CSS_RICO, idDeRef, urlDibujable, anchoDeImagen, alineaDeImagen, type AlineaImagen } from './HtmlSeguro';
import { repartoDeBarra, recortarSeparadores, anchoDeArrastre, anchoInicialDeImagen, esCodigoParaInsertar } from './editor-rico-reglas';
import { embedDe, embedDeIframe, atributosDeIframe, altoDeEmbed, claseDeProveedor, porQueNoSeInserta, type Embed } from '@/lib/embeds';
import { Toast, useToast } from './Toast';
import { IconoBorrar } from './BotonBorrar';

// ── El contrato ──────────────────────────────────────────────────────────────

/** Lo que devuelve `subirAdjunto`: la referencia que va al HTML, y cómo mostrarla. */
export type AdjuntoSubido = { ref: string; nombre: string; mime: string };

export type EditorRicoProps = {
  /** El HTML. El editor lo carga al montar y otra vez sólo si cambia desde afuera. */
  valor: string;
  /** Cada cambio, con el HTML entero. `''` = vacío (no `<p></p>`). */
  onCambio: (html: string) => void;
  /**
   * Sube un archivo y devuelve su referencia. Si no viene, no se puede adjuntar (los botones no se
   * dibujan y soltar un archivo no hace nada). Si FALLA, que rechace con un error corto: el editor
   * lo muestra tal cual. `onProgreso` (0-100) alimenta la barra; sin él, la barra no dice el %.
   */
  subirAdjunto?: (file: File, onProgreso?: (pct: number) => void) => Promise<AdjuntoSubido>;
  /** La URL con la que se DIBUJA una referencia, para quien está mirando. */
  urlDeAdjunto: (ref: string) => string | null | undefined;
  placeholder?: string;
  soloLectura?: boolean;
  /** El `accept` del botón «Adjuntar archivo» (lo que el bucket de quien monta acepta). */
  aceptaArchivos?: string;
  /** El `accept` del botón «Imagen». */
  aceptaImagenes?: string;
  /** Alto mínimo del área de escritura, en px. */
  minAlto?: number;
  /** Cómo lo anuncia un lector de pantalla. */
  etiqueta?: string;
  className?: string;
  style?: CSSProperties;
  /**
   * Botones de QUIEN MONTA en la barra de formato, después de las marcas (cuarta tanda del Chatbot,
   * 09/10/2026, punto 16: «los botones de abajo del todo de "{}" y emoji, deberían estar en algún
   * lugar del editable de texto arriba, donde están las negritas»). El email los usa para «{ }»,
   * el emoji y el modo HTML.
   *
   * ⚠️ OPCIONAL Y ADITIVO: las lecciones del curso no lo pasan y su barra es la de siempre. Entran a
   * la MISMA lista de piezas, así que lo que no entra se va a «Más» como cualquier otro botón. Van
   * temprano en la barra a propósito: lo que se pierde en «Más» es lo del final.
   */
  botonesExtra?: ReadonlyArray<BotonExtraRico>;
};

/**
 * Un botón de quien monta (ver `botonesExtra`). `accion` recibe el botón para anclar un panel propio;
 * si el botón quedó adentro de «Más», recibe «Más» (que se cierra al elegir).
 */
export type BotonExtraRico = {
  id: string;
  nombre: string;
  icono: ReactNode;
  activo?: boolean;
  apagado?: boolean;
  accion: (el: HTMLElement) => void;
};

// ── Reglas chicas (puras) ────────────────────────────────────────────────────

/** ¿Este archivo se dibuja como IMAGEN? Sí: PNG, JPG, WEBP, GIF. Un SVG no (puede llevar código). */
const esImagen = (mime: string | null | undefined) => /^image\/(png|jpe?g|webp|gif)$/i.test(mime ?? '');

/**
 * ¿Este destino puede ir en un enlace? http, https y mailto: lo mismo que deja pasar el saneo del
 * server (`hrefSeguro`, lib/html-seguro.ts). Un enlace que el server va a tirar no se ofrece.
 */
function hrefPermitido(raw: string): boolean {
  const limpio = raw.replace(/[\t\n\r]/g, '').trim();
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(limpio);
  if (!m) return false;
  const esquema = m[1].toLowerCase();
  if (esquema === 'mailto') return limpio.length > 7;
  if (esquema !== 'http' && esquema !== 'https') return false;
  try { return !!new URL(limpio).hostname; } catch { return false; }
}

/**
 * ¿Dos colores son el mismo? El navegador devuelve `rgb(37, 99, 235)` para lo que se eligió como
 * `#2563EB` (TipTap lee el color del estilo ya normalizado), así que comparar el texto nunca marca
 * la muestra elegida.
 */
function mismoColor(a: string, b: string): boolean {
  const canal = (c: string): string | null => {
    const t = c.trim().toLowerCase();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
    if (hex) {
      const h = hex[1].length === 3 ? hex[1].split('').map((x) => x + x).join('') : hex[1];
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
    }
    const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(t);
    return rgb ? [rgb[1], rgb[2], rgb[3]].map(Number).join(',') : null;
  };
  const x = canal(a), y = canal(b);
  return x != null && x === y;
}

/** Lo que se tipeó en el panel del enlace, como enlace: «ejemplo.com» es https://ejemplo.com. */
function normalizarHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (hrefPermitido(t)) return t;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(t)) return `mailto:${t}`;
  const conEsquema = `https://${t.replace(/^\/+/, '')}`;
  return hrefPermitido(conEsquema) && /\.[a-z]{2,}/i.test(conEsquema) ? conEsquema : null;
}

/**
 * Lo que entra al PEGAR desde Word, Google Docs o una página: sin estilos de Word, sin comentarios
 * condicionales, sin el negro y el blanco que Word pone en todo (en un tema oscuro dejarían la
 * letra negra sobre negro), y sin imágenes que no sean nuestras.
 *
 * ⚠️ UNA IMAGEN PEGADA DE OTRO LADO NO SE PEGA: su `src` es una página ajena (un pixel que avisa
 *    cada vez que un alumno abre la clase), un `file:///` de la máquina de quien copió, o un
 *    `data:` de megas adentro del HTML. Se cuenta y se avisa: una captura de pantalla pegada SÍ
 *    entra, porque llega como ARCHIVO y se sube (`handlePaste`).
 */
function limpiarPegado(html: string): { html: string; imagenesFuera: number } {
  if (typeof DOMParser === 'undefined') return { html, imagenesFuera: 0 };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style, script, meta, link, title, xml, o\\:p').forEach((n) => n.remove());
  const recorrer = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const comentarios: Node[] = [];
  while (recorrer.nextNode()) comentarios.push(recorrer.currentNode);
  comentarios.forEach((c) => c.parentNode?.removeChild(c));
  let imagenesFuera = 0;
  doc.querySelectorAll('img').forEach((img) => {
    if (!idDeRef(img.getAttribute('src'))) { img.remove(); imagenesFuera++; }
  });
  const neutro = /^(?:#0{3}(?:0{3})?|black|windowtext|auto|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|#fff(?:fff)?|white|transparent|rgba\(.*,\s*0\s*\))$/i;
  doc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    if (neutro.test(el.style.color.trim())) el.style.removeProperty('color');
    if (neutro.test(el.style.backgroundColor.trim())) el.style.removeProperty('background-color');
  });
  return { html: doc.body.innerHTML, imagenesFuera };
}

/**
 * Un pegado que trae ARCHIVOS, ¿se sube como archivos? Sí, salvo que el HTML del mismo pegado
 * traiga TEXTO visible: ahí se pega el texto.
 *
 * ⚠️ POR QUÉ: Excel —y según el programa y la versión, Word y PowerPoint— ponen en el portapapeles,
 *    además del HTML, una FOTO de lo copiado, y el navegador la entrega en `clipboardData.files`.
 *    Con «si hay archivos, se suben», pegar un párrafo de Word subía una imagen del párrafo y tiraba
 *    el texto: lo contrario de «editar como si fuera un Word». ⚠️ NO MEDIDO con Office real (la
 *    verificación del editor fue con eventos sintéticos): por eso la regla mira el HTML del pegado
 *    y no qué programa lo puso.
 *    Lo que sigue subiéndose: una captura (sin HTML) y «Copiar imagen» de una página (su HTML es
 *    sólo un `<img>`, sin texto).
 * Pura y sin DOM: la ejecuta tests/curso-adjuntos.test.ts.
 */
export function pegadoEsDeArchivos(cantidad: number, html: string | null | undefined): boolean {
  if (!(cantidad > 0)) return false;
  const texto = (html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|xml|title|head)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xa0;|\u00a0/gi, ' ')
    .trim();
  return !texto;
}

/** El aviso de las imágenes de afuera que no entraron (un pegado o algo soltado). */
const avisoImagenesFuera = (n: number) => (n === 1 ? 'Una imagen no se pegó: súbela.' : `${n} imágenes no se pegaron: súbelas.`);

// ── Las imágenes y los archivos adentro del documento ────────────────────────

/**
 * Lo que comparten el editor y sus vistas de nodo: cómo resolver una referencia AHORA (la función
 * de quien monta cambia cuando llegan las URLs), las vistas vivas (para redibujarlas cuando eso
 * pasa) y las vistas locales de lo recién subido (un `blob:` del archivo, que se ve al instante
 * sin esperar a que quien monta firme nada).
 */
type CtxAdjuntos = {
  resolver: (ref: string) => string | null | undefined;
  vivas: Set<() => void>;
  locales: Map<string, string>;
};

function urlDe(ctx: CtxAdjuntos, ref: string): string | null {
  if (!idDeRef(ref)) return null;
  const local = ctx.locales.get(ref);
  if (local) return local;
  let url: string | null | undefined = null;
  try { url = ctx.resolver(ref); } catch { url = null; }
  return urlDibujable(url) ? url : null;
}

/**
 * La imagen de TipTap, dibujada con `urlDeAdjunto`. El `src` del NODO es la referencia (lo que se
 * guarda); el del `<img>` en pantalla es la URL de quien mira.
 */
const ImagenAdjunto = Image.extend<{ ctx: CtxAdjuntos | null; inline: boolean; allowBase64: boolean; HTMLAttributes: Record<string, unknown>; resize: false }>({
  addOptions() {
    return { inline: false, allowBase64: false, HTMLAttributes: {}, resize: false, ctx: null };
  },
  // El tamaño y la alineación (item 10): lo que no es EXACTAMENTE un valor de la lista no se lee,
  // y lo que no se lee no se escribe. Sin atributo, la imagen va a su tamaño natural, como antes.
  addAttributes() {
    return {
      ...this.parent?.(),
      ancho: {
        default: null,
        parseHTML: (el: HTMLElement) => anchoDeImagen(el.getAttribute('data-ancho')),
        renderHTML: (a: Record<string, unknown>) => {
          const n = anchoDeImagen(a.ancho);
          return n ? { 'data-ancho': String(n) } : {};
        },
      },
      alinea: {
        default: null,
        parseHTML: (el: HTMLElement) => alineaDeImagen(el.getAttribute('data-alinea')),
        renderHTML: (a: Record<string, unknown>) => {
          const al = alineaDeImagen(a.alinea);
          return al ? { 'data-alinea': al } : {};
        },
      },
    };
  },
  addNodeView() {
    const ctx = this.options.ctx;
    return ({ node }) => {
      const img = document.createElement('img');
      let actual = node;
      const pintar = () => {
        const ref = String(actual.attrs.src ?? '');
        const url = ctx ? urlDe(ctx, ref) : null;
        if (url) { if (img.getAttribute('src') !== url) img.src = url; img.classList.remove('mk-rico-img-pendiente'); }
        else { img.removeAttribute('src'); img.classList.add('mk-rico-img-pendiente'); }
        img.alt = String(actual.attrs.alt ?? '');
        if (actual.attrs.title) img.title = String(actual.attrs.title); else img.removeAttribute('title');
        // El ancho lo dibuja `CSS_RICO` desde el atributo, igual que en la lectura: la imagen se ve
        // en el editor al mismo tamaño que la va a ver el alumno.
        const ancho = anchoDeImagen(actual.attrs.ancho);
        if (ancho) img.dataset.ancho = String(ancho); else delete img.dataset.ancho;
        const alinea = alineaDeImagen(actual.attrs.alinea);
        if (alinea) img.dataset.alinea = alinea; else delete img.dataset.alinea;
      };
      pintar();
      ctx?.vivas.add(pintar);
      return {
        dom: img,
        update: (n) => { if (n.type !== actual.type) return false; actual = n; pintar(); return true; },
        destroy: () => { ctx?.vivas.delete(pintar); },
      };
    };
  },
});

/**
 * El CHIP de un archivo adjunto (un PDF, una planilla, un ZIP): un nodo atómico en el renglón, con
 * el nombre. Se guarda como `<a class="mk-adjunto" href="mako-adjunto:<uuid>">nombre</a>`, que es
 * lo que el saneo del server deja pasar y lo que `HtmlSeguro` traduce a un link.
 *
 * En el editor se dibuja como un `<span>` (sin `href`): un link con un esquema que el navegador no
 * conoce, adentro de un texto editable, es un clic que no lleva a ningún lado.
 */
const ChipAdjunto = NodoTiptap.create({
  name: 'adjuntoArchivo',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      ref: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('href'), renderHTML: () => ({}) },
      nombre: {
        default: 'archivo',
        parseHTML: (el: HTMLElement) => (el.textContent || 'archivo').replace(/\s+/g, ' ').trim().slice(0, 160) || 'archivo',
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    // Más prioridad que el link de TipTap (50): un `<a class="mk-adjunto">` es este nodo, no texto
    // con un enlace.
    return [{ tag: 'a.mk-adjunto[href]', priority: 60, getAttrs: (el) => (idDeRef((el as HTMLElement).getAttribute('href')) ? null : false) }];
  },
  renderHTML({ node }) {
    return ['a', { class: 'mk-adjunto', href: node.attrs.ref }, String(node.attrs.nombre ?? 'archivo')];
  },
  renderText({ node }) {
    return String(node.attrs.nombre ?? '');
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'mk-adjunto';
      dom.contentEditable = 'false';
      dom.textContent = String(node.attrs.nombre ?? 'archivo');
      dom.title = String(node.attrs.nombre ?? '');
      return { dom };
    };
  },
});

/**
 * El embed de un nodo `insertado`, o `null` si sus atributos no son uno que `embedDe` reconozca (un
 * documento viejo o tocado a mano): ahí no se dibuja ni se escribe nada.
 */
function embedDelNodo(attrs: Record<string, unknown>): Embed | null {
  const e = embedDe(String(attrs.src ?? ''));
  if (!e || e.proveedor !== attrs.proveedor) return null;
  return e.alto == null ? e : { ...e, alto: altoDeEmbed(attrs.alto) ?? e.alto };
}

/** Lo que el editor lee de un `<iframe>` (pegado o del HTML guardado): la regla del saneo, `embedDeIframe`. */
const leerIframe = (el: HTMLElement): Embed | null =>
  embedDeIframe({ src: el.getAttribute('src'), 'data-alto': el.getAttribute('data-alto'), height: el.getAttribute('height') });

/**
 * LO INSERTADO (item 15, ver la trampa 12 de la cabecera): un video o una agenda, como un bloque
 * atómico. Cada atributo se LEE con `leerIframe` (TipTap mezcla lo que devuelve cada atributo por encima
 * del `getAttrs` de la regla: sin su propio `parseHTML`, el `src` crudo del código pisaría el rearmado)
 * y no se escribe solo (`renderHTML: () => ({})`): el `<iframe>` lo arma `atributosDeIframe`, completo.
 */
const Insertado = NodoTiptap.create({
  name: 'insertado',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null, parseHTML: (el: HTMLElement) => leerIframe(el)?.src ?? null, renderHTML: () => ({}) },
      proveedor: { default: null, parseHTML: (el: HTMLElement) => leerIframe(el)?.proveedor ?? null, renderHTML: () => ({}) },
      alto: { default: null, parseHTML: (el: HTMLElement) => leerIframe(el)?.alto ?? null, renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    // Un iframe que no es de la lista no entra al documento (y al pegar, se va con lo demás que no entra).
    return [{ tag: 'iframe[src]', getAttrs: (el) => (leerIframe(el as HTMLElement) ? null : false) }];
  },
  renderHTML({ node }) {
    const e = embedDelNodo(node.attrs);
    return e ? ['iframe', Object.fromEntries(atributosDeIframe(e))] : ['p'];
  },
  renderText({ node }) {
    return String(node.attrs.src ?? '');
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'mk-er-insertado';
      dom.contentEditable = 'false';
      const iframe = document.createElement('iframe');
      dom.appendChild(iframe);
      let actual = node;
      const pintar = () => {
        const e = embedDelNodo(actual.attrs);
        if (!e) { iframe.removeAttribute('src'); return; }
        // El `sandbox` ANTES que el `src`: se aplica en la navegación que arranca con el `src`.
        const attrs = atributosDeIframe(e);
        for (const [k, v] of attrs) if (k !== 'src' && iframe.getAttribute(k) !== v) iframe.setAttribute(k, v);
        if (iframe.getAttribute('src') !== e.src) iframe.setAttribute('src', e.src);
      };
      pintar();
      return {
        dom,
        update: (n) => { if (n.type !== actual.type) return false; actual = n; pintar(); return true; },
        // Lo que pase adentro del iframe (otra página) no es un cambio del documento.
        ignoreMutation: () => true,
      };
    };
  },
});

/** Los atajos que TipTap no trae: Ctrl/⌘+K abre el panel del enlace (el de Word y Docs). */
const AtajosMako = Extension.create<{ abrirEnlace: () => void }>({
  name: 'atajosMako',
  addOptions() { return { abrirEnlace: () => {} }; },
  addKeyboardShortcuts() {
    return { 'Mod-k': () => { this.options.abrirEnlace(); return true; } };
  },
});

// ── Las paletas ──────────────────────────────────────────────────────────────

/**
 * Una paleta CORTA, a propósito: con veinte colores cada clase sale de un color distinto. Tonos
 * medios, que se leen sobre blanco y sobre el fondo oscuro.
 */
const COLORES: ReadonlyArray<{ hex: string; nombre: string }> = [
  { hex: '#64748B', nombre: 'Gris' },
  { hex: '#DC2626', nombre: 'Rojo' },
  { hex: '#EA580C', nombre: 'Naranja' },
  { hex: '#16A34A', nombre: 'Verde' },
  { hex: '#2563EB', nombre: 'Azul' },
  { hex: '#7C3AED', nombre: 'Violeta' },
];
/** Resaltados CLAROS: la letra de un resaltado va siempre oscura (CSS_RICO). */
const RESALTADOS: ReadonlyArray<{ hex: string; nombre: string }> = [
  { hex: '#FEF08A', nombre: 'Amarillo' },
  { hex: '#BBF7D0', nombre: 'Verde' },
  { hex: '#BFDBFE', nombre: 'Azul' },
  { hex: '#FBCFE8', nombre: 'Rosa' },
  { hex: '#FED7AA', nombre: 'Naranja' },
];

const BLOQUES = [
  { value: 'p', label: 'Párrafo' },
  { value: 'h2', label: 'Título' },
  { value: 'h3', label: 'Subtítulo' },
];

// ── Los íconos (trazo, 16 px; sin librería) ──────────────────────────────────

function Ico({ d, children }: { d?: string; children?: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d ? <path d={d} /> : children}
    </svg>
  );
}
const I = {
  deshacer: <Ico d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  rehacer: <Ico d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
  lista: <Ico d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  numerada: <Ico d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />,
  tareas: <Ico d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" />,
  cita: <Ico d="M5 5v14M10 8h9M10 12h9M10 16h6" />,
  linea: <Ico d="M4 12h16" />,
  enlace: <Ico d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />,
  izquierda: <Ico d="M4 6h16M4 12h10M4 18h13" />,
  centro: <Ico d="M4 6h16M7 12h10M5 18h14" />,
  derecha: <Ico d="M4 6h16M10 12h10M7 18h13" />,
  justificar: <Ico d="M4 6h16M4 12h16M4 18h16" />,
  imagen: <Ico><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></Ico>,
  clip: <Ico d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
  resaltar: <Ico d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />,
  cerrar: <Ico d="M18 6 6 18M6 6l12 12" />,
  tabla: <Ico><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 10v10M15 10v10" /></Ico>,
  insertar: <Ico><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m10 9 5 3-5 3z" /></Ico>,
  mas: <Ico><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Ico>,
  // Borrar es el tacho de la casa, ROJO siempre (sexta tanda, general 9): no un trazo propio en el gris
  // de la barra. Mismo dibujo que `IconoMenu nombre="borrar"` y que `BotonBorrar`.
  borrar: <IconoBorrar size={16} />,
  filaArriba: <Ico d="M4 14h16M4 20h16M12 11V3M8.5 6.5 12 3l3.5 3.5" />,
  filaAbajo: <Ico d="M4 4h16M4 10h16M12 13v8M8.5 17.5 12 21l3.5-3.5" />,
  colIzquierda: <Ico d="M14 4v16M20 4v16M11 12H3M6.5 8.5 3 12l3.5 3.5" />,
  colDerecha: <Ico d="M4 4v16M10 4v16M13 12h8M17.5 8.5 21 12l-3.5 3.5" />,
  sacarFila: <Ico><rect x="3" y="9" width="18" height="6" rx="1" /><path d="M9 12h6" /></Ico>,
  sacarCol: <Ico><rect x="9" y="3" width="6" height="18" rx="1" /><path d="M12 9v6" /></Ico>,
  titulos: <Ico><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9.5h18M7 7h4" /></Ico>,
  parrafo: <span aria-hidden="true" style={{ fontWeight: 600, fontSize: 14 }}>¶</span>,
  titulo: <span aria-hidden="true" style={{ fontWeight: 800, fontSize: 15 }}>T</span>,
  subtitulo: <span aria-hidden="true" style={{ fontWeight: 700, fontSize: 12 }}>T</span>,
};

/** El ancho del selector «Párrafo / Título / Subtítulo»: lo usan el selector y su lugar en la regla. */
const ANCHO_BLOQUE = 118;

// ── Los estilos del editor (los de LECTURA vienen de CSS_RICO) ───────────────
// ⚠️ SIN COMILLAS INVERTIDAS NI SIGNO DE PESOS CON LLAVE adentro: es una cadena (AGENTS.md).

const CSS_EDITOR = `
.mk-editor-rico { position: relative; min-width: 0; border: 1px solid var(--border-strong, #DCE0E7); border-radius: var(--r-md, 11px); background: var(--surface, #FFFFFF); color: var(--ink, #12151B); --mk-er-gap: 2px; }
.mk-editor-rico:focus-within { border-color: var(--primary, #2F6FED); box-shadow: 0 0 0 3px var(--primary-bg, #EAF1FE); }
.mk-editor-rico.es-arrastre { border-color: var(--primary, #2F6FED); border-style: dashed; }
.mk-editor-rico .mk-er-barra { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: nowrap; align-items: center; gap: var(--mk-er-gap); min-width: 0; padding: 5px 6px; overflow: hidden; contain: inline-size; background: var(--surface, #FFFFFF); border-bottom: 1px solid var(--border, #EAECF1); border-radius: var(--r-md, 11px) var(--r-md, 11px) 0 0; }
.mk-editor-rico .mk-er-regla { position: absolute; top: 0; left: 0; display: flex; flex-wrap: nowrap; align-items: center; gap: var(--mk-er-gap); width: max-content; visibility: hidden; pointer-events: none; }
.mk-editor-rico .mk-er-sep { flex: none; width: 9px; height: 18px; background: linear-gradient(var(--border, #EAECF1), var(--border, #EAECF1)) center / 1px 100% no-repeat; }
.mk-editor-rico .mk-er-bloque { flex: none; display: inline-flex; align-items: center; }
.mk-editor-rico .mk-er-btn.mk-er-mas { margin-left: auto; }
.mk-editor-rico .mk-er-btn { width: 30px; height: 30px; flex: none; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--r-sm, 8px); background: transparent; color: var(--dim, #454C57); cursor: pointer; font-family: inherit; font-size: 14px; line-height: 1; padding: 0; transition: background .12s ease, color .12s ease; }
.mk-editor-rico .mk-er-btn:hover:not(:disabled) { background: var(--velo-hover, rgba(18,21,27,.055)); color: var(--ink, #12151B); }
.mk-editor-rico .mk-er-btn[aria-pressed="true"] { background: var(--primary-bg, #EAF1FE); color: var(--primary, #2F6FED); }
.mk-editor-rico .mk-er-btn:disabled { opacity: .38; cursor: default; }
.mk-editor-rico .mk-er-btn:focus-visible { outline: none; box-shadow: var(--focus-ring, 0 0 0 2px #FFFFFF, 0 0 0 4px #2F6FED); }
.mk-editor-rico .mk-er-btn .mk-er-raya { display: block; width: 14px; height: 3px; border-radius: 2px; margin-top: 2px; }
.mk-editor-rico .ProseMirror { outline: none; padding: 12px 14px 14px; min-height: var(--mk-er-min, 140px); cursor: text; }
.mk-editor-rico.mk-editor-rico .ProseMirror[contenteditable]:focus-visible { outline: none; }
.mk-editor-rico .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; height: 0; pointer-events: none; color: var(--faint, #66707F); }
.mk-editor-rico .ProseMirror img { cursor: default; }
.mk-editor-rico .ProseMirror img.ProseMirror-selectednode, .mk-editor-rico .ProseMirror .mk-adjunto.ProseMirror-selectednode { outline: 2px solid var(--primary, #2F6FED); outline-offset: 2px; }
.mk-editor-rico .ProseMirror .mk-rico-img-pendiente { width: 100%; min-height: 96px; background: var(--surface-2, #F5F7FA); border: 1px dashed var(--border-strong, #DCE0E7); }
.mk-editor-rico .ProseMirror .mk-er-insertado { position: relative; margin: .4em 0 .9em; border-radius: 8px; cursor: pointer; }
.mk-editor-rico .ProseMirror .mk-er-insertado > iframe { margin: 0; pointer-events: none; }
.mk-editor-rico .ProseMirror .mk-er-insertado.ProseMirror-selectednode { outline: 2px solid var(--primary, #2F6FED); outline-offset: 2px; cursor: default; }
.mk-editor-rico .ProseMirror .mk-er-insertado.ProseMirror-selectednode > iframe { pointer-events: auto; }
.mk-editor-rico .ProseMirror .selectedCell { position: relative; }
.mk-editor-rico .ProseMirror .selectedCell::after { content: ''; position: absolute; inset: 0; background: rgba(47, 111, 237, .14); pointer-events: none; }
.mk-editor-rico .mk-er-img-barra { position: absolute; z-index: 1; display: flex; align-items: center; gap: 2px; padding: 3px; white-space: nowrap; border-radius: var(--r-sm, 8px); background: var(--surface, #FFFFFF); border: 1px solid var(--border-strong, #DCE0E7); box-shadow: 0 6px 18px rgba(18, 21, 27, .18); }
.mk-editor-rico .mk-er-img-op { flex: none; display: inline-flex; align-items: center; justify-content: center; height: 26px; min-width: 26px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent; color: var(--dim, #454C57); font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; cursor: pointer; }
.mk-editor-rico .mk-er-img-op:hover { background: var(--velo-hover, rgba(18, 21, 27, .055)); color: var(--ink, #12151B); }
.mk-editor-rico .mk-er-img-op[aria-pressed="true"] { background: var(--primary-bg, #EAF1FE); color: var(--primary, #2F6FED); }
.mk-editor-rico .mk-er-img-op:focus-visible, .mk-editor-rico .mk-er-img-asa:focus-visible, .mk-editor-rico .mk-er-tabla-chip:focus-visible { outline: none; box-shadow: var(--focus-ring, 0 0 0 2px #FFFFFF, 0 0 0 4px #2F6FED); }
.mk-editor-rico .mk-er-img-sep { flex: none; width: 1px; height: 16px; margin: 0 3px; background: var(--border, #EAECF1); }
.mk-editor-rico .mk-er-img-asa { position: absolute; z-index: 1; width: 14px; height: 14px; padding: 0; border: 2px solid var(--surface, #FFFFFF); border-radius: 4px; background: var(--primary, #2F6FED); box-shadow: 0 1px 4px rgba(18, 21, 27, .35); cursor: nwse-resize; touch-action: none; }
.mk-editor-rico .mk-er-img-pct { position: absolute; z-index: 1; padding: 3px 7px; border-radius: 6px; background: var(--ink, #12151B); color: #FFFFFF; font-size: 11px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; opacity: 0; pointer-events: none; }
.mk-editor-rico.es-redimension .mk-er-img-barra { opacity: 0; pointer-events: none; }
.mk-editor-rico.es-redimension .mk-er-img-pct { opacity: 1; }
.mk-editor-rico.es-redimension, .mk-editor-rico.es-redimension * { cursor: nwse-resize !important; }
.mk-editor-rico .mk-er-tabla-chip { position: absolute; z-index: 1; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 1px solid var(--border-strong, #DCE0E7); border-radius: 999px; background: var(--surface, #FFFFFF); color: var(--dim, #454C57); box-shadow: 0 2px 8px rgba(18, 21, 27, .16); cursor: pointer; }
.mk-editor-rico .mk-er-tabla-chip:hover, .mk-editor-rico .mk-er-tabla-chip[aria-expanded="true"] { color: var(--primary, #2F6FED); border-color: var(--primary, #2F6FED); }
.mk-editor-rico .ProseMirror ul[data-type="taskList"] > li::before { display: none; }
.mk-editor-rico .ProseMirror ul[data-type="taskList"] > li > label { flex: none; display: inline-flex; margin-top: .3em; user-select: none; text-decoration: none; }
.mk-editor-rico .ProseMirror ul[data-type="taskList"] > li > label > input { width: 1.05em; height: 1.05em; margin: 0; cursor: pointer; accent-color: var(--good, #1E9E57); }
.mk-editor-rico .mk-er-avisos { display: flex; flex-direction: column; gap: 4px; padding: 6px 8px 0; }
.mk-editor-rico .mk-er-aviso { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: var(--fs-meta, 12px); color: var(--dim, #454C57); }
.mk-editor-rico .mk-er-aviso.es-error { color: var(--bad, #D0504A); }
.mk-editor-rico .mk-er-aviso-nombre { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mk-editor-rico .mk-er-aviso-dato { flex: none; font-variant-numeric: tabular-nums; }
.mk-editor-rico .mk-er-carril { flex: 1 1 80px; min-width: 60px; height: 4px; border-radius: 999px; background: var(--surface-2, #F5F7FA); overflow: hidden; position: relative; }
.mk-editor-rico .mk-er-carril > span { position: absolute; left: 0; top: 0; bottom: 0; background: var(--primary, #2F6FED); border-radius: 999px; transition: width .2s ease; }
.mk-editor-rico .mk-er-carril.es-indeterminado > span { width: 35%; animation: mk-er-ir 1.1s ease-in-out infinite; }
@keyframes mk-er-ir { from { left: -35%; } to { left: 100%; } }
@media (prefers-reduced-motion: reduce) { .mk-editor-rico .mk-er-carril.es-indeterminado > span { animation: none; left: 0; width: 100%; opacity: .45; } }
.mk-editor-rico .mk-er-x { flex: none; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: inherit; cursor: pointer; border-radius: 6px; padding: 0; }
.mk-editor-rico .mk-er-x:hover { background: var(--velo-hover, rgba(18,21,27,.055)); }
.mk-editor-rico .mk-er-soltar { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center; pointer-events: none; border-radius: var(--r-md, 11px); background: color-mix(in srgb, var(--primary-bg, #EAF1FE) 82%, transparent); color: var(--primary, #2F6FED); font-weight: 600; font-size: var(--fs-sm, 13px); }
.mk-er-flota { background: var(--surface, #FFFFFF); color: var(--ink, #12151B); border: 1px solid var(--border-strong, #DCE0E7); border-radius: var(--r-md, 11px); box-shadow: 0 16px 40px rgba(18,21,27,.22); padding: 10px; font-family: 'Geist', system-ui, sans-serif; font-size: var(--fs-sm, 13px); }
.mk-er-flota .mk-er-muestras { display: flex; gap: 6px; flex-wrap: wrap; }
.mk-er-flota .mk-er-muestra { width: 26px; height: 26px; border-radius: 999px; border: 2px solid transparent; cursor: pointer; padding: 0; box-shadow: inset 0 0 0 1px rgba(18,21,27,.12); }
.mk-er-flota .mk-er-muestra[aria-pressed="true"] { border-color: var(--primary, #2F6FED); }
.mk-er-flota .mk-er-muestra:focus-visible { outline: none; box-shadow: var(--focus-ring, 0 0 0 2px #FFFFFF, 0 0 0 4px #2F6FED); }
.mk-er-flota .mk-er-quitar { margin-top: 8px; width: 100%; height: 30px; border: 1px solid var(--border, #EAECF1); border-radius: var(--r-sm, 8px); background: transparent; color: var(--dim, #454C57); cursor: pointer; font: inherit; }
.mk-er-flota .mk-er-quitar:hover { background: var(--velo-hover, rgba(18,21,27,.055)); }
.mk-er-flota .mk-er-input { width: 100%; box-sizing: border-box; height: 34px; padding: 0 10px; border: 1px solid var(--border-strong, #DCE0E7); border-radius: var(--r-sm, 8px); background: var(--surface, #FFFFFF); color: inherit; font: inherit; outline: none; }
.mk-er-flota .mk-er-input:focus { border-color: var(--primary, #2F6FED); box-shadow: 0 0 0 3px var(--primary-bg, #EAF1FE); }
.mk-er-flota .mk-er-acciones { display: flex; gap: 6px; margin-top: 8px; }
.mk-er-flota .mk-er-accion { height: 30px; padding: 0 12px; border-radius: var(--r-sm, 8px); border: 1px solid var(--border, #EAECF1); background: transparent; color: var(--dim, #454C57); cursor: pointer; font: inherit; }
.mk-er-flota .mk-er-accion:hover { background: var(--velo-hover, rgba(18,21,27,.055)); }
.mk-er-flota .mk-er-accion.es-primaria { background: var(--primary, #2F6FED); border-color: var(--primary, #2F6FED); color: var(--on-primary, #FFFFFF); }
.mk-er-flota .mk-er-accion.es-primaria:hover { background: var(--primary-strong, #245FD6); }
.mk-er-flota .mk-er-error { margin-top: 6px; color: var(--bad, #D0504A); font-size: var(--fs-meta, 12px); }
.mk-er-flota .mk-er-codigo { height: auto; min-height: 66px; padding: 8px 10px; resize: vertical; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; line-height: 1.45; }
.mk-er-flota .mk-er-nota { margin-top: 6px; color: var(--faint, #66707F); font-size: var(--fs-meta, 12px); }
.mk-er-flota .mk-er-menu { display: flex; flex-direction: column; gap: 1px; margin: -4px; max-height: min(70vh, 480px); overflow-y: auto; }
.mk-er-flota .mk-er-fila { flex: none; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 32px; padding: 0 8px; border: 0; border-radius: var(--r-sm, 8px); background: transparent; color: var(--ink, #12151B); font: inherit; text-align: left; cursor: pointer; }
.mk-er-flota .mk-er-fila:hover:not(:disabled), .mk-er-flota .mk-er-fila:focus-visible { background: var(--velo-hover, rgba(18, 21, 27, .055)); outline: none; }
.mk-er-flota .mk-er-fila[aria-checked="true"] { color: var(--primary, #2F6FED); font-weight: 600; }
.mk-er-flota .mk-er-fila:disabled { opacity: .4; cursor: default; }
.mk-er-flota .mk-er-fila.es-peligro { color: var(--bad, #D0504A); }
.mk-er-flota .mk-er-fila-ico { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 18px; color: var(--dim, #454C57); }
.mk-er-flota .mk-er-fila[aria-checked="true"] .mk-er-fila-ico, .mk-er-flota .mk-er-fila.es-peligro .mk-er-fila-ico { color: inherit; }
.mk-er-flota .mk-er-fila-txt { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mk-er-flota .mk-er-fila-atajo { flex: none; font-size: var(--fs-meta, 12px); color: var(--faint, #66707F); font-variant-numeric: tabular-nums; }
.mk-er-flota .mk-er-menu-sep { flex: none; height: 1px; margin: 4px 2px; background: var(--border, #EAECF1); }
.mk-er-flota .mk-er-raya { display: block; width: 14px; height: 3px; border-radius: 2px; margin-top: 2px; }
`;

// ── El panel flotante (color, resaltado, enlace) ─────────────────────────────

function Flotante({ ancla, onCerrar, children, etiqueta, ancho = 220 }: {
  ancla: HTMLElement;
  onCerrar: () => void;
  children: ReactNode;
  etiqueta: string;
  ancho?: number;
}) {
  const capa = useCapaModal(true, { anidada: true });
  const esElDeArriba = capa.esElDeArriba;
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);

  // ⚠️ SIN el `montado` de los otros portales de la casa, y a propósito: este panel sólo existe
  //    después de un CLIC (nunca en el render del server), así que `document` ya está y el portal
  //    se monta en el PRIMER render — el efecto que lo mide lo encuentra. Con un `montado` que
  //    arranca en false, el efecto tendría que llevarlo en sus dependencias o mediría la nada
  //    (AGENTS.md, «un efecto que mide un nodo montado por un portal…»).
  useLayoutEffect(() => {
    const ubicar = () => {
      const el = ref.current;
      if (!el) return;
      const r = ancla.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8 && r.top - h - 6 >= 8) top = r.top - h - 6;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      setPos({ top, left });
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [ancla]);

  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (ref.current?.contains(t) || ancla.contains(t))) return;
      cerrarRef.current();
    };
    // ⚠️ `stopImmediatePropagation` y NO `stopPropagation`: los Escape de la casa viven todos en
    //    `document` y en captura, y frenar la propagación no frena a los hermanos del mismo nodo.
    //    Sin esto, un Escape en el panel cerraba también el modal donde vive el editor.
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cerrarRef.current();
    };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('pointerdown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla, esElDeArriba]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={etiqueta}
      className="mk-er-flota"
      // ⚠️ OPACIDAD y no `visibility: hidden` mientras se ubica: un elemento con `visibility: hidden`
      //    no puede recibir el foco, y el campo del enlace se enfoca en ese mismo instante. Medido en
      //    Chrome: con `visibility`, Ctrl+K abría el panel y lo que se tipeaba caía en el TEXTO.
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: ancho, zIndex: capa.z, opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none' }}
    >
      {children}
    </div>,
    document.body,
  );
}

// ── Una subida en curso ──────────────────────────────────────────────────────

type Subida = { id: string; nombre: string; pct: number | null; error?: string };

// ── Medidas del DOM (las decisiones viven en editor-rico-reglas.ts) ──────────

const num = (s: string | null | undefined): number => parseFloat(s ?? '') || 0;

/** El ancho del TEXTO del editor (sin su relleno), en px CSS: contra eso se mide el % de una imagen. */
function anchoDelTexto(e: Editor | null): number | null {
  if (!e || e.isDestroyed) return null;
  const pm = e.view.dom as HTMLElement;
  const cs = getComputedStyle(pm);
  const w = pm.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight);
  return w > 0 ? w : null;
}

/**
 * El ancho natural de una imagen recién subida, leído de su `blob:` (ya está en memoria: tarda nada).
 * Con un tope de tiempo: si no carga, la imagen entra igual, al ancho por default.
 * (Con `createElement` y no `new Image()`: `Image` acá es la extensión de TipTap.)
 */
function anchoNatural(url: string): Promise<number | null> {
  return new Promise((ok) => {
    const img = document.createElement('img');
    const t = window.setTimeout(() => ok(null), 3000);
    img.onload = () => { window.clearTimeout(t); ok(img.naturalWidth || null); };
    img.onerror = () => { window.clearTimeout(t); ok(null); };
    img.src = url;
  });
}

/** Dónde empieza la tabla en la que está el cursor (o la selección de celdas), o `null`. */
function posDeTabla(e: Editor): number | null {
  const { $from } = e.state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') return $from.before(d);
  return null;
}

type TipoPanel = 'color' | 'resaltado' | 'enlace' | 'mas' | 'tabla' | 'insertar';

/**
 * Una pieza de la barra. La barra y el menú «Más» dibujan la MISMA lista: lo que no entra en una
 * va al otro, con el mismo nombre y la misma acción. `abre` = la acción abre un panel propio (color,
 * resaltado, enlace, tabla), así que desde «Más» no lo cierra: lo reemplaza.
 */
type PiezaBoton = {
  tipo: 'boton'; id: string; nombre: string; atajo?: string; icono: ReactNode;
  activo?: boolean; apagado?: boolean; abre?: boolean; recorrido?: string; refBoton?: Ref<HTMLButtonElement>;
  accion: (el: HTMLElement) => void;
};
type Pieza = PiezaBoton | { tipo: 'sep'; id: string; sep: true } | { tipo: 'bloque'; id: string };

// ── El editor ────────────────────────────────────────────────────────────────

export function EditorRico({
  valor, onCambio, subirAdjunto, urlDeAdjunto, placeholder = 'Escribe aquí…', soloLectura = false,
  aceptaArchivos, aceptaImagenes = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif',
  minAlto = 140, etiqueta = 'Texto', className, style, botonesExtra,
}: EditorRicoProps) {
  const ctx = useRef<CtxAdjuntos | null>(null);
  if (!ctx.current) ctx.current = { resolver: urlDeAdjunto, vivas: new Set(), locales: new Map() };
  const onCambioRef = useRef(onCambio);
  const subirRef = useRef(subirAdjunto);
  const ultimoEmitido = useRef(valor ?? '');
  /** Dónde va cada archivo que está subiendo: una posición que se CORRE con cada cambio. */
  const destinos = useRef(new Map<string, number>());
  /** Cuántas imágenes ajenas sacó el último pegado (lo lee `handlePaste`, que corre después). */
  const imagenesFueraDelPegado = useRef(0);
  const abrirEnlaceRef = useRef<() => void>(() => {});
  const editorRef = useRef<Editor | null>(null);
  /** Mete un video o una agenda donde está el cursor: el panel «Insertar» y el pegado de un código. */
  const insertarEmbedRef = useRef((e: Embed) => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return;
    ed.chain().focus().insertContent({ type: 'insertado', attrs: { src: e.src, proveedor: e.proveedor, alto: e.alto ?? null } }).run();
  });
  /**
   * Lo último que se sacó con un botón (una tabla, una imagen) y dónde estaba, con la posición
   * CORRIDA con cada cambio (como las subidas): es lo que vuelve a poner «Deshacer».
   */
  const sacado = useRef<{ pos: number; nodo: JSONContent; profundidad: number } | null>(null);

  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastre, setArrastre] = useState(false);
  const [panel, setPanel] = useState<null | { tipo: TipoPanel; ancla: HTMLElement }>(null);
  const [mod, setMod] = useState('Ctrl');
  /** Cuántas piezas de la barra se ven; las demás están en «Más». Lo decide `repartoDeBarra`. */
  const [visibles, setVisibles] = useState(Number.POSITIVE_INFINITY);
  /** ¿El foco está adentro del editor? Los controles de la imagen y de la tabla viven sólo mientras tanto. */
  const [enfocado, setEnfocado] = useState(false);
  const { toast, show: mostrarToast, clear: cerrarToast } = useToast();
  const inputImagen = useRef<HTMLInputElement | null>(null);
  const inputArchivo = useRef<HTMLInputElement | null>(null);
  const botonEnlace = useRef<HTMLButtonElement | null>(null);
  const botonMas = useRef<HTMLButtonElement | null>(null);
  /** «Más» abierto con el teclado: el foco va a la primera opción (con el mouse se queda en el texto). */
  const masPorTeclado = useRef(false);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const barraRef = useRef<HTMLDivElement | null>(null);
  const reglaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { onCambioRef.current = onCambio; }, [onCambio]);
  useEffect(() => { subirRef.current = subirAdjunto; }, [subirAdjunto]);
  // El ⌘ se mira en el navegador, después de montar: en el server no hay plataforma y el título
  // del botón saldría distinto en la hidratación.
  useEffect(() => { if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) setMod('⌘'); }, []);

  // Cuando quien monta trae URLs nuevas (o firmadas de nuevo), las imágenes se redibujan.
  useLayoutEffect(() => {
    const c = ctx.current!;
    c.resolver = urlDeAdjunto;
    c.vivas.forEach((pintar) => pintar());
  }, [urlDeAdjunto]);

  // Los `blob:` de lo recién subido se sueltan al desmontar (si no, quedan en memoria).
  useEffect(() => () => { ctx.current?.locales.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const quitarSubida = useCallback((id: string) => setSubidas((s) => s.filter((x) => x.id !== id)), []);

  /** Sube archivos y los mete en `pos` (o donde está el cursor), corriendo la posición mientras tanto. */
  const subirArchivos = useCallback((files: File[], pos: number | null) => {
    const subir = subirRef.current;
    const ed = editorRef.current;
    if (!subir || !ed || ed.isDestroyed || !files.length) return;
    setAviso(null);
    for (const file of files) {
      const id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      destinos.current.set(id, pos ?? ed.state.selection.to);
      setSubidas((s) => [...s, { id, nombre: file.name, pct: null }]);
      const local = esImagen(file.type) ? URL.createObjectURL(file) : null;
      subir(file, (pct) => setSubidas((s) => s.map((x) => (x.id === id ? { ...x, pct: Math.max(0, Math.min(100, Math.round(pct))) } : x))))
        .then(async (r) => {
          if (!r || !idDeRef(r.ref)) throw new Error('No se pudo adjuntar.');
          // Una imagen nueva entra a un ancho razonable (item 10): «se ve enorme» era una captura
          // de 1.920 px ocupando todo el texto. Se mide ANTES de leer el destino: mientras carga,
          // el destino se sigue corriendo con lo que se escriba.
          const ancho = esImagen(r.mime)
            ? anchoInicialDeImagen(local ? await anchoNatural(local) : null, anchoDelTexto(editorRef.current))
            : null;
          const e = editorRef.current;
          if (!e || e.isDestroyed) return;
          const donde = Math.max(0, Math.min(destinos.current.get(id) ?? e.state.selection.to, e.state.doc.content.size));
          if (esImagen(r.mime)) {
            if (local) ctx.current!.locales.set(r.ref, local);
            e.chain().insertContentAt(donde, { type: 'image', attrs: { src: r.ref, alt: r.nombre, ancho } }).run();
          } else {
            if (local) URL.revokeObjectURL(local);
            e.chain().insertContentAt(donde, [{ type: 'adjuntoArchivo', attrs: { ref: r.ref, nombre: r.nombre } }, { type: 'text', text: ' ' }]).run();
          }
          quitarSubida(id);
        })
        .catch((err: unknown) => {
          if (local) URL.revokeObjectURL(local);
          const texto = err instanceof Error && err.message ? err.message : 'No se pudo subir.';
          setSubidas((s) => s.map((x) => (x.id === id ? { ...x, error: texto } : x)));
        })
        .finally(() => { destinos.current.delete(id); });
    }
  }, [quitarSubida]);

  const extensiones = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      undoRedo: { depth: 200 },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => hrefPermitido(url),
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      },
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    TaskList,
    // El nombre que lee un lector de pantalla en cada casilla: el de fábrica está en inglés.
    TaskItem.configure({ nested: true, a11y: { checkboxLabel: (n, hecho) => `${hecho ? 'Hecha' : 'Pendiente'}: ${n.textContent || 'tarea vacía'}` } }),
    ImagenAdjunto.configure({ ctx: ctx.current }),
    ChipAdjunto,
    Insertado,
    // Las tablas (item 10). Sin columnas redimensionables: el ancho de cada columna en px no pasa el
    // saneo (no tiene sentido en un teléfono), y la tabla se reparte el ancho sola.
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder }),
    AtajosMako.configure({ abrirEnlace: () => abrirEnlaceRef.current() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const editor = useEditor({
    // ⚠️ `false` es obligatorio con SSR: el editor no existe en el server y dibujarlo en el primer
    //    render rompe la hidratación.
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: extensiones,
    content: valor || '',
    editable: !soloLectura,
    editorProps: {
      attributes: { class: 'mk-rico', 'aria-label': etiqueta, role: 'textbox', 'aria-multiline': 'true' },
      transformPastedHTML: (html) => {
        const r = limpiarPegado(html);
        imagenesFueraDelPegado.current = r.imagenesFuera;
        return r.html;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const fuera = imagenesFueraDelPegado.current;
        imagenesFueraDelPegado.current = 0;
        // Pegar SÓLO el código que da el proveedor (el `<iframe>` de YouTube, el `<div>` de Calendly) lo
        // inserta (trampa 12). Lo que no es de la lista se pega como texto, como siempre.
        const plano = event.clipboardData?.getData('text/plain') ?? '';
        if (!files.length && esCodigoParaInsertar(plano)) {
          const e = embedDe(plano);
          if (e) { insertarEmbedRef.current(e); return true; }
        }
        if (subirRef.current && pegadoEsDeArchivos(files.length, event.clipboardData?.getData('text/html'))) {
          subirArchivos(files, null);
          return true;
        }
        if (fuera > 0) setAviso(avisoImagenesFuera(fuera));
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        // ⚠️ SOLTAR también pasa por `transformPastedHTML` (lo que se arrastra desde otra página
        //    llega como HTML): el contador se consume ACÁ también. Si no, quedaba vivo y el próximo
        //    pegado de texto plano —que no pasa por `transformPastedHTML`— avisaba de imágenes que
        //    nadie pegó.
        const fuera = imagenesFueraDelPegado.current;
        imagenesFueraDelPegado.current = 0;
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!files.length) {
          if (fuera > 0) setAviso(avisoImagenesFuera(fuera));
          return false;
        }
        setArrastre(false);
        if (!subirRef.current) return true;
        const p = view.posAtCoords({ left: event.clientX, top: event.clientY });
        subirArchivos(files, p ? p.pos : null);
        return true;
      },
    },
    onCreate: ({ editor: e }) => { editorRef.current = e; },
    onDestroy: () => { editorRef.current = null; },
    onTransaction: ({ transaction }) => {
      if (!transaction.docChanged) return;
      for (const [k, p] of destinos.current) destinos.current.set(k, transaction.mapping.map(p));
      const s = sacado.current;
      if (s) sacado.current = { ...s, pos: transaction.mapping.map(s.pos) };
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const limpio = html === '<p></p>' ? '' : html;
      ultimoEmitido.current = limpio;
      onCambioRef.current(limpio);
    },
  });

  useEffect(() => { editorRef.current = editor ?? null; }, [editor]);

  // ⚠️ `valor` SE VUELVE A CARGAR SÓLO SI DICE OTRA COSA. Se compara el DOCUMENTO que produciría,
  //    no el string: el server devuelve el HTML saneado (`<br />`, atributos en otro orden) y, si se
  //    recargara por eso, el cursor saltaría al principio en medio de una palabra.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const v = valor || '';
    if (v === ultimoEmitido.current) return;
    ultimoEmitido.current = v;
    try {
      if (createDocument(v, editor.schema).eq(editor.state.doc)) return;
    } catch { /* si no se puede comparar, se carga */ }
    editor.commands.setContent(v, { emitUpdate: false });
  }, [valor, editor]);

  // ⚠️ `false` = sin evento de cambio: `setEditable` emite un «update» por default, y eso le
  //    mandaba a quien monta un `onCambio` apenas se abría la pantalla — o sea un «sin guardar»
  //    sobre algo que nadie tocó.
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable === soloLectura) editor.setEditable(!soloLectura, false);
  }, [editor, soloLectura]);

  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const alinea = (['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left';
      return {
        negrita: e.isActive('bold'),
        cursiva: e.isActive('italic'),
        subrayado: e.isActive('underline'),
        tachado: e.isActive('strike'),
        bloque: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
        lista: e.isActive('bulletList'),
        numerada: e.isActive('orderedList'),
        tareas: e.isActive('taskList'),
        cita: e.isActive('blockquote'),
        enlace: e.isActive('link'),
        href: (e.getAttributes('link').href as string | undefined) ?? '',
        alinea,
        color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
        resaltado: (e.getAttributes('highlight').color as string | undefined) ?? (e.isActive('highlight') ? '#FEF08A' : null),
        deshacer: e.can().undo(),
        rehacer: e.can().redo(),
        imagen: imagenElegida(e),
        tabla: tablaDelCursor(e),
        insertado: insertadoElegido(e),
      };
    },
  });

  const abrirEnlace = useCallback(() => {
    // Si «Enlace» se fue a «Más», el panel se ancla a «Más»: Ctrl+K no puede dejar de andar porque
    // la ventana se achicó.
    const ancla = botonEnlace.current ?? botonMas.current ?? barraRef.current;
    if (soloLectura || !ancla) return;
    setPanel({ tipo: 'enlace', ancla });
  }, [soloLectura]);
  useEffect(() => { abrirEnlaceRef.current = abrirEnlace; }, [abrirEnlace]);

  const cerrarPanel = useCallback(() => setPanel(null), []);
  const alternarPanel = (tipo: TipoPanel, ancla: HTMLElement) => setPanel((p) => (p?.tipo === tipo ? null : { tipo, ancla }));
  // `null` mientras el editor no existe (el primer render, que también es el del server): un clic
  // en la barra en ese instante no hace nada, en vez de tirar la pantalla.
  const cadena = () => (editor && !editor.isDestroyed ? editor.chain().focus() : null);

  // El menú de la tabla no sobrevive a salir de la tabla (lo que hace ya no tiene sobre qué), y un
  // panel anclado a un botón que se fue a «Más» (la ventana se achicó) queda flotando en la nada.
  const enTabla = !!estado?.tabla;
  useEffect(() => {
    if (!panel) return;
    if ((panel.tipo === 'tabla' && !enTabla) || !panel.ancla.isConnected) setPanel(null);
  }, [panel, enTabla, visibles]);

  /**
   * Saca un nodo (la tabla o la imagen) y deja 5 segundos de «Deshacer» (item 18). Deshacer vuelve a
   * poner EL MISMO nodo donde estaba —corrido con lo que se haya escrito después—, no un Ctrl+Z, que
   * se llevaría lo último que se tipeó. Como el editor guarda solo, deshacer escribe en el server.
   */
  const sacarConDeshacer = useCallback((pos: number, aviso: string) => {
    const e = editorRef.current;
    if (!e || e.isDestroyed) return;
    const nodo = e.state.doc.nodeAt(pos);
    if (!nodo) return;
    sacado.current = { pos, nodo: nodo.toJSON() as JSONContent, profundidad: 0 };
    e.chain().focus().deleteRange({ from: pos, to: pos + nodo.nodeSize }).run();
    if (sacado.current) sacado.current = { ...sacado.current, profundidad: undoDepth(e.state) };
    const deshacer = () => {
      const s = sacado.current;
      sacado.current = null;
      const ed = editorRef.current;
      if (!s || !ed || ed.isDestroyed) return;
      // ⚠️ SI UN Ctrl+Z YA LO DEVOLVIÓ, NO SE PONE OTRA VEZ (revisión final del 08/10/2026): borrar con
      //    el botón es también un paso del historial, así que un Ctrl+Z dentro de los 5 segundos ya
      //    devuelve el nodo, y apretar además «Deshacer» dejaba DOS tablas iguales. Se sabe mirando la
      //    PROFUNDIDAD del historial: es una pila, así que el borrado sólo se deshizo si quedó por debajo
      //    de lo que medía justo después de borrar (deshacer lo que se tipeó después no baja de ahí).
      if (undoDepth(ed.state) < s.profundidad) return;
      ed.chain().focus().insertContentAt(Math.max(0, Math.min(s.pos, ed.state.doc.content.size)), s.nodo).run();
    };
    // ⚠️ EL TOAST ES DEL EDITOR, no de quien lo monta: uno de afuera puede vivir más que el editor
    //    (se cambia de clase en esos 5 segundos) y ahí «Deshacer» no tendría dónde volver a poner el
    //    nodo — un botón que no deshace nada. El propio se va con el editor.
    mostrarToast(aviso, deshacer);
  }, [mostrarToast]);

  const alElegirArchivos = (lista: FileList | null, input: HTMLInputElement | null) => {
    const files = Array.from(lista ?? []);
    if (input) input.value = '';
    if (files.length) subirArchivos(files, null);
  };

  const puedeAdjuntar = !!subirAdjunto && !soloLectura;
  const enCurso = subidas.length > 0;

  const aplicarBloque = (v: string) => {
    if (v === 'h2') cadena()?.setHeading({ level: 2 }).run();
    else if (v === 'h3') cadena()?.setHeading({ level: 3 }).run();
    else cadena()?.setParagraph().run();
  };

  // ── Las piezas de la barra, en orden: lo más usado primero, porque lo que no entra se va a
  //    «Más» desde el final. Las marcas (negrita, cursiva…) antes que el selector de párrafo, que
  //    mide como cuatro botones: en una columna angosta, la negrita es lo que tiene que quedar a
  //    mano. Insertar (enlace, imagen, archivo, tabla) va antes que las listas y la alineación: es
  //    lo que se pidió que se vea.
  const sep = (id: string): Pieza => ({ tipo: 'sep', id, sep: true });
  const piezas: Pieza[] = [
    { tipo: 'boton', id: 'deshacer', nombre: 'Deshacer', atajo: `${mod}+Z`, icono: I.deshacer, apagado: !estado?.deshacer, accion: () => cadena()?.undo().run() },
    { tipo: 'boton', id: 'rehacer', nombre: 'Rehacer', atajo: `${mod}+Shift+Z`, icono: I.rehacer, apagado: !estado?.rehacer, accion: () => cadena()?.redo().run() },
    sep('s-marcas'),
    { tipo: 'boton', id: 'negrita', nombre: 'Negrita', atajo: `${mod}+B`, icono: <b style={{ fontWeight: 800 }}>B</b>, activo: estado?.negrita, accion: () => cadena()?.toggleBold().run() },
    { tipo: 'boton', id: 'cursiva', nombre: 'Cursiva', atajo: `${mod}+I`, icono: <i style={{ fontFamily: 'Georgia, serif', fontSize: 15 }}>I</i>, activo: estado?.cursiva, accion: () => cadena()?.toggleItalic().run() },
    { tipo: 'boton', id: 'subrayado', nombre: 'Subrayado', atajo: `${mod}+U`, icono: <span style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>U</span>, activo: estado?.subrayado, accion: () => cadena()?.toggleUnderline().run() },
    { tipo: 'boton', id: 'tachado', nombre: 'Tachado', atajo: `${mod}+Shift+S`, icono: <span style={{ textDecoration: 'line-through' }}>S</span>, activo: estado?.tachado, accion: () => cadena()?.toggleStrike().run() },
    {
      tipo: 'boton', id: 'color', nombre: 'Color del texto', activo: !!estado?.color, abre: true, accion: (el) => alternarPanel('color', el),
      icono: (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontWeight: 700 }}>
          A<span className="mk-er-raya" style={{ background: estado?.color ?? 'var(--ink, #12151B)' }} />
        </span>
      ),
    },
    {
      tipo: 'boton', id: 'resaltar', nombre: 'Resaltar', activo: !!estado?.resaltado, abre: true, accion: (el) => alternarPanel('resaltado', el),
      icono: (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
          {I.resaltar}<span className="mk-er-raya" style={{ background: estado?.resaltado ?? 'transparent', marginTop: 1 }} />
        </span>
      ),
    },
    // Los de quien monta (`botonesExtra`), con su separador. Sin ellos, la barra es la de siempre.
    // El id lleva prefijo: un `id` de afuera no puede pisar el de una pieza propia.
    ...(botonesExtra?.length ? [
      sep('s-extra'),
      ...botonesExtra.map((b): PiezaBoton => ({ tipo: 'boton', id: `x-${b.id}`, nombre: b.nombre, icono: b.icono, activo: b.activo, apagado: b.apagado, accion: b.accion })),
    ] : []),
    sep('s-bloque'),
    { tipo: 'bloque', id: 'bloque' },
    sep('s-insertar'),
    { tipo: 'boton', id: 'enlace', nombre: 'Enlace', atajo: `${mod}+K`, icono: I.enlace, activo: estado?.enlace, abre: true, refBoton: botonEnlace, accion: (el) => alternarPanel('enlace', el) },
    ...(puedeAdjuntar ? [
      { tipo: 'boton', id: 'imagen', nombre: 'Imagen', icono: I.imagen, recorrido: 'editor-imagen', accion: () => inputImagen.current?.click() } satisfies PiezaBoton,
      { tipo: 'boton', id: 'adjuntar', nombre: 'Adjuntar archivo', icono: I.clip, recorrido: 'editor-adjuntar', accion: () => inputArchivo.current?.click() } satisfies PiezaBoton,
    ] : []),
    {
      // Afuera de una tabla, la inserta (3 × 3 con títulos); adentro, abre sus filas y columnas.
      tipo: 'boton', id: 'tabla', nombre: enTabla ? 'Filas y columnas' : 'Tabla', icono: I.tabla, activo: enTabla, abre: enTabla, recorrido: 'editor-tabla',
      accion: (el) => (enTabla ? alternarPanel('tabla', el) : cadena()?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()),
    },
    // Un video o una agenda (item 15, trampa 12): abre el panel donde se pega el link o el código.
    { tipo: 'boton', id: 'insertar', nombre: 'Insertar video o agenda', icono: I.insertar, abre: true, recorrido: 'editor-insertar', accion: (el) => alternarPanel('insertar', el) },
    sep('s-listas'),
    { tipo: 'boton', id: 'lista', nombre: 'Lista', atajo: `${mod}+Shift+8`, icono: I.lista, activo: estado?.lista, accion: () => cadena()?.toggleBulletList().run() },
    { tipo: 'boton', id: 'numerada', nombre: 'Lista numerada', atajo: `${mod}+Shift+7`, icono: I.numerada, activo: estado?.numerada, accion: () => cadena()?.toggleOrderedList().run() },
    { tipo: 'boton', id: 'tareas', nombre: 'Lista de tareas', atajo: `${mod}+Shift+9`, icono: I.tareas, activo: estado?.tareas, accion: () => cadena()?.toggleTaskList().run() },
    { tipo: 'boton', id: 'cita', nombre: 'Cita', atajo: `${mod}+Shift+B`, icono: I.cita, activo: estado?.cita, accion: () => cadena()?.toggleBlockquote().run() },
    { tipo: 'boton', id: 'linea', nombre: 'Línea', icono: I.linea, accion: () => cadena()?.setHorizontalRule().run() },
    sep('s-alinear'),
    { tipo: 'boton', id: 'izquierda', nombre: 'Alinear a la izquierda', atajo: `${mod}+Shift+L`, icono: I.izquierda, activo: estado?.alinea === 'left', accion: () => cadena()?.setTextAlign('left').run() },
    { tipo: 'boton', id: 'centro', nombre: 'Centrar', atajo: `${mod}+Shift+E`, icono: I.centro, activo: estado?.alinea === 'center', accion: () => cadena()?.setTextAlign('center').run() },
    { tipo: 'boton', id: 'derecha', nombre: 'Alinear a la derecha', atajo: `${mod}+Shift+R`, icono: I.derecha, activo: estado?.alinea === 'right', accion: () => cadena()?.setTextAlign('right').run() },
    { tipo: 'boton', id: 'justificar', nombre: 'Justificar', atajo: `${mod}+Shift+J`, icono: I.justificar, activo: estado?.alinea === 'justify', accion: () => cadena()?.setTextAlign('justify').run() },
  ];
  const firmaPiezas = piezas.map((p) => p.id).join(',');
  const nVisibles = Math.min(visibles, piezas.length);
  const hayMas = nVisibles < piezas.length;
  const enMas = hayMas ? recortarSeparadores(piezas.slice(nVisibles).map((p) => ({ p, sep: p.tipo === 'sep' }))).map((x) => x.p) : [];

  // ⚠️ CUÁNTAS PIEZAS ENTRAN se decide con la REGLA (todas las piezas, escondidas, siempre) y el
  //    ancho de la barra — nunca con lo que la barra muestra, que es lo que la decisión cambia. Se
  //    vuelve a decidir si cambia el ancho de la barra (su contenedor, el zoom, el teléfono que gira)
  //    o la ventana: con zoom, la ventana es más angosta en px CSS aunque nada observado cambie.
  //    `getBoundingClientRect`, no `offsetWidth`: con zoom los anchos son fraccionarios.
  useLayoutEffect(() => {
    if (soloLectura) return;
    const barra = barraRef.current, regla = reglaRef.current;
    if (!barra || !regla) return;
    const medir = () => {
      const hijos = Array.from(regla.children) as HTMLElement[];
      if (hijos.length < 2) return;
      const mas = hijos[hijos.length - 1];
      const medidas = hijos.slice(0, -1).map((h) => ({ ancho: h.getBoundingClientRect().width, sep: h.classList.contains('mk-er-sep') }));
      const cs = getComputedStyle(barra);
      const disponible = barra.getBoundingClientRect().width - num(cs.paddingLeft) - num(cs.paddingRight) - num(cs.borderLeftWidth) - num(cs.borderRightWidth);
      const r = repartoDeBarra(medidas, disponible, num(cs.columnGap), mas.getBoundingClientRect().width);
      setVisibles((v) => (v === r.visibles ? v : r.visibles));
    };
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(barra);
    ro?.observe(regla);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, [firmaPiezas, soloLectura]);

  const pintarPieza = (p: Pieza) => {
    if (p.tipo === 'sep') return <span key={p.id} className="mk-er-sep" aria-hidden="true" />;
    if (p.tipo === 'bloque') {
      return (
        <span key={p.id} className="mk-er-bloque" style={{ width: ANCHO_BLOQUE }}>
          <Dropdown
            value={estado?.bloque ?? 'p'}
            options={BLOQUES}
            onChange={(v) => { if (editor) aplicarBloque(v); }}
            width={ANCHO_BLOQUE}
            ariaLabel="Estilo del texto"
            search={false}
            disabled={!editor}
            buttonStyle={{ height: 30, minHeight: 30, padding: '0 8px', fontSize: 13, borderRadius: 8, border: '1px solid transparent', background: 'transparent' }}
          />
        </span>
      );
    }
    return (
      <Boton key={p.id} titulo={p.atajo ? `${p.nombre} (${p.atajo})` : p.nombre} activo={p.activo} disabled={p.apagado}
        refBoton={p.refBoton} recorrido={p.recorrido} onClick={(el) => p.accion(el)}>
        {p.icono}
      </Boton>
    );
  };

  return (
    <div
      ref={raizRef}
      className={['mk-editor-rico', arrastre ? 'es-arrastre' : '', className].filter(Boolean).join(' ')}
      style={{ ...({ '--mk-er-min': `${minAlto}px` } as CSSProperties), ...style }}
      onFocus={() => setEnfocado(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEnfocado(false); }}
      onDragOver={(e) => {
        if (!puedeAdjuntar || !e.dataTransfer.types.includes('Files')) return;
        // Sin esto, soltar un archivo sobre la BARRA (fuera del texto) lo abre el navegador en la
        // pestaña y se pierde la pantalla.
        e.preventDefault();
        if (!arrastre) setArrastre(true);
      }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastre(false); }}
      onDrop={(e) => {
        setArrastre(false);
        // Lo que cae ADENTRO del texto ya lo tomó ProseMirror (`handleDrop`, que hace su propio
        // preventDefault); acá llega lo que cayó en la barra o en los avisos.
        if (e.defaultPrevented || !puedeAdjuntar) return;
        const files = Array.from(e.dataTransfer.files ?? []);
        if (!files.length) return;
        e.preventDefault();
        subirArchivos(files, null);
      }}
    >
      <style href="mk-rico" precedence="medium">{CSS_RICO}</style>
      <style href="mk-editor-rico" precedence="medium">{CSS_EDITOR}</style>

      {!soloLectura && (
        <div ref={barraRef} className="mk-er-barra" role="toolbar" aria-label="Formato" data-recorrido="editor-barra">
          {piezas.slice(0, nVisibles).map(pintarPieza)}
          {hayMas && (
            <Boton titulo="Más opciones" refBoton={botonMas} clase="mk-er-mas" recorrido="editor-mas" expandido={panel?.tipo === 'mas'}
              onClick={(el, teclado) => { masPorTeclado.current = teclado; alternarPanel('mas', el); }}>
              {I.mas}
            </Boton>
          )}
          {/* La REGLA: todas las piezas, siempre, escondidas. Contra ella se mide qué entra (ver el
              efecto de `repartoDeBarra`); la última es el lugar de «Más». Sin texto ni
              `data-recorrido`: no la ve ni el lector de pantalla ni el recorrido. */}
          <div ref={reglaRef} className="mk-er-regla" aria-hidden="true">
            {piezas.map((p) => (
              p.tipo === 'sep' ? <span key={p.id} className="mk-er-sep" />
                : p.tipo === 'bloque' ? <span key={p.id} className="mk-er-bloque" style={{ width: ANCHO_BLOQUE }} />
                  : <span key={p.id} className="mk-er-btn" />
            ))}
            <span className="mk-er-btn" />
          </div>
        </div>
      )}
      {puedeAdjuntar && (
        <>
          <input ref={inputImagen} type="file" accept={aceptaImagenes} multiple hidden onChange={(e) => alElegirArchivos(e.target.files, e.target)} />
          <input ref={inputArchivo} type="file" accept={aceptaArchivos} multiple hidden onChange={(e) => alElegirArchivos(e.target.files, e.target)} />
        </>
      )}

      {(enCurso || aviso) && (
        <div className="mk-er-avisos" aria-live="polite">
          {subidas.map((s) => (
            <div key={s.id} className={s.error ? 'mk-er-aviso es-error' : 'mk-er-aviso'}>
              <span className="mk-er-aviso-nombre">{s.nombre}</span>
              {s.error ? (
                <>
                  <span className="mk-er-aviso-dato">{s.error}</span>
                  <button type="button" className="mk-er-x" aria-label="Quitar aviso" title="Quitar aviso" onClick={() => quitarSubida(s.id)}>{I.cerrar}</button>
                </>
              ) : (
                <>
                  <span className={s.pct == null ? 'mk-er-carril es-indeterminado' : 'mk-er-carril'} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.pct ?? undefined} aria-label={`Subiendo ${s.nombre}`}>
                    <span style={s.pct == null ? undefined : { width: `${s.pct}%` }} />
                  </span>
                  <span className="mk-er-aviso-dato">{s.pct == null ? 'Subiendo' : `${s.pct}%`}</span>
                </>
              )}
            </div>
          ))}
          {aviso && (
            <div className="mk-er-aviso">
              <span className="mk-er-aviso-nombre">{aviso}</span>
              <button type="button" className="mk-er-x" aria-label="Quitar aviso" title="Quitar aviso" onClick={() => setAviso(null)}>{I.cerrar}</button>
            </div>
          )}
        </div>
      )}

      <EditorContent editor={editor} />

      {arrastre && puedeAdjuntar && <div className="mk-er-soltar" aria-hidden="true">Suelta para subir</div>}

      {panel && editor && panel.tipo === 'color' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta="Color del texto">
          <Muestras
            colores={COLORES}
            actual={estado?.color ?? null}
            onElegir={(hex) => { cadena()?.setColor(hex).run(); cerrarPanel(); }}
          />
          <button type="button" className="mk-er-quitar" onClick={() => { cadena()?.unsetColor().run(); cerrarPanel(); }}>Automático</button>
        </Flotante>
      )}
      {panel && editor && panel.tipo === 'resaltado' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta="Resaltar">
          <Muestras
            colores={RESALTADOS}
            actual={estado?.resaltado ?? null}
            onElegir={(hex) => { cadena()?.setHighlight({ color: hex }).run(); cerrarPanel(); }}
          />
          <button type="button" className="mk-er-quitar" onClick={() => { cadena()?.unsetHighlight().run(); cerrarPanel(); }}>Sin resaltado</button>
        </Flotante>
      )}
      {panel && editor && panel.tipo === 'enlace' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta="Enlace" ancho={300}>
          <PanelEnlace
            actual={estado?.enlace ? estado.href : ''}
            onAplicar={(href) => {
              const { empty } = editor.state.selection;
              if (estado?.enlace) cadena()?.extendMarkRange('link').setLink({ href }).run();
              // Sin texto elegido, se escribe la dirección como enlace y un espacio SIN la marca: el
              // enlace es «inclusivo» (por el autolink) y lo que se tipee después lo seguiría.
              else if (empty) cadena()?.insertContent([{ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }, { type: 'text', text: ' ' }]).run();
              else cadena()?.setLink({ href }).run();
              cerrarPanel();
            }}
            onQuitar={estado?.enlace ? () => { cadena()?.extendMarkRange('link').unsetLink().run(); cerrarPanel(); } : undefined}
          />
        </Flotante>
      )}
      {panel && editor && panel.tipo === 'insertar' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta="Insertar video o agenda" ancho={320}>
          <PanelInsertar onInsertar={(e) => { insertarEmbedRef.current(e); cerrarPanel(); }} />
        </Flotante>
      )}
      {panel && editor && panel.tipo === 'mas' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta="Más opciones" ancho={240}>
          <MenuMas piezas={enMas} ancla={panel.ancla} enfocar={masPorTeclado.current} bloque={estado?.bloque ?? 'p'}
            onBloque={aplicarBloque} onCerrar={cerrarPanel} />
        </Flotante>
      )}
      {panel && editor && panel.tipo === 'tabla' && estado?.tabla && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta="Filas y columnas" ancho={240}>
          <Menu etiqueta="Filas y columnas" enfocar={false}>
            <FilaMenu nombre="Fila arriba" icono={I.filaArriba} apagado={!estado.tabla.filaAntes} onClick={() => cadena()?.addRowBefore().run()} />
            <FilaMenu nombre="Fila abajo" icono={I.filaAbajo} apagado={!estado.tabla.filaDespues} onClick={() => cadena()?.addRowAfter().run()} />
            <FilaMenu nombre="Columna a la izquierda" icono={I.colIzquierda} apagado={!estado.tabla.colAntes} onClick={() => cadena()?.addColumnBefore().run()} />
            <FilaMenu nombre="Columna a la derecha" icono={I.colDerecha} apagado={!estado.tabla.colDespues} onClick={() => cadena()?.addColumnAfter().run()} />
            <div role="separator" className="mk-er-menu-sep" />
            <FilaMenu nombre="Quitar fila" icono={I.sacarFila} apagado={!estado.tabla.sacarFila} onClick={() => cadena()?.deleteRow().run()} />
            <FilaMenu nombre="Quitar columna" icono={I.sacarCol} apagado={!estado.tabla.sacarCol} onClick={() => cadena()?.deleteColumn().run()} />
            <div role="separator" className="mk-er-menu-sep" />
            <FilaMenu nombre="Fila de títulos" icono={I.titulos} activo={estado.tabla.titulos} onClick={() => cadena()?.toggleHeaderRow().run()} />
            <div role="separator" className="mk-er-menu-sep" />
            <FilaMenu nombre="Borrar tabla" icono={I.borrar} peligro
              onClick={() => { const pos = estado.tabla?.pos; cerrarPanel(); if (pos != null) sacarConDeshacer(pos, 'Tabla borrada'); }} />
          </Menu>
        </Flotante>
      )}

      {/* Los controles de lo que está elegido: el tamaño de una imagen y el menú de una tabla. Viven
          adentro del editor (no en un portal): se mueven con el texto al scrollear, y la barra
          pegada de arriba les pasa por encima. */}
      {editor && !soloLectura && enfocado && estado?.imagen && (
        <ControlesImagen editor={editor} raiz={raizRef} pos={estado.imagen.pos} ancho={estado.imagen.ancho} alinea={estado.imagen.alinea}
          onQuitar={() => { const pos = estado.imagen?.pos; if (pos != null) sacarConDeshacer(pos, 'Imagen quitada'); }} />
      )}
      {/* ⚠️ «Quitar» de lo insertado NO depende del foco, a diferencia de la imagen y la tabla: dar play
          es un clic ADENTRO de su iframe (otra página), y el foco se va del editor —o queda en el `body`
          si el iframe todavía carga—. Medido en el banco de la pista VIDEO: el bloque seguía elegido, con
          su borde, y «Quitar» desaparecía en 3 de 7 corridas (el foco en el iframe o en el `body`; mirar
          `document.activeElement` un tick después tapó el primer caso y no el segundo). Va con el borde:
          elegido, se ve. */}
      {editor && !soloLectura && estado?.insertado && (
        <ControlesInsertado editor={editor} raiz={raizRef} pos={estado.insertado.pos}
          onQuitar={() => {
            const pos = estado.insertado?.pos;
            if (pos == null) return;
            // Un aviso por clase de lo que se quitó (3-4 palabras, AGENTS.md): lo dice el toast.
            if (estado.insertado?.agenda) sacarConDeshacer(pos, 'Agenda quitada');
            else sacarConDeshacer(pos, 'Video quitado');
          }} />
      )}
      {editor && !soloLectura && enfocado && estado?.tabla && (
        <BotonTabla editor={editor} raiz={raizRef} pos={estado.tabla.pos} abierto={panel?.tipo === 'tabla'}
          onAbrir={(el) => alternarPanel('tabla', el)} />
      )}

      <Toast state={toast} onClose={cerrarToast} />
    </div>
  );
}

export default EditorRico;

// ── Lo que el editor lee del documento (para `useEditorState`) ──────────────

/** La imagen elegida (un clic sobre ella), con su ancho y su alineación, o `null`. */
function imagenElegida(e: Editor): { pos: number; ancho: number | null; alinea: AlineaImagen | null } | null {
  const sel = e.state.selection;
  if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'image') return null;
  return { pos: sel.from, ancho: anchoDeImagen(sel.node.attrs.ancho), alinea: alineaDeImagen(sel.node.attrs.alinea) };
}

/** Lo insertado que está elegido (un clic sobre él) y si es una agenda, o `null`. */
function insertadoElegido(e: Editor): { pos: number; agenda: boolean } | null {
  const sel = e.state.selection;
  if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'insertado') return null;
  return { pos: sel.from, agenda: claseDeProveedor(sel.node.attrs.proveedor) === 'agenda' };
}

/** La tabla donde está el cursor y lo que se puede hacer con ella, o `null`. */
function tablaDelCursor(e: Editor) {
  const pos = posDeTabla(e);
  if (pos == null) return null;
  const tabla = e.state.doc.nodeAt(pos);
  return {
    pos,
    titulos: tabla?.firstChild?.firstChild?.type.name === 'tableHeader',
    filaAntes: e.can().addRowBefore(),
    filaDespues: e.can().addRowAfter(),
    colAntes: e.can().addColumnBefore(),
    colDespues: e.can().addColumnAfter(),
    sacarFila: e.can().deleteRow(),
    sacarCol: e.can().deleteColumn(),
  };
}

// ── Piezas de la barra ───────────────────────────────────────────────────────

function Boton({ titulo, activo, disabled, onClick, children, refBoton, recorrido, expandido, clase }: {
  titulo: string;
  activo?: boolean;
  disabled?: boolean;
  /** `teclado`: el clic vino de Enter o Espacio (un clic de teclado no trae coordenadas). */
  onClick: (el: HTMLButtonElement, teclado: boolean) => void;
  children: ReactNode;
  refBoton?: Ref<HTMLButtonElement>;
  /** El punto del recorrido de la pantalla que es este botón (`data-recorrido`, app/_ui/Recorrido.tsx). */
  recorrido?: string;
  /** Si abre un menú: si está abierto. */
  expandido?: boolean;
  clase?: string;
}) {
  return (
    <button
      ref={refBoton}
      type="button"
      className={clase ? `mk-er-btn ${clase}` : 'mk-er-btn'}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo === undefined ? undefined : !!activo}
      aria-haspopup={expandido === undefined ? undefined : 'menu'}
      aria-expanded={expandido}
      data-recorrido={recorrido}
      disabled={disabled}
      // Sin esto, el clic le saca el foco al texto y la selección se pierde antes de aplicar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onClick(e.currentTarget, e.detail === 0)}
    >
      {children}
    </button>
  );
}

// ── Los menús («Más» y la tabla) ─────────────────────────────────────────────

/**
 * Un menú de filas: flechas, Inicio y Fin mueven el foco entre las opciones habilitadas. `enfocar`
 * pone el foco en la primera al abrir (cuando se abrió con el teclado; con el mouse, el foco se
 * queda en el texto, que es donde se está escribiendo).
 */
function Menu({ etiqueta, enfocar, children }: { etiqueta: string; enfocar: boolean; children: ReactNode }) {
  const lista = useRef<HTMLDivElement | null>(null);
  const opciones = () => Array.from(lista.current?.querySelectorAll<HTMLButtonElement>('.mk-er-fila:not(:disabled)') ?? []);
  useEffect(() => {
    if (!enfocar) return;
    // Un cuadro después: el panel se ubica en el mismo commit (va con opacidad, así recibe el foco).
    const id = requestAnimationFrame(() => opciones()[0]?.focus());
    return () => cancelAnimationFrame(id);
  }, [enfocar]);
  const tecla = (e: EventoTecla<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const ops = opciones();
    if (!ops.length) return;
    const i = ops.indexOf(document.activeElement as HTMLButtonElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? ops.length - 1
      : e.key === 'ArrowDown' ? (i + 1) % ops.length : (i <= 0 ? ops.length - 1 : i - 1);
    ops[j].focus();
  };
  return <div ref={lista} role="menu" aria-label={etiqueta} className="mk-er-menu" onKeyDown={tecla}>{children}</div>;
}

function FilaMenu({ nombre, atajo, icono, activo, apagado, peligro, onClick }: {
  nombre: string;
  atajo?: string;
  icono: ReactNode;
  activo?: boolean;
  apagado?: boolean;
  peligro?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={activo === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={activo === undefined ? undefined : !!activo}
      className={peligro ? 'mk-er-fila es-peligro' : 'mk-er-fila'}
      disabled={apagado}
      // Como en la barra: el clic no le saca el foco al texto, o se pierde lo que había elegido.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <span className="mk-er-fila-ico" aria-hidden="true">{icono}</span>
      <span className="mk-er-fila-txt">{nombre}</span>
      {atajo && <span className="mk-er-fila-atajo">{atajo}</span>}
    </button>
  );
}

/**
 * Lo que no entró en la barra, en el mismo orden y con la misma acción. Lo que abre un panel propio
 * (color, resaltado, enlace, la tabla) lo abre anclado a «Más» y este menú se cierra solo (el panel
 * lo reemplaza); lo demás actúa y cierra.
 */
function MenuMas({ piezas, ancla, enfocar, bloque, onBloque, onCerrar }: {
  piezas: Pieza[];
  ancla: HTMLElement;
  enfocar: boolean;
  bloque: string;
  onBloque: (v: string) => void;
  onCerrar: () => void;
}) {
  const ICONO_BLOQUE: Record<string, ReactNode> = { p: I.parrafo, h2: I.titulo, h3: I.subtitulo };
  return (
    <Menu etiqueta="Más opciones" enfocar={enfocar}>
      {piezas.map((p) => {
        if (p.tipo === 'sep') return <div key={p.id} role="separator" className="mk-er-menu-sep" />;
        if (p.tipo === 'bloque') {
          return BLOQUES.map((b) => (
            <FilaMenu key={`bloque-${b.value}`} nombre={b.label} icono={ICONO_BLOQUE[b.value]} activo={bloque === b.value}
              onClick={() => { onBloque(b.value); onCerrar(); }} />
          ));
        }
        return (
          <FilaMenu key={p.id} nombre={p.nombre} atajo={p.atajo} icono={p.icono} activo={p.activo} apagado={p.apagado}
            onClick={() => { p.accion(ancla); if (!p.abre) onCerrar(); }} />
        );
      })}
    </Menu>
  );
}

// ── Lo que está elegido: la imagen y la tabla ────────────────────────────────

type Caja = { top: number; left: number; ancho: number; alto: number; anchoRaiz: number };

/**
 * Dónde está un nodo del documento, relativo a la raíz del editor, y se vuelve a medir cuando el
 * documento cambia (lo de arriba crece o se achica), cuando cambia el tamaño del texto (una imagen
 * que termina de cargar, la ventana) y cuando carga una imagen adentro.
 */
function useCajaDelNodo(editor: Editor, raiz: RefObject<HTMLDivElement | null>, pos: number): Caja | null {
  const [caja, setCaja] = useState<Caja | null>(null);
  useLayoutEffect(() => {
    if (editor.isDestroyed) return;
    const pm = editor.view.dom as HTMLElement;
    const medir = () => {
      const r = raiz.current;
      let el: Node | null = null;
      try { el = editor.isDestroyed ? null : editor.view.nodeDOM(pos); } catch { el = null; }
      if (!r || !(el instanceof HTMLElement) || !el.isConnected) { setCaja((c) => (c ? null : c)); return; }
      const a = r.getBoundingClientRect(), b = el.getBoundingClientRect();
      const nueva: Caja = { top: b.top - a.top, left: b.left - a.left, ancho: b.width, alto: b.height, anchoRaiz: a.width };
      setCaja((c) => (c && c.top === nueva.top && c.left === nueva.left && c.ancho === nueva.ancho && c.alto === nueva.alto && c.anchoRaiz === nueva.anchoRaiz ? c : nueva));
    };
    medir();
    editor.on('transaction', medir);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(pm);
    window.addEventListener('resize', medir);
    pm.addEventListener('load', medir, true);
    return () => {
      editor.off('transaction', medir);
      ro?.disconnect();
      window.removeEventListener('resize', medir);
      pm.removeEventListener('load', medir, true);
    };
  }, [editor, raiz, pos]);
  return caja;
}

const TAMANOS_IMAGEN = [25, 50, 75, 100] as const;

/**
 * Lo que aparece sobre una imagen elegida (item 10): 25 / 50 / 75 / 100 %, izquierda o centro,
 * quitar, y la esquina para arrastrar. Todo escribe el atributo del nodo (una transacción: se
 * deshace con Ctrl+Z y se guarda como cualquier otro cambio).
 *
 * ⚠️ MIENTRAS SE ARRASTRA NO HAY TRANSACCIONES NI `setState`: se cambia el `data-ancho` del `<img>`
 *    (lo dibuja la misma regla de `CSS_RICO`) y la esquina se mueve escribiendo su estilo. Una
 *    transacción por `pointermove` serían sesenta pasos de deshacer por segundo y sesenta
 *    guardados. Al soltar, UNA transacción con el ancho final; si el gesto se cancela, el `<img>`
 *    vuelve a lo que tenía.
 * ⚠️ `setPointerCapture` manda el `pointerup` a la esquina aunque se suelte afuera, y
 *    `releasePointerCapture` puede tirar: va en un `try`, después de resolver (AGENTS.md).
 */
function ControlesImagen({ editor, raiz, pos, ancho, alinea, onQuitar }: {
  editor: Editor;
  raiz: RefObject<HTMLDivElement | null>;
  pos: number;
  ancho: number | null;
  alinea: AlineaImagen | null;
  onQuitar: () => void;
}) {
  const caja = useCajaDelNodo(editor, raiz, pos);
  const barra = useRef<HTMLDivElement | null>(null);
  const asa = useRef<HTMLButtonElement | null>(null);
  const pct = useRef<HTMLSpanElement | null>(null);
  const gesto = useRef<{ x: number; inicio: number; contenido: number; centro: boolean; img: HTMLElement; previo: string | undefined; actual: number } | null>(null);

  // La barra arranca sobre la esquina de la imagen y no se sale del editor por la derecha. Su ancho
  // no depende de dónde se ponga (no hay ida y vuelta), así que se mide y se escribe directo, antes
  // de pintar: sin un estado más que redibuje el editor.
  useLayoutEffect(() => {
    const b = barra.current;
    if (!b || !caja) return;
    const w = b.getBoundingClientRect().width;
    b.style.left = `${Math.max(4, Math.min(caja.left + 8, caja.anchoRaiz - w - 4))}px`;
  }, [caja, ancho, alinea]);

  // Cada cambio de tamaño o de lugar es UN paso de deshacer, aunque vengan seguidos: sin
  // `closeHistory`, el historial junta lo que pasa en medio segundo y un Ctrl+Z se llevaba el
  // arrastre junto con el 25 % de antes (medido en el banco).
  const aplicar = (attrs: { ancho?: number | null; alinea?: AlineaImagen | null }) => {
    if (editor.isDestroyed) return;
    editor.chain().focus().command(({ tr }) => {
      const n = tr.doc.nodeAt(pos);
      if (!n || n.type.name !== 'image') return false;
      tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...attrs });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      closeHistory(tr);
      return true;
    }).run();
  };

  const terminar = (guardar: boolean, el: HTMLElement | null, idPuntero: number | null) => {
    const g = gesto.current;
    gesto.current = null;
    raiz.current?.classList.remove('es-redimension');
    if (g) {
      if (guardar && g.actual !== ancho) aplicar({ ancho: g.actual });
      else if (g.previo) g.img.dataset.ancho = g.previo; else delete g.img.dataset.ancho;
    }
    try { if (el && idPuntero != null) el.releasePointerCapture(idPuntero); } catch { /* ya no la tenía */ }
  };

  if (!caja) return null;
  // Adentro de la imagen, arriba; si la imagen es más baja que la barra, encima de ella.
  const arriba = caja.alto >= 72 ? caja.top + 8 : Math.max(0, caja.top - 40);

  return (
    <>
      <div ref={barra} className="mk-er-img-barra" role="toolbar" aria-label="Imagen" style={{ top: arriba }}>
        {TAMANOS_IMAGEN.map((n) => (
          <button key={n} type="button" className="mk-er-img-op" aria-pressed={ancho === n} title={`Ancho ${n} %`}
            onMouseDown={(e) => e.preventDefault()} onClick={() => aplicar({ ancho: n })}>{n}%</button>
        ))}
        <span className="mk-er-img-sep" aria-hidden="true" />
        <button type="button" className="mk-er-img-op" aria-pressed={alinea !== 'centro'} title="A la izquierda" aria-label="A la izquierda"
          onMouseDown={(e) => e.preventDefault()} onClick={() => aplicar({ alinea: null })}>{I.izquierda}</button>
        <button type="button" className="mk-er-img-op" aria-pressed={alinea === 'centro'} title="Centrada" aria-label="Centrada"
          onMouseDown={(e) => e.preventDefault()} onClick={() => aplicar({ alinea: 'centro' })}>{I.centro}</button>
        <span className="mk-er-img-sep" aria-hidden="true" />
        <button type="button" className="mk-er-img-op" title="Quitar imagen" aria-label="Quitar imagen"
          onMouseDown={(e) => e.preventDefault()} onClick={onQuitar}>{I.borrar}</button>
      </div>
      <button
        ref={asa}
        type="button"
        className="mk-er-img-asa"
        title="Arrastra para cambiar el tamaño"
        aria-label="Cambiar el tamaño"
        style={{ top: caja.top + caja.alto - 8, left: caja.left + caja.ancho - 8 }}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          let img: Node | null = null;
          try { img = editor.view.nodeDOM(pos); } catch { img = null; }
          const contenido = anchoDelTexto(editor);
          if (!(img instanceof HTMLElement) || !contenido) return;
          const inicio = img.getBoundingClientRect().width;
          gesto.current = { x: e.clientX, inicio, contenido, centro: alinea === 'centro', img, previo: img.dataset.ancho, actual: ancho ?? anchoDeArrastre(inicio, contenido) };
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura, el gesto sigue igual */ }
          raiz.current?.classList.add('es-redimension');
        }}
        onPointerMove={(e) => {
          const g = gesto.current, r = raiz.current;
          if (!g || !r) return;
          const dx = e.clientX - g.x;
          const nuevo = anchoDeArrastre(g.inicio + (g.centro ? 2 * dx : dx), g.contenido);
          if (nuevo !== g.actual) { g.actual = nuevo; g.img.dataset.ancho = String(nuevo); }
          // La esquina y el número siguen a la imagen: se leen del DOM (no se calculan), y se
          // escriben directo en el estilo — nada de `setState` por cada movimiento.
          const a = r.getBoundingClientRect(), b = g.img.getBoundingClientRect();
          if (asa.current) { asa.current.style.top = `${b.bottom - a.top - 8}px`; asa.current.style.left = `${b.right - a.left - 8}px`; }
          if (pct.current) { pct.current.textContent = `${g.actual} %`; pct.current.style.top = `${b.bottom - a.top + 10}px`; pct.current.style.left = `${Math.max(4, b.right - a.left - 40)}px`; }
        }}
        onPointerUp={(e) => terminar(true, e.currentTarget, e.pointerId)}
        onPointerCancel={(e) => terminar(false, e.currentTarget, e.pointerId)}
        onLostPointerCapture={() => { if (gesto.current) terminar(true, null, null); }}
        onKeyDown={(e) => {
          // Sin mouse: las flechas cambian el ancho de a 5 %.
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          // Sin ancho guardado la imagen va a su tamaño natural: se parte de lo que MIDE, como el
          // arrastre. Con `?? 100`, una imagen de 300 px en un texto de 1.000 saltaba del 30 al 95 %.
          let img: Node | null = null;
          try { img = editor.view.nodeDOM(pos); } catch { img = null; }
          const contenido = anchoDelTexto(editor);
          const base = ancho ?? (img instanceof HTMLElement && contenido ? anchoDeArrastre(img.getBoundingClientRect().width, contenido) : 100);
          aplicar({ ancho: Math.max(10, Math.min(100, base + (e.key === 'ArrowRight' ? 5 : -5))) });
        }}
      />
      <span ref={pct} className="mk-er-img-pct" aria-hidden="true" />
    </>
  );
}

/**
 * El botón de la esquina de la tabla donde está el cursor: abre filas, columnas, títulos y borrar
 * (lo mismo que el botón «Tabla» de la barra, que puede haberse ido a «Más»).
 */
function BotonTabla({ editor, raiz, pos, abierto, onAbrir }: {
  editor: Editor;
  raiz: RefObject<HTMLDivElement | null>;
  pos: number;
  abierto: boolean;
  onAbrir: (el: HTMLElement) => void;
}) {
  const caja = useCajaDelNodo(editor, raiz, pos);
  if (!caja) return null;
  return (
    <button
      type="button"
      className="mk-er-tabla-chip"
      title="Filas y columnas"
      aria-label="Filas y columnas"
      aria-haspopup="menu"
      aria-expanded={abierto}
      style={{ top: caja.top + 4, left: Math.max(4, caja.left + caja.ancho - 28) }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onAbrir(e.currentTarget)}
    >
      {I.mas}
    </button>
  );
}

/**
 * Lo que aparece sobre un video o una agenda elegidos: «Quitar» (con su «Deshacer» de 5 segundos), en
 * la esquina de arriba a la derecha y AFUERA del bloque: adentro tapaba los controles del propio
 * reproductor (medido en el banco: el engranaje de YouTube quedaba abajo del botón). Si el bloque es lo
 * primero del texto y no hay lugar arriba, va adentro.
 */
function ControlesInsertado({ editor, raiz, pos, onQuitar }: {
  editor: Editor;
  raiz: RefObject<HTMLDivElement | null>;
  pos: number;
  onQuitar: () => void;
}) {
  const caja = useCajaDelNodo(editor, raiz, pos);
  const barra = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const b = barra.current;
    if (!b || !caja) return;
    const w = b.getBoundingClientRect().width;
    b.style.left = `${Math.max(4, Math.min(caja.left + caja.ancho - w - 8, caja.anchoRaiz - w - 4))}px`;
  }, [caja]);
  if (!caja) return null;
  return (
    <div ref={barra} className="mk-er-img-barra" role="toolbar" aria-label="Insertado" style={{ top: caja.top >= 40 ? caja.top - 38 : caja.top + 8 }}>
      <button type="button" className="mk-er-img-op" title="Quitar" aria-label="Quitar"
        onMouseDown={(e) => e.preventDefault()} onClick={onQuitar}>{I.borrar}</button>
    </div>
  );
}

function Muestras({ colores, actual, onElegir }: {
  colores: ReadonlyArray<{ hex: string; nombre: string }>;
  actual: string | null;
  onElegir: (hex: string) => void;
}) {
  return (
    <div className="mk-er-muestras">
      {colores.map((c) => (
        <button
          key={c.hex}
          type="button"
          className="mk-er-muestra"
          title={c.nombre}
          aria-label={c.nombre}
          aria-pressed={!!actual && mismoColor(actual, c.hex)}
          style={{ background: c.hex }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onElegir(c.hex)}
        />
      ))}
    </div>
  );
}

function PanelEnlace({ actual, onAplicar, onQuitar }: {
  actual: string;
  onAplicar: (href: string) => void;
  onQuitar?: () => void;
}) {
  const [texto, setTexto] = useState(actual);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  // Un cuadro después del montaje: el panel se ubica en el mismo commit, y el foco va cuando ya está.
  useEffect(() => {
    const id = requestAnimationFrame(() => { input.current?.focus(); input.current?.select(); });
    return () => cancelAnimationFrame(id);
  }, []);
  const aplicar = () => {
    const href = normalizarHref(texto);
    if (!href) { setError('Ese enlace no sirve.'); return; }
    onAplicar(href);
  };
  const abrible = /^https?:\/\//i.test(actual);
  return (
    <form onSubmit={(e) => { e.preventDefault(); aplicar(); }}>
      <input
        ref={input}
        className="mk-er-input"
        type="text"
        inputMode="url"
        placeholder="https://…"
        aria-label="Dirección del enlace"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setError(null); }}
      />
      {error && <div className="mk-er-error">{error}</div>}
      {/* `mk-er-acciones` y NO `mk-er-fila` (revisión final del 08/10/2026): ese nombre es el de cada
          renglón de los menús «Más» y de la tabla, y las dos reglas con el mismo selector se pisaban —
          cada renglón del menú heredaba el `margin-top: 8px` de esta fila, y esta fila el relleno y el
          cursor de un renglón—. */}
      <div className="mk-er-acciones">
        <button type="submit" className="mk-er-accion es-primaria">Aplicar</button>
        {onQuitar && <button type="button" className="mk-er-accion" onClick={onQuitar}>Quitar</button>}
        {abrible && <a className="mk-er-accion" href={actual} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Abrir</a>}
      </div>
    </form>
  );
}

/**
 * El panel «Insertar» (item 15): se pega un link o el código del proveedor, y `embedDe` (lib/embeds.ts)
 * decide. Un cuadro de varias líneas y no un campo: un código de Vimeo son cuatro renglones. Enter
 * inserta; Shift+Enter, salto de línea. Si no se puede, dice por qué en una frase (`porQueNoSeInserta`).
 */
function PanelInsertar({ onInsertar }: { onInsertar: (e: Embed) => void }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement | null>(null);
  // Un cuadro después del montaje, como el del enlace: el panel se ubica en el mismo commit.
  useEffect(() => {
    const id = requestAnimationFrame(() => campo.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  const aplicar = () => {
    const e = embedDe(texto);
    if (!e) { setError(porQueNoSeInserta(texto)); return; }
    onInsertar(e);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); aplicar(); }}>
      <textarea
        ref={campo}
        className="mk-er-input mk-er-codigo"
        rows={3}
        spellCheck={false}
        placeholder="Link o código para insertar"
        aria-label="Link o código para insertar"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setError(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aplicar(); } }}
      />
      {error && <div className="mk-er-error" role="alert">{error}</div>}
      <div className="mk-er-nota">YouTube, Vimeo, Panda, Calendly, Cal.com…</div>
      <div className="mk-er-acciones">
        <button type="submit" className="mk-er-accion es-primaria">Insertar</button>
      </div>
    </form>
  );
}
