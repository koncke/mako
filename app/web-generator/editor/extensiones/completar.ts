// =============================================================================
// extensiones/completar — los textos A COMPLETAR («[Tu especialidad]») resaltados en el editor
// =============================================================================
// Pedido de Martín (14/10/2026): «También quiero que los [] que el usuario debe completar, se
// queden como de otro color o algo diferencial, y que eso se vea también en la miniatura, así se
// entiende mejor.» La regla (qué es un texto a completar) vive en especificacion.ts
// (`rangosACompletar`): la misma que marca la miniatura en render.ts.
//
// Es una DECORACIÓN de ProseMirror y nada más: no cambia el documento, ni el JSON que se guarda,
// ni `getHTML()`, ni lo que se copia. La hoja (css.ts) la dibuja bajo `.gm-doc[data-modo="editor"]`.
//
// Los rangos se buscan en el texto CORRIDO de cada bloque de texto, no en cada nodo de texto:
// «[tu **cliente** ideal]» son tres textos (la negrita los parte) y se marca igual; ProseMirror parte
// la decoración en un span por texto, adentro de cada marca. Un salto de línea (hardBreak) o
// cualquier nodo en línea cuenta como `\n` y corta el corchete, como en la regla.
//
// Al escribir NO se recorre todo el documento: las decoraciones se corren con la transacción y se
// rearman sólo los bloques que tocó (`actualizarACompletar`). Un cambio de marcas (poner una negrita)
// no corre posiciones ni cambia el texto, así que no toca nada. Cambiar de página con
// `view.updateState(EditorState.create(…))` (EditorLanding.tsx) pasa por `init`: el cálculo entero.
// =============================================================================

import { Extension } from '@tiptap/core';
import type { Node as NodoPM } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { CLASE_A_COMPLETAR, hijosACompletar, rangosACompletar } from '@/lib/editor-landing/especificacion';
import { HtmlCrudo, type AttrsArbol, type HijoArbol, type NodoArbol } from '@/lib/editor-landing/grafico-svg';

export const CLAVE_A_COMPLETAR = new PluginKey<DecorationSet>('aCompletarLanding');

/** Las decoraciones de UN bloque de texto que empieza en `pos` (su contenido, en `pos + 1`). */
function decoracionesDeBloque(bloque: NodoPM, pos: number): Decoration[] {
  let texto = '';
  // Cada hijo aporta tantos caracteres como posiciones ocupa: así un índice del texto es una posición.
  bloque.forEach((hijo) => { texto += hijo.isText ? hijo.text ?? '' : '\n'.repeat(hijo.nodeSize); });
  return rangosACompletar(texto).map(([d, h]) => Decoration.inline(pos + 1 + d, pos + 1 + h, { class: CLASE_A_COMPLETAR }));
}

/** Todas las decoraciones del documento. Pura: la prueba el test. */
export function decoracionesACompletar(doc: NodoPM): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((n, pos) => {
    if (!n.isTextblock) return true;
    decos.push(...decoracionesDeBloque(n, pos));
    return false;
  });
  return decos.length ? DecorationSet.create(doc, decos) : DecorationSet.empty;
}

/**
 * Las decoraciones de antes, corridas por la transacción, con los bloques de texto que tocó
 * rearmados desde su texto nuevo. Pura: el test la compara con `decoracionesACompletar` del
 * documento final, edición por edición.
 */
export function actualizarACompletar(set: DecorationSet, tr: Transaction): DecorationSet {
  if (!tr.docChanged) return set;
  const doc = tr.doc;
  let nuevo = set.map(tr.mapping, doc);
  // Lo que cambió cada paso, llevado al documento final por los pasos que vinieron después.
  const tocados: Array<[number, number]> = [];
  tr.mapping.maps.forEach((paso, i) => {
    const despues = tr.mapping.slice(i + 1);
    paso.forEach((_dViejo, _hViejo, desde, hasta) => { tocados.push([despues.map(desde, -1), despues.map(hasta, 1)]); });
  });
  const vistos = new Set<number>();
  const quitar: Decoration[] = [];
  const poner: Decoration[] = [];
  for (const [d, h] of tocados) {
    // Sin ensanchar el rango: un borrado deja un rango VACÍO, pero cae adentro del bloque que quedó
    // (unir dos párrafos lo deja donde terminaba el de arriba) y `nodesBetween` lo visita igual.
    // Medido el 14/10/2026 con un fuzz de ~21.700 ediciones al azar (escribir, borrar, partir, unir,
    // negrita, reemplazar, saltos): con y sin una posición de más a cada lado, 0 diferencias contra el
    // cálculo entero; sin el `remove` de abajo, falla en la primera edición de cada corrida.
    doc.nodesBetween(Math.min(d, h), Math.max(d, h), (n, pos) => {
      if (!n.isTextblock) return true;
      if (!vistos.has(pos)) {
        vistos.add(pos);
        quitar.push(...nuevo.find(pos, pos + n.nodeSize));
        poner.push(...decoracionesDeBloque(n, pos));
      }
      return false;
    });
  }
  if (quitar.length) nuevo = nuevo.remove(quitar);
  if (poner.length) nuevo = nuevo.add(doc, poner);
  return nuevo;
}

/** El plugin (exportado para el test, que lo arma sobre un EditorState sin montar una vista). */
export function pluginACompletar(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: CLAVE_A_COMPLETAR,
    state: {
      init: (_config, state) => decoracionesACompletar(state.doc),
      apply: (tr, set) => actualizarACompletar(set, tr),
    },
    props: {
      decorations: (state) => CLAVE_A_COMPLETAR.getState(state) ?? DecorationSet.empty,
    },
  });
}

/** La extensión que enchufa esquema.ts en el documento de la landing. */
export const ResaltarACompletar = Extension.create({
  name: 'aCompletarLanding',
  addProseMirrorPlugins() {
    return [pluginACompletar()];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Lo que un NodeView dibuja desde sus ATRIBUTOS (tanda 6)
// ─────────────────────────────────────────────────────────────────────────────
// La decoración marca el TEXTO del documento; lo que un NodeView dibuja desde un atributo (las etiquetas,
// las opciones y el botón del formulario) no pasa por ella. El formulario (nodos/FormularioVista.tsx) marca
// su árbol con esto, SÓLO en la vista del editor: `renderHTML`, `getHTML()` y la publicada salen sin marcar
// (el Pixel arma cada respuesta con `labels[0].textContent`; la publicada no lleva marcas).

/** Lo que dibuja texto VISIBLE en el formulario (un `<option>` no admite marcas; lo `hidden` no se ve). */
const CON_TEXTO_VISIBLE: ReadonlySet<string> = new Set(['label', 'legend', 'span', 'button']);

const esAttrs = (h: HijoArbol | undefined): h is AttrsArbol => !!h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof HtmlCrudo);

/**
 * El árbol del formulario con los «[ ]» marcados (`hijosACompletar`, la misma regla que la decoración y la
 * miniatura) en las etiquetas, las preguntas, las opciones y el botón. Lo oculto (la etiqueta `hidden` que
 * lee el Pixel, el mensaje de éxito) queda igual. Puro: lo prueba tests/editor-landing-completar.test.ts.
 */
export function formularioConACompletar(n: NodoArbol): NodoArbol {
  const [tag, ...resto] = n;
  const attrs = esAttrs(resto[0]) ? resto[0] : null;
  const marca = CON_TEXTO_VISIBLE.has(tag) && attrs?.hidden == null;
  const hijos = resto.flatMap((h, i): HijoArbol[] => {
    if (i === 0 && attrs) return [h];
    if (Array.isArray(h)) return [formularioConACompletar(h as NodoArbol)];
    if (marca && typeof h === 'string') return hijosACompletar(h);
    return [h];
  });
  return [tag, ...hijos];
}
