'use client';

// =============================================================================
// El esquema del editor del Copywriter: los bloques de Notion en BlockNote, y el «Texto destacado» propio
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D11). BlockNote trae los bloques básicos de Notion (Texto, Encabezados, listas,
// Lista desplegable, Cita, Divisor, Tabla); el «Texto destacado» (callout) no lo trae y se arma con su molde de bloque
// propio (blocknotejs.org, «Custom Blocks», el ejemplo del Alert).
// El esquema es EXACTAMENTE lo que sabe guardar lib/copywriter/notion-bloques.ts (TIPOS_BN): sin imágenes, ni código, ni
// encabezados 4-6, ni desplegables de encabezado, ni colores ni alineación. Lo que el editor ofrece y no se guarda se
// perdería al recargar sin un error: por eso no se ofrece.
// =============================================================================

import { useState } from 'react';
import { BlockNoteSchema, createHeadingBlockSpec, defaultBlockSpecs, defaultStyleSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { EMOJI_DESTACADO } from '@/lib/copywriter/doc';
import { TIPOS_BN } from '@/lib/copywriter/notion-bloques';

/** Los íconos que ofrece el Destacado al tocarlo (Notion abre su selector entero; acá, los de un texto). */
export const EMOJIS_DESTACADO = [EMOJI_DESTACADO, '⚠️', '✅', '📌', '🔥', '🎯', '💬', '❗', '🚀', '📣'] as const;

type VistaDestacado = {
  block: { props: { emoji: string } };
  editor: { isEditable: boolean; updateBlock: (b: unknown, c: { props: { emoji: string } }) => unknown };
  contentRef: (n: HTMLElement | null) => void;
};

function Destacado({ block, editor, contentRef }: VistaDestacado) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="nt-destacado" data-callout="">
      <span className="nt-destacado-lado" contentEditable={false}>
        <button type="button" className="nt-destacado-emoji" title="Cambiar el ícono" aria-label="Cambiar el ícono"
          onMouseDown={(e) => e.preventDefault()} onClick={() => { if (editor.isEditable) setAbierto((v) => !v); }}>
          {block.props.emoji || EMOJI_DESTACADO}
        </button>
        {abierto && (
          <span className="nt-menu nt-destacado-menu" role="dialog" aria-label="Ícono">
            {EMOJIS_DESTACADO.map((e) => (
              <button key={e} type="button" aria-label={`Usar ${e}`} onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => { editor.updateBlock(block, { props: { emoji: e } }); setAbierto(false); }}>{e}</button>
            ))}
          </span>
        )}
      </span>
      <div className="nt-destacado-texto" ref={contentRef} />
    </div>
  );
}

const crearDestacado = createReactBlockSpec(
  { type: TIPOS_BN.destacado, propSchema: { emoji: { default: EMOJI_DESTACADO as string } }, content: 'inline' },
  { render: (p) => <Destacado {...(p as unknown as VistaDestacado)} /> },
);

export const esquemaCopy = BlockNoteSchema.create({
  blockSpecs: {
    [TIPOS_BN.parrafo]: defaultBlockSpecs.paragraph,
    [TIPOS_BN.titulo]: createHeadingBlockSpec({ levels: [1, 2, 3], allowToggleHeadings: false }),
    [TIPOS_BN.vineta]: defaultBlockSpecs.bulletListItem,
    [TIPOS_BN.numero]: defaultBlockSpecs.numberedListItem,
    [TIPOS_BN.tarea]: defaultBlockSpecs.checkListItem,
    [TIPOS_BN.desplegable]: defaultBlockSpecs.toggleListItem,
    [TIPOS_BN.cita]: defaultBlockSpecs.quote,
    [TIPOS_BN.divisor]: defaultBlockSpecs.divider,
    [TIPOS_BN.tabla]: defaultBlockSpecs.table,
    [TIPOS_BN.destacado]: crearDestacado(),
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
    strike: defaultStyleSpecs.strike,
    code: defaultStyleSpecs.code,
  },
});

export type EditorCopy = typeof esquemaCopy.BlockNoteEditor;
