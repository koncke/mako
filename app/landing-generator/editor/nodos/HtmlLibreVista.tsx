'use client';

// =============================================================================
// HtmlLibreVista — «HTML personalizado» de Gamma: código propio en un recuadro aislado
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» Gamma tiene el bloque «HTML personalizado» («Un bloque de
// HTML y CSS personalizados, con JavaScript interactivo de forma opcional») que se
// edita con «Editar código». Corre en un `<iframe sandbox="allow-scripts">` con
// `srcdoc`: un origen OPACO, sin la sesión de hola-mako.com (D4: nada de JavaScript
// de terceros en nuestro dominio). La vista del editor es la MISMA forma pública
// (specHtmlLibre, paquete A).
//
// El panel: un editor de código (textarea monoespaciada; Tab escribe dos espacios en
// vez de saltar de campo) y el alto de ALTOS_HTML_LIBRE. Lo escrito se aplica con un
// respiro (cada aplicación recarga el iframe: una por tecla lo haría parpadear) y al
// cerrar el panel se aplica lo pendiente, así no se pierde nada. Tope: TOPES.htmlLibre
// caracteres (el saneo deja vacío lo que lo pasa, nunca lo recorta: quedaría roto).
// PEDIDO al paquete G1: `htmlLibre` → `ReactNodeViewRenderer(HtmlLibreVista)`.
//
// ⚠️ LO QUE SE VE AL EDITAR NO ES LO QUE SE PUBLICA, EN UNA COSA: el JavaScript. Un `iframe
//    srcdoc` HEREDA la política de contenido de la página que lo contiene (el sandbox aísla el
//    ORIGEN, no la política), y la página publicada lleva una política estricta (sólo los scripts
//    propios, por hash: pagina-publica.ts). En el editor la app no restringe scripts, así que acá
//    corren y en /l/<slug> no. Servirlo desde su propia URL con `CSP: sandbox` (la propuesta del
//    paquete F) no entró limpio: la app entera manda `X-Frame-Options: DENY` y `frame-ancestors
//    'none'` desde next.config.ts (ese iframe no se dejaría enmarcar), y Next descarta el header
//    que pone una ruta si next.config ya puso el mismo. Por eso el panel lo DICE en una línea.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, FilaMenu, Flotante, Icono, MenuFilas, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { specHtmlLibre } from '@/lib/editor-landing/especificacion';
import { htmlDeArbol } from '@/lib/editor-landing/grafico-svg';
import { ALTOS_HTML_LIBRE, TOPES } from '@/lib/editor-landing/doc';

const RESPIRO_MS = 600;

const CSS_HTML: string = [
  '.gmx-codigo{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;font-size:12.5px!important;line-height:1.5!important;min-height:260px!important;white-space:pre;tab-size:2;overflow:auto}',
].join('\n');

export function HtmlLibreVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, updateAttributes } = props;
  const ctx = useEditorLanding();
  const [panel, setPanel] = useState<{ tipo: 'codigo' | 'alto'; ancla: HTMLElement } | null>(null);
  const vacio = useRef<HTMLDivElement | null>(null);
  const yaAbrio = useRef(false);
  const html = typeof node.attrs.html === 'string' ? node.attrs.html : '';
  const alto = typeof node.attrs.alto === 'number' ? node.attrs.alto : 300;
  const vista = useMemo(() => (html ? htmlDeArbol(specHtmlLibre(node.attrs, { modo: 'editor' })) : ''), [node.attrs, html]);
  const activo = (selected || !!panel) && editor.isEditable;

  // Recién insertado y vacío: «Editar código» se abre solo (una vez).
  useEffect(() => {
    if (!html && selected && editor.isEditable && !yaAbrio.current && vacio.current) {
      yaAbrio.current = true;
      setPanel({ tipo: 'codigo', ancla: vacio.current });
    }
  }, [html, selected, editor]);

  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar);
  };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      <style href="gmx-html" precedence="medium">{CSS_HTML}</style>
      {activo && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title="Editar código" aria-expanded={panel?.tipo === 'codigo'} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setPanel((p) => (p?.tipo === 'codigo' ? null : { tipo: 'codigo', ancla: el })); }}>
            <Icono nombre="codigo" /><span>Editar código</span>
          </button>
          <button type="button" className="gmx-btn" title="Alto" aria-expanded={panel?.tipo === 'alto'} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setPanel((p) => (p?.tipo === 'alto' ? null : { tipo: 'alto', ancla: el })); }}>
            <span>{alto} px</span><Icono nombre="chevron-abajo" tam={12} />
          </button>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label="Eliminar HTML personalizado" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      {html ? (
        <div className="gmx-nv-marco" dangerouslySetInnerHTML={{ __html: vista }} />
      ) : (
        <div ref={vacio} className="gmx gmx-nv-marco gmx-nv-vacio" contentEditable={false}
          onClick={(e) => { if (editor.isEditable) setPanel({ tipo: 'codigo', ancla: e.currentTarget }); }}>
          <Icono nombre="codigo" tam={22} />
          <span>HTML personalizado</span>
          <span className="gmx-nota">Corre aislado: no ve tu sesión ni el resto de la página.</span>
        </div>
      )}

      {panel?.tipo === 'codigo' && (
        <EditorCodigo inicial={html} ancla={panel.ancla} onAplicar={(v) => updateAttributes({ html: v })} onCerrar={() => setPanel(null)} />
      )}
      {panel?.tipo === 'alto' && (
        <Flotante ancla={panel.ancla} onCerrar={() => setPanel(null)} etiqueta="Alto" ancho={160}>
          <MenuFilas etiqueta="Alto">
            {ALTOS_HTML_LIBRE.map((a) => (
              <FilaMenu key={a} nombre={a + ' px'} activo={alto === a ? true : undefined} onClick={() => { updateAttributes({ alto: a }); setPanel(null); }} />
            ))}
          </MenuFilas>
        </Flotante>
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
  const area = useRef<HTMLTextAreaElement | null>(null);
  const pendiente = useRef<string | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aplicarRef = useRef(onAplicar);
  useEffect(() => { aplicarRef.current = onAplicar; }, [onAplicar]);

  const vaciar = () => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    if (pendiente.current !== null) { aplicarRef.current(pendiente.current); pendiente.current = null; }
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
    <Flotante ancla={ancla} onCerrar={() => { vaciar(); onCerrar(); }} etiqueta="Editar código" ancho={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
        <span className="gmx-rotulo">HTML personalizado</span>
        <span className="gmx-nota">En la página publicada, el JavaScript no corre.</span>
        <textarea
          ref={area}
          className="gmx-campo gmx-codigo"
          spellCheck={false}
          value={texto}
          maxLength={TOPES.htmlLibre}
          placeholder="<div>…</div>"
          aria-label="Código HTML"
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span className="gmx-nota">{texto.length.toLocaleString('es')} / {TOPES.htmlLibre.toLocaleString('es')}</span>
          <button type="button" className="gmx-primario" onMouseDown={(e) => e.preventDefault()} onClick={() => { vaciar(); onCerrar(); }}>Listo</button>
        </div>
      </div>
    </Flotante>
  );
}
