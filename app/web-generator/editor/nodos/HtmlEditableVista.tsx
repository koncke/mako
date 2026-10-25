'use client';

// =============================================================================
// HtmlEditableVista — «Diseño editable»: una sección a medida, con el texto, las imágenes y los enlaces a la vista
// =============================================================================
// Pedido de Martín (23/10/2026): «Que tenga la landing principal de MaKo en el editable de web generator y que
// le pueda hacer cambios de allí y se apliquen». El bloque y su contrato: lib/editor-landing/html-editable.ts.
//
// La sección se dibuja en un iframe `sandbox="allow-same-origin"` SIN `allow-scripts`: el HTML no corre nada
// (el saneo del server ya le sacó todo script, y acá igual no podría), y por ser del mismo origen esta vista
// puede tocar su documento: el `body` va `contentEditable` y lo que se escribe vuelve al atributo `html` con
// un respiro. Mismo documento que la página publicada (`documentoEditable`: la base de Tailwind, la hoja del
// documento y `.gm-libre`), así que se ve igual, y sus media queries miran el ancho del lienzo (la vista
// previa de celular del editor muestra el diseño de celular).
//
// Lo que se hace con el mouse:
//   · Clic adentro: la sección pasa a ser la ACTIVA (24/10/2026; antes ProseMirror no se enteraba del clic, que pasa en
//     el iframe): se ven sus controles y el chat de MaKo la toma como pista. MaKo además lee y cambia sus TEXTOS
//     (lib/editor-landing/html-editable-textos.ts): las páginas de MaKo se editan desde el chat sin tocar la forma.
//   · Texto: clic y escribir. Enter es un salto de línea (no parte la caja del diseño en dos). Negrita y cursiva sobre
//     lo elegido, desde la barrita.
//   · Imagen: clic en la imagen y «Imagen» la reemplaza (el selector de siempre: subir, buscar, biblioteca).
//   · Enlace: clic en el texto de un enlace o botón y «Enlace» cambia a dónde lleva.
//   · «Código»: el HTML de la sección, para lo que no se toca a la vista.
//
// ⚠️ Lo que escribe esta vista NO recarga el iframe (se perdería el cursor): el documento se rearma sólo cuando
//    el `html` cambia por OTRO camino (deshacer, «Código», la IA). `emitido` guarda lo último que salió de acá.
// ⚠️ El alto se mide desde afuera (el iframe no corre scripts): al cargar, al escribir, al cargar una imagen y
//    con un sondeo liviano, porque las fuentes y los videos cambian el alto sin avisar.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, Flotante, Icono, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { NODO, TOPES } from '@/lib/editor-landing/doc';
import { CLASE_LIBRE, documentoEditable } from '@/lib/editor-landing/html-editable';

const RESPIRO_MS = 500;
const SONDEO_MS = 800;

/**
 * El iframe del diseño SIEMPRE recibe el clic (25/10/2026, Martín: «Las landing de MaKo NO son editables, no puedo ni
 * cambiar un título»). BarraFormato apaga los iframes de un bloque que no está activo (`.gmx-nv:not([data-activo="si"])
 * iframe{pointer-events:none}`, del 11/10: que un video o un embed no se trague el clic que elige el bloque). Pero esta
 * sección se activa con el `mousedown` de ADENTRO del iframe, y con esa regla el clic nunca llegaba: ni cursor, ni
 * sección activa, ni barra. Medido con clics en el editor real (#32): el clic caía en el envoltorio. Esta regla le gana
 * por especificidad, no por orden (las dos van en `<style>` distintos): lo vigila tests/editor-web-diseno-editable-clic.test.ts.
 */
export const CSS_EDITABLE: string = [
  '.gmx-editable-vivo{position:relative}',
  '.gmx-editable-vivo iframe{display:block;width:100%;border:0;background:transparent}',
  '.gmx-nv .gmx-nv-marco.gmx-editable-vivo>iframe{pointer-events:auto}',
  '.gmx-codigo{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;font-size:12.5px!important;line-height:1.5!important;min-height:420px!important;white-space:pre;tab-size:2;overflow:auto;resize:vertical;width:100%}',
].join('\n');

/** Lo que se marca adentro del documento mientras se edita y NO va al `html` guardado. */
const CSS_DENTRO = 'body[contenteditable]{outline:none;caret-color:#2F6FED}[data-gmx-sel]{outline:2px solid #2F6FED!important;outline-offset:2px}';

export function HtmlEditableVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, updateAttributes } = props;
  const ctx = useEditorLanding();
  const html = typeof node.attrs.html === 'string' ? node.attrs.html : '';
  const css = ctx.config.diseno?.css ?? '';
  const marco = useRef<HTMLIFrameElement | null>(null);
  const emitido = useRef<string>(html);
  const [fuente, setFuente] = useState(html);
  const [alto, setAlto] = useState(320);
  const [activo, setActivo] = useState(false);
  const [codigo, setCodigo] = useState<{ ancla: HTMLElement } | null>(null);
  const [enlace, setEnlace] = useState<{ ancla: HTMLElement; a: HTMLAnchorElement } | null>(null);
  const elegido = useRef<Element | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editable = editor.isEditable;
  // Lo que leen las escuchas del iframe, que se ponen UNA vez al cargar: siempre lo último.
  const vivo = useRef({ ctx, editor, getPos });
  vivo.current = { ctx, editor, getPos };

  /**
   * La sección de este diseño pasa a ser la ACTIVA (24/10/2026, Martín: «Todas las paginas de MaKo no son editables,
   * clickeo y no se pueden editar las secciones»): el clic pasa en el iframe y ProseMirror no lo ve, así que la sección
   * no se activaba: ni sus controles ni el chat («Editar» toma la sección activa como pista) se enteraban.
   */
  const marcarSeccion = () => {
    const { ctx: c, editor: e, getPos: gp } = vivo.current;
    const pos = gp();
    if (typeof pos !== 'number' || e.isDestroyed) return;
    const $p = e.state.doc.resolve(pos);
    for (let d = $p.depth; d >= 1; d--) {
      const n = $p.node(d);
      if (n.type.name === NODO.tarjeta) { const id = String(n.attrs.id ?? ''); if (id) c.marcarActiva(id); return; }
    }
  };

  // El documento se rearma SÓLO si el html cambió por otro camino (no por lo que se escribió acá).
  useEffect(() => {
    if (html !== emitido.current) { emitido.current = html; setFuente(html); }
  }, [html]);
  const doc = useMemo(() => documentoEditable(fuente, css), [fuente, css]);

  const documento = () => marco.current?.contentDocument ?? null;
  const raiz = () => documento()?.querySelector('.' + CLASE_LIBRE) ?? null;

  const medir = useCallback(() => {
    const d = documento();
    if (!d?.documentElement) return;
    const h = Math.max(40, Math.ceil(d.documentElement.scrollHeight));
    setAlto((a) => (Math.abs(a - h) > 1 ? h : a));
  }, []);

  /** El HTML de la sección como quedó, sin las marcas de esta vista. */
  const leer = (): string | null => {
    const r = raiz();
    if (!r) return null;
    const copia = r.cloneNode(true) as HTMLElement;
    copia.querySelectorAll('[data-gmx-sel]').forEach((el) => el.removeAttribute('data-gmx-sel'));
    return copia.innerHTML;
  };
  const guardar = useCallback(() => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    const v = leer();
    if (v === null || v === emitido.current) return;
    if (v.length > TOPES.htmlEditable) { ctx.avisar('Sección muy grande'); return; }
    emitido.current = v;
    updateAttributes({ html: v });
  }, [ctx, updateAttributes]); // eslint-disable-line react-hooks/exhaustive-deps
  const conRespiro = useCallback(() => {
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = setTimeout(guardar, RESPIRO_MS);
    medir();
  }, [guardar, medir]);
  useEffect(() => () => guardar(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cargar el documento: editable, sus escuchas y el alto.
  const alCargar = () => {
    const d = documento();
    if (!d) return;
    const estilo = d.createElement('style');
    estilo.setAttribute('data-gmx', '');
    estilo.textContent = CSS_DENTRO;
    d.head.appendChild(estilo);
    if (editable) d.body.setAttribute('contenteditable', 'true');
    d.addEventListener('input', conRespiro);
    d.addEventListener('load', medir, true);
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); d.execCommand('insertLineBreak'); }
    });
    d.addEventListener('mousedown', (e) => {
      setActivo(true);
      marcarSeccion();
      const t = e.target as Element | null;
      if (elegido.current) elegido.current.removeAttribute('data-gmx-sel');
      elegido.current = t?.closest?.('img, a') ?? null;
      if (elegido.current) elegido.current.setAttribute('data-gmx-sel', '');
    });
    // Un enlace en un contentEditable no navega; sin editar, tampoco: esto es el editor.
    d.addEventListener('click', (e) => { if ((e.target as Element | null)?.closest?.('a')) e.preventDefault(); });
    d.defaultView?.addEventListener('blur', () => guardar());
    medir();
  };

  // Sondeo liviano del alto (fuentes, videos e imágenes que cambian el alto sin avisar).
  useEffect(() => {
    const id = setInterval(medir, SONDEO_MS);
    return () => clearInterval(id);
  }, [medir]);

  const cambiarImagen = async () => {
    const img = elegido.current?.closest('img') as HTMLImageElement | null;
    if (!img) { ctx.avisar('Elige una imagen'); return; }
    const url = await ctx.elegirImagen();
    if (!url) return;
    img.removeAttribute('srcset');
    img.src = url;
    guardar();
    medir();
  };
  /**
   * Negrita y cursiva sobre lo elegido ADENTRO del diseño (24/10/2026: «agregar funcionalidades al editor web» sin romper
   * el diseño). El comando de edición del documento del iframe: el foco y la selección siguen allá porque el botón no se
   * los roba (onMouseDown + preventDefault).
   */
  const formato = (cmd: 'bold' | 'italic') => {
    const d = documento();
    if (!d) return;
    const sel = d.getSelection();
    if (!sel || sel.isCollapsed) { ctx.avisar('Elige un texto'); return; }
    d.execCommand(cmd);
    guardar();
  };
  const abrirEnlace = (ancla: HTMLElement) => {
    const a = elegido.current?.closest('a') as HTMLAnchorElement | null;
    if (!a) { ctx.avisar('Elige un enlace'); return; }
    setEnlace({ ancla, a });
  };
  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar);
  };

  const mostrarBarra = editable && (activo || !!codigo || !!enlace);
  return (
    <NodeViewWrapper className="gmx-nv" data-activo={mostrarBarra ? 'si' : undefined}
      onMouseLeave={() => { if (!codigo && !enlace) setActivo(false); }}>
      <EstilosG2 />
      <style href="gmx-editable" precedence="medium">{CSS_EDITABLE}</style>
      {mostrarBarra && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title="Negrita" aria-label="Negrita" onMouseDown={(e) => e.preventDefault()} onClick={() => formato('bold')}>
            <Icono nombre="negrita" />
          </button>
          <button type="button" className="gmx-btn" title="Cursiva" aria-label="Cursiva" onMouseDown={(e) => e.preventDefault()} onClick={() => formato('italic')}>
            <Icono nombre="cursiva" />
          </button>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Cambiar la imagen elegida" onMouseDown={(e) => e.preventDefault()} onClick={() => void cambiarImagen()}>
            <Icono nombre="imagen" /><span>Imagen</span>
          </button>
          <button type="button" className="gmx-btn" title="Cambiar a dónde lleva el enlace elegido" onMouseDown={(e) => e.preventDefault()} onClick={(e) => abrirEnlace(e.currentTarget)}>
            <Icono nombre="enlace" /><span>Enlace</span>
          </button>
          <button type="button" className="gmx-btn" title="Código" aria-expanded={!!codigo} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { guardar(); const el = e.currentTarget; setCodigo((p) => (p ? null : { ancla: el })); }}>
            <Icono nombre="codigo" /><span>Código</span>
          </button>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label="Eliminar sección" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      <div className="gmx-nv-marco gmx-editable-vivo gm-editable" contentEditable={false}>
        <iframe ref={marco} sandbox="allow-same-origin" srcDoc={doc} title="Diseño editable" referrerPolicy="no-referrer"
          onLoad={alCargar} style={{ height: alto + 'px' }} />
      </div>

      {codigo && (
        <Flotante ancla={codigo.ancla} onCerrar={() => setCodigo(null)} etiqueta="Código" ancho={Math.min(960, typeof window === 'undefined' ? 960 : window.innerWidth - 16)}>
          <CodigoSeccion inicial={emitido.current} onListo={(v) => { setCodigo(null); if (v !== emitido.current) updateAttributes({ html: v }); }} />
        </Flotante>
      )}
      {enlace && (
        <Flotante ancla={enlace.ancla} onCerrar={() => setEnlace(null)} etiqueta="Enlace" ancho={360}>
          <CampoEnlace inicial={enlace.a.getAttribute('href') ?? ''} onListo={(v) => {
            if (v) enlace.a.setAttribute('href', v); else enlace.a.removeAttribute('href');
            setEnlace(null);
            guardar();
          }} />
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

export default HtmlEditableVista;

function CodigoSeccion({ inicial, onListo }: { inicial: string; onListo: (html: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
      <textarea className="gmx-campo gmx-codigo" spellCheck={false} value={texto} maxLength={TOPES.htmlEditable} aria-label="Código"
        onChange={(e) => setTexto(e.target.value)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="gmx-nota">Sin JavaScript</span>
        <button type="button" className="gmx-primario" onMouseDown={(e) => e.preventDefault()} onClick={() => onListo(texto)}>Listo</button>
      </div>
    </div>
  );
}

function CampoEnlace({ inicial, onListo }: { inicial: string; onListo: (href: string) => void }) {
  const [v, setV] = useState(inicial);
  return (
    <form style={{ display: 'flex', gap: 6, padding: 4 }} onSubmit={(e) => { e.preventDefault(); onListo(v.trim()); }}>
      <input className="gmx-campo" style={{ flex: 1 }} value={v} placeholder="https://… o #seccion" aria-label="A dónde lleva" autoFocus onChange={(e) => setV(e.target.value)} />
      <button type="submit" className="gmx-primario">Listo</button>
    </form>
  );
}
