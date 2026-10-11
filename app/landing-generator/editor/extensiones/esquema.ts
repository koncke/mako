// =============================================================================
// extensiones/esquema — la lista de extensiones del documento, sin React
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1).
//
// `extensionesBase(op)` arma TODO el documento (nodos, marcas, plugins, placeholder) con los
// NodeViews que le pasen. index.ts le pasa los de React; el test le pasa ninguno y arma el
// esquema en node con `getSchema` (sin DOM: ningún `addNodeView` corre hasta que hay vista).
//
// De StarterKit se apaga lo que no es de doc.ts (`code`, `codeBlock`: no se guardan, el
// server los tiraría), el `document` (el nuestro sólo admite secciones) y el `trailingNode`
// (agregaría un párrafo suelto al final del documento, que sólo admite secciones: con eso
// cada carga abría un documento inválido).
// =============================================================================

import type { Extensions, NodeViewRenderer } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { NODO } from '@/lib/editor-landing/doc';
import { hrefPermitido } from '@/lib/editor-landing/especificacion';
import {
  Documento, Tarjeta, Columnas, Columna, Optimizado, OptimizadoItem, Botones, Boton, Recuadro,
  Desplegable, DesplegableTitulo, DesplegableCuerpo, Imagen, Video, Insertado, Formulario, Grafico,
  Espaciador, HtmlLibre, TablaLanding,
} from './nodos';
import { TextStyleLanding, ColorLanding, TamTexto, ResaltadoLanding, Etiqueta, VariantesTexto } from './marcas';
import { AtajosLanding, IdsUnicos, PartirConGuiones, PortapapelesFiel, Subidas, OpcionesDelDocumento, type OpcionesLanding } from './plugins';

/** El texto de la línea vacía donde está el cursor (Gamma: «Type / for blocks»). */
export const PLACEHOLDER_GENERAL = 'Escribe algo o escribe «/» para ver los comandos';
/** El título vacío de una sección. */
export const PLACEHOLDER_TITULO = 'Título de la sección';

/** Los NodeViews que se enchufan, por nombre de nodo. */
export type VistasNodos = Partial<Record<string, NodeViewRenderer>>;

export type OpcionesBase = Partial<OpcionesLanding> & {
  /** Reemplaza el texto de la línea vacía. */
  placeholder?: string;
  vistas?: VistasNodos;
};

/**
 * El placeholder de cada nodo vacío. Los títulos se ven SIEMPRE (dicen qué va ahí aunque el
 * cursor esté en otro lado, como en Gamma); la línea de texto, sólo donde está el cursor (si
 * no, una sección con tres párrafos vacíos repetía la ayuda tres veces).
 */
function placeholderDe(general: string) {
  return ({ node, hasAnchor }: { node: import('@tiptap/pm/model').Node; hasAnchor: boolean }): string => {
    const tipo = node.type.name;
    if (tipo === 'heading') {
      if (node.attrs.variante === 'titulo' || node.attrs.level === 1) return PLACEHOLDER_TITULO;
      return `Encabezado ${node.attrs.level}`;
    }
    if (tipo === NODO.desplegableTitulo) return 'Pregunta o título';
    if (tipo === NODO.boton) return 'Botón';
    if (tipo === 'paragraph') {
      if (!hasAnchor) return '';
      if (node.attrs.variante === 'antetitulo') return 'Antetítulo';
      return general;
    }
    return '';
  };
}

export function extensionesBase(op: OpcionesBase = {}): Extensions {
  const v = op.vistas ?? {};
  const vista = (nombre: string) => ({ vista: v[nombre] ?? null });
  return [
    StarterKit.configure({
      document: false,
      code: false,
      codeBlock: false,
      trailingNode: false,
      heading: { levels: [1, 2, 3, 4] },
      undoRedo: { depth: 200 },
      dropcursor: { color: '#2c88f7', width: 2 },
      // El enlace: sólo destinos que el server va a guardar (las mismas reglas que el saneo:
      // http(s), mailto:, tel:, `#t-<id>`, `pagina:<id>`). Sin `target`/`rel` por default: el
      // «Abrir en una pestaña nueva» lo elige la persona, y el `rel` lo escribe render.ts.
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => !!hrefPermitido(url),
        HTMLAttributes: { target: null, rel: null, class: null },
      },
    }),
    Documento,
    Tarjeta.configure(vista(NODO.tarjeta)),
    Columnas.configure(vista(NODO.columnas)),
    Columna,
    Optimizado.configure(vista(NODO.optimizado)),
    OptimizadoItem.configure(vista(NODO.optimizadoItem)),
    Botones.configure(vista(NODO.botones)),
    Boton,
    Recuadro.configure(vista(NODO.recuadro)),
    Desplegable.configure(vista(NODO.desplegable)),
    DesplegableTitulo,
    DesplegableCuerpo,
    Imagen.configure(vista(NODO.imagen)),
    Video.configure(vista(NODO.video)),
    Insertado.configure(vista(NODO.insertado)),
    Formulario.configure(vista(NODO.formulario)),
    Grafico.configure(vista(NODO.grafico)),
    Espaciador.configure(vista(NODO.espaciador)),
    HtmlLibre.configure(vista(NODO.htmlLibre)),
    TablaLanding,
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true, a11y: { checkboxLabel: (_n, marcada) => (marcada ? 'Tarea hecha' : 'Tarea pendiente') } }),
    TextStyleLanding,
    ColorLanding,
    TamTexto,
    ResaltadoLanding,
    Etiqueta,
    VariantesTexto,
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    Placeholder.configure({
      includeChildren: true,
      showOnlyCurrent: false,
      placeholder: placeholderDe(op.placeholder || PLACEHOLDER_GENERAL),
    }),
    IdsUnicos,
    PartirConGuiones,
    AtajosLanding,
    PortapapelesFiel,
    Subidas.configure({ subirArchivo: op.subirArchivo, avisar: op.avisar }),
    OpcionesDelDocumento.configure({ subirArchivo: op.subirArchivo, elegirImagen: op.elegirImagen, avisar: op.avisar }),
  ];
}
