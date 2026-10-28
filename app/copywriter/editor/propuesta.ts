// =============================================================================
// La propuesta de MaKo EN el guion: se construye a la vista, se marca, y se acepta, se descarta o se reintenta
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D5). Notion (help/notion-ai-faqs): «When Notion AI creates or edits content for
// you, you'll have the option to accept or discard those changes, or have Notion AI try again». Y la regla de la casa
// para un chat que edita lo abierto (AGENTS.md): proponer, no aplicar; aceptar en UN paso de deshacer.
//
// Cómo:
//   · CONSTRUIR: los cuadros de lib/copywriter/operaciones.ts (`cuadrosDeConstruccion`) se pintan de a uno, con un
//     pequeño delay (AGENTS.md, «Lo que MaKo construye se ve CONSTRUYÉNDOSE»), FUERA del historial de deshacer y sin
//     disparar el autoguardado (`preventUpdate`). Lo escrito por MaKo va marcado (`nt-propuesta`). Con «reducir
//     movimiento» del sistema, o si la persona toca «Saltear», va el último cuadro directo.
//   · ACEPTAR: vuelve a la foto de ANTES (sin historial) y pone el resultado en UNA transacción CON historial: un
//     Ctrl+Z lo deshace entero.
//   · DESCARTAR: vuelve a la foto de antes, exacta.
// Sin React: lo usa el chat (app/copywriter/PanelMaKo.tsx), que es quien sabe cuándo.
// =============================================================================

import type { Editor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { JsonNodo } from '@/lib/copywriter/tipos';

const claveMarcas = new PluginKey<ReadonlySet<string>>('propuestaDeMako');

/** Marca los bloques de primer nivel cuyo id está en el conjunto (lo que escribió MaKo y todavía no se aceptó). */
export const MarcasDePropuesta = Extension.create({
  name: 'marcasDePropuesta',
  addProseMirrorPlugins() {
    return [
      new Plugin<ReadonlySet<string>>({
        key: claveMarcas,
        state: {
          init: () => new Set<string>(),
          apply: (tr, previo) => (tr.getMeta(claveMarcas) as ReadonlySet<string> | undefined) ?? previo,
        },
        props: {
          decorations(state) {
            const marcas = claveMarcas.getState(state);
            if (!marcas?.size) return null;
            const decos: Decoration[] = [];
            state.doc.forEach((n, pos) => {
              if (typeof n.attrs.bid === 'string' && marcas.has(n.attrs.bid)) decos.push(Decoration.node(pos, pos + n.nodeSize, { class: 'nt-propuesta' }));
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

/** Pone el documento entero (sin historial y sin autoguardado, salvo que se pida el historial: aceptar). */
export function ponerDoc(editor: Editor, doc: JsonNodo, op: { historial?: boolean; marcas?: ReadonlySet<string> } = {}): boolean {
  if (editor.isDestroyed) return false;
  let nodo;
  try { nodo = editor.schema.nodeFromJSON(doc); nodo.check(); } catch { return false; }
  const tr = editor.state.tr.replaceWith(0, editor.state.doc.content.size, nodo.content);
  tr.setMeta('preventUpdate', !op.historial);
  if (!op.historial) tr.setMeta('addToHistory', false);
  tr.setMeta(claveMarcas, op.marcas ?? new Set<string>());
  editor.view.dispatch(tr);
  return true;
}

/** ¿El sistema pide reducir el movimiento? */
export const sinMovimiento = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Lo que tarda cada cuadro: fracciones de segundo (el total, segundos). */
export const MS_POR_CUADRO = 110;

/**
 * Pinta los cuadros de a uno. Devuelve cuando llegó al último (o antes, si `saltear()` dice que sí: va el último). Los
 * bloques nuevos de cada cuadro se marcan como propuesta. `nuevos` son todos los ids que escribió MaKo.
 */
export async function construir(editor: Editor, cuadros: readonly JsonNodo[], nuevos: ReadonlySet<string>, op: { saltear: () => boolean; ms?: number }): Promise<boolean> {
  if (!cuadros.length) return true;
  const ms = op.ms ?? MS_POR_CUADRO;
  const marcasDe = (d: JsonNodo) => new Set((d.content ?? []).map((b) => b.attrs?.bid).filter((x): x is string => typeof x === 'string' && nuevos.has(x)));
  if (!sinMovimiento()) {
    for (let i = 0; i < cuadros.length - 1; i++) {
      if (op.saltear() || editor.isDestroyed) break;
      if (!ponerDoc(editor, cuadros[i], { marcas: marcasDe(cuadros[i]) })) return false;
      await new Promise((r) => setTimeout(r, ms));
    }
  }
  const ultimo = cuadros[cuadros.length - 1];
  return ponerDoc(editor, ultimo, { marcas: marcasDe(ultimo) });
}

/** Aceptar: la foto de antes sin historial, y el resultado en UN paso de deshacer. */
export function aceptar(editor: Editor, antes: JsonNodo, final: JsonNodo): boolean {
  return ponerDoc(editor, antes) && ponerDoc(editor, final, { historial: true });
}

/** Descartar: la foto de antes, exacta. */
export function descartar(editor: Editor, antes: JsonNodo): boolean {
  return ponerDoc(editor, antes);
}
