'use client';

// =============================================================================
// EditorLanding — el armazón del editor de landings copiado de Gamma 5
// =============================================================================
// Pedido de Martín (11/10/2026), textual: «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» Diseño, decisiones y contratos: docs/diseno-editor-landing.md.
//
// EL LAYOUT es el de Gamma 5 (gamma-ui.md §5.1-§5.2): arriba la barra (⌂ al Panel · páginas ·
// el título editable «Sin título» · el estado del guardado · Compartir · el botón partido azul
// [⤒ Publicar ▾] · ⋯ · el avatar); a la izquierda el panel del agente (✨, se colapsa con ⇤) o
// el de páginas; sobre el lienzo la barra de herramientas redondeada (✨ para reabrir el agente si se
// plegó —el interruptor Edición manual / Edición con IA de Gamma se sacó el 12/10—, Deshacer/Rehacer, «⊞ Agregar bloque», la zona contextual de formato y
// la vista por dispositivo); la tira de secciones; y el lienzo con el fondo del tema y las
// secciones al centro. Abajo a la derecha, el zoom «100%» y el «?» de los atajos.
//
// ESTE ARCHIVO ES EL ÚNICO DUEÑO DEL DOCUMENTO (contrato: ./contexto.ts). Guarda, cambia de
// página y aplica lo que piden las piezas; ninguna pieza escribe el documento por su cuenta.
// Tres decisiones que no se ven y que gobiernan todo lo de abajo:
//
//   1. UN editor de TipTap por PÁGINA, el de la página abierta. Las demás viven como JSON en
//      `contenidoRef`. Cambiar de página guarda el JSON de la actual en el estado y carga la
//      otra con un EditorState NUEVO (mismos plugins): así el historial de deshacer es por
//      página. Un `setContent` dejaba el Ctrl+Z capaz de deshacer HACIA la página anterior.
//      ⚠️ Mientras se edita, `contenido` (el del contexto) trae la página abierta del último
//      guardado; lo vivo es `editor`. El estado se refresca en cada guardado (1,5 s de respiro).
//
//   2. EL AUTOGUARDADO es concurrencia optimista: cada guardado manda la `version` que tiene, y
//      si otra pestaña guardó en el medio el server contesta conflicto (409) y la pantalla lo
//      dice con «Recargar» — nunca pisa en silencio. Por eso los guardados van EN FILA (una
//      promesa encadenada): dos en paralelo mandarían la misma versión y el segundo daría un
//      conflicto falso. Respiro de 1,5 s; `guardarAhora` lo cancela y manda ya; al ocultarse la
//      pestaña (visibilitychange) y al desmontar se manda lo pendiente (con `keepalive` si el
//      cuerpo entra en los 64 KB que el navegador permite).
//
//   3. NO SE GUARDA LO QUE NO SE PUDO ABRIR. Si el JSON de una página no cumple el esquema de
//      las extensiones, TipTap abre un documento VACÍO sin error, y el autoguardado lo
//      escribiría encima (hallazgo del paquete A). Antes de dar una página por abierta se
//      valida con `schema.nodeFromJSON(...).check()`; si falla, la página queda «rota»: el
//      lienzo lo dice, el editor queda de sólo lectura y el guardado manda esa página como
//      estaba, no lo que muestra el editor.
//
// PRESENTACIONES (T3, tanda 2: «Falta la funcionalidad de crear presentaciones… Diapositivas, tal
// cual como lo hace gamma»): con `config.formato === 'presentacion'` la barra cambia Publicar por
// PRESENTAR como botón principal (Publicar queda en el ▾), la raíz del lienzo lleva
// `data-formato`/`data-proporcion` (la forma de la diapositiva y la guía de desbordamiento son de
// css.ts) y, con forma fija, la letra base sale del ANCHO DEL LIENZO (`baseDelLienzo`): una
// diapositiva que no entra de ancho achica su alto y el contenido, en em, se sale.
//
// Lo que NO se copia de Gamma: el «Formato libre» (bloques con posición absoluta), la edición en
// tiempo real con otros (no hay infraestructura de presencia: D8) y el chrome oscuro por tema
// (ver app/web-generator/gamma.css).
// =============================================================================

import '../gamma.css';
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type DragEvent as DragEventReact,
} from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import type { Node as NodoPM } from '@tiptap/pm/model';
import Link from '@/app/_ui/Link';
import { temaPorId, varsDeTema } from '@/lib/editor-landing/temas';
import {
  NODO, TOPES, docPagina, nuevoId, tarjetaVacia,
  type DocPagina, type JsonNodo, type LandingContenido, type Pagina,
} from '@/lib/editor-landing/doc';
import {
  diapositivaFija, esPresentacion, proporcionDe, terminoTarjeta,
  type ConfigLanding, type LandingCompleta, type PedidoDocs, type TemaPropio,
} from '@/lib/editor-landing/api-tipos';
import type { IdBloque } from '@/lib/editor-landing/catalogo-bloques';
import {
  EditorLandingContext,
  type CtxEditorLanding, type Dialogo, type EstadoGuardado, type OpcionesImagen, type PanelDer, type PanelIzq,
} from './contexto';
import { extensionesLanding } from './extensiones';
import BarraFormato from './BarraFormato';
import AsaBloque from './AsaBloque';
import MenuBarra from './MenuBarra';
import AgregarBloque, { TIPO_ARRASTRE_BLOQUE, insertarBloqueEn } from './AgregarBloque';
import TiraSecciones from './TiraSecciones';
import { seccionPorId, tarjetaEnCursor } from './insertar';
import PanelPaginas from './PanelPaginas';
import MenuDocumento, { Ico, ItemMenu, Menu, SepMenu, useTeclaMod, type InfoDocumento } from './MenuDocumento';
import { pedirDocs, subirArchivo, useSelectorImagen } from './subir';
import SelectorImagen from './SelectorImagen';
import PanelAgente, { EstilosContenido } from './paneles/PanelAgente';
import PanelTema, { EVENTO_TEMAS_PROPIOS } from './paneles/PanelTema';
import { URL_FUENTE_CHROME, marcarReciente } from '../cliente';
import PanelComentarios from './paneles/PanelComentarios';
import PanelHistorial from './paneles/PanelHistorial';
import DialogoCompartir from './dialogos/DialogoCompartir';
import DialogoPublicar from './dialogos/DialogoPublicar';
import DialogoExportar from './dialogos/DialogoExportar';
import DialogoConfiguracion from './dialogos/DialogoConfiguracion';
import DialogoAnalitica from './dialogos/DialogoAnalitica';
import DialogoAtajos from './dialogos/DialogoAtajos';
import Presentar from './Presentar';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** El respiro del autoguardado: un guardado por pausa, no uno por tecla. */
const RESPIRO_MS = 1500;
/** Cuánto espera para reintentar un guardado que falló (red caída, 5xx). */
const REINTENTO_MS = 8000;
/**
 * Reintentos SOLOS seguidos antes de parar. Una falla que no se arregla esperando (una landing
 * demasiado grande, un 4xx) no puede quedar golpeando la ruta cada 8 s para siempre: después de
 * esto queda el «Reintentar» del indicador, y el próximo cambio vuelve a probar.
 */
const REINTENTOS_SOLOS = 3;

/** Los niveles de zoom del lienzo, en %. */
export const ZOOMS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 200] as const;

type Dispositivo = 'escritorio' | 'tableta' | 'movil';
const DISPOSITIVOS: { id: Dispositivo; nombre: string; icono: string }[] = [
  { id: 'escritorio', nombre: 'Vista previa del escritorio', icono: 'escritorio' },
  { id: 'tableta', nombre: 'Vista previa en tablet', icono: 'tablet' },
  { id: 'movil', nombre: 'Vista previa móvil', icono: 'celular' },
];

const CLAVE_ZOOM = 'gma.lienzo.zoom';
const CLAVE_TIRA = 'gma.tira.visible';

type Sucio = { titulo: boolean; contenido: boolean; config: boolean };
const LIMPIO: Sucio = { titulo: false, contenido: false, config: false };
const algo = (s: Sucio) => s.titulo || s.contenido || s.config;

/** Lo que guarda un guardado: capturado AL PEDIRLO (el contenido sale del editor en ese instante). */
type Paquete = { sucio: Sucio; titulo?: string; contenido?: LandingContenido; config?: ConfigLanding; base: LandingContenido };

/**
 * El --gm-base del lienzo con el zoom aplicado. Todo el contenido está en `em` relativos a la
 * sección (css.ts), así que escalar la letra base es escalar el dibujo entero sin transform:
 * los clics, las selecciones y las barras flotantes siguen cayendo donde se ven.
 */
function baseDelLienzo(dispositivo: Dispositivo, zoom: number, diapo: { ancho: number } | null = null): Record<string, string> {
  const z = zoom / 100;
  if (dispositivo === 'movil') return { '--gm-base-movil': `calc(16px * ${z})`, '--gm-base': `calc(16px * ${z})` };
  // T3: una diapositiva de forma fija mide 64.5em y tiene que ENTRAR de ancho (si no, su alto sale
  // del ancho achicado y el contenido, en em, desborda): la letra base sale del ancho del lienzo
  // (o del cuadro de la tableta, que mide min(820px, lienzo − 32px): gamma.css). 68.5 = 64.5 + 4 de aire.
  const tope = diapo && diapo.ancho > 0
    ? `${(Math.round(((dispositivo === 'tableta' ? Math.min(820, diapo.ancho - 32) : diapo.ancho) / 68.5) * 100) / 100)}px`
    : null;
  if (dispositivo === 'tableta') return { '--gm-base': tope ? `calc(min(15px, ${tope}) * ${z})` : `calc(15px * ${z})` };
  const normal = 'clamp(15px, calc(100vw / 68.5), 18px)';
  return { '--gm-base': `calc(${tope ? `min(${normal}, ${tope})` : normal} * ${z})` };
}

/** Iniciales para el avatar. */
function iniciales(nombre: string | null): string {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '·';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// La entrada: el documento o el error de carga
// ─────────────────────────────────────────────────────────────────────────────

export type PropsEditorLanding = {
  /** La landing abierta, o null si no se pudo leer. */
  doc: LandingCompleta | null;
  /** Por qué no se pudo leer (texto corto). */
  error?: string | null;
  /** Los temas propios del workspace (app_settings `landing.temas`). */
  temasPropios: TemaPropio[];
  /** Quién la creó (para la cabeza del menú ⋯). */
  creadoPor: string | null;
  /** Quién mira (el avatar de la barra). */
  autor: string | null;
};

export default function EditorLanding(p: PropsEditorLanding) {
  if (!p.doc) return <ErrorDeCarga error={p.error ?? null} />;
  return <Armazon {...p} doc={p.doc} />;
}

function ErrorDeCarga({ error }: { error: string | null }) {
  return (
    <div className="gma gma-app">
      <link rel="stylesheet" href={URL_FUENTE_CHROME} precedence="default" />
      <div className="gma-barra">
        <Link href="/web-generator" className="gma-boton gma-boton--icono gma-tip" data-tip="Panel" aria-label="Panel">
          <Ico n="casa" t={18} />
        </Link>
      </div>
      <div className="gma-vacio">
        <h1 className="gma-vacio-titulo">No se pudo abrir la landing</h1>
        {error ? <p className="gma-vacio-texto">{error}</p> : null}
        <div className="gma-vacio-acciones">
          <button type="button" className="gma-boton gma-boton--primario" onClick={() => window.location.reload()}>Reintentar</button>
          <Link href="/web-generator" className="gma-boton gma-boton--contorno">Volver al Panel</Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El armazón
// ─────────────────────────────────────────────────────────────────────────────

function Armazon({ doc, temasPropios, creadoPor, autor }: PropsEditorLanding & { doc: LandingCompleta }) {
  const docId = doc.id;
  const mod = useTeclaMod();

  // ── El documento ──
  const [titulo, setTituloEstado] = useState(doc.titulo);
  const [contenido, setContenidoEstado] = useState<LandingContenido>(doc.contenido);
  const [config, setConfigEstado] = useState<ConfigLanding>(doc.config);
  const [version, setVersion] = useState(doc.version);
  const [estado, setEstadoEstado] = useState<EstadoGuardado>('guardado');
  const [paginaActual, setPaginaActualEstado] = useState<string>(doc.contenido.paginas[0]?.id ?? '');
  const [rota, setRota] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [urlPublica, setUrlPublica] = useState<string | null>(doc.urlPublica);
  const [cambiosSinPublicar, setCambiosSinPublicar] = useState(doc.cambiosSinPublicar);
  const [propios, setPropios] = useState<TemaPropio[]>(temasPropios);
  const [info] = useState<InfoDocumento>({ creado: doc.creado, creadoPor });

  // ── La pantalla ──
  const [tarjetaActiva, setTarjetaActivaEstado] = useState<string | null>(null);
  // El agente arranca ABIERTO y se puede plegar (feedback de Martín, 12/10/2026: «No deberían existir
  // esos botones [Edición manual / Edición con IA], por defecto el editor de IA siempre abierto. Y de
  // ultima que se pueda plegar»). Con el agente abierto se edita a mano igual.
  const [panelIzq, setPanelIzqEstado] = useState<PanelIzq>('agente');
  /** La persona plegó el agente: cerrar el panel de páginas no lo vuelve a abrir. */
  const agentePlegado = useRef(false);
  const [panelDer, setPanelDer] = useState<PanelDer>(null);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [tiraVisible, setTiraVisible] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [dispositivo, setDispositivo] = useState<Dispositivo>('escritorio');
  const [toast, setToast] = useState<{ id: number; texto: string; onDeshacer?: () => void } | null>(null);
  const [menuDoc, setMenuDoc] = useState<HTMLElement | null>(null);
  const [menuPublicar, setMenuPublicar] = useState<HTMLElement | null>(null);
  const [menuZoom, setMenuZoom] = useState<HTMLElement | null>(null);
  const [agregarBloque, setAgregarBloque] = useState<HTMLElement | null>(null);

  // ── Refs: la verdad que leen los callbacks de identidad fija ──
  const tituloRef = useRef(doc.titulo);
  const contenidoRef = useRef<LandingContenido>(doc.contenido);
  const configRef = useRef<ConfigLanding>(doc.config);
  const versionRef = useRef(doc.version);
  const paginaActualRef = useRef(paginaActual);
  const docListoRef = useRef<string | null>(null);   // la página que el editor tiene ABIERTA y válida
  const tarjetaActivaRef = useRef<string | null>(null);
  const estadoRef = useRef<EstadoGuardado>('guardado');
  const sucioRef = useRef<Sucio>({ ...LIMPIO });
  const colaRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<number | null>(null);
  const reintentoRef = useRef<number | null>(null);
  const conflictoRef = useRef(false);
  const descartesAvisados = useRef(false);
  const fallosSeguidos = useRef(0);
  const lienzoRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const toastTimer = useRef<number | null>(null);

  const setEstado = useCallback((e: EstadoGuardado) => {
    if (estadoRef.current === e) return;
    estadoRef.current = e;
    setEstadoEstado(e);
  }, []);

  const setTarjetaActiva = useCallback((id: string | null) => {
    if (tarjetaActivaRef.current === id) return;
    tarjetaActivaRef.current = id;
    setTarjetaActivaEstado(id);
  }, []);

  const tema = useMemo(() => temaPorId(config.tema, propios), [config.tema, propios]);
  // T3: una presentación dice «diapositiva», Presentar es la acción principal y, con forma fija,
  // la letra base sale del ancho del lienzo (baseDelLienzo).
  const presentacion = esPresentacion(config);
  const fija = diapositivaFija(config);
  const [anchoLienzo, setAnchoLienzo] = useState(0);

  // «Recientes» del Panel: una landing abierta desde un link o un marcador también es reciente.
  useEffect(() => { marcarReciente(docId); }, [docId]);

  // El panel de temas avisa cuando guarda o borra un tema propio: si el que cambió es el APLICADO,
  // sin esto el lienzo seguiría pintando la versión vieja hasta recargar.
  useEffect(() => {
    const alCambiar = (e: Event) => {
      const lista = (e as CustomEvent<TemaPropio[]>).detail;
      if (Array.isArray(lista)) setPropios(lista);
    };
    window.addEventListener(EVENTO_TEMAS_PROPIOS, alCambiar);
    return () => window.removeEventListener(EVENTO_TEMAS_PROPIOS, alCambiar);
  }, []);

  // ── Aviso corto (3-4 palabras), con «Deshacer» opcional ──
  const avisar = useCallback((texto: string, onDeshacer?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), texto, onDeshacer });
    toastTimer.current = window.setTimeout(() => setToast(null), onDeshacer ? 6000 : 3500);
  }, []);

  // ── El selector de imágenes (I2) como promesa ──
  const { elegirImagen, selector } = useSelectorImagen();
  const elegirImagenRef = useRef(elegirImagen);
  elegirImagenRef.current = elegirImagen;
  const elegirImagenEstable = useCallback((op?: OpcionesImagen) => elegirImagenRef.current(op), []);

  // ─────────────────────────────────────────────────────────────────────────
  // El contenido con la página abierta sacada del editor
  // ─────────────────────────────────────────────────────────────────────────

  /** El JSON vivo de la página abierta, o null si el editor no la tiene abierta y válida. */
  const docVivo = useCallback((): DocPagina | null => {
    const e = editorRef.current;
    if (!e || e.isDestroyed || docListoRef.current !== paginaActualRef.current) return null;
    try { return e.getJSON() as DocPagina; } catch { return null; }
  }, []);

  /** `contenidoRef` con la página abierta reemplazada por lo que muestra el editor. */
  const contenidoVivo = useCallback((): LandingContenido => {
    const base = contenidoRef.current;
    const vivo = docVivo();
    if (!vivo) return base;
    const id = paginaActualRef.current;
    return { ...base, paginas: base.paginas.map((p) => (p.id === id ? { ...p, doc: vivo } : p)) };
  }, [docVivo]);

  // ─────────────────────────────────────────────────────────────────────────
  // El autoguardado
  // ─────────────────────────────────────────────────────────────────────────

  const armarPaquete = useCallback((): Paquete | null => {
    const s = sucioRef.current;
    if (!algo(s) || conflictoRef.current) return null;
    sucioRef.current = { ...LIMPIO };
    const base = contenidoRef.current;
    return {
      sucio: s,
      base,
      titulo: s.titulo ? tituloRef.current : undefined,
      contenido: s.contenido ? contenidoVivo() : undefined,
      config: s.config ? configRef.current : undefined,
    };
  }, [contenidoVivo]);

  const devolverSucio = useCallback((s: Sucio) => {
    const a = sucioRef.current;
    sucioRef.current = { titulo: a.titulo || s.titulo, contenido: a.contenido || s.contenido, config: a.config || s.config };
  }, []);

  /** Manda UN paquete. La `version` se lee al MANDAR (el guardado anterior de la fila la subió). */
  const mandar = useCallback(async (paq: Paquete, keepalive: boolean) => {
    if (conflictoRef.current) return;
    setEstado('guardando');
    const cuerpo: Extract<PedidoDocs, { accion: 'guardar' }> = { accion: 'guardar', id: docId, version: versionRef.current };
    if (paq.titulo !== undefined) cuerpo.titulo = paq.titulo;
    if (paq.contenido !== undefined) cuerpo.contenido = paq.contenido;
    if (paq.config !== undefined) cuerpo.config = paq.config;
    try {
      const r = await pedirDocs(cuerpo, { keepalive });
      if (!r.ok) {
        if (r.conflicto) {
          conflictoRef.current = true;
          devolverSucio(paq.sucio);
          setEstado('conflicto');
          return;
        }
        throw new Error(r.error);
      }
      fallosSeguidos.current = 0;
      versionRef.current = r.version;
      setVersion(r.version);
      setCambiosSinPublicar(r.cambiosSinPublicar);
      if (paq.contenido && contenidoRef.current === paq.base) {
        contenidoRef.current = paq.contenido;
        setContenidoEstado(paq.contenido);
      }
      if (r.descartes > 0 && !descartesAvisados.current) {
        descartesAvisados.current = true;
        avisar('Se descartó contenido inválido');
      }
      setEstado(algo(sucioRef.current) ? 'sin-guardar' : 'guardado');
    } catch {
      devolverSucio(paq.sucio);
      setEstado('error');
      fallosSeguidos.current += 1;
      if (reintentoRef.current) window.clearTimeout(reintentoRef.current);
      if (fallosSeguidos.current > REINTENTOS_SOLOS) return;
      reintentoRef.current = window.setTimeout(() => {
        reintentoRef.current = null;
        if (algo(sucioRef.current)) void encolarRef.current(false);
      }, REINTENTO_MS);
    }
  }, [docId, setEstado, devolverSucio, avisar]);

  /** Pone un guardado en la FILA (nunca dos en paralelo: mandarían la misma versión). */
  const encolar = useCallback((keepalive: boolean): Promise<void> => {
    const paq = armarPaquete();
    if (!paq) return colaRef.current;
    const p = colaRef.current.then(() => mandar(paq, keepalive));
    colaRef.current = p.catch(() => {});
    return p;
  }, [armarPaquete, mandar]);
  const encolarRef = useRef(encolar);
  encolarRef.current = encolar;

  const marcarSucio = useCallback((campo: keyof Sucio) => {
    sucioRef.current = { ...sucioRef.current, [campo]: true };
    if (conflictoRef.current) return;
    setEstado('sin-guardar');
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { timerRef.current = null; void encolarRef.current(false); }, RESPIRO_MS);
  }, [setEstado]);

  /** Manda lo pendiente YA (cancela el respiro) y devuelve la versión nueva, o null si no se pudo. */
  const guardarAhora = useCallback(async (): Promise<number | null> => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    fallosSeguidos.current = 0;
    await encolarRef.current(false);
    await colaRef.current;
    if (conflictoRef.current || algo(sucioRef.current)) return null;
    return versionRef.current;
  }, []);

  /** El último guardado al irse: sin respiro, con keepalive si entra. */
  const vaciarPendiente = useCallback(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (algo(sucioRef.current)) void encolarRef.current(true);
  }, []);

  // Flush al ocultarse la pestaña (cambiar de pestaña, cerrar el navegador: ahí el desmonte NO
  // corre) y al desmontar (volver al Panel). Y si queda algo sin mandar, el navegador pregunta.
  useEffect(() => {
    const visibilidad = () => { if (document.visibilityState === 'hidden') vaciarPendiente(); };
    const antesDeSalir = (e: BeforeUnloadEvent) => {
      if (!algo(sucioRef.current) && estadoRef.current !== 'guardando') return;
      vaciarPendiente();
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', visibilidad);
    window.addEventListener('pagehide', vaciarPendiente);
    window.addEventListener('beforeunload', antesDeSalir);
    return () => {
      document.removeEventListener('visibilitychange', visibilidad);
      window.removeEventListener('pagehide', vaciarPendiente);
      window.removeEventListener('beforeunload', antesDeSalir);
      vaciarPendiente();
      if (reintentoRef.current) window.clearTimeout(reintentoRef.current);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [vaciarPendiente]);

  // ─────────────────────────────────────────────────────────────────────────
  // El editor de TipTap (uno, el de la página abierta)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Abre una página en el editor con un EditorState NUEVO (historial limpio). Valida contra el
   * esquema ANTES: si el JSON no entra, la página queda rota y no se toca (ver la cabecera, 3).
   */
  const abrirEnEditor = useCallback((e: Editor, p: Pagina): boolean => {
    try {
      const nodo = e.schema.nodeFromJSON(p.doc);
      nodo.check();
      e.view.updateState(EditorState.create({ schema: e.schema, doc: nodo, plugins: e.state.plugins }));
      docListoRef.current = p.id;
      setRota(null);
      e.setEditable(true, false);
      let idPrimera: string | null = null;
      if (nodo.childCount && nodo.child(0).type.name === NODO.tarjeta) idPrimera = String(nodo.child(0).attrs.id ?? '') || null;
      setTarjetaActiva(idPrimera);
      return true;
    } catch (err) {
      console.warn(`[editor-landing] #${docId}: la página «${p.titulo}» no se pudo abrir en el editor`, err);
      docListoRef.current = null;
      setRota(p.id);
      try { e.setEditable(false, false); } catch { /* editor recién creado */ }
      return false;
    } finally {
      setRevision((r) => r + 1);
    }
  }, [docId, setTarjetaActiva]);

  // Las funciones que reciben las extensiones (las subidas, el selector, los avisos) tienen
  // identidad fija: el editor se crea UNA vez y no puede quedarse con una versión vieja.
  const extensiones = useMemo(
    () => extensionesLanding({ subirArchivo, elegirImagen: elegirImagenEstable, avisar }),
    [elegirImagenEstable, avisar],
  );

  const alActualizar = useRef<() => void>(() => {});
  alActualizar.current = () => {
    // Un cambio en un editor que no tiene la página válida abierta no se guarda (ver la cabecera, 3).
    if (docListoRef.current !== paginaActualRef.current) return;
    marcarSucio('contenido');
  };
  const alSeleccionar = useRef<(e: Editor) => void>(() => {});
  alSeleccionar.current = (e: Editor) => { const id = tarjetaEnCursor(e)?.id; if (id) setTarjetaActiva(id); };

  const editor = useEditor({
    extensions: extensiones,
    // Sin esto, el render del server no coincide con el del navegador (EditorRico, trampa 14).
    immediatelyRender: false,
    // Un documento de landing entero no se redibuja en React por tecla (EditorRico, trampa 16):
    // lo que necesita saber del editor lo lee con useEditorState o escuchando sus eventos.
    shouldRerenderOnTransaction: false,
    content: doc.contenido.paginas[0]?.doc ?? docPagina([tarjetaVacia()]),
    editorProps: {
      attributes: { class: 'gm-pagina', spellcheck: 'true', 'aria-label': 'Contenido de la landing' },
    },
    onCreate: ({ editor: e }) => {
      editorRef.current = e;
      const p = contenidoRef.current.paginas.find((x) => x.id === paginaActualRef.current);
      if (p) abrirEnEditor(e, p);
    },
    onUpdate: () => alActualizar.current(),
    onSelectionUpdate: ({ editor: e }) => alSeleccionar.current(e),
  });
  useEffect(() => { editorRef.current = editor; }, [editor]);

  // ─────────────────────────────────────────────────────────────────────────
  // Lo que el contexto ofrece a las piezas
  // ─────────────────────────────────────────────────────────────────────────

  const setTitulo = useCallback((t: string) => {
    const v = t.slice(0, TOPES.titulo);
    tituloRef.current = v;
    setTituloEstado(v);
    marcarSucio('titulo');
  }, [marcarSucio]);

  const setConfig = useCallback((c: ConfigLanding) => {
    configRef.current = c;
    setConfigEstado(c);
    marcarSucio('config');
  }, [marcarSucio]);

  /** Cambia de página: lo vivo de la actual queda en el estado, y la otra se abre limpia. */
  const irAPagina = useCallback((id: string) => {
    const e = editorRef.current;
    if (id === paginaActualRef.current && docListoRef.current === id) return;
    const vivo = contenidoVivo();
    contenidoRef.current = vivo;
    setContenidoEstado(vivo);
    const otra = vivo.paginas.find((p) => p.id === id);
    if (!otra) return;
    paginaActualRef.current = id;
    setPaginaActualEstado(id);
    if (e && !e.isDestroyed) abrirEnEditor(e, otra);
    lienzoRef.current?.scrollTo({ top: 0 });
  }, [contenidoVivo, abrirEnEditor]);

  /**
   * Aplica la lista de páginas que arma una pieza (el panel de páginas). La página abierta
   * conserva lo VIVO del editor aunque la lista traiga su JSON viejo; si la abierta ya no está,
   * se abre la primera.
   */
  const setPaginas = useCallback((nuevas: Pagina[]) => {
    if (!nuevas.length) return;
    const actual = paginaActualRef.current;
    const vivo = docVivo();
    const lista = nuevas.slice(0, TOPES.paginas).map((p) => (p.id === actual && vivo ? { ...p, doc: vivo } : p));
    const siguiente: LandingContenido = { ...contenidoRef.current, paginas: lista };
    contenidoRef.current = siguiente;
    setContenidoEstado(siguiente);
    marcarSucio('contenido');
    if (!lista.some((p) => p.id === actual)) {
      const primera = lista[0];
      paginaActualRef.current = primera.id;
      setPaginaActualEstado(primera.id);
      const e = editorRef.current;
      if (e && !e.isDestroyed) abrirEnEditor(e, primera);
    }
  }, [docVivo, marcarSucio, abrirEnEditor]);

  const irATarjeta = useCallback((id: string) => {
    const e = editorRef.current;
    if (!e || e.isDestroyed) return;
    const s = seccionPorId(e.state.doc, id);
    if (!s) return;
    try {
      e.view.dispatch(e.state.tr.setSelection(TextSelection.near(e.state.doc.resolve(s.pos + 1))));
    } catch { /* una sección sin texto: alcanza con llevarla a la vista */ }
    const dom = e.view.nodeDOM(s.pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setTarjetaActiva(id);
  }, [setTarjetaActiva]);

  /** Arma nodos de ProseMirror a partir del JSON de una pieza; null si alguno no entra en el esquema. */
  const nodosDe = useCallback((e: Editor, nuevas: JsonNodo[]): NodoPM[] | null => {
    try {
      const nodos = nuevas.filter((n) => n && n.type === NODO.tarjeta).map((n) => e.schema.nodeFromJSON(n));
      nodos.forEach((n) => n.check());
      return nodos;
    } catch (err) {
      console.warn(`[editor-landing] #${docId}: secciones que no entran en el esquema`, err);
      return null;
    }
  }, [docId]);

  /**
   * Reemplaza secciones por id en UNA transacción (un Ctrl+Z las devuelve todas). Lo que trae un
   * id que no está (una sección que la IA agregó) va después de la última reemplazada.
   */
  const reemplazarTarjetas = useCallback((nuevas: JsonNodo[]) => {
    const e = editorRef.current;
    if (!e || e.isDestroyed || docListoRef.current !== paginaActualRef.current) return;
    const nodos = nodosDe(e, nuevas);
    if (!nodos) { avisar('No se pudo aplicar'); return; }
    const tr = e.state.tr;
    let finUltima: number | null = null;
    const sueltas: NodoPM[] = [];
    for (const n of nodos) {
      const s = seccionPorId(tr.doc, String(n.attrs.id ?? ''));
      if (s) {
        tr.replaceWith(s.pos, s.pos + s.nodo.nodeSize, n);
        finUltima = s.pos + n.nodeSize;
      } else {
        sueltas.push(n);
      }
    }
    if (sueltas.length) tr.insert(finUltima ?? tr.doc.content.size, sueltas);
    if (!tr.docChanged) return;
    e.view.dispatch(tr);
  }, [nodosDe, avisar]);

  /**
   * Inserta secciones en UNA transacción: después de `despuesDe`, o de la activa si no se dice
   * (`undefined`), o al final (`null`). Un id que ya existe se reemplaza por uno nuevo.
   */
  const insertarTarjetas = useCallback((nuevas: JsonNodo[], despuesDe?: string | null) => {
    const e = editorRef.current;
    if (!e || e.isDestroyed || docListoRef.current !== paginaActualRef.current) return;
    const usados = new Set<string>();
    e.state.doc.forEach((n) => { if (n.type.name === NODO.tarjeta) usados.add(String(n.attrs.id ?? '')); });
    const conIds = nuevas.map((n) => {
      const id = typeof n.attrs?.id === 'string' ? n.attrs.id : '';
      if (id && !usados.has(id)) { usados.add(id); return n; }
      const otro = nuevoId('t');
      usados.add(otro);
      return { ...n, attrs: { ...(n.attrs ?? {}), id: otro } };
    });
    const nodos = nodosDe(e, conIds);
    if (!nodos || !nodos.length) { avisar('No se pudo insertar'); return; }
    if (e.state.doc.childCount + nodos.length > TOPES.tarjetasPorPagina) { avisar(`Máximo de ${terminoTarjeta(configRef.current, { plural: true })}`); return; }
    const ref = despuesDe === undefined ? tarjetaActivaRef.current : despuesDe;
    const s = ref ? seccionPorId(e.state.doc, ref) : null;
    const pos = s ? s.pos + s.nodo.nodeSize : e.state.doc.content.size;
    const tr = e.state.tr.insert(pos, nodos);
    try { tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))); } catch { /* sin texto adentro */ }
    e.view.dispatch(tr);
    const id = String(nodos[0].attrs.id ?? '');
    setTarjetaActiva(id || null);
    requestAnimationFrame(() => {
      const dom = e.isDestroyed ? null : e.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [nodosDe, avisar, setTarjetaActiva]);

  /** Recarga lo del server. Descarta lo pendiente: quien quiera conservarlo llama guardarAhora antes. */
  const recargar = useCallback(async () => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    await colaRef.current;
    const r = await pedirDocs({ accion: 'abrir', id: docId });
    if (!r.ok) { avisar('No se pudo recargar'); return; }
    const d = r.doc;
    sucioRef.current = { ...LIMPIO };
    conflictoRef.current = false;
    tituloRef.current = d.titulo; setTituloEstado(d.titulo);
    configRef.current = d.config; setConfigEstado(d.config);
    versionRef.current = d.version; setVersion(d.version);
    contenidoRef.current = d.contenido; setContenidoEstado(d.contenido);
    setUrlPublica(d.urlPublica);
    setCambiosSinPublicar(d.cambiosSinPublicar);
    setEstado('guardado');
    const p = d.contenido.paginas.find((x) => x.id === paginaActualRef.current) ?? d.contenido.paginas[0];
    if (p) {
      paginaActualRef.current = p.id;
      setPaginaActualEstado(p.id);
      const e = editorRef.current;
      if (e && !e.isDestroyed) abrirEnEditor(e, p);
    }
    // Un tema propio recién creado en otro lado: se vuelven a leer los del workspace.
    if (d.config.tema.startsWith('ws:')) {
      const t = await pedirDocs({ accion: 'temas' });
      if (t.ok) setPropios(t.temas);
    }
  }, [docId, avisar, setEstado, abrirEnEditor]);

  // Si la config apunta a un tema propio que no está en la lista (lo acaba de crear el panel de
  // temas), se vuelve a leer la lista: sin esto el lienzo caería al tema por defecto.
  useEffect(() => {
    const id = config.tema;
    if (!id.startsWith('ws:')) return;
    const clave = id.slice(3);
    if (propios.some((p) => p.id === clave || p.id === id)) return;
    let vivo = true;
    void pedirDocs({ accion: 'temas' }).then((t) => { if (vivo && t.ok) setPropios(t.temas); }).catch(() => {});
    return () => { vivo = false; };
  }, [config.tema, propios]);

  /** El agente y el modo IA son lo mismo visto de dos lados: se CALCULA, no se sincroniza. */
  const modoIA = panelIzq === 'agente';
  const setPanelIzq = useCallback((p: PanelIzq) => {
    if (p === 'agente') agentePlegado.current = false;
    else if (p === null) agentePlegado.current = true;
    setPanelIzqEstado(p);
  }, []);
  const setModoIA = useCallback((v: boolean) => {
    agentePlegado.current = !v;
    setPanelIzqEstado((p) => (v ? 'agente' : p === 'agente' ? null : p));
  }, []);

  const ctx = useMemo<CtxEditorLanding>(() => ({
    docId,
    titulo,
    setTitulo,
    contenido,
    config,
    setConfig,
    tema,
    version,
    estado,
    guardarAhora,
    paginas: contenido.paginas,
    paginaActual,
    irAPagina,
    setPaginas,
    editor,
    tarjetaActiva,
    irATarjeta,
    modoIA,
    setModoIA,
    panelIzq,
    setPanelIzq,
    panelDer,
    setPanelDer,
    dialogo,
    setDialogo,
    subirArchivo,
    elegirImagen: elegirImagenEstable,
    avisar,
    reemplazarTarjetas,
    insertarTarjetas,
    urlPublica,
    baseLandings: doc.baseLandings,
    cambiosSinPublicar,
    recargar,
  }), [
    docId, titulo, setTitulo, contenido, config, setConfig, tema, version, estado, guardarAhora, paginaActual,
    irAPagina, setPaginas, editor, tarjetaActiva, irATarjeta, modoIA, setModoIA, panelIzq, setPanelIzq, panelDer,
    dialogo, elegirImagenEstable, avisar, reemplazarTarjetas, insertarTarjetas, urlPublica, doc.baseLandings, cambiosSinPublicar, recargar,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Atajos de la pantalla (gamma-ui.md §7)
  // ─────────────────────────────────────────────────────────────────────────
  // Mod+S guarda ya (siempre: el navegador abriría «Guardar como»). Mod+E abre/cierra el agente,
  // Mod+Enter presenta, Mod+/ los atajos, Escape cierra lo de arriba. Los demás los resuelve el
  // editor (Mod+Z, Mod+Shift+Z, formato): si TipTap ya atendió la tecla (`defaultPrevented`), acá
  // no se hace nada — el atajo del texto gana (AGENTS.md, «el Ctrl+Z nativo gana en un texto»).
  const cerrarDialogo = useCallback(() => setDialogo(null), []);
  const cerrarPanelDer = useCallback(() => setPanelDer(null), []);
  /** Cerrar el panel de páginas vuelve al agente, salvo que la persona lo haya plegado. */
  const cerrarPaginas = useCallback(() => setPanelIzqEstado(agentePlegado.current ? null : 'agente'), []);
  const arriba = useRef({ dialogo, panelDer, panelIzq });
  arriba.current = { dialogo, panelDer, panelIzq };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const conMod = e.metaKey || e.ctrlKey;
      if (conMod && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void guardarAhora();
        return;
      }
      if (e.defaultPrevented) return;
      if (conMod && !e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setPanelIzqEstado((p) => {
          agentePlegado.current = p === 'agente';
          return p === 'agente' ? null : 'agente';
        });
        return;
      }
      if (conMod && e.key === '/') {
        e.preventDefault();
        setDialogo('atajos');
        return;
      }
      if (e.key === 'Escape') {
        // Lo de arriba primero: un diálogo, después el panel derecho, después el de páginas.
        // (Menús y popovers cierran solos y frenan la tecla en captura.)
        const u = arriba.current;
        if (u.dialogo) setDialogo(null);
        else if (u.panelDer) setPanelDer(null);
        else if (u.panelIzq === 'paginas') cerrarPaginas();
      }
    };
    // Mod+Enter presenta AUNQUE el foco esté en el texto: el salto de línea de StarterKit
    // (HardBreak) también escucha Mod+Enter, y ProseMirror atiende la tecla antes que `window`.
    // Por eso va en CAPTURA y frena la propagación: el editor nunca la ve. (El salto de línea
    // sigue en Shift+Enter, que es el de Gamma.)
    const presentar = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter' || e.shiftKey || e.altKey) return;
      if (arriba.current.dialogo) return;
      // Un campo de otra pieza (el comentario manda con Mod+Enter) se queda con su tecla.
      const t = e.target instanceof HTMLElement ? e.target : null;
      const enTexto = !!t?.closest('.ProseMirror');
      if (t && !enTexto && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      e.stopPropagation();
      setDialogo('presentar');
    };
    window.addEventListener('keydown', tecla);
    window.addEventListener('keydown', presentar, true);
    return () => {
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('keydown', presentar, true);
    };
  }, [guardarAhora]);

  // ─────────────────────────────────────────────────────────────────────────
  // Preferencias de quien mira (zoom, tira): se restauran del navegador si se puede
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const z = Number(localStorage.getItem(CLAVE_ZOOM));
      if ((ZOOMS as readonly number[]).includes(z)) setZoom(z);
      if (localStorage.getItem(CLAVE_TIRA) === 'no') setTiraVisible(false);
    } catch { /* sin almacenamiento: quedan las de siempre */ }
  }, []);
  const cambiarZoom = useCallback((z: number) => {
    setZoom(z);
    try { localStorage.setItem(CLAVE_ZOOM, String(z)); } catch { /* sin almacenamiento */ }
  }, []);
  const cambiarTira = useCallback((v: boolean) => {
    setTiraVisible(v);
    try { localStorage.setItem(CLAVE_TIRA, v ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  }, []);
  const pasoZoom = (dir: 1 | -1) => {
    const i = (ZOOMS as readonly number[]).indexOf(zoom);
    const j = Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 5 : i) + dir));
    cambiarZoom(ZOOMS[j]);
  };

  // La sección activa también sigue al scroll (la tira resalta la que se ve), mientras el
  // cursor no esté escribiendo en otra.
  const marcoScroll = useRef<number | null>(null);
  const alScrollear = () => {
    if (marcoScroll.current != null) return;
    marcoScroll.current = requestAnimationFrame(() => {
      marcoScroll.current = null;
      const e = editorRef.current;
      const lienzo = lienzoRef.current;
      if (!e || e.isDestroyed || e.isFocused || !lienzo) return;
      const r = lienzo.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.35);
      const sec = el instanceof Element ? el.closest('.gm-tarjeta') : null;
      if (!sec || !lienzo.contains(sec)) return;
      try {
        const $p = e.state.doc.resolve(e.view.posAtDOM(sec, 0));
        const n = $p.depth >= 1 ? $p.node(1) : null;
        if (n && n.type.name === NODO.tarjeta) setTarjetaActiva(String(n.attrs.id ?? '') || null);
      } catch { /* un nodo fuera del documento (una barra flotante) */ }
    });
  };

  // ── Soltar un bloque arrastrado desde «Agregar bloque» ──
  // En CAPTURA: ProseMirror escucha el `drop` en su propio nodo y trataría el arrastre como un
  // pegado de texto; frenarlo acá arriba le gana.
  const sobreLienzo = (e: DragEventReact<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(TIPO_ARRASTRE_BLOQUE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const soltarEnLienzo = (e: DragEventReact<HTMLDivElement>) => {
    const id = e.dataTransfer.getData(TIPO_ARRASTRE_BLOQUE) as IdBloque;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    const ed = editorRef.current;
    const pos = ed && !ed.isDestroyed ? ed.view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos ?? null : null;
    if (!insertarBloqueEn(ed, id, { pos, tarjetaActiva: tarjetaActivaRef.current, elegirImagen: elegirImagenEstable })) avisar('No se pudo insertar');
  };

  // ── Publicar ▾: Vista previa abre el borrador por el link privado, con lo pendiente mandado ──
  const vistaPrevia = async () => {
    const ventana = window.open('', '_blank');
    await guardarAhora();
    const r = await pedirDocs({ accion: 'vistaPrevia', id: docId });
    if (!r.ok) { ventana?.close(); avisar('No se pudo abrir'); return; }
    if (ventana) { ventana.opener = null; ventana.location.href = r.url; } else window.open(r.url, '_blank', 'noopener');
  };

  // El ancho del lienzo, sólo para la letra base de una diapositiva fija (baseDelLienzo). Se
  // redondea a 8 px: un ResizeObserver dispara por cada píxel al abrir un panel.
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el || !fija || typeof ResizeObserver === 'undefined') return;
    const medir = () => setAnchoLienzo(Math.round(el.clientWidth / 8) * 8);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fija]);

  const paginaRota = rota !== null && rota === paginaActual;
  const sinPaginas = contenido.paginas.length === 0;
  const estiloDoc = useMemo(
    () => ({ ...varsDeTema(tema), ...baseDelLienzo(dispositivo, zoom, fija ? { ancho: anchoLienzo } : null) }) as CSSProperties,
    [tema, dispositivo, zoom, fija, anchoLienzo],
  );

  return (
    <EditorLandingContext.Provider value={ctx}>
      <div className="gma gma-app">
        <link rel="stylesheet" href={URL_FUENTE_CHROME} precedence="default" />
        {/* La hoja del contenido (la misma que sirve la página publicada, D3) y las fuentes del tema,
            UNA vez: `EstilosContenido` las monta con `href` + `precedence`, y React 19 deduplica por
            `href` con la que pide cada panel (el historial, Presentar, el popover de una sección).
            Con `dangerouslySetInnerHTML` acá y la de los paneles, la página llevaba 94 KB dos veces. */}
        <EstilosContenido tema={tema} />

        {/* ── Barra superior ── */}
        <header className="gma-barra">
          <div className="gma-barra-izq">
            <Link href="/web-generator" className="gma-boton gma-boton--icono gma-tip" data-tip="Panel" aria-label="Panel"
              onClick={() => { void guardarAhora(); }}>
              <Ico n="casa" t={18} />
            </Link>
            <button type="button" className="gma-boton gma-boton--icono gma-tip" data-tip="Abrir panel de páginas" aria-label="Abrir panel de páginas"
              aria-pressed={panelIzq === 'paginas'} onClick={() => (panelIzq === 'paginas' ? cerrarPaginas() : setPanelIzqEstado('paginas'))}>
              <Ico n="paginas" t={18} />
            </button>
            <input
              className="gma-titulo"
              value={titulo}
              placeholder="Sin título"
              aria-label="Editar título"
              maxLength={TOPES.titulo}
              size={Math.min(48, Math.max(8, (titulo || 'Sin título').length + 1))}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
            />
            <IndicadorGuardado estado={estado} onReintentar={() => { void guardarAhora(); }} />
          </div>
          <div className="gma-barra-der">
            <button type="button" className="gma-boton gma-boton--secundario" onClick={() => setDialogo('compartir')}>
              <Ico n="candado" t={14} /> Compartir
            </button>
            <div className="gma-partido">
              {/* T3: en una presentación la acción principal es Presentar (Publicar queda en el ▾). */}
              {presentacion ? (
                <button type="button" className="gma-boton gma-boton--primario gma-tip" data-tip="Presentar" data-atajo={`${mod}↵`}
                  onClick={() => setDialogo('presentar')}>
                  <Ico n="presentar" t={15} /> Presentar
                </button>
              ) : (
                <button type="button" className="gma-boton gma-boton--primario gma-tip"
                  data-tip={cambiosSinPublicar ? 'Tienes cambios que publicar' : 'Publicar'}
                  onClick={() => setDialogo('publicar')}>
                  <Ico n="subir" t={15} /> Publicar
                </button>
              )}
              <button type="button" className="gma-boton gma-boton--primario" aria-label={presentacion ? 'Más opciones' : 'Más opciones de publicación'}
                aria-expanded={!!menuPublicar} onClick={(e) => setMenuPublicar(menuPublicar ? null : e.currentTarget)}>
                <Ico n="chevron-abajo" t={14} />
              </button>
              {cambiosSinPublicar ? <span className="gma-punto-cambios" aria-hidden /> : null}
            </div>
            <button type="button" className="gma-boton gma-boton--icono gma-tip" data-tip="Más" aria-label="Menú del documento"
              aria-expanded={!!menuDoc} onClick={(e) => setMenuDoc(menuDoc ? null : e.currentTarget)}>
              <Ico n="puntos" t={18} />
            </button>
            <span className="gma-avatar" title={autor ?? undefined} aria-label={autor ?? 'Tú'}>{iniciales(autor)}</span>
          </div>
        </header>

        {estado === 'conflicto' ? (
          <div className="gma-aviso" role="alert">
            Hay una versión más nueva de esta landing.
            <button type="button" className="gma-boton gma-boton--chico gma-boton--primario" onClick={() => { void recargar(); }}>Recargar</button>
          </div>
        ) : null}

        <div className="gma-cuerpo">
          {/* ── Panel izquierdo: el agente o las páginas ── */}
          {panelIzq === 'agente' ? (
            <aside className="gma-izq" data-panel="agente" aria-label="Edición con IA">
              {/* Sin cabecera propia: la del agente (casa, título y plegar) es la única. Había dos. */}
              <div className="gma-izq-cuerpo"><PanelAgente /></div>
            </aside>
          ) : panelIzq === 'paginas' ? (
            <aside className="gma-izq" data-panel="paginas" aria-label="Páginas">
              <PanelPaginas onCerrar={cerrarPaginas} />
            </aside>
          ) : null}

          <main className="gma-centro">
            {/* ── Barra de herramientas ── */}
            <div className="gma-herramientas" role="toolbar" aria-label="Herramientas">
              {/* Sin «Edición manual / Edición con IA»: con el agente abierto se edita a mano igual. Lo
                  único que queda es volver a abrirlo si se plegó. */}
              {!modoIA && (
                <>
                  <button type="button" className="gma-herr-boton gma-tip" data-tip="Abrir MaKo" data-atajo={`${mod}E`} aria-label="Abrir MaKo"
                    onClick={() => setModoIA(true)}>
                    <Ico n="destellos" t={16} />
                  </button>
                  <span className="gma-sep" />
                </>
              )}
              <DeshacerRehacer editor={editor} mod={mod} />
              <span className="gma-sep" />
              <button type="button" className="gma-herr-boton gma-tip" data-tip="Agregar bloque" aria-label="Agregar bloque"
                aria-expanded={!!agregarBloque} disabled={!editor || paginaRota}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => setAgregarBloque(agregarBloque ? null : e.currentTarget)}>
                <Ico n="grilla-mas" t={16} /> <span className="gma-herr-texto">Agregar bloque</span>
              </button>
              <span className="gma-sep" />
              <div className="gma-herr-ctx">
                <BarraFormato modo="fija" />
              </div>
              <div className="gma-herr-der">
                <div className="gma-dispositivos" role="group" aria-label="Vista por dispositivo">
                  {DISPOSITIVOS.map((d) => (
                    <button key={d.id} type="button" className="gma-herr-boton gma-tip" data-tip={d.nombre} aria-label={d.nombre}
                      aria-pressed={dispositivo === d.id} onClick={() => setDispositivo(d.id)}>
                      <Ico n={d.icono} t={15} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="gma-area">
              {tiraVisible ? (
                <TiraSecciones revision={revision} onCerrar={() => cambiarTira(false)} />
              ) : (
                <button type="button" className="gma-boton gma-boton--contorno gma-boton--chico gma-boton--icono gma-tira-abrir gma-tip"
                  data-tip="Abrir tira de imágenes" aria-label="Abrir tira de imágenes" onClick={() => cambiarTira(true)}>
                  <Ico n="diseno" t={14} />
                </button>
              )}

              {/* ── El lienzo ── */}
              <div
                ref={lienzoRef}
                className="gma-lienzo"
                data-dispositivo={dispositivo}
                onScroll={alScrollear}
                onDragOverCapture={sobreLienzo}
                onDropCapture={soltarEnLienzo}
              >
                {sinPaginas ? (
                  <div className="gma-vacio">
                    <h2 className="gma-vacio-titulo">{presentacion ? 'Esta presentación está vacía' : 'Esta landing no tiene páginas'}</h2>
                    <div className="gma-vacio-acciones">
                      <button type="button" className="gma-boton gma-boton--primario"
                        onClick={() => setPaginas([{ id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: docPagina([tarjetaVacia()]) }])}>
                        {presentacion ? 'Añadir diapositiva' : 'Añadir página'}
                      </button>
                    </div>
                  </div>
                ) : paginaRota ? (
                  <div className="gma-vacio" role="alert">
                    <h2 className="gma-vacio-titulo">No se pudo abrir esta página</h2>
                    <p className="gma-vacio-texto">Su contenido no coincide con el editor. No se modificó.</p>
                    <div className="gma-vacio-acciones">
                      <button type="button" className="gma-boton gma-boton--primario" onClick={() => { void recargar(); }}>Recargar</button>
                      <button type="button" className="gma-boton gma-boton--contorno" onClick={() => setPanelDer('historial')}>Historial de versiones…</button>
                    </div>
                  </div>
                ) : null}
                <div
                  className="gm-doc"
                  data-modo="editor"
                  data-tema={config.tema}
                  data-formato={presentacion ? 'presentacion' : undefined}
                  data-proporcion={presentacion ? proporcionDe(config) : undefined}
                  data-dispositivo={dispositivo === 'escritorio' ? undefined : dispositivo}
                  style={{ ...estiloDoc, display: paginaRota || sinPaginas ? 'none' : undefined }}
                >
                  <div className="gm-fondo">
                    <EditorContent editor={editor} />
                  </div>
                </div>
                <AsaBloque />
                <MenuBarra />
                <BarraFormato modo="flotante" />
              </div>
            </div>

            {/* ── Esquina: zoom y atajos ── */}
            <div className="gma-esquina" data-esquina-ocupada="">
              <button type="button" className="gma-zoom gma-tip" data-tip="Zoom" data-tip-lado="arriba" aria-label="Zoom"
                aria-expanded={!!menuZoom} onClick={(e) => setMenuZoom(menuZoom ? null : e.currentTarget)}>
                {zoom}%
              </button>
              <button type="button" className="gma-ayuda gma-tip" data-tip="Atajos de teclado" data-tip-lado="izquierda" data-atajo={`${mod}/`}
                aria-label="Atajos de teclado" onClick={() => setDialogo('atajos')}>
                ?
              </button>
            </div>
          </main>

          {/* ── Panel derecho ── */}
          {panelDer ? (
            <aside className="gma-der" aria-label={panelDer === 'tema' ? 'Tema' : panelDer === 'comentarios' ? 'Comentarios' : 'Historial de versiones'}>
              {panelDer === 'tema' ? <PanelTema onCerrar={cerrarPanelDer} /> : null}
              {panelDer === 'comentarios' ? <PanelComentarios /> : null}
              {panelDer === 'historial' ? <PanelHistorial /> : null}
            </aside>
          ) : null}
        </div>

        {/* ── Menús ── */}
        <MenuDocumento abierto={!!menuDoc} ancla={menuDoc} onCerrar={() => setMenuDoc(null)} info={info} />
        {menuPublicar ? (
          <Menu ancla={menuPublicar} onCerrar={() => setMenuPublicar(null)} alinear="fin" etiqueta={presentacion ? 'Presentar' : 'Publicar'} ancho={240}>
            {presentacion ? (
              <>
                <ItemMenu icono="presentar" texto="Presentar" atajo={`${mod}↵`} onClick={() => setDialogo('presentar')} />
                <SepMenu />
              </>
            ) : null}
            <ItemMenu icono="globo" texto="Publicar" onClick={() => setDialogo('publicar')} />
            <ItemMenu icono="ojo" texto="Vista previa" onClick={() => { void vistaPrevia(); }} />
            {urlPublica ? (
              <ItemMenu icono="flecha-externa" texto="Ver página publicada"
                onClick={() => { window.open(urlPublica, '_blank', 'noopener,noreferrer'); }} />
            ) : null}
            {presentacion ? null : (
              <>
                <SepMenu />
                <ItemMenu icono="presentar" texto="Presentar" atajo={`${mod}↵`} onClick={() => setDialogo('presentar')} />
              </>
            )}
          </Menu>
        ) : null}
        {menuZoom ? (
          <Menu ancla={menuZoom} onCerrar={() => setMenuZoom(null)} alinear="fin" arriba etiqueta="Zoom" ancho={200}>
            <ItemMenu icono="zoom-mas" texto="Acercar" disabled={zoom >= ZOOMS[ZOOMS.length - 1]} mantenerAbierto onClick={() => pasoZoom(1)} />
            <ItemMenu icono="zoom-menos" texto="Alejar" disabled={zoom <= ZOOMS[0]} mantenerAbierto onClick={() => pasoZoom(-1)} />
            <ItemMenu icono="check" texto="Zoom al 100%" disabled={zoom === 100} onClick={() => cambiarZoom(100)} />
          </Menu>
        ) : null}
        {agregarBloque ? <AgregarBloque ancla={agregarBloque} onCerrar={() => setAgregarBloque(null)} /> : null}

        {/* ── Diálogos ──
            Los de I1 reciben `onCerrar` (de identidad fija); los de I2 se cierran solos por el
            contexto (`setDialogo(null)` / `setPanelDer(null)`), y Presentar avisa con `onSalir`. */}
        {dialogo === 'compartir' ? <DialogoCompartir onCerrar={cerrarDialogo} /> : null}
        {dialogo === 'publicar' ? <DialogoPublicar onCerrar={cerrarDialogo} /> : null}
        {dialogo === 'exportar' ? <DialogoExportar onCerrar={cerrarDialogo} /> : null}
        {dialogo === 'configuracion' ? <DialogoConfiguracion onCerrar={cerrarDialogo} /> : null}
        {dialogo === 'analitica' ? <DialogoAnalitica /> : null}
        {dialogo === 'atajos' ? <DialogoAtajos /> : null}
        {dialogo === 'presentar' ? <Presentar onSalir={cerrarDialogo} /> : null}
        <SelectorImagen {...selector} />

        {toast ? (
          <div key={toast.id} className="gma-toast" role="status">
            <span>{toast.texto}</span>
            {toast.onDeshacer ? (
              <button type="button" className="gma-toast-accion" onClick={() => { const f = toast.onDeshacer; setToast(null); f?.(); }}>
                Deshacer
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </EditorLandingContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Piezas chicas de la barra
// ─────────────────────────────────────────────────────────────────────────────

/** El estado del guardado, chico, al lado del título. */
function IndicadorGuardado({ estado, onReintentar }: { estado: EstadoGuardado; onReintentar: () => void }) {
  if (estado === 'guardando') {
    return <span className="gma-estado" data-estado={estado} role="status"><Ico n="refrescar" t={13} className="gma-girar" /> Guardando…</span>;
  }
  if (estado === 'guardado') {
    return <span className="gma-estado" data-estado={estado} role="status"><Ico n="nube-check" t={14} /> Guardado</span>;
  }
  if (estado === 'sin-guardar') {
    return <span className="gma-estado" data-estado={estado} role="status">Sin guardar</span>;
  }
  if (estado === 'error') {
    return (
      <span className="gma-estado" data-estado={estado} role="status">
        <Ico n="x-circulo" t={14} /> No se guardó ·{' '}
        <button type="button" className="gma-estado-reintentar" onClick={onReintentar}>Reintentar</button>
      </span>
    );
  }
  return <span className="gma-estado" data-estado={estado} role="status"><Ico n="x-circulo" t={14} /> Versión más nueva</span>;
}

/**
 * Deshacer y Rehacer de la barra. Leen `can()` con useEditorState (re-render sólo cuando cambia
 * la respuesta, no por tecla) y no le roban el foco al texto (onMouseDown + preventDefault).
 */
function DeshacerRehacer({ editor, mod }: { editor: Editor | null; mod: string }) {
  const puede = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      deshacer: !!e && !e.isDestroyed && e.isEditable && e.can().undo(),
      rehacer: !!e && !e.isDestroyed && e.isEditable && e.can().redo(),
    }),
  }) ?? { deshacer: false, rehacer: false };
  return (
    <>
      <button type="button" className="gma-herr-boton gma-tip" data-tip="Deshacer" data-atajo={`${mod}Z`} aria-label="Deshacer"
        disabled={!puede.deshacer} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.commands.undo()}>
        <Ico n="deshacer" t={16} />
      </button>
      <button type="button" className="gma-herr-boton gma-tip" data-tip="Rehacer" data-atajo={`${mod}Shift+Z`} aria-label="Rehacer"
        disabled={!puede.rehacer} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.commands.redo()}>
        <Ico n="rehacer" t={16} />
      </button>
    </>
  );
}
