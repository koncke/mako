// =============================================================================
// Las acciones sobre un bloque del Copywriter: lo que hacen el menú «/» y el del asa ⋮⋮ (sin React)
// =============================================================================
// Una sola copia de «convertir en», «duplicar» y «eliminar» para los dos menús (AGENTS.md, «Una cosa, un lugar»). Todo
// pasa por comandos de TipTap sobre el editor vivo: el deshacer (Ctrl+Z) los toma solo.
// =============================================================================

import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { NODOS, nombreDeSeccion, bidNuevo, EMOJI_DESTACADO } from '@/lib/copywriter/doc';
import type { JsonNodo } from '@/lib/copywriter/tipos';
import type { IdBloqueCopy } from './bloques';

/** El bloque de primer nivel donde está el cursor: su posición y su nodo. */
export function bloqueDelCursor(editor: Editor): { pos: number; tam: number; tipo: string } | null {
  const { $from } = editor.state.selection;
  if ($from.depth < 1) return null;
  const pos = $from.before(1);
  const n = editor.state.doc.nodeAt(pos);
  return n ? { pos, tam: n.nodeSize, tipo: n.type.name } : null;
}

/** Lo que se inserta como bloque nuevo (los que no son «convertir el renglón»). */
function nodoNuevo(id: IdBloqueCopy): JsonNodo | null {
  switch (id) {
    case 'destacado': return { type: NODOS.destacado, attrs: { emoji: EMOJI_DESTACADO, bid: bidNuevo() }, content: [{ type: NODOS.parrafo }] };
    case 'desplegable': return { type: NODOS.desplegable, attrs: { abierto: true, bid: bidNuevo() }, content: [{ type: NODOS.parrafo }] };
    case 'separador': return { type: NODOS.separador, attrs: { bid: bidNuevo() } };
    default: return null;
  }
}

/**
 * Aplica un bloque del catálogo en el renglón del cursor (el del «/», ya sin la «/consulta»): convierte el renglón
 * (Texto, Encabezados, listas, cita, sección) o, si es un bloque contenedor (Destacado, Desplegable, Divisor), lo pone
 * en el lugar del renglón si está vacío o debajo si no. `alMako` lo resuelve la pantalla (llevar el foco al chat).
 */
export function aplicarBloque(editor: Editor, id: IdBloqueCopy, alMako?: () => void): void {
  if (id === 'mako') { alMako?.(); return; }
  const c = editor.chain().focus();
  if (id.startsWith('seccion:')) {
    const etiqueta = id.slice('seccion:'.length);
    const b = bloqueDelCursor(editor);
    const vacio = b ? !editor.state.doc.nodeAt(b.pos)?.textContent.trim() : true;
    c.setNode(NODOS.titulo, { level: 2, seccion: etiqueta }).run();
    if (vacio) editor.chain().insertContent(nombreDeSeccion(etiqueta)).run();
    return;
  }
  switch (id) {
    case 'texto': c.setParagraph().run(); return;
    case 'h1': c.setNode(NODOS.titulo, { level: 1, seccion: null }).run(); return;
    case 'h2': c.setNode(NODOS.titulo, { level: 2, seccion: null }).run(); return;
    case 'h3': c.setNode(NODOS.titulo, { level: 3, seccion: null }).run(); return;
    case 'vinetas': c.toggleBulletList().run(); return;
    case 'numerada': c.toggleOrderedList().run(); return;
    case 'tareas': c.toggleTaskList().run(); return;
    case 'cita': c.toggleBlockquote().run(); return;
    case 'tabla': c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); return;
    default: break;
  }
  const nodo = nodoNuevo(id);
  const b = bloqueDelCursor(editor);
  if (!nodo || !b) return;
  const n = editor.state.doc.nodeAt(b.pos);
  const vacio = !!n && n.type.name === NODOS.parrafo && n.content.size === 0;
  const en = vacio ? { from: b.pos, to: b.pos + b.tam } : b.pos + b.tam;
  editor.chain().focus().insertContentAt(en, nodo).run();
  // El cursor, adentro del bloque nuevo (el primer renglón de un Destacado o de un Desplegable).
  const destino = (vacio ? b.pos : b.pos + b.tam) + 2;
  if (id !== 'separador' && destino <= editor.state.doc.content.size) {
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(destino))));
  }
}

/** Las conversiones que ofrece el asa (Notion: «Convertir en»). */
export const CONVERTIR_EN: readonly { id: IdBloqueCopy; nombre: string }[] = [
  { id: 'texto', nombre: 'Texto' },
  { id: 'h1', nombre: 'Encabezado 1' },
  { id: 'h2', nombre: 'Encabezado 2' },
  { id: 'h3', nombre: 'Encabezado 3' },
  { id: 'vinetas', nombre: 'Lista con viñetas' },
  { id: 'numerada', nombre: 'Lista numerada' },
  { id: 'tareas', nombre: 'Lista de tareas' },
  { id: 'cita', nombre: 'Cita' },
];

/** Los bloques que se pueden convertir (los de texto y las listas). */
export const CONVERTIBLES: ReadonlySet<string> = new Set([NODOS.parrafo, NODOS.titulo, NODOS.vinetas, NODOS.numerada, NODOS.tareas, NODOS.cita]);

/** Convierte el bloque de `pos` (pone el cursor adentro y aplica). */
export function convertirBloque(editor: Editor, pos: number, id: IdBloqueCopy): void {
  const n = editor.state.doc.nodeAt(pos);
  if (!n) return;
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos + 1))));
  aplicarBloque(editor, id);
}

/** Duplica el bloque de `pos` debajo (con un id nuevo: el plugin lo repone igual, esto lo deja limpio). */
export function duplicarBloque(editor: Editor, pos: number): void {
  const n = editor.state.doc.nodeAt(pos);
  if (!n) return;
  const copia = n.type.create({ ...n.attrs, bid: bidNuevo() }, n.content, n.marks);
  editor.view.dispatch(editor.state.tr.insert(pos + n.nodeSize, copia).scrollIntoView());
  editor.view.focus();
}

/** Elimina el bloque de `pos` (Ctrl+Z lo devuelve). Si era el único, queda un renglón vacío. */
export function eliminarBloque(editor: Editor, pos: number): void {
  const n = editor.state.doc.nodeAt(pos);
  if (!n) return;
  const tr = editor.state.tr.delete(pos, pos + n.nodeSize);
  if (tr.doc.childCount === 0) tr.insert(0, editor.schema.nodes[NODOS.parrafo].create({ bid: bidNuevo() }));
  editor.view.dispatch(tr);
  editor.view.focus();
}
