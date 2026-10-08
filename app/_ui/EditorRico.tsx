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
// 5. LOS PANELES (color, resaltado, enlace) SE PORTALEAN AL BODY y se registran en la pila de
//    modales (`useCapaModal`, anidada): el editor puede vivir adentro de una caja con `overflow` o
//    de un modal, y un Escape en el panel no puede cerrar el modal de abajo.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import { Extension, Node as NodoTiptap, createDocument } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Dropdown } from '@/app/components/Dropdown';
import { useCapaModal } from '@/app/_components/pila-modales';
import { CSS_RICO, idDeRef, urlDibujable } from './HtmlSeguro';

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
};

// ── Los estilos del editor (los de LECTURA vienen de CSS_RICO) ───────────────
// ⚠️ SIN COMILLAS INVERTIDAS NI SIGNO DE PESOS CON LLAVE adentro: es una cadena (AGENTS.md).

const CSS_EDITOR = `
.mk-editor-rico { position: relative; border: 1px solid var(--border-strong, #DCE0E7); border-radius: var(--r-md, 11px); background: var(--surface, #FFFFFF); color: var(--ink, #12151B); }
.mk-editor-rico:focus-within { border-color: var(--primary, #2F6FED); box-shadow: 0 0 0 3px var(--primary-bg, #EAF1FE); }
.mk-editor-rico.es-arrastre { border-color: var(--primary, #2F6FED); border-style: dashed; }
.mk-editor-rico .mk-er-barra { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 5px 6px; background: var(--surface, #FFFFFF); border-bottom: 1px solid var(--border, #EAECF1); border-radius: var(--r-md, 11px) var(--r-md, 11px) 0 0; }
.mk-editor-rico .mk-er-sep { width: 1px; height: 18px; margin: 0 4px; background: var(--border, #EAECF1); flex: none; }
.mk-editor-rico .mk-er-btn { width: 30px; height: 30px; flex: none; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--r-sm, 8px); background: transparent; color: var(--dim, #454C57); cursor: pointer; font-family: inherit; font-size: 14px; line-height: 1; padding: 0; transition: background .12s ease, color .12s ease; }
.mk-editor-rico .mk-er-btn:hover:not(:disabled) { background: var(--velo-hover, rgba(18,21,27,.055)); color: var(--ink, #12151B); }
.mk-editor-rico .mk-er-btn[aria-pressed="true"] { background: var(--primary-bg, #EAF1FE); color: var(--primary, #2F6FED); }
.mk-editor-rico .mk-er-btn:disabled { opacity: .38; cursor: default; }
.mk-editor-rico .mk-er-btn:focus-visible { outline: none; box-shadow: var(--focus-ring, 0 0 0 2px #FFFFFF, 0 0 0 4px #2F6FED); }
.mk-editor-rico .mk-er-btn .mk-er-raya { display: block; width: 14px; height: 3px; border-radius: 2px; margin-top: 2px; }
.mk-editor-rico .ProseMirror { outline: none; padding: 12px 14px 14px; min-height: var(--mk-er-min, 140px); cursor: text; }
.mk-editor-rico .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; height: 0; pointer-events: none; color: var(--faint, #66707F); }
.mk-editor-rico .ProseMirror img { cursor: default; }
.mk-editor-rico .ProseMirror img.ProseMirror-selectednode, .mk-editor-rico .ProseMirror .mk-adjunto.ProseMirror-selectednode { outline: 2px solid var(--primary, #2F6FED); outline-offset: 2px; }
.mk-editor-rico .ProseMirror .mk-rico-img-pendiente { width: 100%; min-height: 96px; background: var(--surface-2, #F5F7FA); border: 1px dashed var(--border-strong, #DCE0E7); }
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
.mk-er-flota .mk-er-fila { display: flex; gap: 6px; margin-top: 8px; }
.mk-er-flota .mk-er-accion { height: 30px; padding: 0 12px; border-radius: var(--r-sm, 8px); border: 1px solid var(--border, #EAECF1); background: transparent; color: var(--dim, #454C57); cursor: pointer; font: inherit; }
.mk-er-flota .mk-er-accion:hover { background: var(--velo-hover, rgba(18,21,27,.055)); }
.mk-er-flota .mk-er-accion.es-primaria { background: var(--primary, #2F6FED); border-color: var(--primary, #2F6FED); color: var(--on-primary, #FFFFFF); }
.mk-er-flota .mk-er-accion.es-primaria:hover { background: var(--primary-strong, #245FD6); }
.mk-er-flota .mk-er-error { margin-top: 6px; color: var(--bad, #D0504A); font-size: var(--fs-meta, 12px); }
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

// ── El editor ────────────────────────────────────────────────────────────────

export function EditorRico({
  valor, onCambio, subirAdjunto, urlDeAdjunto, placeholder = 'Escribe aquí…', soloLectura = false,
  aceptaArchivos, aceptaImagenes = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif',
  minAlto = 140, etiqueta = 'Texto', className, style,
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

  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastre, setArrastre] = useState(false);
  const [panel, setPanel] = useState<null | { tipo: 'color' | 'resaltado' | 'enlace'; ancla: HTMLElement }>(null);
  const [mod, setMod] = useState('Ctrl');
  const inputImagen = useRef<HTMLInputElement | null>(null);
  const inputArchivo = useRef<HTMLInputElement | null>(null);
  const botonEnlace = useRef<HTMLButtonElement | null>(null);

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
        .then((r) => {
          if (!r || !idDeRef(r.ref)) throw new Error('No se pudo adjuntar.');
          const e = editorRef.current;
          if (!e || e.isDestroyed) return;
          const donde = Math.max(0, Math.min(destinos.current.get(id) ?? e.state.selection.to, e.state.doc.content.size));
          if (esImagen(r.mime)) {
            if (local) ctx.current!.locales.set(r.ref, local);
            e.chain().insertContentAt(donde, { type: 'image', attrs: { src: r.ref, alt: r.nombre } }).run();
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
      if (!transaction.docChanged || !destinos.current.size) return;
      for (const [k, p] of destinos.current) destinos.current.set(k, transaction.mapping.map(p));
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
      };
    },
  });

  const abrirEnlace = useCallback(() => {
    if (soloLectura || !botonEnlace.current) return;
    setPanel({ tipo: 'enlace', ancla: botonEnlace.current });
  }, [soloLectura]);
  useEffect(() => { abrirEnlaceRef.current = abrirEnlace; }, [abrirEnlace]);

  const cerrarPanel = useCallback(() => setPanel(null), []);
  // `null` mientras el editor no existe (el primer render, que también es el del server): un clic
  // en la barra en ese instante no hace nada, en vez de tirar la pantalla.
  const cadena = () => (editor && !editor.isDestroyed ? editor.chain().focus() : null);

  const alElegirArchivos = (lista: FileList | null, input: HTMLInputElement | null) => {
    const files = Array.from(lista ?? []);
    if (input) input.value = '';
    if (files.length) subirArchivos(files, null);
  };

  const puedeAdjuntar = !!subirAdjunto && !soloLectura;
  const enCurso = subidas.length > 0;

  return (
    <div
      className={['mk-editor-rico', arrastre ? 'es-arrastre' : '', className].filter(Boolean).join(' ')}
      style={{ ...({ '--mk-er-min': `${minAlto}px` } as CSSProperties), ...style }}
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
        <div className="mk-er-barra" role="toolbar" aria-label="Formato">
          <Boton titulo={`Deshacer (${mod}+Z)`} disabled={!estado?.deshacer} onClick={() => cadena()?.undo().run()}>{I.deshacer}</Boton>
          <Boton titulo={`Rehacer (${mod}+Shift+Z)`} disabled={!estado?.rehacer} onClick={() => cadena()?.redo().run()}>{I.rehacer}</Boton>
          <span className="mk-er-sep" aria-hidden="true" />
          <Dropdown
            value={estado?.bloque ?? 'p'}
            options={BLOQUES}
            onChange={(v) => {
              if (!editor) return;
              if (v === 'h2') cadena()?.setHeading({ level: 2 }).run();
              else if (v === 'h3') cadena()?.setHeading({ level: 3 }).run();
              else cadena()?.setParagraph().run();
            }}
            width={118}
            ariaLabel="Estilo del texto"
            search={false}
            disabled={!editor}
            buttonStyle={{ height: 30, minHeight: 30, padding: '0 8px', fontSize: 13, borderRadius: 8, border: '1px solid transparent', background: 'transparent' }}
          />
          <span className="mk-er-sep" aria-hidden="true" />
          <Boton titulo={`Negrita (${mod}+B)`} activo={estado?.negrita} onClick={() => cadena()?.toggleBold().run()}><b style={{ fontWeight: 800 }}>B</b></Boton>
          <Boton titulo={`Cursiva (${mod}+I)`} activo={estado?.cursiva} onClick={() => cadena()?.toggleItalic().run()}><i style={{ fontFamily: 'Georgia, serif', fontSize: 15 }}>I</i></Boton>
          <Boton titulo={`Subrayado (${mod}+U)`} activo={estado?.subrayado} onClick={() => cadena()?.toggleUnderline().run()}><span style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>U</span></Boton>
          <Boton titulo={`Tachado (${mod}+Shift+S)`} activo={estado?.tachado} onClick={() => cadena()?.toggleStrike().run()}><span style={{ textDecoration: 'line-through' }}>S</span></Boton>
          <Boton
            titulo="Color del texto"
            activo={!!estado?.color}
            onClick={(el) => setPanel((p) => (p?.tipo === 'color' ? null : { tipo: 'color', ancla: el }))}
          >
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontWeight: 700 }}>
              A<span className="mk-er-raya" style={{ background: estado?.color ?? 'var(--ink, #12151B)' }} />
            </span>
          </Boton>
          <Boton
            titulo="Resaltar"
            activo={!!estado?.resaltado}
            onClick={(el) => setPanel((p) => (p?.tipo === 'resaltado' ? null : { tipo: 'resaltado', ancla: el }))}
          >
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              {I.resaltar}<span className="mk-er-raya" style={{ background: estado?.resaltado ?? 'transparent', marginTop: 1 }} />
            </span>
          </Boton>
          <span className="mk-er-sep" aria-hidden="true" />
          <Boton titulo={`Lista (${mod}+Shift+8)`} activo={estado?.lista} onClick={() => cadena()?.toggleBulletList().run()}>{I.lista}</Boton>
          <Boton titulo={`Lista numerada (${mod}+Shift+7)`} activo={estado?.numerada} onClick={() => cadena()?.toggleOrderedList().run()}>{I.numerada}</Boton>
          <Boton titulo={`Lista de tareas (${mod}+Shift+9)`} activo={estado?.tareas} onClick={() => cadena()?.toggleTaskList().run()}>{I.tareas}</Boton>
          <Boton titulo={`Cita (${mod}+Shift+B)`} activo={estado?.cita} onClick={() => cadena()?.toggleBlockquote().run()}>{I.cita}</Boton>
          <Boton titulo="Línea" onClick={() => cadena()?.setHorizontalRule().run()}>{I.linea}</Boton>
          <span className="mk-er-sep" aria-hidden="true" />
          <Boton
            titulo={`Enlace (${mod}+K)`}
            activo={estado?.enlace}
            refBoton={botonEnlace}
            onClick={(el) => setPanel((p) => (p?.tipo === 'enlace' ? null : { tipo: 'enlace', ancla: el }))}
          >
            {I.enlace}
          </Boton>
          <span className="mk-er-sep" aria-hidden="true" />
          <Boton titulo={`Alinear a la izquierda (${mod}+Shift+L)`} activo={estado?.alinea === 'left'} onClick={() => cadena()?.setTextAlign('left').run()}>{I.izquierda}</Boton>
          <Boton titulo={`Centrar (${mod}+Shift+E)`} activo={estado?.alinea === 'center'} onClick={() => cadena()?.setTextAlign('center').run()}>{I.centro}</Boton>
          <Boton titulo={`Alinear a la derecha (${mod}+Shift+R)`} activo={estado?.alinea === 'right'} onClick={() => cadena()?.setTextAlign('right').run()}>{I.derecha}</Boton>
          <Boton titulo={`Justificar (${mod}+Shift+J)`} activo={estado?.alinea === 'justify'} onClick={() => cadena()?.setTextAlign('justify').run()}>{I.justificar}</Boton>
          {puedeAdjuntar && (
            <>
              <span className="mk-er-sep" aria-hidden="true" />
              <Boton titulo="Imagen" onClick={() => inputImagen.current?.click()}>{I.imagen}</Boton>
              <Boton titulo="Adjuntar archivo" onClick={() => inputArchivo.current?.click()}>{I.clip}</Boton>
              <input ref={inputImagen} type="file" accept={aceptaImagenes} multiple hidden onChange={(e) => alElegirArchivos(e.target.files, e.target)} />
              <input ref={inputArchivo} type="file" accept={aceptaArchivos} multiple hidden onChange={(e) => alElegirArchivos(e.target.files, e.target)} />
            </>
          )}
        </div>
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
    </div>
  );
}

export default EditorRico;

// ── Piezas de la barra ───────────────────────────────────────────────────────

function Boton({ titulo, activo, disabled, onClick, children, refBoton }: {
  titulo: string;
  activo?: boolean;
  disabled?: boolean;
  onClick: (el: HTMLButtonElement) => void;
  children: ReactNode;
  refBoton?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={refBoton}
      type="button"
      className="mk-er-btn"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo === undefined ? undefined : !!activo}
      disabled={disabled}
      // Sin esto, el clic le saca el foco al texto y la selección se pierde antes de aplicar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onClick(e.currentTarget)}
    >
      {children}
    </button>
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
      <div className="mk-er-fila">
        <button type="submit" className="mk-er-accion es-primaria">Aplicar</button>
        {onQuitar && <button type="button" className="mk-er-accion" onClick={onQuitar}>Quitar</button>}
        {abrible && <a className="mk-er-accion" href={actual} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Abrir</a>}
      </div>
    </form>
  );
}
