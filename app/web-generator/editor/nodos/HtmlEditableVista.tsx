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
//     lo elegido, desde la barrita; y TODA la barra «Texto» de arriba (26/10/2026: estaba gris), por ../puente-diseno.ts.
//   · CADA ELEMENTO con el control que el editor ya tiene para su tipo (25/10/2026, Martín: «quiero que TODO sea editable,
//     cada botón, cada video, cada cosa que hay»; lib/editor-landing/diseno-elementos.ts): clic en el elemento y su botón
//     de la barrita, que se marca:
//       - imagen → «Imagen», el selector de siempre (subir, buscar, biblioteca);
//       - enlace → «Enlace», el MISMO selector de destino del botón de un bloque; y si se ve como un BOTÓN, «Botón»
//         (26/10/2026, Martín: «Los botones tampoco son editables»): su texto, a dónde lleva y sus colores;
//       - video → «Video»: un `<video>`, el selector en modo video (el del bloque Video); un reproductor (Panda,
//         YouTube…), el panel «Pegar una URL» del bloque Insertar;
//       - ícono → «Ícono», el selector de íconos, con el tamaño y la clase del que estaba.
//   · Clic derecho: el MISMO menú de la sección, en el punto (el evento pasa en el iframe y se reenvía a la sección).
//   · «Código»: el HTML de la sección, para lo que no se toca a la vista.
//
// LO QUE LA PUBLICADA ARMA CON SCRIPTS, A LA VISTA (26/10/2026, Martín: «El video no se muestra», «El Calendly embed no
// aparece», «La animación... de MaKo no aparece»). Adentro de un iframe sin scripts no corren, ni los de un iframe de
// adentro (el sandbox se hereda). Por eso, desde afuera: cada reproductor y cada agenda va REAL en una capa encima de
// su lugar (`vivos`: no recibe el mouse hasta que se elige, y el segundo clic ya es del reproductor), y la red de MaKo
// en un canvas de esta página encima del suyo (../red-de-mako.ts: lo que se pinta en el canvas del iframe NO se ve).
//
// ⚠️ Lo que escribe esta vista NO recarga el iframe (se perdería el cursor): el documento se rearma sólo cuando
//    el `html` cambia por OTRO camino (deshacer, «Código», la IA). `emitido` guarda lo último que salió de acá.
// ⚠️ El alto se mide desde afuera (el iframe no corre scripts): al cargar, al escribir, al cargar una imagen y
//    con un sondeo liviano, porque las fuentes y los videos cambian el alto sin avisar.
// ⚠️ UN CLIC ADENTRO NO LLEGA A LA PÁGINA (26/10/2026, Martín: «si le doy click derecho y luego doy click izquierdo en
//    otro lado, debe desaparecer el desplegable»): los menús y paneles se cierran con un `pointerdown` en el documento
//    de la página, y el de adentro del iframe es de OTRO documento. Se reenvía al marco, como el clic derecho.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, Flotante, Icono, SelectorDestino, VAR_COLOR, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { SelectorIcono } from '../SelectorIcono';
import { PanelInsertar } from './InsertadoVista';
import { PanelContenidoDiseno } from './PanelContenidoDiseno';
import { COLORES_TEMA, NODO, TOPES, esHex } from '@/lib/editor-landing/doc';
import { ANCHO_COPIA_ESCRITORIO, ATTR_RAIZ_EDITABLE, CLASE_LIBRE, documentoEditable, envoltoriosValidos, escalaDeCopia } from '@/lib/editor-landing/html-editable';
import { srcVideo } from '@/lib/editor-landing/especificacion';
import { svgIcono } from '@/lib/editor-landing/iconos';
import { varsDeTema } from '@/lib/editor-landing/temas';
import { PIDE_ELEGIR, elementoEnPunto, tipoDeElemento, type TipoElemento } from '@/lib/editor-landing/diseno-elementos';
import { enlaceDeCalendly, fichaDeAgenda, fichaDeEmbed, srcdocDeFicha } from '@/lib/editor-landing/vista-embeds';
import { ALLOW_EMBED, REFERRER_EMBED, SANDBOX_EMBED, embedDe } from '@/lib/embeds';
import { activarDiseno, avisarDiseno, disenoActivo, soltarDiseno, useDisenoActivo } from '../puente-diseno';
import { animarRedDeMako } from '../red-de-mako';
import { colorDeBoton, conMarcas, esBotonDeDiseno, ponerColorDeBoton, ponerTextoDeBoton, textoDeBoton } from '../botones-diseno';
import {
  agregarElemento, capaEncima, comoEnlace, deAfuera, duplicarElemento, fotoDeEstilo, fuentesDeLaPagina, igualarEstilo, imagenDeFondo, limpiarParaCambiar,
  moverElemento, nombreDeElemento, nuevaImagen, nuevoBoton, nuevoTexto, ponerColor, ponerFuente, ponerImagenDeFondo, quitarElemento,
  type ElementoDiseno,
} from '@/lib/editor-landing/diseno-elemento-acciones';

/** Un elemento del DOM del iframe, visto por las acciones de cualquier elemento (que no conocen el DOM real). */
const comoDiseno = (el: Element): ElementoDiseno => el as unknown as ElementoDiseno;

const RESPIRO_MS = 500;
const SONDEO_MS = 800;

/**
 * El iframe del diseño SIEMPRE recibe el clic (25/10/2026, Martín: «Las landing de MaKo NO son editables, no puedo ni
 * cambiar un título»). BarraFormato apaga los iframes de un bloque que no está activo (`.gmx-nv:not([data-activo="si"])
 * iframe{pointer-events:none}`, del 11/10: que un video o un embed no se trague el clic que elige el bloque). Pero esta
 * sección se activa con el `mousedown` de ADENTRO del iframe, y con esa regla el clic nunca llegaba: ni cursor, ni
 * sección activa, ni barra. Medido con clics en el editor real (#32): el clic caía en el envoltorio. Esta regla le gana
 * por especificidad, no por orden (las dos van en `<style>` distintos): lo vigila tests/editor-web-diseno-editable-clic.test.ts.
 *
 * La barrita va en un ancla PEGADA arriba de lo que se ve (`sticky`, alto 0: no mueve nada), así en una sección de
 * 2.000 px no se queda arriba, fuera de la pantalla, mientras se edita lo de abajo. Las capas vivas (`gmx-vivo`) van
 * encima del iframe, en su lugar.
 */
export const CSS_EDITABLE: string = [
  '.gmx-editable-vivo{position:relative}',
  '.gmx-editable-vivo iframe{display:block;width:100%;border:0;background:transparent}',
  '.gmx-nv .gmx-nv-marco.gmx-editable-vivo>iframe{pointer-events:auto}',
  '.gmx-nv-ancla{position:sticky;top:56px;height:0;z-index:6}',
  '.gmx-editable-vivo>iframe.gmx-vivo{position:absolute;display:block;border:0;border-radius:12px;background:#000;z-index:2}',
  '.gmx-editable-vivo>canvas.gmx-vivo-red{position:absolute;display:block;pointer-events:none;z-index:2}',
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
 * Las dos son SÓLO del editor: `leer` las saca antes de guardar. Encima va la capa viva (`vivos`), si se reconoce.
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

/**
 * Un reproductor o una agenda REAL (`embed`), o el lienzo de la red de MaKo (`red`, ../red-de-mako.ts: lo que se pinta en
 * el canvas del iframe no se ve), encima de su lugar en el diseño.
 */
type Vivo = { clave: string; tipo: 'embed' | 'red'; src: string; titulo: string; x: number; y: number; w: number; h: number; el: Element };

/** Lo vivo del documento, con su lugar (en px del iframe, que es el del marco). */
function vivosDe(d: Document): Vivo[] {
  const out: Vivo[] = [];
  // Recortado a la caja del iframe (verificación de 5004dba08, 28/10/2026): una agenda de una página copiada con
  // `position:fixed` y 12.000 px se dibujaba en la app encima de TODO el lienzo, y los clics iban a la agenda.
  const recortarALaCaja = (r: DOMRect) => {
    const ancho = d.documentElement.clientWidth;
    const alto = d.documentElement.clientHeight;
    const x = Math.max(0, r.left);
    const y = Math.max(0, r.top);
    return { x, y, w: Math.min(ancho, r.right) - x, h: Math.min(alto, r.bottom) - y };
  };
  const lugar = (el: Element) => {
    const r = recortarALaCaja(el.getBoundingClientRect());
    return r.w < 8 || r.h < 8 ? null : { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
  };
  const sumar = (el: Element, texto: string, i: number) => {
    const e = embedDe(texto);
    const l = e ? lugar(el) : null;
    if (e && l) out.push({ clave: `${i}:${e.src}`, tipo: 'embed', src: e.src, titulo: e.proveedor || 'Insertado', ...l, el });
  };
  d.querySelectorAll('iframe[data-gmx-vista]').forEach((f, i) => sumar(f, f.getAttribute('src') ?? '', i));
  d.querySelectorAll('[data-calendly]').forEach((el, i) => sumar(el, el.getAttribute('data-calendly') ?? '', 1000 + i));
  d.querySelectorAll('canvas[data-animacion="mako-red"]').forEach((el, i) => {
    const l = lugar(el);
    if (l) out.push({ clave: `red:${i}`, tipo: 'red', src: '', titulo: 'La red de MaKo', ...l, el });
  });
  return out;
}
const mismosVivos = (a: Vivo[], b: Vivo[]) =>
  a.length === b.length && a.every((v, i) => v.clave === b[i].clave && v.x === b[i].x && v.y === b[i].y && v.w === b[i].w && v.h === b[i].h && v.el === b[i].el);

export function HtmlEditableVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, updateAttributes } = props;
  const ctx = useEditorLanding();
  const html = typeof node.attrs.html === 'string' ? node.attrs.html : '';
  const css = ctx.config.diseno?.css ?? '';
  // La copia de una página (copia-identica.ts): sin la base de Tailwind, y la sección adentro de sus envoltorios.
  const sinBase = ctx.config.diseno?.sinBase === true;
  const envoltorios = envoltoriosValidos(node.attrs.envoltorios);
  const claveEnv = envoltorios ? envoltorios.join('') : '';
  const marco = useRef<HTMLIFrameElement | null>(null);
  /** La caja del iframe (su ancho es el del lienzo: de ahí sale la escala de una copia). */
  const cajaMarco = useRef<HTMLDivElement | null>(null);
  // UNA COPIA, A ANCHO DE ESCRITORIO (29/10/2026, Martín: «las páginas clonadas se desfasaron todas»). Dibujada al ancho del
  // lienzo (~980 px) sus media queries elegían el diseño de tableta: se dibuja a ANCHO_COPIA_ESCRITORIO y se achica
  // (`escalaDeCopia`). El clic, el cursor y la selección los lleva el navegador a través del `transform`; lo que esta vista
  // pasa entre el iframe y la página (el clic reenviado, las capas vivas) va multiplicado por la escala.
  const [escala, setEscala] = useState(1);
  const escalaVivo = useRef(1);
  escalaVivo.current = escala;
  const emitido = useRef<string>(html);
  const [fuente, setFuente] = useState(html);
  const [alto, setAlto] = useState(320);
  const [codigo, setCodigo] = useState<{ ancla: HTMLElement } | null>(null);
  const [enlace, setEnlace] = useState<{ ancla: HTMLElement; a: HTMLAnchorElement } | null>(null);
  const [panelBoton, setPanelBoton] = useState<{ ancla: HTMLElement; a: HTMLAnchorElement } | null>(null);
  const [video, setVideo] = useState<{ ancla: HTMLElement; el: HTMLElement } | null>(null);
  const [icono, setIcono] = useState<{ ancla: HTMLElement; el: SVGElement } | null>(null);
  /** «Elemento» (28/10/2026, la réplica editable): el panel de CUALQUIER elemento elegido. */
  const [panelElemento, setPanelElemento] = useState<{ ancla: HTMLElement } | null>(null);
  /** «Contenido» (28/10/2026): la lista de TODO lo de la sección, también lo oculto y lo tapado (PanelContenidoDiseno.tsx). */
  const [panelContenido, setPanelContenido] = useState<{ ancla: HTMLElement } | null>(null);
  /** Sube con cada cambio del panel «Elemento»: lo vuelve a dibujar con lo que quedó. */
  const [, setVuelta] = useState(0);
  /** El tipo del elemento elegido: su botón de la barrita se marca. */
  const [tipo, setTipo] = useState<TipoElemento | null>(null);
  /** El enlace elegido se ve como un botón (la barrita ofrece «Botón»). */
  const [esBoton, setEsBoton] = useState(false);
  const [vivos, setVivos] = useState<Vivo[]>([]);
  const [elegidoEl, setElegidoEl] = useState<Element | null>(null);
  const elegido = useRef<Element | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** El documento que se cargó por última vez (el que se suelta del puente al irse). */
  const docRef = useRef<Document | null>(null);
  const editable = editor.isEditable;
  // Lo que leen las escuchas del iframe, que se ponen UNA vez al cargar: siempre lo último.
  const vivo = useRef({ ctx, editor, getPos });
  vivo.current = { ctx, editor, getPos };
  // ¿Este diseño es el que tiene el cursor? (la barrita se ve mientras lo sea: ../puente-diseno.ts)
  const { diseno: activoEnPuente } = useDisenoActivo();
  const esActivo = !!activoEnPuente && !!docRef.current && activoEnPuente.doc === docRef.current;

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
  const doc = useMemo(() => documentoEditable(fuente, css, { envoltorios, sinBase }), [fuente, css, claveEnv, sinBase]); // eslint-disable-line react-hooks/exhaustive-deps

  const documento = () => marco.current?.contentDocument ?? null;
  // Lo que se edita y se guarda: adentro de los envoltorios de una copia (los de afuera no son de la sección).
  const raiz = () => documento()?.querySelector('[' + ATTR_RAIZ_EDITABLE + ']') ?? documento()?.querySelector('.' + CLASE_LIBRE) ?? null;
  /** La caja entera que se ve (con los envoltorios): su alto es el del iframe. */
  const cajaLibre = () => documento()?.querySelector('.' + CLASE_LIBRE) ?? null;

  /** Elige un elemento: lo marca, y la barrita marca el control de su tipo (o sólo «Elemento», si no tiene uno propio). */
  const elegir = (el: Element | null) => {
    if (elegido.current && elegido.current !== el) elegido.current.removeAttribute('data-gmx-sel');
    elegido.current = el;
    if (el) el.setAttribute('data-gmx-sel', '');
    const t = tipoDeElemento(el);
    setTipo(t);
    setEsBoton(t === 'enlace' && !!el && esBotonDeDiseno(el));
    setElegidoEl(el);
  };
  // Las escuchas del iframe se ponen UNA vez al cargar: leen esto, que es siempre lo último.
  const elegirVivo = useRef(elegir);
  elegirVivo.current = elegir;
  const raizVivo = useRef(raiz);
  raizVivo.current = raiz;

  // Las capas vivas, con su lugar de ahora (se mueven si el diseño cambia de alto o de ancho).
  const medirVivos = useCallback(() => {
    const d = documento();
    if (!d) return;
    const lista = vivosDe(d);
    setVivos((prev) => (mismosVivos(prev, lista) ? prev : lista));
  }, []);

  // ⚠️ EL ALTO ES EL DEL CONTENIDO, no el `scrollHeight` del documento (25/10/2026, Martín: «en muchas secciones hay como
  // una separación»). El `scrollHeight` de un documento nunca es menor que su ventana —el iframe mismo—, así que una
  // sección arrancaba en 320 px y no bajaba nunca: el encabezado de 65 px dejaba 255 px de gris abajo (medido en las 23
  // landings de MaKo), y una que se achicaba al cargar sus fuentes dejaba la diferencia. La raíz (`flow-root`) mide lo que
  // ocupa; su `scrollHeight` suma lo que se sale de ella.
  const medir = useCallback(() => {
    const r = cajaLibre() as HTMLElement | null;
    if (!r) return;
    const caja = r.getBoundingClientRect();
    const h = Math.max(40, Math.ceil(Math.max(caja.bottom, caja.top + r.scrollHeight)));
    setAlto((a) => (Math.abs(a - h) > 1 ? h : a));
    medirVivos();
  }, [medirVivos]);

  /** El HTML de la sección como quedó, sin las marcas de esta vista. */
  const leer = (): string | null => {
    const r = raiz();
    if (!r) return null;
    const copia = r.cloneNode(true) as HTMLElement;
    copia.querySelectorAll('[data-gmx-sel]').forEach((el) => el.removeAttribute('data-gmx-sel'));
    // Las fichas del editor (ponerFichas) no se guardan: ni la de la agenda ni el `srcdoc` de un reproductor.
    copia.querySelectorAll('[data-gmx-ui]').forEach((el) => el.remove());
    copia.querySelectorAll('[data-gmx-vista]').forEach((el) => { el.removeAttribute('srcdoc'); el.removeAttribute('data-gmx-vista'); });
    // El tamaño en px que le puso el dibujo de la red de MaKo (../red-de-mako.ts) no es del diseño.
    copia.querySelectorAll('canvas[data-animacion]').forEach((el) => { el.removeAttribute('width'); el.removeAttribute('height'); });
    return copia.innerHTML;
  };
  /**
   * Los envoltorios con la RAÍZ como está ahora (28/10/2026): en una copia, la raíz de la sección es el envoltorio de más
   * adentro, y su HTML no está en `html` (que es lo de ADENTRO). Sin esto, el fondo o el color que se le ponía a «la
   * sección» desde «Elemento» se perdía al guardar. null = sin envoltorios, o igual que antes.
   */
  const envVivo = useRef(envoltorios);
  envVivo.current = envoltorios;
  const envoltoriosDeAhora = (): string[] | null => {
    const env = envVivo.current;
    const r = raiz();
    if (!env?.length || !r || !r.hasAttribute(ATTR_RAIZ_EDITABLE)) return null;
    const sola = r.cloneNode(false) as HTMLElement;
    sola.removeAttribute(ATTR_RAIZ_EDITABLE);
    sola.removeAttribute('data-gmx-sel');
    const entera = sola.outerHTML;
    const abre = entera.slice(0, entera.lastIndexOf('</'));
    const nuevos = envoltoriosValidos([...env.slice(0, -1), abre]);
    return nuevos && nuevos.join('') !== env.join('') ? nuevos : null;
  };
  const guardar = useCallback(() => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    const v = leer();
    if (v === null) return;
    const env = envoltoriosDeAhora();
    if (v === emitido.current && !env) return;
    if (v.length > TOPES.htmlEditable) { ctx.avisar('Sección muy grande'); return; }
    emitido.current = v;
    updateAttributes(env ? { html: v, envoltorios: env } : { html: v });
  }, [ctx, updateAttributes]); // eslint-disable-line react-hooks/exhaustive-deps
  const guardarVivo = useRef(guardar);
  guardarVivo.current = guardar;
  const conRespiro = useCallback(() => {
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = setTimeout(guardar, RESPIRO_MS);
    medir();
  }, [guardar, medir]);
  // Al irse: guarda, para la red y suelta el puente si este diseño era el activo.
  useEffect(() => () => { guardar(); soltarDiseno(docRef.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // La red de MaKo: mientras el diseño tenga una, se pintan sus canvas de esta página (../red-de-mako.ts).
  const conRed = vivos.some((v) => v.tipo === 'red');
  useEffect(() => {
    if (!conRed) return;
    // Los canvas de la red están en el marco, al lado del iframe.
    return animarRedDeMako(() => Array.from(marco.current?.parentElement?.querySelectorAll<HTMLCanvasElement>('canvas.gmx-vivo-red') ?? []));
  }, [conRed]);
  // El cursor volvió a un bloque de ProseMirror: este diseño deja de ser el activo (y su barrita se va).
  useEffect(() => {
    const volver = () => soltarDiseno(docRef.current);
    editor.on('focus', volver);
    return () => { editor.off('focus', volver); };
  }, [editor]);

  // Al cargar el documento: editable, sus escuchas y el alto.
  const alCargar = () => {
    const d = documento();
    if (!d) return;
    if (docRef.current && docRef.current !== d) soltarDiseno(docRef.current);
    docRef.current = d;
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
    // El clic de adentro, a la página: cierra los menús y paneles abiertos (ver la cabecera).
    d.addEventListener('pointerdown', (e) => {
      const m = marco.current;
      if (!m) return;
      const r = m.getBoundingClientRect();
      const k = escalaVivo.current;
      m.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, composed: true, clientX: r.left + e.clientX * k, clientY: r.top + e.clientY * k,
        button: e.button, buttons: e.buttons, pointerType: e.pointerType || 'mouse', isPrimary: true,
      }));
    });
    d.addEventListener('mousedown', (e) => {
      activarDiseno({ doc: d, guardar: () => guardarVivo.current() });
      marcarSeccion();
      // Lo que tiene control propio (un enlace, una imagen, un video, un ícono); si no, el elemento tocado (un título, una
      // caja, un texto): CUALQUIER cosa se elige, para el panel «Elemento» (28/10/2026). Fuera de la sección (los envoltorios
      // de una copia, el fondo del iframe), la sección misma.
      const tocado = e.target as Element | null;
      const r = raizVivo.current();
      const conControl = elementoEnPunto(d, tocado, e.clientX, e.clientY) as Element | null;
      elegirVivo.current(conControl ?? (tocado && r && r.contains(tocado) ? tocado : r));
    });
    // La barra «Texto» de arriba lee la selección de ACÁ (../puente-diseno.ts).
    d.addEventListener('selectionchange', () => { if (disenoActivo()?.doc === d) avisarDiseno(); });
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
      const k = escalaVivo.current;
      e.preventDefault();
      m.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + e.clientX * k, clientY: r.top + e.clientY * k }));
    });
    // Un enlace en un contentEditable no navega; sin editar, tampoco: esto es el editor.
    d.addEventListener('click', (e) => { if ((e.target as Element | null)?.closest?.('a')) e.preventDefault(); });
    d.defaultView?.addEventListener('blur', () => guardar());
    medir();
  };

  // Sondeo liviano del alto (fuentes, videos e imágenes que cambian el alto sin avisar) y del lugar de las capas vivas.
  useEffect(() => {
    const id = setInterval(medir, SONDEO_MS);
    return () => clearInterval(id);
  }, [medir]);
  // La escala de una copia: el ancho del lienzo y su aparato (escritorio, tableta, celular), cada vez que cambian.
  useEffect(() => {
    const caja = cajaMarco.current;
    if (!caja || !sinBase || typeof ResizeObserver === 'undefined') { setEscala(1); return; }
    const calcular = () => setEscala(escalaDeCopia(caja.clientWidth, caja.closest('.gma-lienzo')?.getAttribute('data-dispositivo') ?? null));
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(caja);
    return () => ro.disconnect();
  }, [sinBase]);

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
    // Sin `srcset`, la carga perezosa ni los `<source>` de su `<picture>`: cualquiera le gana al `src` y se seguía viendo la de
    // antes (las copias idénticas traen todo eso de la página original).
    limpiarParaCambiar(comoDiseno(img));
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
    avisarDiseno();
  };
  const abrirEnlace = (ancla: HTMLElement) => {
    const a = elegidoDe('enlace') as HTMLAnchorElement | null;
    if (!a) return;
    if (esBotonDeDiseno(a)) setPanelBoton({ ancla, a }); else setEnlace({ ancla, a });
  };
  /**
   * A dónde lleva un botón o enlace, con el selector del botón de un bloque (pestaña nueva incluida). Un `<button>` de la
   * página pasa a ser un `<a>` con lo suyo (28/10/2026): un `<button>` no puede llevar a ningún lado.
   */
  const ponerDestino = (el: HTMLAnchorElement, href: string | null, nueva: boolean) => {
    const win = el.ownerDocument.defaultView;
    const antes = win ? fotoDeEstilo(win.getComputedStyle(el)) : null;
    const a = (comoEnlace(comoDiseno(el)) as unknown as HTMLAnchorElement | null) ?? el;
    // El `<a>` nuevo se ve IGUAL que el botón: lo que la hoja le daba por ser `<button>` pasa a su `style`.
    if (a !== el && antes && win) igualarEstilo(comoDiseno(a), antes, fotoDeEstilo(win.getComputedStyle(a)));
    if (a !== el) elegir(a);
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
  // ── «Elemento» (28/10/2026, Martín: «Debe ser todo editable»): cualquier elemento, con lo que la persona espera de un
  //    editor de páginas (diseno-elemento-acciones.ts). Sin elegir nada, actúa sobre la sección.
  const elementoActual = (): Element | null => {
    const el = elegido.current;
    return el && el.isConnected ? el : raiz();
  };
  const despuesDeCambiar = () => { guardar(); medir(); setVuelta((v) => v + 1); };
  const accionElemento = (que: 'afuera' | 'duplicar' | 'antes' | 'despues' | 'quitar') => {
    const el = elementoActual();
    const r = raiz();
    if (!el || !r) return;
    if (que === 'afuera') {
      const p = deAfuera(comoDiseno(el), comoDiseno(r));
      if (p) elegir(p as unknown as Element);
      setVuelta((v) => v + 1);
      return;
    }
    if (que === 'duplicar') elegir(duplicarElemento(comoDiseno(el)) as unknown as Element);
    else if (que === 'antes' || que === 'despues') {
      if (!moverElemento(comoDiseno(el), que)) { ctx.avisar(que === 'antes' ? 'Ya es el primero' : 'Ya es el último'); return; }
    } else if (!quitarElemento(comoDiseno(el), comoDiseno(r))) {
      ctx.avisar('La sección entera se quita con «Eliminar sección»');
      return;
    } else elegir(null);
    despuesDeCambiar();
  };
  const colorElemento = (cual: 'texto' | 'fondo', v: string | null) => {
    const el = elementoActual();
    if (!el || !ponerColor(comoDiseno(el), cual, v)) return;
    despuesDeCambiar();
  };
  const fuenteElemento = (f: string | null) => {
    const el = elementoActual();
    if (!el || !ponerFuente(comoDiseno(el), f)) return;
    despuesDeCambiar();
  };
  const fondoImagenElemento = async (que: 'cambiar' | 'quitar') => {
    const el = elementoActual();
    if (!el) return;
    if (que === 'quitar') { ponerImagenDeFondo(comoDiseno(el), null); despuesDeCambiar(); return; }
    const url = await ctx.elegirImagen();
    if (!url || !el.isConnected) return;
    const cs = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (!ponerImagenDeFondo(comoDiseno(el), url, { size: cs?.backgroundSize ?? '', position: cs?.backgroundPosition ?? '' })) { ctx.avisar('Imagen no válida'); return; }
    despuesDeCambiar();
    // Quedó puesta; si una capa de la página la tapa, se dice (si no, se lee como que no hizo nada).
    const win = el.ownerDocument.defaultView;
    if (win && capaEncima([win.getComputedStyle(el, '::before'), win.getComputedStyle(el, '::after')])) ctx.avisar('Una capa de la página la tapa');
  };

  /** Un texto, un botón o una imagen NUEVOS debajo del elegido (o al final de la sección): «elementos sueltos». */
  const agregarNuevo = async (que: 'texto' | 'boton' | 'imagen') => {
    const el = elementoActual();
    const r = raiz();
    const d = documento();
    if (!el || !r || !d) return;
    let nuevo: ElementoDiseno;
    if (que === 'imagen') {
      const url = await ctx.elegirImagen();
      if (!url || !el.isConnected) return;
      nuevo = nuevaImagen(d as unknown as ElementoDiseno['ownerDocument'], url);
    } else if (que === 'boton') nuevo = nuevoBoton(d as unknown as ElementoDiseno['ownerDocument'], comoDiseno(r));
    else nuevo = nuevoTexto(d as unknown as ElementoDiseno['ownerDocument']);
    agregarElemento(comoDiseno(el), comoDiseno(r), nuevo);
    const nodo = nuevo as unknown as Element;
    elegir(nodo);
    // Un texto nuevo queda elegido para escribir encima; un botón, con su panel para decir a dónde lleva.
    if (que === 'texto') { d.getSelection()?.selectAllChildren(nodo); (d.body as HTMLElement).focus(); }
    despuesDeCambiar();
  };

  // ── «Contenido»: lo que se cambia desde la lista va por los MISMOS caminos que con el elemento elegido.
  const quitarDeLista = (el: Element) => {
    const r = raiz();
    if (!r || !quitarElemento(comoDiseno(el), comoDiseno(r))) return;
    if (elegido.current && !elegido.current.isConnected) elegir(null);
    despuesDeCambiar();
  };
  const destinoDeLista = (el: Element) => {
    const ancla = panelContenido?.ancla;
    elegir(el);
    setPanelContenido(null);
    if (ancla) abrirEnlace(ancla);
  };
  const verDeLista = (el: Element) => {
    elegir(el);
    (el as HTMLElement).scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  };

  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar);
  };
  /** Los colores del tema, por su valor (adentro del diseño no están sus variables). */
  const coloresDelTema = useMemo(() => {
    const vars = varsDeTema(ctx.tema) as Record<string, string>;
    return COLORES_TEMA.map((c) => vars[VAR_COLOR[c]]).filter((v): v is string => !!v);
  }, [ctx.tema]);

  const abierto = !!codigo || !!enlace || !!panelBoton || !!video || !!icono || !!panelElemento || !!panelContenido;
  const mostrarBarra = editable && (esActivo || abierto);
  /** Un botón de la barrita: sólo el ícono (la barra cabe entre los controles de la sección) y su nombre en el tooltip. */
  const boton = (nombre: string, ico: ReactNode, alClic: (ancla: HTMLElement) => void, marcado?: boolean, texto?: string) => (
    <button type="button" className="gmx-btn gma-tip" data-tip={nombre} aria-label={nombre} aria-pressed={marcado === undefined ? undefined : marcado}
      style={texto ? { width: 'auto', padding: '0 8px', gap: 6, fontWeight: 600 } : undefined}
      onMouseDown={(e) => e.preventDefault()} onClick={(e) => alClic(e.currentTarget)}>
      {ico}{texto && <span>{texto}</span>}
    </button>
  );
  return (
    <NodeViewWrapper className="gmx-nv" data-activo={mostrarBarra ? 'si' : undefined}>
      <EstilosG2 />
      <style href="gmx-editable" precedence="medium">{CSS_EDITABLE}</style>
      <div className="gmx-nv-ancla" contentEditable={false}>
        {mostrarBarra && (
          <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
            {boton('Negrita', <Icono nombre="negrita" />, () => formato('bold'))}
            {boton('Cursiva', <Icono nombre="cursiva" />, () => formato('italic'))}
            <span className="gmx-nv-sep" />
            {boton('Imagen', <Icono nombre="imagen" />, () => void cambiarImagen(), tipo === 'imagen')}
            {/* Un enlace que se ve como un botón: «Botón», con su nombre a la vista (su texto, destino y colores). */}
            {esBoton && boton('Botón', <Icono nombre="enlace" />, abrirEnlace, true, 'Botón')}
            {boton('Enlace', <Icono nombre="enlace" />, abrirEnlace, tipo === 'enlace')}
            {boton('Video', <Icono nombre="video" />, (a) => void cambiarVideo(a), tipo === 'video')}
            {boton('Ícono', <Icono nombre="estrella" />, abrirIcono, tipo === 'icono')}
            {/* CUALQUIER elemento (o la sección): quitar, duplicar, mover, colores, fondo y fuente; y elegir el de afuera. */}
            {boton('Elemento', <Icono nombre="capas" />, (el) => setPanelElemento((p) => (p ? null : { ancla: el })), !!panelElemento, 'Elemento')}
            {/* TODO lo de la sección en una lista: también lo que la copia dejó oculto (respuestas, menús, pestañas) o tapado. */}
            {boton('Contenido', <Icono nombre="lista" />, (el) => { guardar(); setPanelContenido((p) => (p ? null : { ancla: el })); }, !!panelContenido, 'Contenido')}
            <span className="gmx-nv-sep" />
            {boton('Código', <Icono nombre="codigo" />, (el) => { guardar(); setCodigo((p) => (p ? null : { ancla: el })); })}
            {boton('Eliminar sección', <IconoBorrar size={16} />, eliminar)}
          </div>
        )}
      </div>
      <div ref={cajaMarco} className="gmx-nv-marco gmx-editable-vivo gm-editable" contentEditable={false}
        style={escala < 1 ? { height: Math.ceil(alto * escala) + 'px', overflow: 'hidden' } : undefined}>
        <iframe ref={marco} sandbox="allow-same-origin" srcDoc={doc} title="Diseño editable" referrerPolicy="no-referrer"
          onLoad={alCargar} style={escala < 1
            ? { width: ANCHO_COPIA_ESCRITORIO + 'px', height: alto + 'px', transform: `scale(${escala})`, transformOrigin: '0 0' }
            : { height: alto + 'px' }} />
        {/* Los reproductores y las agendas, REALES, encima de su lugar. Sin el mouse hasta que se eligen. La red de MaKo, un
            canvas de esta página que se pinta (el del iframe no se ve). */}
        {vivos.map((v) => v.tipo === 'red' ? (
          <canvas key={v.clave} className="gmx-vivo-red" aria-hidden="true" style={{ left: v.x * escala, top: v.y * escala, width: v.w * escala, height: v.h * escala }} />
        ) : (
          <iframe key={v.clave} className="gmx-vivo" src={v.src} title={v.titulo} sandbox={SANDBOX_EMBED} allow={ALLOW_EMBED}
            referrerPolicy={REFERRER_EMBED} loading="lazy"
            style={{ left: v.x * escala, top: v.y * escala, width: v.w * escala, height: v.h * escala, pointerEvents: esActivo && !!elegidoEl && (elegidoEl === v.el || v.el.contains(elegidoEl)) ? 'auto' : 'none' }} />
        ))}
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
      {panelBoton && (
        <Flotante ancla={panelBoton.ancla} onCerrar={() => setPanelBoton(null)} etiqueta="Botón" ancho={340}>
          <PanelBoton a={panelBoton.a} colores={coloresDelTema} onCambio={() => { guardar(); medir(); }}
            onDestino={(href, nueva) => { ponerDestino(panelBoton.a, href, nueva); setPanelBoton(null); }} />
        </Flotante>
      )}
      {video && (
        <Flotante ancla={video.ancla} onCerrar={() => setVideo(null)} etiqueta="Video" ancho={360}>
          <PanelInsertar inicial={video.el.getAttribute('data-calendly') ?? video.el.getAttribute('src') ?? ''} conVideos={!video.el.hasAttribute('data-calendly')} onInsertar={(e) => {
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
      {panelElemento && elementoActual() && raiz() && (
        <Flotante ancla={panelElemento.ancla} onCerrar={() => setPanelElemento(null)} etiqueta="Elemento" ancho={320}>
          <PanelElemento el={elementoActual() as Element} raiz={raiz() as Element} raizGuardable={!!envoltorios?.length} colores={coloresDelTema}
            onAccion={accionElemento} onColor={colorElemento} onFuente={fuenteElemento}
            onFondoImagen={(q) => void fondoImagenElemento(q)} onAgregar={(q) => void agregarNuevo(q)} />
        </Flotante>
      )}
      {panelContenido && raiz() && (
        <Flotante ancla={panelContenido.ancla} onCerrar={() => setPanelContenido(null)} etiqueta="Contenido" ancho={360}>
          <PanelContenidoDiseno raiz={raiz() as Element} onCambio={conRespiro}
            onCambiarImagen={(img) => { elegir(img); void cambiarImagen(); }}
            onQuitar={quitarDeLista}
            onFondo={(el, q) => { elegir(el); void fondoImagenElemento(q); }}
            onDestino={destinoDeLista}
            onVer={verDeLista}
            onIcono={(el, b) => { elegir(el); abrirIcono(b); }}
            onVideo={(el, b) => { elegir(el); void cambiarVideo(b); }} />
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

/**
 * «Botón» de un diseño (26/10/2026, Martín: «Los botones tampoco son editables»): su texto, a dónde lleva (el MISMO
 * selector del botón de un bloque) y sus dos colores (los del tema o uno a elección). Cada cambio va a su HTML.
 */
function PanelBoton({ a, colores, onCambio, onDestino }: {
  a: HTMLAnchorElement;
  colores: readonly string[];
  onCambio: () => void;
  onDestino: (href: string | null, nueva: boolean) => void;
}) {
  const [texto, setTexto] = useState(() => textoDeBoton(a));
  const [color, setColor] = useState(() => colorDeBoton(a));
  const marcado = conMarcas(a);
  const poner = (cual: 'fondo' | 'texto', v: string) => {
    // Un color (hex, rgb, oklch…), nunca otra cosa en el `style`.
    if (!v || /[;{}<>"]|url\(/i.test(v)) return;
    ponerColorDeBoton(a, cual, v);
    setColor((c) => ({ ...c, [cual]: v }));
    onCambio();
  };
  const fila = (cual: 'fondo' | 'texto', rotulo: string) => (
    <>
      <span className="gmx-rotulo">{rotulo}</span>
      <div className="gmx-muestras">
        {colores.map((c) => (
          <button key={c} type="button" className="gmx-muestra" title={c} aria-label={`${rotulo}: ${c}`} aria-pressed={color[cual].toLowerCase() === c.toLowerCase()}
            style={{ background: c }} onMouseDown={(e) => e.preventDefault()} onClick={() => poner(cual, c)} />
        ))}
        <input type="color" aria-label={`${rotulo}: otro`} value={esHex(color[cual]) ? color[cual] : '#000000'} onChange={(e) => poner(cual, e.target.value.toLowerCase())} />
      </div>
    </>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
      <span className="gmx-rotulo">Texto</span>
      {marcado
        ? <span className="gmx-nota">Este botón lleva datos que pone la página (la prueba o un precio): se escribe en el botón.</span>
        : <input className="gmx-campo" value={texto} maxLength={80} aria-label="Texto del botón"
            onChange={(e) => { setTexto(e.target.value); ponerTextoDeBoton(a, e.target.value); onCambio(); }} />}
      {fila('fondo', 'Color del botón')}
      {fila('texto', 'Color del texto')}
      <span className="gmx-rotulo">A dónde lleva</span>
      <SelectorDestino valor={a.getAttribute('href')} nuevaPestana={a.getAttribute('target') === '_blank'}
        onElegir={(href, nueva) => onDestino(href, nueva)}
        onQuitar={a.getAttribute('href') ? () => onDestino(null, false) : undefined} />
    </div>
  );
}

/**
 * «Elemento» de un diseño (28/10/2026, Martín: «Debe ser todo editable»): CUALQUIER elemento elegido —o la sección, sin
 * elegir nada—, con lo que se espera de un editor de páginas: elegir el de afuera (de un logo a su enlace, de una tarjeta a
 * su caja), duplicar, mover entre sus hermanos y quitar; el color del texto, el fondo (color o imagen) y la fuente, de las
 * que la página ya carga. Cada cambio va a su HTML (lib/editor-landing/diseno-elemento-acciones.ts).
 */
function PanelElemento({ el, raiz, raizGuardable, colores, onAccion, onColor, onFuente, onFondoImagen, onAgregar }: {
  el: Element;
  raiz: Element;
  /** En una copia la raíz es su envoltorio y se guarda; en un diseño de MaKo es la caja del editor y no. */
  raizGuardable: boolean;
  colores: readonly string[];
  onAccion: (que: 'afuera' | 'duplicar' | 'antes' | 'despues' | 'quitar') => void;
  onColor: (cual: 'texto' | 'fondo', v: string | null) => void;
  onFuente: (f: string | null) => void;
  onFondoImagen: (que: 'cambiar' | 'quitar') => void;
  /** Un elemento NUEVO debajo de éste (o al final de la sección). */
  onAgregar: (que: 'texto' | 'boton' | 'imagen') => void;
}) {
  const v = el.ownerDocument.defaultView;
  const cs = v?.getComputedStyle(el);
  const esRaiz = el === raiz;
  const conImagen = !!imagenDeFondo(cs?.backgroundImage);
  // Las fuentes que la página YA carga: las de sus elementos (hasta 400, para no recorrer una página entera).
  const fuentes = useMemo(() => {
    const todos = Array.from(el.ownerDocument.querySelectorAll('body *')).slice(0, 400);
    return fuentesDeLaPagina(todos.map((x) => v?.getComputedStyle(x).fontFamily ?? ''));
  }, [el.ownerDocument, v]);
  const hex = (rgb: string | undefined) => {
    const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(rgb ?? '');
    return m ? '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('') : '#000000';
  };
  const accion = (que: Parameters<typeof onAccion>[0], rotulo: string, ico: ReactNode, apagado?: boolean) => (
    <button type="button" className="gmx-btn gma-tip" data-tip={rotulo} aria-label={rotulo} disabled={apagado}
      onMouseDown={(e) => e.preventDefault()} onClick={() => onAccion(que)}>
      {ico}
    </button>
  );
  const fila = (cual: 'texto' | 'fondo', rotulo: string, actual: string | undefined) => (
    <>
      <span className="gmx-rotulo">{rotulo}</span>
      <div className="gmx-muestras">
        {colores.map((c) => (
          <button key={c} type="button" className="gmx-muestra" title={c} aria-label={`${rotulo}: ${c}`}
            style={{ background: c }} onMouseDown={(e) => e.preventDefault()} onClick={() => onColor(cual, c)} />
        ))}
        <input type="color" aria-label={`${rotulo}: otro`} value={hex(actual)} onChange={(e) => onColor(cual, e.target.value.toLowerCase())} />
        <button type="button" className="gmx-muestra gmx-muestra-nada" title="Como estaba" aria-label={`${rotulo}: como estaba`}
          onMouseDown={(e) => e.preventDefault()} onClick={() => onColor(cual, null)} />
      </div>
    </>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>{nombreDeElemento(el as unknown as ElementoDiseno, raiz as unknown as ElementoDiseno)}</strong>
        <button type="button" className="gmx-chip" disabled={esRaiz} onMouseDown={(e) => e.preventDefault()} onClick={() => onAccion('afuera')}>
          Elegir el de afuera
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {accion('duplicar', 'Duplicar', <Icono nombre="duplicar" />, esRaiz)}
        {accion('antes', 'Subir', <Icono nombre="flecha-arriba" />, esRaiz)}
        {accion('despues', 'Bajar', <Icono nombre="flecha-abajo" />, esRaiz)}
        {accion('quitar', 'Quitar', <IconoBorrar size={16} />, esRaiz)}
      </div>
      <span className="gmx-rotulo">{esRaiz ? 'Agregar al final' : 'Agregar debajo'}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([['texto', 'Texto'], ['boton', 'Botón'], ['imagen', 'Imagen']] as const).map(([q, rotulo]) => (
          <button key={q} type="button" className="gmx-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => onAgregar(q)}>{rotulo}</button>
        ))}
      </div>
      {esRaiz && !raizGuardable ? (
        <span className="gmx-nota">El fondo de esta sección se cambia eligiendo lo de adentro, o con «Código».</span>
      ) : (<>
      {fila('texto', 'Color del texto', cs?.color)}
      {fila('fondo', 'Fondo', cs?.backgroundColor)}
      <span className="gmx-rotulo">Imagen de fondo</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="gmx-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => onFondoImagen('cambiar')}>
          {conImagen ? 'Cambiar' : 'Poner una'}
        </button>
        {conImagen && (
          <button type="button" className="gmx-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => onFondoImagen('quitar')}>Quitar</button>
        )}
      </div>
      {fuentes.length > 0 && (
        <>
          <span className="gmx-rotulo">Fuente</span>
          <select className="gmx-campo" aria-label="Fuente" value="" onChange={(e) => onFuente(e.target.value || null)}>
            <option value="">{(cs?.fontFamily ?? '').split(',')[0].replace(/["']/g, '') || 'La de la página'}</option>
            {fuentes.map((f) => <option key={f} value={f}>{f.split(',')[0].replace(/["']/g, '')}</option>)}
          </select>
        </>
      )}
      </>)}
    </div>
  );
}
