'use client';

// =============================================================================
// nodos/ImagenVista — una imagen del contenido, con sus controles
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D3, D6).
//
// `figure.gm-imagen[data-ancho][data-alinea][data-forma]` (la forma de especificacion.ts) y,
// con la imagen elegida, la barra de Gamma (gamma-ui §5.10): ancho, alineación, forma de la
// imagen, enlace y texto alternativo, reemplazar y quitar; y la esquina para arrastrar el ancho.
// Sin imagen, el recuadro vacío con «Agregar imagen» (clic o soltar un archivo).
//
// Heredado del editor rico (app/_ui/EditorRico.tsx, ControlesImagen), con sus trampas pagadas:
//   · el ancho es de la LISTA CERRADA (10 a 100 de a 5, ANCHOS_IMAGEN): nunca un px;
//   · mientras se arrastra la esquina NO hay transacciones ni setState: se escribe el
//     `data-ancho` de la figura (lo dibuja la misma regla de la hoja) y, al soltar, UNA
//     transacción con `closeHistory` (si no, Ctrl+Z se llevaba el arrastre junto con el
//     cambio anterior);
//   · quitar deja 5 s de «Deshacer» que devuelve la MISMA imagen.
// =============================================================================

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { EditorLandingContext } from '../contexto';
import { attrsImagen, hrefPermitido, srcImagen } from '@/lib/editor-landing/especificacion';
import { NODO, type AttrsImagen, type Alineacion, type FormaImagen } from '@/lib/editor-landing/doc';
import { TIPOS_IMAGEN, TOPE_IMAGEN_BYTES } from '@/lib/editor-landing/api-tipos';
import { anchoDeArrastre } from '@/app/_ui/editor-rico-reglas';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { CSS_NODOS } from '../extensiones/estilos-nodos';
import { Flotante, FilaMenu, Ico, sinRobarFoco } from '../extensiones/piezas';
import { opcionesLanding } from '../extensiones/plugins';
import { sacarConDeshacer } from '../insertar';

const ANCHOS_RAPIDOS = [25, 50, 75, 100] as const;
const FORMAS: { id: FormaImagen; nombre: string; icono: string }[] = [
  { id: 'normal', nombre: 'Predeterminado', icono: 'imagen' },
  { id: 'redondeada', nombre: 'Redondeado', icono: 'tarjeta-credito' },
  { id: 'circulo', nombre: 'Círculo', icono: 'usuario-circulo' },
];
const ALINEAS: { id: Alineacion; nombre: string; icono: string }[] = [
  { id: 'izquierda', nombre: 'Izquierda', icono: 'alinear-izquierda' },
  { id: 'centro', nombre: 'Centro', icono: 'alinear-centro' },
  { id: 'derecha', nombre: 'Derecha', icono: 'alinear-derecha' },
];

export default function ImagenVista({ node, editor, getPos, selected }: NodeViewProps) {
  const ctx = useContext(EditorLandingContext);
  const a = attrsImagen(node.attrs);
  const figRef = useRef<HTMLElement | null>(null);
  const pctRef = useRef<HTMLSpanElement | null>(null);
  const [panel, setPanel] = useState<null | { tipo: 'forma' | 'enlace'; ancla: HTMLElement }>(null);
  const [subiendo, setSubiendo] = useState(false);
  const cerrar = useCallback(() => setPanel(null), []);
  const editable = editor.isEditable;

  const setAttrs = useCallback((cambios: Partial<AttrsImagen>) => {
    const pos = getPos();
    if (typeof pos !== 'number' || editor.isDestroyed) return;
    editor.chain().command(({ tr }) => {
      const n = tr.doc.nodeAt(pos);
      if (!n || n.type.name !== NODO.imagen) return false;
      tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...cambios });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      closeHistory(tr);
      return true;
    }).run();
  }, [editor, getPos]);

  const avisar = useCallback((t: string, deshacer?: () => void) => {
    if (ctx) ctx.avisar(t, deshacer); else opcionesLanding(editor).avisar?.(t);
  }, [ctx, editor]);

  const elegir = useCallback(async () => {
    const fn = ctx?.elegirImagen ?? opcionesLanding(editor).elegirImagen;
    if (!fn) return;
    const url = await fn({ modo: 'imagen' });
    if (!url) return;
    if (!srcImagen(url)) { avisar('Imagen no válida'); return; }
    setAttrs({ src: url });
  }, [ctx, editor, setAttrs, avisar]);

  const quitar = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
    avisar('Imagen eliminada', sacarConDeshacer(editor, tr, pos, node));
  };

  // Soltar un archivo sobre la imagen (o sobre el recuadro vacío) la reemplaza.
  useEffect(() => {
    const el = figRef.current;
    if (!el || !editable) return;
    const hay = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const sobre = (e: DragEvent) => { if (hay(e)) { e.preventDefault(); e.stopPropagation(); } };
    const soltar = async (e: DragEvent) => {
      if (!hay(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const f = Array.from(e.dataTransfer?.files ?? []).find((x) => (TIPOS_IMAGEN as readonly string[]).includes(x.type));
      if (!f) { avisar('Formato no admitido'); return; }
      if (f.size > TOPE_IMAGEN_BYTES) { avisar('Imagen muy pesada'); return; }
      const subir = ctx?.subirArchivo ?? opcionesLanding(editor).subirArchivo;
      if (!subir) return;
      setSubiendo(true);
      try { const url = await subir(f); if (srcImagen(url)) setAttrs({ src: url }); } catch { avisar('No se pudo subir'); } finally { setSubiendo(false); }
    };
    el.addEventListener('dragover', sobre);
    el.addEventListener('drop', soltar);
    return () => { el.removeEventListener('dragover', sobre); el.removeEventListener('drop', soltar); };
  }, [editable, ctx, editor, setAttrs, avisar]);

  // ── La esquina: arrastrar el ancho ──
  const gesto = useRef<{ x: number; inicio: number; contenedor: number; actual: number; previo: string | null } | null>(null);
  const terminar = (guardar: boolean) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    if (pctRef.current) pctRef.current.style.display = 'none';
    if (guardar && g.actual !== a.ancho) setAttrs({ ancho: g.actual });
    else if (figRef.current) figRef.current.setAttribute('data-ancho', g.previo ?? String(a.ancho));
  };

  const lado = a.alinea === 'derecha' ? 'izq' : 'der';

  return (
    <NodeViewWrapper
      as="figure"
      ref={figRef}
      className="gm-imagen"
      data-ancho={String(a.ancho)}
      data-alinea={a.alinea}
      data-forma={a.forma}
      data-vacia={a.src ? undefined : 'si'}
      data-soltar-propio=""
    >
      <style href="gma-nodos" precedence="medium">{CSS_NODOS}</style>
      {a.src
        ? <img src={a.src} alt={a.alt} draggable={false} />
        : editable && (
          <button type="button" className="gma gmc gmc-hueco" contentEditable={false} suppressContentEditableWarning onMouseDown={sinRobarFoco} onClick={() => void elegir()}>
            <Ico n="imagen" tam={28} />
            Agregar imagen
          </button>
        )}
      {subiendo && <div className="gma gmc gmc-cargando" contentEditable={false} suppressContentEditableWarning>Subiendo…</div>}

      {editable && selected && a.src && (
        <>
          <div className="gma gmc gmc-img-barra" role="toolbar" aria-label="Imagen" contentEditable={false} suppressContentEditableWarning>
            {ANCHOS_RAPIDOS.map((w) => (
              <button key={w} type="button" className="gmc-img-op" aria-pressed={a.ancho === w} title={`Ancho ${w}%`} onMouseDown={sinRobarFoco} onClick={() => setAttrs({ ancho: w })}>{w}%</button>
            ))}
            <span className="gmc-img-sep" aria-hidden="true" />
            {ALINEAS.map((al) => (
              <button key={al.id} type="button" className="gmc-img-op" aria-pressed={a.alinea === al.id} title={al.nombre} aria-label={al.nombre} onMouseDown={sinRobarFoco} onClick={() => setAttrs({ alinea: al.id })}><Ico n={al.icono} /></button>
            ))}
            <span className="gmc-img-sep" aria-hidden="true" />
            <button type="button" className="gmc-img-op" title="Forma de la imagen" aria-label="Forma de la imagen" aria-haspopup="menu" onMouseDown={sinRobarFoco}
              onClick={(e) => setPanel({ tipo: 'forma', ancla: e.currentTarget })}><Ico n="diseno" /></button>
            <button type="button" className="gmc-img-op" aria-pressed={!!a.href} title="Enlace" aria-label="Enlace" onMouseDown={sinRobarFoco}
              onClick={(e) => setPanel({ tipo: 'enlace', ancla: e.currentTarget })}><Ico n="enlace" /></button>
            <button type="button" className="gmc-img-op" title="Reemplazar imagen" aria-label="Reemplazar imagen" onMouseDown={sinRobarFoco} onClick={() => void elegir()}><Ico n="refrescar" /></button>
            <span className="gmc-img-sep" aria-hidden="true" />
            <button type="button" className="gmc-img-op" title="Eliminar" aria-label="Eliminar imagen" onMouseDown={sinRobarFoco} onClick={quitar}><IconoBorrar size={16} /></button>
          </div>
          <button
            type="button"
            className="gma gmc-img-asa"
            data-lado={lado}
            contentEditable={false} suppressContentEditableWarning
            title="Arrastra para cambiar el tamaño"
            aria-label="Cambiar el tamaño"
            onMouseDown={sinRobarFoco}
            onPointerDown={(e) => {
              if (e.button !== 0 || !figRef.current) return;
              e.preventDefault();
              const fig = figRef.current;
              const cont = fig.parentElement?.getBoundingClientRect().width ?? 0;
              if (!cont) return;
              gesto.current = { x: e.clientX, inicio: fig.getBoundingClientRect().width, contenedor: cont, actual: a.ancho, previo: fig.getAttribute('data-ancho') };
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sigue igual */ }
            }}
            onPointerMove={(e) => {
              const g = gesto.current;
              if (!g || !figRef.current) return;
              const dx = (e.clientX - g.x) * (a.alinea === 'derecha' ? -1 : 1) * (a.alinea === 'centro' ? 2 : 1);
              const nuevo = anchoDeArrastre(g.inicio + dx, g.contenedor);
              if (nuevo !== g.actual) { g.actual = nuevo; figRef.current.setAttribute('data-ancho', String(nuevo)); }
              if (pctRef.current) { pctRef.current.style.display = 'block'; pctRef.current.textContent = `${g.actual}%`; }
            }}
            onPointerUp={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ya no la tenía */ } terminar(true); }}
            onPointerCancel={() => terminar(false)}
            onLostPointerCapture={() => { if (gesto.current) terminar(true); }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              setAttrs({ ancho: Math.max(10, Math.min(100, a.ancho + (e.key === 'ArrowRight' ? 5 : -5))) });
            }}
          />
          <span ref={pctRef} className="gma gmc gmc-img-pct" style={{ display: 'none' }} aria-hidden="true" />
        </>
      )}

      {panel?.tipo === 'forma' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrar} etiqueta="Forma de la imagen" rol="menu" ancho={220}>
          <div className="gmc-menu-titulo">Forma de la imagen</div>
          {FORMAS.map((f) => (
            <FilaMenu key={f.id} icono={f.icono} texto={f.nombre + (a.forma === f.id ? ' ✓' : '')} onClick={() => { setAttrs({ forma: f.id }); setPanel(null); }} />
          ))}
        </Flotante>
      )}
      {panel?.tipo === 'enlace' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrar} etiqueta="Enlace" ancho={300}>
          <PanelEnlaceImagen href={a.href} alt={a.alt} onGuardar={(href, alt) => { setAttrs({ href, alt }); setPanel(null); }} />
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

/** El enlace de la imagen (las mismas reglas que el server: hrefPermitido) y su texto alternativo. */
function PanelEnlaceImagen({ href, alt, onGuardar }: { href: string | null; alt: string; onGuardar: (href: string | null, alt: string) => void }) {
  const [destino, setDestino] = useState(href ?? '');
  const [texto, setTexto] = useState(alt);
  const [error, setError] = useState('');
  const guardar = () => {
    const limpio = destino.trim();
    if (!limpio) { onGuardar(null, texto.trim()); return; }
    const ok = hrefPermitido(limpio);
    if (!ok || ok === '#') { setError('Enlace no válido'); return; }
    onGuardar(ok, texto.trim());
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar(); }}>
      <label className="gmc-rotulo" htmlFor="gmc-img-href">Enlace</label>
      <input id="gmc-img-href" className="gmc-campo" value={destino} autoFocus placeholder="Pega un enlace" onChange={(e) => { setDestino(e.target.value); setError(''); }} />
      {error && <p className="gmc-error">{error}</p>}
      <label className="gmc-rotulo" htmlFor="gmc-img-alt">Texto alternativo</label>
      <input id="gmc-img-alt" className="gmc-campo" value={texto} maxLength={300} placeholder="Qué muestra la imagen" onChange={(e) => setTexto(e.target.value)} />
      <div className="gmc-pie">
        {href && <button type="button" className="gmc-boton" data-suave="" onClick={() => onGuardar(null, texto.trim())}>Quitar enlace</button>}
        <button type="submit" className="gmc-boton">Guardar</button>
      </div>
    </form>
  );
}
