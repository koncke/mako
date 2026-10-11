// =============================================================================
// extensiones/barra — el plugin del menú «/» y los atajos markdown de Gamma
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» En Gamma se escribe «/» en un bloque vacío (o después de
// un espacio) y se abre el menú de comandos con todo lo que se puede insertar; lo
// que se escribe a continuación lo filtra. Diseño: docs/diseno-editor-landing.md (D1).
//
// POR QUÉ UN PLUGIN PROPIO Y NO `@tiptap/suggestion`: no está instalado (D1: «sin
// dependencias de TipTap nuevas») y lo que hace falta entra en un plugin de
// ProseMirror de cien líneas. Este archivo es SÓLO el motor (sin React): el estado
// del menú (dónde está la «/» y qué se escribió después) vive en el estado del
// editor, y `MenuBarra.tsx` lo dibuja leyéndolo con `useEditorState`.
//
// Las decisiones que no se ven en el código:
//   · EL MENÚ SE ABRE SÓLO SI LA «/» SE TECLEÓ, nunca porque el cursor cayó al lado de
//     una que ya estaba. Con «abrir si el cursor está después de una /», hacer clic en
//     «y/o» o en una URL escrita abría el menú sobre el texto de otra persona. Por eso
//     la apertura sale de `handleTextInput` (el evento de TECLEAR) y no de mirar el
//     texto en cada transacción.
//   · UNA VEZ ABIERTO, EL ESTADO SE RECALCULA EN CADA TRANSACCIÓN desde el documento:
//     la posición de la «/» se corre con `tr.mapping` y la consulta es el texto entre
//     la «/» y el cursor. Si la «/» desapareció, el cursor salió del rango o pasó a otro
//     bloque, el menú se cierra solo. No hay un «abierto» guardado que pueda quedar
//     mintiendo.
//   · ESCAPE CIERRA Y NO REABRE: el estado vuelve a null y seguir escribiendo no lo
//     abre (sólo una «/» nueva).
//   · PRIORIDAD 1000: el `handleKeyDown` de este plugin tiene que correr ANTES que los
//     atajos de StarterKit. Con la prioridad de fábrica (100), Enter partía el bloque
//     antes de que el menú pudiera elegir el renglón resaltado.
//   · Las flechas/Enter/Tab las resuelve el componente (sabe qué renglón está
//     resaltado): se registra con `registrarTeclasBarra(view, fn)`. Si nadie montó el
//     menú, el plugin no se traga ninguna tecla salvo Escape.
//
// Atajos markdown de Gamma (gamma-ui §5.5/5.6): «- » viñetas, «1. » numerada,
// «[] » tareas, «> » cita, «# » a «#### » encabezados y «! » el Título grande. StarterKit
// trae los suyos para casi todos; acá van otra vez porque el de tareas de TipTap pide
// «[ ] » (con espacio adentro) y el «! » no existe, y porque así el comportamiento de
// Gamma no depende de cómo se configure StarterKit. Si una regla de acá y una de
// StarterKit hacen lo mismo, gana la primera (ésta, por prioridad) y la otra no corre.
// =============================================================================

import { Extension, textblockTypeInputRule, wrappingInputRule, type Editor, type InputRule } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { BLOQUES, CATEGORIAS_BLOQUE, buscarBloques, type CategoriaBloque, type DefBloque, type IdBloque } from '@/lib/editor-landing/catalogo-bloques';

// ─────────────────────────────────────────────────────────────────────────────
// El estado del menú
// ─────────────────────────────────────────────────────────────────────────────

/** `desde` = la posición de la «/»; `hasta` = el cursor; `consulta` = lo escrito entre las dos. */
export type EstadoBarra = { desde: number; hasta: number; consulta: string } | null;

type MetaBarra = { abrir: number } | { cerrar: true };

export const claveBarra = new PluginKey<EstadoBarra>('barraComandos');

/** El estado del menú «/» en este estado del editor (null = cerrado). */
export function estadoBarra(state: EditorState): EstadoBarra {
  return claveBarra.getState(state) ?? null;
}

/** Los bloques de texto donde «/» abre el menú. En la etiqueta de un botón o en un título de desplegable, no. */
const TEXTOS_CON_BARRA: ReadonlySet<string> = new Set(['paragraph', 'heading']);

/** Lo más largo que se acepta después de la «/» antes de dar por hecho que es texto y no un comando. */
export const TOPE_CONSULTA = 40;

/**
 * ¿Lo escrito después de la «/» todavía puede ser un comando? Vacío, sí. Si empieza con un
 * espacio, trae dos espacios seguidos, otra «/», un salto o pasa el tope, no: es una frase.
 * Un espacio adentro sí vale («como funciona» encuentra Etapas por su sinónimo).
 */
export function consultaValida(q: string): boolean {
  if (q === '') return true;
  if (q.length > TOPE_CONSULTA) return false;
  if (/^\s/.test(q) || /\s\s/.test(q) || /[/\n\ufffc]/.test(q)) return false;
  // Con un espacio ya escrito y nada que mostrar, se está escribiendo una frase: se cierra.
  if (/\s/.test(q) && buscarBloques(q).length === 0) return false;
  return true;
}

/** Recalcula el estado con la «/» en `desde`, o null si el menú ya no tiene sentido. */
function calcular(state: EditorState, desde: number): EstadoBarra {
  const sel = state.selection;
  if (!(sel instanceof TextSelection) || !sel.empty) return null;
  if (desde < 0 || desde + 1 > state.doc.content.size) return null;
  if (state.doc.textBetween(desde, desde + 1, '\n', '\ufffc') !== '/') return null;
  const cabeza = sel.from;
  if (cabeza <= desde) return null;
  const $d = state.doc.resolve(desde);
  // La «/» y el cursor en el MISMO bloque de texto (si el cursor pasó a otro, se cerró).
  if (!$d.parent.isTextblock || $d.start() !== sel.$from.start() || $d.depth !== sel.$from.depth) return null;
  const consulta = state.doc.textBetween(desde + 1, cabeza, '\n', '\ufffc');
  if (!consultaValida(consulta)) return null;
  return { desde, hasta: cabeza, consulta };
}

// ─────────────────────────────────────────────────────────────────────────────
// El teclado: lo registra el componente que dibuja el menú
// ─────────────────────────────────────────────────────────────────────────────

const teclas = new WeakMap<EditorView, (e: KeyboardEvent) => boolean>();

/**
 * El componente del menú registra acá quién contesta las flechas, Enter y Tab mientras el menú
 * está abierto (devuelve true si usó la tecla). `null` lo saca. Un WeakMap por vista: con dos
 * editores en la pantalla (la miniatura en vivo de otra página), cada uno tiene el suyo.
 */
export function registrarTeclasBarra(view: EditorView, fn: ((e: KeyboardEvent) => boolean) | null): void {
  if (fn) teclas.set(view, fn);
  else teclas.delete(view);
}

/** Cierra el menú (Escape, clic afuera, el editor perdió el foco). */
export function cerrarBarra(editor: Editor): void {
  if (editor.isDestroyed || !estadoBarra(editor.state)) return;
  editor.view.dispatch(editor.state.tr.setMeta(claveBarra, { cerrar: true } satisfies MetaBarra));
}

/**
 * Inserta un párrafo nuevo con una «/» en `pos` (una posición ENTRE bloques: la de después de
 * un bloque de primer nivel de la sección) y abre el menú ahí. Es el «+» del asa de bloques:
 * en Gamma y en Notion, el «+» al costado de un bloque abre la misma lista que la barra.
 */
export function insertarBarraEn(editor: Editor, pos: number): boolean {
  if (editor.isDestroyed || !editor.isEditable) return false;
  const { state } = editor;
  const p = state.schema.nodes.paragraph;
  if (!p) return false;
  const nodo = p.create(null, state.schema.text('/'));
  const $pos = state.doc.resolve(Math.max(0, Math.min(pos, state.doc.content.size)));
  if (!$pos.parent.canReplaceWith($pos.index(), $pos.index(), p)) return false;
  const tr = state.tr.insert($pos.pos, nodo);
  // El cursor queda después de la «/» (pos + 1 entra al párrafo, + 1 pasa la barra).
  tr.setSelection(TextSelection.create(tr.doc, $pos.pos + 2));
  tr.setMeta(claveBarra, { abrir: $pos.pos + 1 } satisfies MetaBarra);
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que muestra el menú (puro: lo usa el componente y lo prueba el test)
// ─────────────────────────────────────────────────────────────────────────────

export type GrupoBarra = { categoria: CategoriaBloque; bloques: DefBloque[] };

/** Los bloques que encuentra `consulta`, agrupados por categoría en el orden de Gamma. */
export function gruposDeBarra(consulta: string): GrupoBarra[] {
  const hallados = buscarBloques(consulta);
  const grupos: GrupoBarra[] = [];
  for (const categoria of CATEGORIAS_BLOQUE) {
    const bloques = hallados.filter((b) => b.categoria === categoria);
    if (bloques.length) grupos.push({ categoria, bloques });
  }
  return grupos;
}

/**
 * El atajo markdown que Gamma muestra a la derecha de cada renglón del «/» (gamma-ui §5.6:
 * «# Heading 1», «- Item», «> Quote»…). Sólo los que este editor de verdad convierte al
 * escribirlos (las reglas de abajo y el «---» del separador de StarterKit).
 */
export const ATAJO_MARKDOWN: Partial<Record<IdBloque, string>> = {
  titulo: '!',
  h1: '#',
  h2: '##',
  h3: '###',
  h4: '####',
  vinetas: '-',
  numerada: '1.',
  tareas: '[]',
  cita: '>',
  separador: '---',
};

/** Todos los ids del catálogo (para el test: el menú no puede esconder ninguno con la consulta vacía). */
export const IDS_BARRA: readonly IdBloque[] = BLOQUES.map((b) => b.id);

// ─────────────────────────────────────────────────────────────────────────────
// La extensión
// ─────────────────────────────────────────────────────────────────────────────

export const ExtensionBarra = Extension.create({
  name: 'barraComandos',
  priority: 1000,

  addInputRules() {
    const nodos = this.editor.schema.nodes;
    const reglas: InputRule[] = [];
    // «! » = el «Título» grande de Gamma (h1 con variante 'titulo').
    if (nodos.heading) {
      reglas.push(textblockTypeInputRule({ find: /^!\s$/, type: nodos.heading, getAttributes: { level: 1, variante: 'titulo' } }));
      reglas.push(textblockTypeInputRule({ find: /^(#{1,4})\s$/, type: nodos.heading, getAttributes: (m) => ({ level: m[1].length, variante: null }) }));
    }
    // «[] » = lista de tareas (la de TipTap sólo entiende «[ ] »). Se envuelve en el ÍTEM: ProseMirror
    // encuentra solo la lista que lo contiene.
    if (nodos.taskItem && nodos.taskList) {
      reglas.push(wrappingInputRule({ find: /^\s*\[\]\s$/, type: nodos.taskItem, getAttributes: { checked: false } }));
    }
    if (nodos.bulletList) reglas.push(wrappingInputRule({ find: /^\s*[-+*]\s$/, type: nodos.bulletList }));
    if (nodos.orderedList) {
      reglas.push(wrappingInputRule({
        find: /^(\d+)\.\s$/,
        type: nodos.orderedList,
        getAttributes: (m) => ({ start: Number(m[1]) || 1 }),
        joinPredicate: (m, n) => n.childCount + (n.attrs.start as number) === Number(m[1]),
      }));
    }
    if (nodos.blockquote) reglas.push(wrappingInputRule({ find: /^\s*>\s$/, type: nodos.blockquote }));
    return reglas;
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<EstadoBarra>({
        key: claveBarra,
        state: {
          init: () => null,
          apply(tr, previo, _viejo, nuevo) {
            const meta = tr.getMeta(claveBarra) as MetaBarra | undefined;
            if (meta && 'cerrar' in meta) return null;
            if (meta && 'abrir' in meta) return calcular(nuevo, meta.abrir);
            if (!previo) return null;
            if (!tr.docChanged && !tr.selectionSet) return previo;
            // assoc 1: si se escribió JUSTO antes de la «/», la «/» se corre con lo escrito.
            const r = tr.mapping.mapResult(previo.desde, 1);
            if (r.deleted) return null;
            return calcular(nuevo, r.pos);
          },
        },
        props: {
          handleTextInput(view, from, to, text, deflt) {
            if (text !== '/') return false;
            const $f = view.state.doc.resolve(from);
            const padre = $f.parent;
            if (!padre.isTextblock || !TEXTOS_CON_BARRA.has(padre.type.name) || padre.type.spec.code) return false;
            // «al principio de un bloque vacío o después de un espacio» (Gamma).
            const off = $f.parentOffset;
            const vacio = padre.content.size === 0 || (from === $f.start() && to === $f.end());
            const antes = off > 0 ? padre.textBetween(off - 1, off, '\n', '\ufffc') : '';
            if (!vacio && !(antes && /\s/.test(antes))) return false;
            const tr = deflt();
            tr.setMeta(claveBarra, { abrir: from } satisfies MetaBarra);
            view.dispatch(tr);
            return true;
          },
          handleKeyDown(view, event) {
            if (!estadoBarra(view.state)) return false;
            if (event.key === 'Escape') {
              view.dispatch(view.state.tr.setMeta(claveBarra, { cerrar: true } satisfies MetaBarra));
              return true;
            }
            const fn = teclas.get(view);
            return fn ? fn(event) : false;
          },
        },
      }),
    ];
  },
});

export default ExtensionBarra;
