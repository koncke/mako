'use client';

// =============================================================================
// InsertadoVista — «Insertar» de Gamma: un video o una agenda de otro sitio
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» En Gamma se pega una URL o un `<iframe>` («Pega una URL o
// <iframe>…») y el bloque muestra el sitio; con el bloque elegido, «Editar
// inserción…» lo cambia (gamma-ui §5.10). Acá lo que se puede insertar lo decide
// `embedDe` de lib/embeds.ts —la MISMA función que usa el saneo del server y el
// editor rico (trampa 12)—, y si no se puede, el porqué sale de `porQueNoSeInserta`:
// un insertado que el server va a tirar no se ofrece.
//
// El iframe es la forma pública (specInsertado: sandbox y allow fijos de embeds.ts) y
// no recibe el mouse hasta que el bloque está elegido (trampa 13: un clic en el iframe
// se lleva el foco y el bloque no se puede elegir). Una agenda lleva su alto, de la
// lista de embeds.ts, con − y +. Un insertado nuevo (vacío) abre solo su panel.
// PEDIDO al paquete G1: `insertado` → `ReactNodeViewRenderer(InsertadoVista)`.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, Flotante, Icono, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { specInsertado } from '@/lib/editor-landing/especificacion';
import { htmlDeArbol } from '@/lib/editor-landing/grafico-svg';
import { ALTO_EMBED_MAX, ALTO_EMBED_MIN, ALTO_EMBED_PASO, altoValido, claseDeProveedor, embedDe, nombreDeProveedor, porQueNoSeInserta } from '@/lib/embeds';

/**
 * Lo que dice el hueco vacío según su PISTA (14/10/2026): el VSL de un diseño pide «tu video» y se ve
 * 16:9 con un ▶ (lo que va a ocupar el video); el bloque «Agenda», «tu agenda»; sin pista, como siempre.
 * Los proveedores de la nota son los de lib/embeds.ts.
 */
const TEXTO_VACIO: Record<'video' | 'agenda' | 'otro', readonly [string, string]> = {
  video: ['Pega el enlace de tu video', 'YouTube, Panda, Vimeo…'],
  agenda: ['Pega el enlace de tu agenda', 'Calendly o Cal.com'],
  otro: ['Pega el enlace de un video o de tu agenda', 'YouTube, Vimeo, Loom, Calendly, Cal.com, Google Calendar…'],
};

export function InsertadoVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, updateAttributes } = props;
  const ctx = useEditorLanding();
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const vacio = useRef<HTMLDivElement | null>(null);
  const yaAbrio = useRef(false);
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';
  const proveedor = typeof node.attrs.proveedor === 'string' ? node.attrs.proveedor : '';
  const agenda = claseDeProveedor(proveedor) === 'agenda';
  // Vacío, el proveedor es la PISTA de qué va en el hueco (attrsInsertado, especificacion.ts).
  const pista = src ? null : claseDeProveedor(proveedor);
  const alto = typeof node.attrs.alto === 'number' ? node.attrs.alto : null;
  const html = useMemo(() => (src ? htmlDeArbol(specInsertado(node.attrs, { modo: 'editor' })) : ''), [node.attrs, src]);
  const activo = (selected || !!ancla) && editor.isEditable;

  // Recién insertado y vacío: el panel se abre solo (una vez), como en Gamma.
  useEffect(() => {
    if (!src && selected && editor.isEditable && !yaAbrio.current && vacio.current) {
      yaAbrio.current = true;
      setAncla(vacio.current);
    }
  }, [src, selected, editor]);

  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar);
  };
  const cambiarAlto = (d: number) => {
    const base = alto ?? 700;
    updateAttributes({ alto: altoValido(Math.max(ALTO_EMBED_MIN, Math.min(ALTO_EMBED_MAX, base + d * ALTO_EMBED_PASO))) });
  };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      {activo && src && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <span className="gmx-nv-etq">{nombreDeProveedor(proveedor) ?? 'Insertado'}</span>
          <button type="button" className="gmx-btn" title="Editar inserción…" aria-expanded={!!ancla} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setAncla((a) => (a ? null : el)); }}>
            <Icono nombre="lapiz" /><span>Editar inserción…</span>
          </button>
          {agenda && (
            <>
              <span className="gmx-nv-sep" />
              <button type="button" className="gmx-btn" title="Menos alto" aria-label="Menos alto" disabled={(alto ?? 700) <= ALTO_EMBED_MIN} onMouseDown={(e) => e.preventDefault()} onClick={() => cambiarAlto(-1)}>
                <Icono nombre="menos" />
              </button>
              <span className="gmx-nv-etq">{alto ?? 700} px</span>
              <button type="button" className="gmx-btn" title="Más alto" aria-label="Más alto" disabled={(alto ?? 700) >= ALTO_EMBED_MAX} onMouseDown={(e) => e.preventDefault()} onClick={() => cambiarAlto(1)}>
                <Icono nombre="mas" />
              </button>
            </>
          )}
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label="Eliminar insertado" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      {src ? (
        <div className="gmx-nv-marco" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div ref={vacio} className="gmx gmx-nv-marco gmx-nv-vacio" data-clase={pista ?? undefined} contentEditable={false}
          onClick={(e) => { if (editor.isEditable) setAncla(e.currentTarget); }}>
          {pista === 'video'
            ? <span className="gmx-nv-play"><Icono nombre="play" tam={22} /></span>
            : <Icono nombre={pista === 'agenda' ? 'calendario' : 'insertar'} tam={22} />}
          <span>{TEXTO_VACIO[pista ?? 'otro'][0]}</span>
          <span className="gmx-nota">{TEXTO_VACIO[pista ?? 'otro'][1]}</span>
        </div>
      )}

      {ancla && (
        <Flotante ancla={ancla} onCerrar={() => setAncla(null)} etiqueta="Editar inserción" ancho={360}>
          <PanelInsertar
            inicial={src}
            onInsertar={(e) => { updateAttributes({ src: e.src, proveedor: e.proveedor, alto: claseDeProveedor(e.proveedor) === 'agenda' ? (e.alto ?? 700) : null }); setAncla(null); }}
            onQuitar={src ? () => { setAncla(null); eliminar(); } : undefined}
          />
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

export default InsertadoVista;

function PanelInsertar({ inicial, onInsertar, onQuitar }: {
  inicial: string;
  onInsertar: (e: { src: string; proveedor: string; alto?: number }) => void;
  onQuitar?: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const campo = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => campo.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  const e = embedDe(texto);
  const motivo = texto.trim() && !e ? porQueNoSeInserta(texto) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
      <span className="gmx-rotulo">Insertar</span>
      <textarea
        ref={campo}
        className={'gmx-campo' + (motivo ? ' gmx-campo-error' : '')}
        rows={3}
        value={texto}
        placeholder="Pega una URL o <iframe>…"
        aria-label="Enlace o código"
        onChange={(ev) => setTexto(ev.target.value)}
        onKeyDown={(ev) => { if (ev.key === 'Enter' && !ev.shiftKey && e) { ev.preventDefault(); onInsertar(e); } }}
      />
      {motivo && <span className="gmx-error">{motivo}</span>}
      {e && <span className="gmx-nota">{nombreDeProveedor(e.proveedor) ?? 'Listo'}: se puede insertar.</span>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {onQuitar && (
          <button type="button" className="gmx-chip" onMouseDown={(ev) => ev.preventDefault()} onClick={onQuitar} style={{ color: 'var(--gmx-peligro)' }}>
            <IconoBorrar size={14} /><span>Eliminar</span>
          </button>
        )}
        <button type="button" className="gmx-primario" disabled={!e} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { if (e) onInsertar(e); }}>Insertar</button>
      </div>
    </div>
  );
}
