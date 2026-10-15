'use client';

// =============================================================================
// nodos/VideoVista — un video SUBIDO (MP4/WebM del bucket), con sus controles
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D3, D6).
//
// `figure.gm-video > video` (la forma de especificacion.ts). Los videos de YouTube, Vimeo,
// Loom… son otro nodo (`insertado`, InsertadoVista). Éste es el archivo propio, con lo que
// Gamma deja elegir: ancho, reproducción automática (sale muteado: un navegador no reproduce
// solo un video con sonido), bucle, miniatura (póster), reemplazar y quitar.
//
// ⚠️ El `<video>` recibe sus clics (`stopEvent` en extensiones/index.ts): sin eso, ProseMirror
//    se tomaba el clic para elegir el bloque y los controles del reproductor no respondían. Para
//    elegir el bloque (y ver la barra) está la píldora «Editar» arriba a la izquierda.
// =============================================================================

import { useCallback, useContext, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { EditorLandingContext } from '../contexto';
import { attrsVideo, srcImagen, srcVideo } from '@/lib/editor-landing/especificacion';
import { NODO, type AttrsVideo } from '@/lib/editor-landing/doc';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { CSS_NODOS } from '../extensiones/estilos-nodos';
import { Ico, sinRobarFoco } from '../extensiones/piezas';
import { opcionesLanding } from '../extensiones/plugins';
import { sacarConDeshacer } from '../insertar';

const ANCHOS_RAPIDOS = [50, 75, 100] as const;

export default function VideoVista({ node, editor, getPos, selected }: NodeViewProps) {
  const ctx = useContext(EditorLandingContext);
  const a = attrsVideo(node.attrs);
  const figRef = useRef<HTMLElement | null>(null);
  const [cargando, setCargando] = useState(false);
  const editable = editor.isEditable;

  const setAttrs = useCallback((cambios: Partial<AttrsVideo>) => {
    const pos = getPos();
    if (typeof pos !== 'number' || editor.isDestroyed) return;
    editor.chain().command(({ tr }) => {
      const n = tr.doc.nodeAt(pos);
      if (!n || n.type.name !== NODO.video) return false;
      tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...cambios });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      closeHistory(tr);
      return true;
    }).run();
  }, [editor, getPos]);

  const avisar = useCallback((t: string, deshacer?: () => void) => {
    if (ctx) ctx.avisar(t, deshacer); else opcionesLanding(editor).avisar?.(t);
  }, [ctx, editor]);

  const elegir = useCallback(async (que: 'video' | 'poster') => {
    const fn = ctx?.elegirImagen ?? opcionesLanding(editor).elegirImagen;
    if (!fn) return;
    setCargando(true);
    try {
      const url = await fn({ modo: que === 'video' ? 'video' : 'imagen' });
      if (!url) return;
      if (que === 'video') { if (srcVideo(url)) setAttrs({ src: url }); else avisar('Video no válido'); }
      else if (srcImagen(url)) setAttrs({ poster: url }); else avisar('Imagen no válida');
    } finally {
      setCargando(false);
    }
  }, [ctx, editor, setAttrs, avisar]);

  const elegirBloque = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
    editor.view.focus();
  };

  const quitar = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
    avisar('Video eliminado', sacarConDeshacer(editor, tr, pos, node));
  };

  return (
    <NodeViewWrapper as="figure" ref={figRef} className="gm-video" data-ancho={String(a.ancho)} data-vacia={a.src ? undefined : 'si'}>
      <style href="gma-nodos" precedence="medium">{CSS_NODOS}</style>
      {a.src
        ? (
          // En el editor siempre con controles y sin sonido: el autoplay se ve en la página publicada.
          <video key={a.src} src={a.src} poster={a.poster ?? undefined} controls muted playsInline preload="metadata" loop={a.bucle} />
        )
        : editable && (
          <button type="button" className="gma gmc gmc-hueco" contentEditable={false} suppressContentEditableWarning onMouseDown={sinRobarFoco} onClick={() => void elegir('video')}>
            <Ico n="video" tam={28} />
            Subir video
          </button>
        )}
      {cargando && <div className="gma gmc gmc-cargando" contentEditable={false} suppressContentEditableWarning>Cargando…</div>}

      {editable && a.src && !selected && (
        <button type="button" className="gma gmc gmc-editar" contentEditable={false} suppressContentEditableWarning onMouseDown={sinRobarFoco} onClick={elegirBloque}>Editar</button>
      )}

      {editable && selected && a.src && (
        <div className="gma gmc gmc-img-barra" role="toolbar" aria-label="Video" contentEditable={false} suppressContentEditableWarning>
          {ANCHOS_RAPIDOS.map((w) => (
            <button key={w} type="button" className="gmc-img-op" aria-pressed={a.ancho === w} title={`Ancho ${w}%`} onMouseDown={sinRobarFoco} onClick={() => setAttrs({ ancho: w })}>{w}%</button>
          ))}
          <span className="gmc-img-sep" aria-hidden="true" />
          <button type="button" className="gmc-img-op" aria-pressed={a.autoplay} title="Reproducción automática (sin sonido)" onMouseDown={sinRobarFoco} onClick={() => setAttrs({ autoplay: !a.autoplay })}>
            <Ico n="play" /> Automático
          </button>
          <button type="button" className="gmc-img-op" aria-pressed={a.bucle} title="Repetir en bucle" onMouseDown={sinRobarFoco} onClick={() => setAttrs({ bucle: !a.bucle })}>
            <Ico n="refrescar" /> Bucle
          </button>
          <button type="button" className="gmc-img-op" aria-pressed={!!a.poster} title={a.poster ? 'Reemplazar miniatura' : 'Agregar miniatura'} onMouseDown={sinRobarFoco} onClick={() => void elegir('poster')}>
            <Ico n="imagen" /> Miniatura
          </button>
          {a.poster && (
            <button type="button" className="gmc-img-op" title="Quitar miniatura" aria-label="Quitar miniatura" onMouseDown={sinRobarFoco} onClick={() => setAttrs({ poster: null })}><Ico n="cerrar" /></button>
          )}
          <span className="gmc-img-sep" aria-hidden="true" />
          <button type="button" className="gmc-img-op" title="Reemplazar video" aria-label="Reemplazar video" onMouseDown={sinRobarFoco} onClick={() => void elegir('video')}><Ico n="subir" /></button>
          <button type="button" className="gmc-img-op" title="Eliminar" aria-label="Eliminar video" onMouseDown={sinRobarFoco} onClick={quitar}><IconoBorrar size={16} /></button>
        </div>
      )}
    </NodeViewWrapper>
  );
}
