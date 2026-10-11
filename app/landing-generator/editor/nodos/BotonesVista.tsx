'use client';

// =============================================================================
// BotonesVista — el grupo de botones de una sección, editable en el lugar
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» En Gamma el texto de un botón se escribe ADENTRO del
// botón, y al elegirlo aparece su panel: «Pegar un enlace o buscar una página»,
// Estilo (relleno / contorno), Alineación horizontal y Eliminar (gamma-ui §5.10).
// Acá, con el cursor en un botón: Destino (una URL, una sección de esta página, otra
// página del sitio, un correo o un teléfono), Estilo, y Eliminar; y para el grupo:
// Alineación y «Añadir botón».
//
// La etiqueta del botón es el texto del nodo `boton` (`content: 'text*'`, sin marcas)
// y se edita como cualquier texto. La forma pública (`.gm-botones[data-alinea]`) va en
// el contentDOM (`useAtributosEnContenido`): los `a.gm-boton` tienen que quedar como
// hijos DIRECTOS, como en el HTML publicado.
// PEDIDO al paquete G1: `botones` → `ReactNodeViewRenderer(BotonesVista)`. El `boton`
// queda con su renderHTML (SPEC_NODOS.boton): un `<a>` adentro de un contenteditable no
// navega.
// =============================================================================

import { useMemo, useRef, useState } from 'react';
import { NodeViewContent, NodeViewWrapper, useEditorState, type ReactNodeViewProps } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import {
  EstilosG2, FilaMenu, Flotante, Icono, MenuFilas, SelectorDestino, describirDestino, noRobaFoco, seccionesDe, useAtributosEnContenido,
} from '../BarraFormato';
import { specBotones } from '@/lib/editor-landing/especificacion';
import type { AttrsArbol } from '@/lib/editor-landing/grafico-svg';
import { ALINEACIONES, NODO, VARIANTES_BOTON, type Alineacion, type VarianteBoton } from '@/lib/editor-landing/doc';

const NOMBRE_VARIANTE: Record<VarianteBoton, string> = { primario: 'Principal', secundario: 'Secundario', contorno: 'Contorno' };
const ICONO_ALINEA: Record<Alineacion, string> = { izquierda: 'alinear-izquierda', centro: 'alinear-centro', derecha: 'alinear-derecha' };
const NOMBRE_ALINEA: Record<Alineacion, string> = { izquierda: 'Alinear a la izquierda', centro: 'Alinear al centro', derecha: 'Alinear a la derecha' };

type PanelBotones = { tipo: 'destino' | 'estilo'; ancla: HTMLElement };

export function BotonesVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, selectionInside, updateAttributes } = props;
  const ctx = useEditorLanding();
  const caja = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<PanelBotones | null>(null);
  useAtributosEnContenido(caja, specBotones(node.attrs)[1] as AttrsArbol);

  // El botón donde está el cursor.
  const boton = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const base = getPos();
      if (!e || typeof base !== 'number') return null;
      const { $from } = e.state.selection;
      for (let d = $from.depth; d >= 2; d--) {
        if ($from.node(d).type.name !== NODO.boton) continue;
        if ($from.before(d - 1) !== base) return null;
        const n = $from.node(d);
        return { pos: $from.before(d), href: String(n.attrs.href ?? ''), variante: (n.attrs.variante as VarianteBoton) ?? 'primario', nuevaPestana: !!n.attrs.nuevaPestana };
      }
      return null;
    },
  });
  const activo = (selected || !!selectionInside || !!panel) && editor.isEditable;
  const alinea = (node.attrs.alinea as Alineacion) ?? 'izquierda';
  const secciones = useMemo(() => (activo ? seccionesDe(editor) : []), [activo, editor]);
  const paginas = useMemo(() => ctx.paginas.map((p) => ({ id: p.id, titulo: p.titulo || 'Página' })), [ctx.paginas]);

  const abrir = (tipo: PanelBotones['tipo'], ancla: HTMLElement) => setPanel((p) => (p && p.tipo === tipo ? null : { tipo, ancla }));
  const cerrar = () => setPanel(null);

  const ponerEnBoton = (cambio: Record<string, unknown>) => {
    const pos = boton?.pos;
    if (pos == null) return;
    editor.chain().focus().command(({ tr }) => {
      const n = tr.doc.nodeAt(pos);
      if (!n || n.type.name !== NODO.boton) return false;
      tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...cambio });
      return true;
    }).run();
  };

  /** Un botón nuevo al final del grupo, con su texto elegido para escribir encima. */
  const agregar = () => {
    const base = getPos();
    const tipo = editor.schema.nodes[NODO.boton];
    if (typeof base !== 'number' || !tipo) return;
    let hayPrincipal = false;
    node.forEach((b) => { if (b.attrs.variante === 'primario') hayPrincipal = true; });
    const texto = 'Botón';
    const nuevo = tipo.create({ href: '#', variante: hayPrincipal ? 'secundario' : 'primario', nuevaPestana: false }, editor.schema.text(texto));
    const donde = base + node.nodeSize - 1;
    editor.chain().focus().command(({ tr }) => {
      tr.insert(donde, nuevo);
      tr.setSelection(TextSelection.create(tr.doc, donde + 1, donde + 1 + texto.length));
      return true;
    }).run();
  };

  /** Quita el botón donde está el cursor; si era el único, se va el grupo entero (Ctrl+Z lo devuelve). */
  const eliminar = () => {
    const base = getPos();
    const pos = boton?.pos;
    if (typeof base !== 'number' || pos == null) return;
    editor.chain().focus().command(({ tr }) => {
      const grupo = tr.doc.nodeAt(base);
      const n = tr.doc.nodeAt(pos);
      if (!grupo || !n) return false;
      if (grupo.childCount <= 1) tr.delete(base, base + grupo.nodeSize);
      else tr.delete(pos, pos + n.nodeSize);
      return true;
    }).run();
    cerrar();
  };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      {activo && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          {ALINEACIONES.map((a) => (
            <button key={a} type="button" className="gmx-btn" title={NOMBRE_ALINEA[a]} aria-label={NOMBRE_ALINEA[a]} aria-pressed={alinea === a}
              onMouseDown={(e) => e.preventDefault()} onClick={() => updateAttributes({ alinea: a })}>
              <Icono nombre={ICONO_ALINEA[a]} />
            </button>
          ))}
          <button type="button" className="gmx-btn" title="Añadir botón" onMouseDown={(e) => e.preventDefault()} onClick={agregar}>
            <Icono nombre="mas" /><span>Botón</span>
          </button>
          {boton && (
            <>
              <span className="gmx-nv-sep" />
              <button type="button" className="gmx-btn" title="Destino" aria-expanded={panel?.tipo === 'destino'} onMouseDown={(e) => e.preventDefault()} onClick={(e) => abrir('destino', e.currentTarget)}>
                <Icono nombre="enlace" />
                <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{boton.href && boton.href !== '#' ? describirDestino(boton.href, secciones, paginas) : 'Sin destino'}</span>
              </button>
              <button type="button" className="gmx-btn" title="Estilo" aria-expanded={panel?.tipo === 'estilo'} onMouseDown={(e) => e.preventDefault()} onClick={(e) => abrir('estilo', e.currentTarget)}>
                <Icono nombre="paleta" /><span>{NOMBRE_VARIANTE[boton.variante] ?? 'Principal'}</span><Icono nombre="chevron-abajo" tam={12} />
              </button>
              <button type="button" className="gmx-btn" title="Eliminar botón" aria-label="Eliminar botón" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
                <IconoBorrar size={16} />
              </button>
            </>
          )}
        </div>
      )}
      <div ref={caja} className="gmx-nv-marco"><NodeViewContent /></div>

      {panel?.tipo === 'destino' && boton && (
        <Flotante ancla={panel.ancla} onCerrar={cerrar} etiqueta="Destino del botón" ancho={300}>
          <SelectorDestino
            valor={boton.href || null}
            nuevaPestana={boton.nuevaPestana}
            textoQuitar="Quitar destino"
            onElegir={(href, nueva) => { ponerEnBoton({ href, nuevaPestana: nueva && /^https?:/i.test(href) }); cerrar(); }}
            onQuitar={() => { ponerEnBoton({ href: '#', nuevaPestana: false }); cerrar(); }}
          />
        </Flotante>
      )}
      {panel?.tipo === 'estilo' && boton && (
        <Flotante ancla={panel.ancla} onCerrar={cerrar} etiqueta="Estilo" ancho={200}>
          <MenuFilas etiqueta="Estilo">
            {VARIANTES_BOTON.map((v) => (
              <FilaMenu key={v} nombre={NOMBRE_VARIANTE[v]} activo={boton.variante === v ? true : undefined} onClick={() => { ponerEnBoton({ variante: v }); cerrar(); }} />
            ))}
          </MenuFilas>
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

export default BotonesVista;
