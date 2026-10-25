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
//   · CADA ELEMENTO con el control que el editor ya tiene para su tipo (25/10/2026, Martín: «quiero que TODO sea editable,
//     cada botón, cada video, cada cosa que hay»; lib/editor-landing/diseno-elementos.ts): clic en el elemento y su botón
//     de la barrita, que se marca:
//       - imagen → «Imagen», el selector de siempre (subir, buscar, biblioteca);
//       - botón o enlace → «Enlace», el MISMO selector de destino del botón de un bloque (secciones, páginas, WhatsApp,
//         correo, pestaña nueva), no un campo suelto;
//       - video → «Video»: un `<video>`, el selector en modo video (el del bloque Video); un reproductor (Panda,
//         YouTube…), el panel «Pegar una URL» del bloque Insertar;
//       - ícono → «Ícono», el selector de íconos, con el tamaño y la clase del que estaba.
//   · Clic derecho: el MISMO menú de la sección, en el punto (el evento pasa en el iframe y se reenvía a la sección).
//   · «Código»: el HTML de la sección, para lo que no se toca a la vista.
//
// ⚠️ Lo que escribe esta vista NO recarga el iframe (se perdería el cursor): el documento se rearma sólo cuando
//    el `html` cambia por OTRO camino (deshacer, «Código», la IA). `emitido` guarda lo último que salió de acá.
// ⚠️ El alto se mide desde afuera (el iframe no corre scripts): al cargar, al escribir, al cargar una imagen y
//    con un sondeo liviano, porque las fuentes y los videos cambian el alto sin avisar.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, Flotante, Icono, SelectorDestino, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { SelectorIcono } from '../SelectorIcono';
import { PanelInsertar } from './InsertadoVista';
import { NODO, TOPES } from '@/lib/editor-landing/doc';
import { CLASE_LIBRE, documentoEditable } from '@/lib/editor-landing/html-editable';
import { srcVideo } from '@/lib/editor-landing/especificacion';
import { svgIcono } from '@/lib/editor-landing/iconos';
import { PIDE_ELEGIR, elementoEnPunto, tipoDeElemento, type TipoElemento } from '@/lib/editor-landing/diseno-elementos';
import { enlaceDeCalendly, fichaDeAgenda, fichaDeEmbed, srcdocDeFicha } from '@/lib/editor-landing/vista-embeds';

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
// `iframe` y `video` sin clic ADENTRO del editor: si no, el reproductor se traga el clic que los elige
// (diseno-elementos.ts los elige por su caja). En la página publicada se reproducen: esta hoja no se guarda.
// `.gm-libre` con `flow-root`: los márgenes de lo de adentro quedan ADENTRO, así su caja mide lo que ocupa la sección.
const CSS_DENTRO = 'body[contenteditable]{outline:none;caret-color:#2F6FED}[data-gmx-sel]{outline:2px solid #2F6FED!important;outline-offset:2px}iframe,video{pointer-events:none}.gm-libre{display:flow-root}';

/**
 * Lo que la página publicada arma con JavaScript y adentro del editor (un iframe SIN scripts) quedaría vacío, con su ficha
 * (vista-embeds.ts; 25/10/2026, Martín sobre la #36: «toda esta sección en blanco... no funciona bien el editor web»):
 * un reproductor muestra qué es y su enlace (su `srcdoc`), y una agenda vacía (`[data-calendly]`) lleva la ficha adentro.
 * Las dos son SÓLO del editor: `leer` las saca antes de guardar.
 */
function ponerFichas(d: Document) {
  d.querySelectorAll('iframe').forEach((f) => {
    f.setAttribute('srcdoc', srcdocDeFicha(fichaDeEmbed(f.getAttribute('src') ?? '')));
    f.setAttribute('data-gmx-vista', '');
  });
  d.querySelectorAll('[data-calendly]').forEach((el) => {
    el.querySelectorAll('[data-gmx-ui]').forEach((x) => x.remove());
    if (!el.children.length) el.insertAdjacentHTML('beforeend', fichaDeAgenda(el.getAttribute('data-calendly') ?? ''));
  });
}

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
  const [video, setVideo] = useState<{ ancla: HTMLElement; el: HTMLElement } | null>(null);
  const [icono, setIcono] = useState<{ ancla: HTMLElement; el: SVGElement } | null>(null);
  /** El tipo del elemento elegido: su botón de la barrita se marca. */
  const [tipo, setTipo] = useState<TipoElemento | null>(null);
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

  // ⚠️ EL ALTO ES EL DEL CONTENIDO, no el `scrollHeight` del documento (25/10/2026, Martín: «en muchas secciones hay como
  // una separación»). El `scrollHeight` de un documento nunca es menor que su ventana —el iframe mismo—, así que una
  // sección arrancaba en 320 px y no bajaba nunca: el encabezado de 65 px dejaba 255 px de gris abajo (medido en las 23
  // landings de MaKo), y una que se achicaba al cargar sus fuentes dejaba la diferencia. La raíz (`flow-root`) mide lo que
  // ocupa; su `scrollHeight` suma lo que se sale de ella.
  const medir = useCallback(() => {
    const r = raiz() as HTMLElement | null;
    if (!r) return;
    const caja = r.getBoundingClientRect();
    const h = Math.max(40, Math.ceil(Math.max(caja.bottom, caja.top + r.scrollHeight)));
    setAlto((a) => (Math.abs(a - h) > 1 ? h : a));
  }, []);

  /** El HTML de la sección como quedó, sin las marcas de esta vista. */
  const leer = (): string | null => {
    const r = raiz();
    if (!r) return null;
    const copia = r.cloneNode(true) as HTMLElement;
    copia.querySelectorAll('[data-gmx-sel]').forEach((el) => el.removeAttribute('data-gmx-sel'));
    // Las fichas del editor (ponerFichas) no se guardan: ni la de la agenda ni el `srcdoc` de un reproductor.
    copia.querySelectorAll('[data-gmx-ui]').forEach((el) => el.remove());
    copia.querySelectorAll('[data-gmx-vista]').forEach((el) => { el.removeAttribute('srcdoc'); el.removeAttribute('data-gmx-vista'); });
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
    ponerFichas(d);
    d.addEventListener('input', conRespiro);
    d.addEventListener('load', medir, true);
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); d.execCommand('insertLineBreak'); }
    });
    d.addEventListener('mousedown', (e) => {
      setActivo(true);
      marcarSeccion();
      if (elegido.current) elegido.current.removeAttribute('data-gmx-sel');
      elegido.current = elementoEnPunto(d, e.target as Element | null, e.clientX, e.clientY) as Element | null;
      if (elegido.current) elegido.current.setAttribute('data-gmx-sel', '');
      setTipo(tipoDeElemento(elegido.current));
    });
    // EL CLIC DERECHO (25/10/2026, Martín: «no funciona aún el click derecho en el editor web»). Medido en producción: el
    // evento llegaba al documento del iframe y no subía a la página, donde la sección (TarjetaVista) lo escucha. Se reenvía
    // al marco con el punto pasado a la página: abre el MISMO menú de la sección. Quedan con el menú del navegador lo
    // mismo que en un bloque: con Shift, y con texto elegido (copiar, pegar, el corrector).
    d.addEventListener('contextmenu', (e) => {
      if (e.shiftKey) return;
      const sel = d.getSelection();
      if (sel && !sel.isCollapsed) return;
      const m = marco.current;
      if (!m) return;
      const r = m.getBoundingClientRect();
      e.preventDefault();
      m.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + e.clientX, clientY: r.top + e.clientY }));
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

  /** El elemento elegido si es de ese tipo; si no, el aviso de qué elegir y null. */
  const elegidoDe = (t: TipoElemento): Element | null => {
    const el = elegido.current;
    if (el && el.isConnected && tipoDeElemento(el) === t) return el;
    ctx.avisar(PIDE_ELEGIR[t]);
    return null;
  };
  const cambiarImagen = async () => {
    const img = elegidoDe('imagen') as HTMLImageElement | null;
    if (!img) return;
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
    const a = elegidoDe('enlace') as HTMLAnchorElement | null;
    if (a) setEnlace({ ancla, a });
  };
  /** A dónde lleva un botón o enlace, con el selector del botón de un bloque (pestaña nueva incluida). */
  const ponerDestino = (a: HTMLAnchorElement, href: string | null, nueva: boolean) => {
    if (href) a.setAttribute('href', href); else a.removeAttribute('href');
    if (href && nueva) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    else { a.removeAttribute('target'); a.removeAttribute('rel'); }
    setEnlace(null);
    guardar();
  };
  /**
   * El video elegido: un `<video>` se cambia con el selector en modo video (subir o la biblioteca, como el bloque Video);
   * un reproductor (`iframe` de Panda, YouTube…), con el panel del bloque Insertar (pegar el enlace).
   */
  const cambiarVideo = async (ancla: HTMLElement) => {
    const el = elegidoDe('video');
    if (!el) return;
    if (el.tagName.toLowerCase() === 'iframe' || el.hasAttribute('data-calendly')) { setVideo({ ancla, el: el as HTMLElement }); return; }
    const url = await ctx.elegirImagen({ modo: 'video' });
    if (!url) return;
    if (!srcVideo(url)) { ctx.avisar('Video no válido'); return; }
    el.querySelectorAll('source').forEach((x) => x.remove());
    el.setAttribute('src', url);
    guardar();
    medir();
  };
  const abrirIcono = (ancla: HTMLElement) => {
    const el = elegidoDe('icono') as SVGElement | null;
    if (el) setIcono({ ancla, el });
  };
  /** El ícono nuevo en el lugar del que estaba, con su tamaño, su clase y su estilo (el color sale de `currentColor`). */
  const ponerIcono = (svg: SVGElement, nombre: string) => {
    const d = documento();
    if (!d || !svg.isConnected) { setIcono(null); return; }
    const caja = svg.getBoundingClientRect();
    const plantilla = d.createElement('template');
    plantilla.innerHTML = svgIcono(nombre, Math.round(caja.width) || 24, svg.getAttribute('class') ?? undefined);
    const nuevo = plantilla.content.firstElementChild;
    if (!nuevo) return;
    for (const at of ['style', 'width', 'height', 'aria-hidden', 'aria-label', 'role']) {
      const v = svg.getAttribute(at);
      if (v !== null) nuevo.setAttribute(at, v);
    }
    svg.replaceWith(nuevo);
    elegido.current = nuevo;
    nuevo.setAttribute('data-gmx-sel', '');
    setIcono(null);
    guardar();
  };
  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar);
  };

  const abierto = !!codigo || !!enlace || !!video || !!icono;
  const mostrarBarra = editable && (activo || abierto);
  /** Un botón de la barrita: sólo el ícono (la barra cabe entre los controles de la sección) y su nombre en el tooltip. */
  const boton = (nombre: string, ico: ReactNode, alClic: (ancla: HTMLElement) => void, marcado?: boolean) => (
    <button type="button" className="gmx-btn gma-tip" data-tip={nombre} aria-label={nombre} aria-pressed={marcado === undefined ? undefined : marcado}
      onMouseDown={(e) => e.preventDefault()} onClick={(e) => alClic(e.currentTarget)}>
      {ico}
    </button>
  );
  return (
    <NodeViewWrapper className="gmx-nv" data-activo={mostrarBarra ? 'si' : undefined}
      onMouseLeave={() => { if (!abierto) setActivo(false); }}>
      <EstilosG2 />
      <style href="gmx-editable" precedence="medium">{CSS_EDITABLE}</style>
      {mostrarBarra && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          {boton('Negrita', <Icono nombre="negrita" />, () => formato('bold'))}
          {boton('Cursiva', <Icono nombre="cursiva" />, () => formato('italic'))}
          <span className="gmx-nv-sep" />
          {boton('Imagen', <Icono nombre="imagen" />, () => void cambiarImagen(), tipo === 'imagen')}
          {boton('Enlace', <Icono nombre="enlace" />, abrirEnlace, tipo === 'enlace')}
          {boton('Video', <Icono nombre="video" />, (a) => void cambiarVideo(a), tipo === 'video')}
          {boton('Ícono', <Icono nombre="estrella" />, abrirIcono, tipo === 'icono')}
          <span className="gmx-nv-sep" />
          {boton('Código', <Icono nombre="codigo" />, (el) => { guardar(); setCodigo((p) => (p ? null : { ancla: el })); })}
          {boton('Eliminar sección', <IconoBorrar size={16} />, eliminar)}
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
        <Flotante ancla={enlace.ancla} onCerrar={() => setEnlace(null)} etiqueta="Enlace" ancho={340}>
          <SelectorDestino valor={enlace.a.getAttribute('href')} nuevaPestana={enlace.a.getAttribute('target') === '_blank'}
            onElegir={(href, nueva) => ponerDestino(enlace.a, href, nueva)}
            onQuitar={enlace.a.getAttribute('href') ? () => ponerDestino(enlace.a, null, false) : undefined} />
        </Flotante>
      )}
      {video && (
        <Flotante ancla={video.ancla} onCerrar={() => setVideo(null)} etiqueta="Video" ancho={360}>
          <PanelInsertar inicial={video.el.getAttribute('data-calendly') ?? video.el.getAttribute('src') ?? ''} onInsertar={(e) => {
            const el = video.el;
            if (el.isConnected && el.hasAttribute('data-calendly')) {
              const url = enlaceDeCalendly(e.src);
              if (!url) { ctx.avisar('Pega un enlace de Calendly'); return; }
              el.setAttribute('data-calendly', url);
            } else if (el.isConnected) el.setAttribute('src', e.src);
            const d = documento();
            if (d) ponerFichas(d);
            setVideo(null);
            guardar();
            medir();
          }} />
        </Flotante>
      )}
      {icono && (
        <SelectorIcono ancla={icono.ancla} valor={null} onElegir={(n) => ponerIcono(icono.el, n)} onCerrar={() => setIcono(null)} />
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
