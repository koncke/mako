// =============================================================================
// Las extensiones del editor del Copywriter: los bloques de Notion sobre TipTap 3 (sin dependencias nuevas)
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D3). El esquema es el que sanea lib/copywriter/doc.ts: si uno cambia, el otro
// también (un nodo que el editor conoce y el saneo no, se guarda como párrafo; uno que el saneo deja y el editor no
// conoce, TipTap lo descarta SIN error al abrir — el hallazgo del paquete A del Web Generator).
//
// Lo propio de este editor, que no trae TipTap:
//   · `Destacado` (el «Texto destacado» de Notion, `callout`): un recuadro gris con un emoji que se cambia tocándolo.
//   · `Desplegable` (la «Lista desplegable», `toggle`): el primer renglón siempre a la vista y el resto se pliega con
//     el triángulo. Plegar es un cambio del documento (Notion recuerda cómo lo dejaste).
//   · `IdsDeBloque`: el `bid` de cada bloque de primer nivel (lib/copywriter/doc.ts lo explica) y la `seccion` de un
//     título. No se copian al partir un bloque con Enter (`keepOnSplit: false`), y un plugin repone el que falte o se
//     repita (pegar copia los attrs) sin entrar al deshacer.
//   · Los atajos de Notion: «> » es un DESPLEGABLE y «" » una cita (en Gamma «> » era cita: por eso el «/» del Web
//     Generator va con `atajos: false`), «[] » una lista de tareas. «# », «- », «1. » y «---» los trae StarterKit.
// =============================================================================

import { Extension, Node, mergeAttributes, wrappingInputRule, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as NodoPM } from '@tiptap/pm/model';
import { ExtensionBarra } from '@/app/web-generator/editor/extensiones/barra';
import { BLOQUES_DE_PRIMER_NIVEL, EMOJI_DESTACADO, NODOS, bidNuevo } from '@/lib/copywriter/doc';
import { buscarBloquesCopy } from './bloques';
import { MarcasDePropuesta } from './propuesta';

/** Los emojis que recorre el del Destacado al tocarlo (Notion abre su selector; acá, los de un guion). */
export const EMOJIS_DESTACADO = [EMOJI_DESTACADO, '⚠️', '✅', '📌', '🔥', '🎯', '💬', '❗'] as const;

export const Destacado = Node.create({
  name: NODOS.destacado,
  group: 'block',
  content: 'paragraph+',
  defining: true,
  addAttributes() {
    return {
      emoji: {
        default: EMOJI_DESTACADO,
        parseHTML: (el) => el.getAttribute('data-emoji') || EMOJI_DESTACADO,
        renderHTML: (a) => ({ 'data-emoji': a.emoji }),
      },
    };
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'nt-destacado' }), 0]; },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'nt-destacado';
      dom.setAttribute('data-callout', '');
      const emoji = document.createElement('button');
      emoji.type = 'button';
      emoji.className = 'nt-destacado-emoji';
      emoji.contentEditable = 'false';
      emoji.textContent = String(node.attrs.emoji);
      emoji.title = 'Cambiar el ícono';
      emoji.addEventListener('mousedown', (e) => e.preventDefault());
      emoji.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos == null || !editor.isEditable) return;
        const actual = editor.state.doc.nodeAt(pos);
        if (!actual) return;
        const i = EMOJIS_DESTACADO.indexOf(actual.attrs.emoji as (typeof EMOJIS_DESTACADO)[number]);
        const siguiente = EMOJIS_DESTACADO[(i + 1) % EMOJIS_DESTACADO.length];
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...actual.attrs, emoji: siguiente }));
      });
      const cuerpo = document.createElement('div');
      cuerpo.className = 'nt-destacado-cuerpo';
      dom.append(emoji, cuerpo);
      return {
        dom,
        contentDOM: cuerpo,
        update: (n: NodoPM) => {
          if (n.type.name !== NODOS.destacado) return false;
          emoji.textContent = String(n.attrs.emoji);
          return true;
        },
        ignoreMutation: (m) => m.target === emoji || emoji.contains(m.target as globalThis.Node),
      };
    };
  },
});

export const Desplegable = Node.create({
  name: NODOS.desplegable,
  group: 'block',
  content: 'paragraph block*',
  defining: true,
  addAttributes() {
    return {
      abierto: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-abierto') !== 'false',
        renderHTML: (a) => ({ 'data-abierto': a.abierto ? 'true' : 'false' }),
      },
    };
  },
  parseHTML() { return [{ tag: 'div[data-toggle]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle': '', class: 'nt-desplegable' }), 0]; },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'nt-desplegable';
      dom.setAttribute('data-abierto', node.attrs.abierto ? 'true' : 'false');
      const flecha = document.createElement('button');
      flecha.type = 'button';
      flecha.className = 'nt-desplegable-flecha';
      flecha.contentEditable = 'false';
      flecha.setAttribute('aria-label', node.attrs.abierto ? 'Plegar' : 'Desplegar');
      flecha.textContent = '▸';
      flecha.addEventListener('mousedown', (e) => e.preventDefault());
      flecha.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos == null) return;
        const actual = editor.state.doc.nodeAt(pos);
        if (!actual) return;
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...actual.attrs, abierto: !actual.attrs.abierto }));
      });
      const cuerpo = document.createElement('div');
      cuerpo.className = 'nt-desplegable-cuerpo';
      dom.append(flecha, cuerpo);
      return {
        dom,
        contentDOM: cuerpo,
        update: (n: NodoPM) => {
          if (n.type.name !== NODOS.desplegable) return false;
          dom.setAttribute('data-abierto', n.attrs.abierto ? 'true' : 'false');
          flecha.setAttribute('aria-label', n.attrs.abierto ? 'Plegar' : 'Desplegar');
          return true;
        },
        ignoreMutation: (m) => m.target === flecha || flecha.contains(m.target as globalThis.Node) || (m.type === 'attributes' && m.target === dom),
      };
    };
  },
});

/**
 * Los atajos de Notion que StarterKit no trae o trae distinto: «> » lista desplegable, «" » cita, «[] » lista de tareas.
 * PRIORIDAD 101: las reglas se prueban en el orden de las extensiones y gana la primera que encaja; con ésta adelante de
 * StarterKit (100), «> » arma el desplegable y no la cita de StarterKit. Es una extensión y no un nodo a propósito: la
 * prioridad de un NODO cambia el orden del esquema (y el primero del grupo es el que se usa para rellenar).
 */
const AtajosNotion = Extension.create({
  name: 'atajosNotion',
  priority: 101,
  addInputRules() {
    const { taskItem, blockquote, toggle } = this.editor.schema.nodes;
    return [
      ...(toggle ? [wrappingInputRule({ find: /^\s*>\s$/, type: toggle })] : []),
      ...(blockquote ? [wrappingInputRule({ find: /^\s*"\s$/, type: blockquote })] : []),
      ...(taskItem ? [wrappingInputRule({ find: /^\s*\[\]\s$/, type: taskItem, getAttributes: { checked: false } })] : []),
    ];
  },
});

const claveIds = new PluginKey('idsDeBloque');

/** El `bid` de cada bloque de primer nivel y la `seccion` de un título (ver la cabecera). */
export const IdsDeBloque = Extension.create({
  name: 'idsDeBloque',
  addGlobalAttributes() {
    return [
      {
        types: [...BLOQUES_DE_PRIMER_NIVEL],
        attributes: {
          bid: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-bid'),
            renderHTML: (a) => (a.bid ? { 'data-bid': a.bid } : {}),
          },
        },
      },
      {
        types: [NODOS.titulo],
        attributes: {
          seccion: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-seccion'),
            renderHTML: (a) => (a.seccion ? { 'data-seccion': a.seccion } : {}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: claveIds,
        appendTransaction(trs, _viejo, state) {
          if (!trs.some((t) => t.docChanged)) return null;
          const vistos = new Set<string>();
          let tr: ReturnType<typeof state.tr.setNodeMarkup> | null = null;
          state.doc.forEach((n, pos) => {
            if (!BLOQUES_DE_PRIMER_NIVEL.has(n.type.name)) return;
            const bid = typeof n.attrs.bid === 'string' ? n.attrs.bid : '';
            if (bid && !vistos.has(bid)) { vistos.add(bid); return; }
            const nuevo = bidNuevo();
            vistos.add(nuevo);
            tr = (tr ?? state.tr).setNodeMarkup(pos, undefined, { ...n.attrs, bid: nuevo });
          });
          return tr ? (tr as ReturnType<typeof state.tr.setNodeMarkup>).setMeta('addToHistory', false) : null;
        },
      }),
    ];
  },
});

/** El texto gris de la línea vacía (Notion: «Escribe '/' para ver los comandos…»). Los títulos dicen qué son siempre. */
export const PLACEHOLDER_LINEA = 'Escribe «/» para ver los comandos…';

function placeholderDe({ node, hasAnchor }: { node: NodoPM; hasAnchor: boolean }): string {
  if (node.type.name === NODOS.titulo) return `Encabezado ${node.attrs.level}`;
  if (node.type.name === NODOS.parrafo) return hasAnchor ? PLACEHOLDER_LINEA : '';
  return '';
}

/** Todas las extensiones del documento de un guion. */
export function extensionesCopy(): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false,
      trailingNode: false,
      heading: { levels: [1, 2, 3] },
      undoRedo: { depth: 200 },
      dropcursor: { color: 'rgba(35,131,226,.6)', width: 3 },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => /^(https?:\/\/|mailto:)/i.test(url),
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow', class: null },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true, a11y: { checkboxLabel: (_n, marcada) => (marcada ? 'Tarea hecha' : 'Tarea pendiente') } }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Destacado,
    Desplegable,
    IdsDeBloque,
    AtajosNotion,
    Placeholder.configure({ includeChildren: true, showOnlyCurrent: false, placeholder: placeholderDe }),
    ExtensionBarra.configure({ buscar: (q) => buscarBloquesCopy(q), atajos: false }),
    // Lo que escribió MaKo y todavía no se aceptó, marcado (./propuesta.ts).
    MarcasDePropuesta,
  ];
}
