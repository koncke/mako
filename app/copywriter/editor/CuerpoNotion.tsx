'use client';

// =============================================================================
// CuerpoNotion — el cuerpo de la página: BlockNote, con el «/», el asa ⋮⋮ y la barra de la selección de Notion
// =============================================================================
// Pedido de Martín (29/10/2026): «quiero que Copywriter sea una réplica de Notion, busca un repo que sea copia, y
// replícalo». Diseño: docs/diseno-copywriter.md (D11). BlockNote (MPL-2.0, sólo el núcleo: los paquetes XL son GPL) es la
// copia de Notion en React: el «+» y el asa ⋮⋮ en el margen (arrastrar mueve el bloque; tocarla abre Eliminar ·
// Duplicar), el «/» que filtra lo escrito, la barra flotante al seleccionar, Tab para anidar, los atajos markdown.
//
// Lo que se cambió de BlockNote, y por qué:
//   · EL MENÚ «/» es el catálogo del Copywriter (./bloques.ts: los nombres y las descripciones de Notion en español, más
//     «Secciones del guion» y «Pedirle a MaKo», el «Ask AI» de Notion). Cada bloque básico usa la acción de BlockNote.
//   · LA BARRA DE LA SELECCIÓN: Convertir en · negrita, cursiva, subrayado, tachado, código · enlace · «Preguntar a
//     MaKo» (lleva lo seleccionado a la caja del chat, como «Ask AI» de Notion). Sin colores ni alineación: el documento
//     guardado no los tiene (ver ./esquema.tsx).
//   · EL ASA: Eliminar · Duplicar (y «Fila de encabezado» en una tabla). Sin «Colores», por lo mismo.
//   · LOS COLORES son los de la casa: el tema de BlockNote apunta a los tokens (`var(--ink)`…), así el oscuro sale solo.
//
// LO QUE VE EL RESTO DE LA PÁGINA es el documento GUARDADO (JsonNodo), nunca los bloques de BlockNote: `onCambio` lo
// convierte con lib/copywriter/notion-bloques.ts, y el chat de MaKo escribe por `DocVivo` (./propuesta.ts).
// =============================================================================

import '@blocknote/mantine/style.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type PartialBlock } from '@blocknote/core';
import { SideMenuExtension } from '@blocknote/core/extensions';
import { es } from '@blocknote/core/locales';
import {
  BasicTextStyleButton, BlockTypeSelect, CreateLinkButton, DragHandleMenu, FormattingToolbar, FormattingToolbarController,
  RemoveBlockItem, SideMenu, SideMenuController, SuggestionMenuController, TableRowHeaderItem, useBlockNoteEditor,
  useComponentsContext, useCreateBlockNote, useExtensionState, type DefaultReactSuggestionItem, type SideMenuProps,
} from '@blocknote/react';
import { getDefaultReactSlashMenuItems } from '@blocknote/react';
import { BlockNoteView, type Theme } from '@blocknote/mantine';
import { nombreDeSeccion } from '@/lib/copywriter/doc';
import { seccionDe, type BloqueArrastre } from '@/lib/copywriter/seccion-arrastre';
import { aBloques, deBloques, TIPOS_BN, type BloqueBN, type Secciones } from '@/lib/copywriter/notion-bloques';
import type { JsonNodo } from '@/lib/copywriter/tipos';
import { buscarBloquesCopy, catalogoCopy, type DefBloqueCopy } from './bloques';
import { esquemaCopy, type EditorCopy } from './esquema';
import type { DocVivo } from './propuesta';

/** El renglón vacío (Notion: «Escribe "/" para ver los comandos…»). */
export const PLACEHOLDER_LINEA = 'Escribe «/» para ver los comandos…';

/** Los colores de BlockNote, apuntando a los tokens de la casa (cambian solos con el tema). */
const TEMA: Theme = {
  colors: {
    editor: { text: 'var(--ink)', background: 'var(--surface)' },
    menu: { text: 'var(--ink)', background: 'var(--surface)' },
    tooltip: { text: 'var(--surface)', background: 'var(--ink)' },
    hovered: { text: 'var(--ink)', background: 'var(--velo-hover)' },
    selected: { text: 'var(--ink)', background: 'var(--primary-bg)' },
    disabled: { text: 'var(--faint)', background: 'var(--surface-2)' },
    shadow: 'var(--border)',
    border: 'var(--border)',
    sideMenu: 'var(--faint)',
  },
  borderRadius: 6,
  fontFamily: "'Geist', ui-sans-serif, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
};

/** El diccionario de BlockNote en español, con los textos de Notion donde se ven. */
const DICCIONARIO = {
  ...es,
  placeholders: { ...es.placeholders, default: PLACEHOLDER_LINEA, heading: 'Encabezado', toggleListItem: 'Desplegable', bulletListItem: 'Lista', numberedListItem: 'Lista', checkListItem: 'Tarea pendiente' },
  formatting_toolbar: { ...es.formatting_toolbar },
};

/** id del catálogo → la clave de la acción de BlockNote para ese bloque. */
const CLAVE_BN: Partial<Record<DefBloqueCopy['id'], string>> = {
  texto: 'paragraph', h1: 'heading', h2: 'heading_2', h3: 'heading_3', vinetas: 'bullet_list', numerada: 'numbered_list',
  tareas: 'check_list', desplegable: 'toggle_list', cita: 'quote', separador: 'divider', tabla: 'table',
};

export type PropsCuerpo = {
  /** El documento guardado con el que abre (no se vuelve a leer: el editor es el dueño mientras está abierto). */
  inicial: JsonNodo;
  editable: boolean;
  /** Las etiquetas de la estructura elegida: van primero en «Secciones del guion». */
  etiquetas: readonly string[];
  /** Con un link para editar no hay MaKo (ni en el «/» ni en la barra). */
  conMako: boolean;
  /** Cada cambio de la persona, ya en el formato guardado. Los que pone MaKo por `DocVivo` no pasan por acá. */
  onCambio: (doc: JsonNodo) => void;
  /** El documento vivo, para el chat de MaKo. */
  onDoc?: (d: DocVivo | null) => void;
  /** «Pedirle a MaKo» (del «/») o «Preguntar a MaKo» con lo seleccionado (de la barra). */
  onMako?: (seleccion?: string) => void;
  /** Enter en el título lleva el cursor acá. */
  enfocarRef?: React.MutableRefObject<(() => void) | null>;
  movil?: boolean;
};

export function CuerpoNotion(p: PropsCuerpo) {
  // Las props de AHORA para los manejadores (se actualizan después de cada render, no durante).
  const vivo = useRef(p);
  useLayoutEffect(() => { vivo.current = p; });
  // Lo que abre el editor, una sola vez: el padre monta uno nuevo por página (`key`). Las secciones del guion de los
  // Títulos 2 (id → etiqueta) viajan aparte del editor (notion-bloques.ts).
  const [{ bloques: inicio, secciones: seccionesIniciales }] = useState(() => aBloques(p.inicial));
  const secciones = useRef<Secciones>(seccionesIniciales);

  const editor = useCreateBlockNote({
    schema: esquemaCopy,
    dictionary: DICCIONARIO,
    initialContent: inicio as PartialBlock<typeof esquemaCopy.blockSchema>[],
    animations: true,
    tables: { headers: true },
  } as Parameters<typeof useCreateBlockNote>[0]) as unknown as EditorCopy;

  /** Mientras MaKo pone un documento, los cambios no son de la persona (no se marcan para guardar). */
  const poniendo = useRef(false);
  const [marcas, setMarcas] = useState<ReadonlySet<string>>(new Set());

  const leer = useCallback((): JsonNodo => deBloques(editor.document as unknown as BloqueBN[], secciones.current), [editor]);

  // El documento vivo, para el chat de MaKo (./propuesta.ts).
  useEffect(() => {
    let destruido = false;
    const doc: DocVivo = {
      leer,
      vivo: () => !destruido,
      poner: (d, op = {}) => {
        if (destruido) return false;
        const { bloques, secciones: s } = aBloques(d);
        poniendo.current = true;
        try {
          editor.transact((tr) => {
            if (!op.historial) tr.setMeta('addToHistory', false);
            editor.replaceBlocks(editor.document, bloques as PartialBlock<typeof esquemaCopy.blockSchema>[]);
          });
          secciones.current = s;
        } catch { return false; } finally { poniendo.current = false; }
        setMarcas(op.marcas ?? new Set());
        return true;
      },
    };
    vivo.current.onDoc?.(doc);
    return () => { destruido = true; vivo.current.onDoc?.(null); };
  }, [editor, leer]);

  useEffect(() => {
    if (!p.enfocarRef) return;
    p.enfocarRef.current = () => { try { editor.setTextCursorPosition(editor.document[0], 'start'); editor.focus(); } catch { /* sin bloques */ } };
    return () => { if (p.enfocarRef) p.enfocarRef.current = null; };
  }, [editor, p.enfocarRef]);

  const alCambiar = useCallback(() => {
    if (poniendo.current) return;
    vivo.current.onCambio(leer());
  }, [leer]);

  // ── El «/» ──────────────────────────────────────────────────────────────────
  const etiquetasClave = p.etiquetas.join('|');
  const catalogo = useMemo(() => catalogoCopy(p.etiquetas, { conMako: p.conMako }), [etiquetasClave, p.conMako]); // eslint-disable-line react-hooks/exhaustive-deps
  const itemsDelMenu = useCallback(async (consulta: string): Promise<DefaultReactSuggestionItem[]> => {
    const deBN = new Map(getDefaultReactSlashMenuItems(editor as never).map((i) => [(i as { key?: string }).key ?? '', i]));
    return buscarBloquesCopy(consulta, catalogo).map((b): DefaultReactSuggestionItem => {
      const accion = deBN.get(CLAVE_BN[b.id] ?? '');
      // El ícono: el de BlockNote para los bloques básicos; el del catálogo para los demás (§, ✦, 💡).
      const base = { title: b.nombre, subtext: b.descripcion, aliases: [...b.sinonimos], group: b.categoria, badge: b.atajo, icon: accion?.icon ?? <span className="nt-bn-icono" aria-hidden>{b.icono}</span> };
      if (b.id === 'mako') return { ...base, onItemClick: () => vivo.current.onMako?.() };
      if (b.id === 'destacado') return { ...base, onItemClick: () => { insertarOCambiar(editor, { type: TIPOS_BN.destacado }); } };
      if (b.id.startsWith('seccion:')) {
        const etiqueta = b.id.slice('seccion:'.length);
        return { ...base, onItemClick: () => {
          const nuevo = insertarOCambiar(editor, { type: TIPOS_BN.titulo, props: { level: 2 }, content: nombreDeSeccion(etiqueta) });
          if (nuevo?.id) secciones.current = { ...secciones.current, [nuevo.id]: etiqueta };
          alCambiar();
        } };
      }
      return { ...base, onItemClick: () => accion?.onItemClick() };
    });
  }, [editor, catalogo, alCambiar]);

  // Las marcas de una propuesta de MaKo: los bloques escritos (una lista son sus ítems: `<bid>x<n>`).
  const css = useMemo(() => {
    if (!marcas.size) return '';
    const sel = [...marcas].filter((b) => /^b[a-z0-9]+$/.test(b)).flatMap((b) => [`.nt-bn [data-node-type="blockOuter"][data-id="${b}"]`, `.nt-bn [data-node-type="blockOuter"][data-id^="${b}x"]`]);
    return sel.length ? `${sel.join(',\n')} { background: var(--nt-propuesta, var(--primary-bg)); border-radius: 4px; }` : '';
  }, [marcas]);

  return (
    <div className="nt-bn" data-movil={p.movil ? '' : undefined}>
      {css && <style>{css}</style>}
      <BlockNoteView editor={editor as never} editable={p.editable} theme={{ light: TEMA, dark: TEMA }} onChange={alCambiar}
        slashMenu={false} formattingToolbar={false} sideMenu={false} emojiPicker={false}>
        <SuggestionMenuController triggerCharacter="/" getItems={itemsDelMenu} />
        <FormattingToolbarController formattingToolbar={() => <BarraSeleccion conMako={p.conMako} onMako={(t) => vivo.current.onMako?.(t)} />} />
        {!p.movil && <SideMenuController sideMenu={(s) => <MenuLateral {...s} dragHandleMenu={MenuDelAsa} />} />}
      </BlockNoteView>
    </div>
  );
}

/** El «insertar o convertir» del «/» de BlockNote (el renglón vacío se convierte; si tiene texto, va debajo). */
function insertarOCambiar(editor: EditorCopy, bloque: Record<string, unknown>): { id?: string } | null {
  try {
    const actual = editor.getTextCursorPosition().block as unknown as { content?: unknown };
    const contenido = Array.isArray(actual.content) ? actual.content as { type: string; text?: string }[] : [];
    const vacio = !contenido.length || (contenido.length === 1 && contenido[0].type === 'text' && contenido[0].text === '/');
    const e = editor as unknown as {
      updateBlock: (a: unknown, b: unknown) => { id: string };
      insertBlocks: (a: unknown[], b: unknown, c: 'after') => { id: string }[];
      setTextCursorPosition: (b: unknown, p?: 'start' | 'end') => void;
    };
    const nuevo = vacio ? e.updateBlock(actual, bloque) : e.insertBlocks([bloque], actual, 'after')[0];
    e.setTextCursorPosition(nuevo, 'end');
    return nuevo;
  } catch { return null; }
}

/** La barra de la selección (Notion): Convertir en · estilos · enlace · Preguntar a MaKo. */
function BarraSeleccion({ conMako, onMako }: { conMako: boolean; onMako: (seleccion: string) => void }) {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext()!;
  return (
    <FormattingToolbar>
      {conMako && (
        <Components.FormattingToolbar.Button className="bn-button nt-bn-mako" mainTooltip="Preguntar a MaKo" label="Preguntar a MaKo"
          onClick={() => onMako(editor.getSelectedText().trim())}>
          <span aria-hidden>✦</span>&nbsp;Preguntar a MaKo
        </Components.FormattingToolbar.Button>
      )}
      <BlockTypeSelect key="tipo" />
      <BasicTextStyleButton basicTextStyle="bold" key="negrita" />
      <BasicTextStyleButton basicTextStyle="italic" key="cursiva" />
      <BasicTextStyleButton basicTextStyle="underline" key="subrayado" />
      <BasicTextStyleButton basicTextStyle="strike" key="tachado" />
      <BasicTextStyleButton basicTextStyle="code" key="codigo" />
      <CreateLinkButton key="enlace" />
    </FormattingToolbar>
  );
}

/**
 * El menú lateral (el «+» y el asa ⋮⋮), con UNA diferencia: arrastrar un TÍTULO se lleva su sección, lo que tiene debajo
 * hasta el próximo título de su nivel (llamada con Leila del 5/11: «arrastrar un bloque deja su contenido atrás»). Antes
 * del arrastre de BlockNote (en captura, así corre primero) se selecciona la sección; BlockNote mueve la selección entera
 * cuando abarca varios bloques. La regla es pura: lib/copywriter/seccion-arrastre.ts.
 */
function MenuLateral(p: SideMenuProps) {
  const editor = useBlockNoteEditor(esquemaCopy);
  const elegido = useExtensionState(SideMenuExtension, { editor, selector: (s) => s?.block });
  const alEmpezar = () => {
    if (!elegido) return;
    const tramo = seccionDe(editor.document as unknown as BloqueArrastre[], elegido.id);
    // Si la selección no se puede armar, el arrastre sigue como siempre (el título solo): nunca se corta el gesto.
    if (tramo) { try { editor.setSelection(tramo.desde, tramo.hasta); } catch { /* el título solo */ } }
  };
  return <div style={{ display: 'contents' }} onDragStartCapture={alEmpezar}><SideMenu {...p} /></div>;
}

/** El menú del asa ⋮⋮ (Notion): Eliminar · Duplicar, y en una tabla la fila de encabezado. */
function MenuDelAsa() {
  return (
    <DragHandleMenu>
      <RemoveBlockItem>Eliminar</RemoveBlockItem>
      <DuplicarItem>Duplicar</DuplicarItem>
      <TableRowHeaderItem>Fila de encabezado</TableRowHeaderItem>
    </DragHandleMenu>
  );
}

/** Copia el bloque (con sus hijos) debajo de sí mismo, con ids nuevos (BlockNote los exige únicos). */
function DuplicarItem({ children }: { children: React.ReactNode }) {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor(esquemaCopy);
  // Sin `as` sobre la llamada: TS infiere el elegido del tipo de afuera y el selector deja de encajar.
  const elegido = useExtensionState(SideMenuExtension, { editor, selector: (s) => s?.block });
  if (!elegido) return null;
  const block = elegido as unknown as BloqueBN;
  const sinIds = (b: BloqueBN): BloqueBN => ({ type: b.type, props: b.props, content: b.content, children: (b.children ?? []).map(sinIds) });
  return (
    <Components.Generic.Menu.Item className="bn-menu-item" onClick={() => { editor.insertBlocks([sinIds(block)] as PartialBlock<typeof esquemaCopy.blockSchema>[], elegido, 'after'); }}>
      {children}
    </Components.Generic.Menu.Item>
  );
}
