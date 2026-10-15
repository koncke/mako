'use client';

// =============================================================================
// HtmlLibreVista — «HTML personalizado» de Gamma: HTML, CSS y JS propios, con vista en vivo
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer todo lo que ahí
// se hace.» Y en la tanda 2 (punto 9): «Si se tiene que poder editar libremente con "HTML
// personalizado", esto permitirá copiar otras landing...». Decisión T6 en
// docs/diseno-editor-landing.md.
//
// El bloque se ve con su código CORRIENDO: un `<iframe sandbox="allow-scripts">` con `srcdoc` (un
// origen OPACO, sin la sesión de hola-mako.com) que ocupa el ancho entero y se ajusta SOLO al alto
// de lo que dibuja: el documento lleva un script que mide y le manda el alto al padre
// (`documentoHtmlLibre`, lib/editor-landing/html-libre.ts), y acá se acepta sólo si `ev.source` es la
// ventana de ESE iframe. El atributo `alto` queda como alto de partida (ya no hay menú de alto).
//
// «Editar código» abre el editor: el código a la izquierda y la vista en vivo a la derecha (abajo en
// pantallas angostas). Lo escrito se aplica con un respiro (cada aplicación recarga el iframe: una por
// tecla lo haría parpadear) y al cerrar se aplica lo pendiente, así no se pierde nada. Tope:
// TOPES.htmlLibre caracteres (el saneo deja vacío lo que lo pasa, nunca lo recorta: quedaría roto).
//
// En la página PUBLICADA el bloque se sirve desde su propia URL (`/l/html/<docId>/<id>`, con CSP
// `sandbox allow-scripts allow-forms allow-popups`): ahí su JavaScript corre igual que acá.
//
// ⚠️ El `srcdoc` del editor NO es el atributo `html`: es `documentoHtmlLibre(html)` (doctype, base y el
//    script del alto). El `renderHTML` del nodo (especificacion.ts) sigue escribiendo el `html` crudo:
//    copiar y pegar el bloque no puede ir acumulando scripts.
// ⚠️ Un iframe se traga los clics: sin seleccionar, una tapa transparente encima lo selecciona (si
//    no, no habría forma de llegar a «Editar código» con el mouse).
// =============================================================================

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, Flotante, Icono, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { TOPES } from '@/lib/editor-landing/doc';
import { SANDBOX_EDITOR, altoDeMensaje, documentoHtmlLibre } from '@/lib/editor-landing/html-libre';

const RESPIRO_MS = 600;

const CSS_HTML: string = [
  '.gmx-codigo{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;font-size:12.5px!important;line-height:1.5!important;min-height:360px!important;height:100%;white-space:pre;tab-size:2;overflow:auto;resize:vertical}',
  '.gmx-codigo-grilla{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:stretch}',
  '@media (max-width:760px){.gmx-codigo-grilla{grid-template-columns:minmax(0,1fr)}}',
  '.gmx-vista-viva{border:1px solid rgba(0,0,0,.12);border-radius:6px;overflow:auto;max-height:min(62vh,560px);min-height:200px;background:#fff}',
  '.gmx-vista-viva iframe,.gmx-html-vivo iframe{display:block;width:100%;border:0}',
  '.gmx-html-vivo{position:relative}',
  '.gmx-html-tapa{position:absolute;inset:0;cursor:pointer;background:transparent}',
].join('\n');

/**
 * El alto que manda el documento de un iframe (o null mientras no mandó nada). Escucha `message` en
 * la ventana y acepta SÓLO lo que viene de la ventana de ESE iframe: el origen es opaco ('null') y no
 * sirve para distinguir uno de otro.
 */
function useAltoDelIframe(ref: RefObject<HTMLIFrameElement | null>, doc: string): number | null {
  const [alto, setAlto] = useState<number | null>(null);
  useEffect(() => {
    const oir = (ev: MessageEvent) => {
      const win = ref.current?.contentWindow;
      if (!win || ev.source !== win) return;
      const h = altoDeMensaje(ev.data);
      if (h !== null) setAlto(h);
    };
    window.addEventListener('message', oir);
    return () => window.removeEventListener('message', oir);
  }, [ref, doc]);
  return alto;
}

export function HtmlLibreVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, updateAttributes } = props;
  const ctx = useEditorLanding();
  const [panel, setPanel] = useState<{ ancla: HTMLElement } | null>(null);
  const vacio = useRef<HTMLDivElement | null>(null);
  const marco = useRef<HTMLIFrameElement | null>(null);
  const yaAbrio = useRef(false);
  const html = typeof node.attrs.html === 'string' ? node.attrs.html : '';
  const altoInicial = typeof node.attrs.alto === 'number' ? node.attrs.alto : 300;
  const doc = useMemo(() => (html ? documentoHtmlLibre(html) : ''), [html]);
  const altoVivo = useAltoDelIframe(marco, doc);
  const activo = (selected || !!panel) && editor.isEditable;

  // Recién insertado y vacío: «Editar código» se abre solo (una vez).
  useEffect(() => {
    if (!html && selected && editor.isEditable && !yaAbrio.current && vacio.current) {
      yaAbrio.current = true;
      setPanel({ ancla: vacio.current });
    }
  }, [html, selected, editor]);

  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar);
  };
  const seleccionar = () => {
    const pos = getPos();
    if (typeof pos === 'number') editor.chain().focus().setNodeSelection(pos).run();
  };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      <style href="gmx-html" precedence="medium">{CSS_HTML}</style>
      {activo && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title="Editar código" aria-expanded={!!panel} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setPanel((p) => (p ? null : { ancla: el })); }}>
            <Icono nombre="codigo" /><span>Editar código</span>
          </button>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label="Eliminar HTML personalizado" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      {html ? (
        <div className="gmx-nv-marco gmx-html-vivo" contentEditable={false}>
          <div className="gm-html" data-alto={String(altoInicial)}>
            <iframe ref={marco} sandbox={SANDBOX_EDITOR} srcDoc={doc} title="HTML personalizado" referrerPolicy="no-referrer"
              style={{ height: (altoVivo ?? altoInicial) + 'px' }} />
          </div>
          {!activo && editor.isEditable && (
            <div className="gmx-html-tapa" aria-hidden="true" onMouseDown={(e) => { e.preventDefault(); seleccionar(); }} />
          )}
        </div>
      ) : (
        <div ref={vacio} className="gmx gmx-nv-marco gmx-nv-vacio" contentEditable={false}
          onClick={(e) => { if (editor.isEditable) setPanel({ ancla: e.currentTarget }); }}>
          <Icono nombre="codigo" tam={22} />
          <span>HTML personalizado</span>
          <span className="gmx-nota">HTML, CSS y JS. Corre aislado.</span>
        </div>
      )}

      {panel && (
        <EditorCodigo inicial={html} ancla={panel.ancla} onAplicar={(v) => updateAttributes({ html: v })} onCerrar={() => setPanel(null)} />
      )}
    </NodeViewWrapper>
  );
}

export default HtmlLibreVista;

function EditorCodigo({ inicial, ancla, onAplicar, onCerrar }: {
  inicial: string;
  ancla: HTMLElement;
  onAplicar: (html: string) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  // Lo que se ve en la vista en vivo: lo último APLICADO (con el mismo respiro que el documento).
  const [visto, setVisto] = useState(inicial);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const vivo = useRef<HTMLIFrameElement | null>(null);
  const pendiente = useRef<string | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aplicarRef = useRef(onAplicar);
  useEffect(() => { aplicarRef.current = onAplicar; }, [onAplicar]);
  // El ancho se toma al abrir: el panel es ancho (código + vista) pero nunca más que la ventana.
  const [ancho] = useState(() => (typeof window === 'undefined' ? 960 : Math.max(320, Math.min(960, window.innerWidth - 16))));
  const doc = useMemo(() => (visto ? documentoHtmlLibre(visto) : ''), [visto]);
  const altoVivo = useAltoDelIframe(vivo, doc);

  const vaciar = () => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    if (pendiente.current !== null) {
      const v = pendiente.current;
      pendiente.current = null;
      aplicarRef.current(v);
      setVisto(v);
    }
  };
  // Al cerrar (o al desmontar por cualquier camino), se aplica lo que quedó en el respiro.
  useEffect(() => () => vaciar(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = requestAnimationFrame(() => area.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const cambiar = (v: string) => {
    setTexto(v);
    pendiente.current = v;
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = setTimeout(vaciar, RESPIRO_MS);
  };

  return (
    <Flotante ancla={ancla} onCerrar={() => { vaciar(); onCerrar(); }} etiqueta="Editar código" ancho={ancho}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
        <span className="gmx-rotulo">HTML, CSS y JS</span>
        <div className="gmx-codigo-grilla">
          <textarea
            ref={area}
            className="gmx-campo gmx-codigo"
            spellCheck={false}
            value={texto}
            maxLength={TOPES.htmlLibre}
            placeholder={'<style>…</style>\n<div>…</div>\n<script>…</script>'}
            aria-label="Código"
            onChange={(e) => cambiar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Tab' || e.shiftKey) return;
              e.preventDefault();
              const el = e.currentTarget;
              const ini = el.selectionStart, fin = el.selectionEnd;
              const v = texto.slice(0, ini) + '  ' + texto.slice(fin);
              cambiar(v);
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = ini + 2; });
            }}
          />
          <div className="gmx-vista-viva" aria-label="Vista en vivo">
            {doc ? (
              <iframe ref={vivo} sandbox={SANDBOX_EDITOR} srcDoc={doc} title="Vista en vivo" referrerPolicy="no-referrer"
                style={{ height: (altoVivo ?? 200) + 'px' }} />
            ) : (
              <span className="gmx-nota" style={{ display: 'block', padding: 12 }}>Vista en vivo</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span className="gmx-nota">{texto.length.toLocaleString('es')} / {TOPES.htmlLibre.toLocaleString('es')}</span>
          <button type="button" className="gmx-primario" onMouseDown={(e) => e.preventDefault()} onClick={() => { vaciar(); onCerrar(); }}>Listo</button>
        </div>
      </div>
    </Flotante>
  );
}
