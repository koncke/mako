'use client';

// =============================================================================
// Asa — el «+» y el ⋮⋮ en el margen izquierdo de cada bloque (copiado de Notion)
// =============================================================================
// Notion (help/writing-and-editing-basics, «Editing tools»): al pasar el cursor por un bloque aparecen, en el margen,
// el «+» (abre el menú de bloques en un renglón nuevo debajo) y el ⋮⋮ (se arrastra para mover el bloque; tocarlo abre
// Convertir en · Duplicar · Eliminar). Sólo para los bloques de PRIMER nivel: son los que mueve y numera el guion.
//
// El arrastre es el de ProseMirror, con el molde del asa del Web Generator (app/web-generator/editor/AsaBloque.tsx) y
// las reglas que ya mordieron (AGENTS.md):
//   · `dragstart` deja una NodeSelection del bloque y `view.dragging = { slice, move, node }`: el `drop` del editor
//     borra el original e inserta donde cae. Sin `node`, ProseMirror borra la SELECCIÓN.
//   · La foto que sigue al cursor la toma el navegador AL TERMINAR `dragstart`: se le pasa el bloque real
//     (`setDragImage`) y toda marca visual va con `setTimeout(…, 0)`, o sale en la foto.
//   · Al nodo origen no se le toca el tamaño.
// En el teléfono no se dibuja (no hay cursor que pase por encima): ahí está el «/» y el menú del bloque no hace falta.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type DragEvent as EventoArrastre } from 'react';
import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { insertarBarraEn } from '@/app/web-generator/editor/extensiones/barra';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { CONVERTIBLES, CONVERTIR_EN, convertirBloque, duplicarBloque, eliminarBloque } from './acciones';

type Bloque = { pos: number; tipo: string; top: number; alto: number };

/** El bloque de primer nivel debajo de `y` (por las cajas de sus nodos en el DOM). */
function bloqueEnY(view: EditorView, y: number): Bloque | null {
  let hallado: Bloque | null = null;
  view.state.doc.forEach((n, pos) => {
    if (hallado) return;
    const dom = view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return;
    const r = dom.getBoundingClientRect();
    if (y >= r.top - 4 && y <= r.bottom + 4) hallado = { pos, tipo: n.type.name, top: r.top, alto: r.height };
  });
  return hallado;
}

export function Asa({ editor, contenedor }: { editor: Editor; contenedor: HTMLElement | null }) {
  const [bloque, setBloque] = useState<Bloque | null>(null);
  const [menu, setMenu] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const vivo = useRef({ bloque, menu, arrastrando });
  vivo.current = { bloque, menu, arrastrando };
  const marco = useRef<number | null>(null);

  // Seguir el cursor por el documento (en un cuadro por vez).
  useEffect(() => {
    if (!contenedor) return;
    const mover = (e: MouseEvent) => {
      if (vivo.current.menu || vivo.current.arrastrando || !editor.isEditable || editor.isDestroyed) return;
      const y = e.clientY;
      if (marco.current != null) cancelAnimationFrame(marco.current);
      marco.current = requestAnimationFrame(() => {
        marco.current = null;
        setBloque(bloqueEnY(editor.view, y));
      });
    };
    const salir = () => { if (!vivo.current.menu && !vivo.current.arrastrando) setBloque(null); };
    contenedor.addEventListener('mousemove', mover);
    contenedor.addEventListener('mouseleave', salir);
    return () => {
      contenedor.removeEventListener('mousemove', mover);
      contenedor.removeEventListener('mouseleave', salir);
      if (marco.current != null) cancelAnimationFrame(marco.current);
    };
  }, [contenedor, editor]);

  // Escribir esconde el asa (como en Notion).
  useEffect(() => {
    const esconder = () => { if (!vivo.current.menu) setBloque(null); };
    editor.on('update', esconder);
    return () => { editor.off('update', esconder); };
  }, [editor]);

  const nodoActual = useCallback(() => {
    const b = vivo.current.bloque;
    if (!b || editor.isDestroyed) return null;
    const n = editor.state.doc.nodeAt(b.pos);
    return n && n.type.name === b.tipo ? { b, n } : null;
  }, [editor]);

  if (!bloque || !contenedor || !editor.isEditable) return null;
  const caja = contenedor.getBoundingClientRect();
  const editorCaja = editor.view.dom.getBoundingClientRect();
  const top = bloque.top - caja.top + contenedor.scrollTop + Math.min(bloque.alto / 2, 14) - 12;
  const left = editorCaja.left - caja.left - 50;

  const alArrastrar = (ev: EventoArrastre<HTMLButtonElement>) => {
    const actual = nodoActual();
    if (!actual) { ev.preventDefault(); return; }
    const vista = editor.view;
    const nodeSel = NodeSelection.create(vista.state.doc, actual.b.pos);
    vista.dispatch(vista.state.tr.setSelection(nodeSel));
    const { dom: html, text, slice } = vista.serializeForClipboard(nodeSel.content());
    ev.dataTransfer.clearData();
    ev.dataTransfer.setData('text/html', html.innerHTML);
    ev.dataTransfer.setData('text/plain', text);
    ev.dataTransfer.effectAllowed = 'copyMove';
    const d = vista.nodeDOM(actual.b.pos);
    if (d instanceof HTMLElement) {
      const r = d.getBoundingClientRect();
      ev.dataTransfer.setDragImage(d, Math.max(0, Math.min(ev.clientX - r.left, r.width)), Math.max(0, Math.min(ev.clientY - r.top, r.height)));
    }
    // `node` es lo que el drop borra del lugar viejo (prosemirror-view lee `dragging.node`).
    vista.dragging = { slice, move: true, node: nodeSel } as EditorView['dragging'];
    setMenu(false);
    setTimeout(() => setArrastrando(true), 0);
  };
  const alSoltar = () => {
    setArrastrando(false);
    setBloque(null);
    setTimeout(() => { if (!editor.isDestroyed && editor.view.dragging) editor.view.dragging = null; }, 50);
  };
  const agregarAbajo = () => {
    const actual = nodoActual();
    if (!actual) return;
    insertarBarraEn(editor, actual.b.pos + actual.n.nodeSize);
    setBloque(null);
  };
  const conCierre = (f: (pos: number) => void) => () => {
    const actual = nodoActual();
    setMenu(false);
    setBloque(null);
    if (actual) f(actual.b.pos);
  };

  return (
    <div className="nt-asa" style={{ top, left, opacity: arrastrando ? 0 : 1 }}>
      <button type="button" className="nt-asa-btn" onClick={agregarAbajo} title="Haz clic para añadir un bloque debajo" aria-label="Añadir un bloque debajo">+</button>
      <button type="button" className="nt-asa-btn nt-asa-arrastre" draggable onDragStart={alArrastrar} onDragEnd={alSoltar}
        onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" title="Arrastra para mover · Haz clic para abrir el menú" aria-label="Mover o abrir el menú del bloque">⋮⋮</button>
      {menu && (
        <div className="nt-menu" data-chico="" role="menu" style={{ position: 'absolute', top: 28, left: 0 }} onMouseDown={(e) => e.preventDefault()}>
          {CONVERTIBLES.has(bloque.tipo) && (
            <>
              <div className="nt-menu-grupo">Convertir en</div>
              {CONVERTIR_EN.map((c) => (
                <button key={c.id} type="button" role="menuitem" className="nt-menu-fila" onClick={conCierre((pos) => convertirBloque(editor, pos, c.id))}>
                  <span className="nt-menu-textos"><span className="nt-menu-nombre">{c.nombre}</span></span>
                </button>
              ))}
              <div className="nt-menu-sep" />
            </>
          )}
          <button type="button" role="menuitem" className="nt-menu-fila" onClick={conCierre((pos) => duplicarBloque(editor, pos))}>
            <span className="nt-menu-cuadro" aria-hidden>⧉</span><span className="nt-menu-textos"><span className="nt-menu-nombre">Duplicar</span></span>
          </button>
          <button type="button" role="menuitem" className="nt-menu-fila" data-peligro="" onClick={conCierre((pos) => eliminarBloque(editor, pos))}>
            <span className="nt-menu-cuadro" aria-hidden><IconoBorrar size={16} /></span><span className="nt-menu-textos"><span className="nt-menu-nombre">Eliminar</span></span>
          </button>
        </div>
      )}
    </div>
  );
}
