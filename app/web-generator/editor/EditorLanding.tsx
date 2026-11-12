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
// plegó —el interruptor Edición manual / Edición con IA de Gamma se sacó el 12/10—, Deshacer/Rehacer, «⊞ Agregar bloque»,
// «Animar» —el panel de animaciones, copiado del Image Editor y de Canva el 15/10: paneles/PanelAnimacion.tsx—, la zona contextual de formato y
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
// Las piezas de la caja del Ops Center en el chat del agente (paneles/PanelAgente.tsx no puede cargar CSS: lo importan
// módulos que cargan los tests).
import '@/app/admin/operaciones/centro.css';
import {
  Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type DragEvent as DragEventReact,
} from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import type { Node as NodoPM } from '@tiptap/pm/model';
import Link from '@/app/_ui/Link';
import { TEMAS, temaPorId, urlFuentes, varsDeTema } from '@/lib/editor-landing/temas';
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
  type CtxEditorLanding, type Dialogo, type EstadoGuardado, type ModoAnimar, type OpcionesImagen, type PanelDer, type PanelIzq, type PedidoAnimar,
} from './contexto';
import { extensionesLanding, ponerAnimacionDePagina } from './extensiones';
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
import { tomarAvisoDeReplica } from '../crear/aviso-replica';
import PanelComentarios from './paneles/PanelComentarios';
import PanelHistorial from './paneles/PanelHistorial';
import PanelAnimacion from './paneles/PanelAnimacion';
import DialogoCompartir from './dialogos/DialogoCompartir';
import DialogoPublicar from './dialogos/DialogoPublicar';
import DialogoExportar from './dialogos/DialogoExportar';
import { PanelLandings, RUTA_NUEVA_LANDING } from './paneles/PanelLandings';
import type { Analizada, Derecha } from '../panel-reglas';
import DialogoConfiguracion from './dialogos/DialogoConfiguracion';
import DialogoAnalitica from './dialogos/DialogoAnalitica';
import DialogoAtajos from './dialogos/DialogoAtajos';
import Presentar from './Presentar';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

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

/**
 * «Nueva landing» (24/10/2026): el cuadro «¿Qué vas a crear hoy?» del Panel con sus plantillas, montado ACÁ en lugar de la
 * barra y el lienzo. Perezoso: trae Crear, el Diagnóstico y Replicar, que el editor no usa hasta que se toca «Nueva landing».
 */
const InicioEmbebido = lazy(() => import('../Inicio').then((m) => ({ default: m.Inicio })));

type Dispositivo = 'escritorio' | 'tableta' | 'movil';
const DISPOSITIVOS: { id: Dispositivo; nombre: string; icono: string }[] = [
  { id: 'escritorio', nombre: 'Vista previa del escritorio', icono: 'escritorio' },
  { id: 'tableta', nombre: 'Vista previa en tablet', icono: 'tablet' },
  { id: 'movil', nombre: 'Vista previa móvil', icono: 'celular' },
];

const CLAVE_ZOOM = 'gma.lienzo.zoom';
/** La segunda barra (el editor de texto) abierta o cerrada, recordada por quien mira. */
const CLAVE_FORMATO = 'gma.formato.abierto';

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
function baseDelLienzo(dispositivo: Dispositivo, zoom: number, diapo: { ancho: number } | null = null, lienzo = 0): Record<string, string> {
  const z = zoom / 100;
  if (dispositivo === 'movil') return { '--gm-base-movil': `calc(16px * ${z})`, '--gm-base': `calc(16px * ${z})` };
  // T3: una diapositiva de forma fija mide 64.5em y tiene que ENTRAR de ancho (si no, su alto sale
  // del ancho achicado y el contenido, en em, desborda): la letra base sale del ancho del lienzo
  // (o del cuadro de la tableta, que mide min(820px, lienzo − 32px): gamma.css). 68.5 = 64.5 + 4 de aire.
  const tope = diapo && diapo.ancho > 0
    ? `${(Math.round(((dispositivo === 'tableta' ? Math.min(820, diapo.ancho - 32) : diapo.ancho) / 68.5) * 100) / 100)}px`
    : null;
  if (dispositivo === 'tableta') return { '--gm-base': tope ? `calc(min(15px, ${tope}) * ${z})` : `calc(15px * ${z})` };
  // Una PÁGINA en el escritorio también sale del ancho del lienzo (prueba en producción del 10/11/2026): con `100vw` la letra era
  // la de la ventana entera y el lienzo, con el chat y un panel abiertos, mide la mitad. El título de la portada partía palabras
  // («prim / eros», «clien / tes») y los botones salían en dos renglones. Como en Gamma, la sección se achica entera y se ve como
  // la publicada a ese ancho.
  const topePagina = !diapo && lienzo > 0 ? `${Math.round((lienzo / 68.5) * 100) / 100}px` : null;
  const t = tope ?? topePagina;
  const normal = 'clamp(15px, calc(100vw / 68.5), 18px)';
  return { '--gm-base': `calc(${t ? `min(${normal}, ${t})` : normal} * ${z})` };
}

// (Acá estaban las iniciales del avatar de la barra de arriba: el avatar se fue con esa barra el 24/10/2026; la app ya
// muestra el suyo en la barra lateral.)

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
  /** Para «Nueva landing» (el cuadro de crear adentro del editor): las landings de afuera ya analizadas, como en el Panel. */
  analizadas?: Analizada[];
  errorAnalizadas?: string | null;
  /** Las bases de las landings publicadas, la vigente primero (`basesLandings`); sin ellas, la de esta landing. */
  bases?: string[];
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
        <Link href={RUTA_NUEVA_LANDING} className="gma-boton gma-boton--icono gma-tip" data-tip="Panel" aria-label="Panel">
          <Ico n="casa" t={18} />
        </Link>
      </div>
      <div className="gma-vacio">
        <h1 className="gma-vacio-titulo">No se pudo abrir la landing</h1>
        {error ? <p className="gma-vacio-texto">{error}</p> : null}
        <div className="gma-vacio-acciones">
          <button type="button" className="gma-boton gma-boton--primario" onClick={() => window.location.reload()}>Reintentar</button>
          <Link href={RUTA_NUEVA_LANDING} className="gma-boton gma-boton--contorno">Volver al Panel</Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El armazón
// ─────────────────────────────────────────────────────────────────────────────

function Armazon({ doc, temasPropios, creadoPor, analizadas, errorAnalizadas, bases }: PropsEditorLanding & { doc: LandingCompleta }) {
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
  // El agente arranca ABIERTO y ya NO se pliega (24/10/2026, Martín: «La sidebar del chat de MaKo NO se debe poder cerrar
  // nunca. Elimina el boton de plegar»; el 12/10 había pedido «de ultima que se pueda plegar», lo posterior gana). La
  // tarjeta siempre está; cambia de vista (el chat, las páginas, tus landings, la tira). Con el agente abierto se edita a
  // mano igual.
  const [panelIzq, setPanelIzqEstado] = useState<PanelIzq>('agente');
  /** «Nueva landing» abierta (se ve sólo con la lista a la izquierda: salir de la lista la cierra, ver el efecto). */
  const [nueva, setNuevaEstado] = useState(false);
  /** Lo que «Nueva landing» tiene que abrir en vez del cuadro (una réplica sin terminar, ticket #54): ver `retomarReplica`. */
  const [pedidoNueva, setPedidoNueva] = useState<{ n: number; derecha: Derecha } | null>(null);
  const pedidos = useRef(0);
  const [panelEntero, setPanelEntero] = useState(false);
  const [revisionLista, setRevisionLista] = useState(0);
  const listaCambio = useCallback(() => setRevisionLista((n) => n + 1), []);
  // Inicio se desmonta al volver a la landing: lo analizado (eliminar, sumar) vive acá, o reaparecería lo eliminado.
  const [analizadasVivas, setAnalizadasVivas] = useState<Analizada[]>(analizadas ?? []);
  // El Diagnóstico de esta misma landing le sube la versión en el server: al volver, se lee de nuevo (o el guardado daría conflicto).
  const seDiagnosticoLaAbierta = useRef(false);
  const marcarDiagnostico = useCallback(() => { seDiagnosticoLaAbierta.current = true; }, []);
  const [panelDer, setPanelDer] = useState<PanelDer>(null);
  /** Lo último que pidieron al abrir «Animar» (la vista; ver `abrirAnimar`). */
  const [pedidoAnimar, setPedidoAnimar] = useState<PedidoAnimar | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [zoom, setZoom] = useState(100);
  /** La segunda barra, la del editor de texto (botón «Texto»). Cerrada hasta leer lo recordado: el server no tiene navegador. */
  const [formatoAbierto, setFormatoAbierto] = useState(false);
  const [dispositivo, setDispositivo] = useState<Dispositivo>('escritorio');
  const [toast, setToast] = useState<{ id: number; texto: string; onDeshacer?: () => void } | null>(null);
  const [menuDoc, setMenuDoc] = useState<HTMLElement | null>(null);
  const [menuPublicar, setMenuPublicar] = useState<HTMLElement | null>(null);
  /** El botón azul «Compartir»: el panel Compartir se abre debajo de él (sin él, abre centrado). */
  const [anclaCompartir, setAnclaCompartir] = useState<HTMLElement | null>(null);
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
  const avisar = useCallback((texto: string, onDeshacer?: () => void, ms?: number) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), texto, onDeshacer });
    toastTimer.current = window.setTimeout(() => setToast(null), ms ?? (onDeshacer ? 6000 : 3500));
  }, []);

  // La línea del resultado de Replicar (tanda 8: lo que no se copió del scroll), UNA vez al abrir esta copia. La deja
  // ../crear/Replicar.tsx antes de navegar; se consume en el efecto y queda en el ref (el modo estricto corre el efecto
  // dos veces y el desmonte de mentira borra el temporizador del aviso: se muestra en el turno siguiente).
  const avisoReplica = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (avisoReplica.current === undefined) avisoReplica.current = tomarAvisoDeReplica(docId);
    const texto = avisoReplica.current;
    if (!texto) return;
    // El tiempo de LEERLO (12/11/2026): en 3,5 s se iba «9 secciones quedaron con el texto de la original» antes de terminar la
    // primera línea, y la copia parecía adaptada. Entre 8 y 15 s, según el largo.
    const t = window.setTimeout(() => { avisoReplica.current = null; avisar(texto, undefined, Math.min(15_000, Math.max(8_000, texto.length * 70))); }, 0);
    return () => window.clearTimeout(t);
  }, [docId, avisar]);

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

  /**
   * Abre «Animar» (paneles/PanelAnimacion.tsx) en una vista. Con `tarjetaId` («Animar sección» del menú de una
   * sección) esa sección pasa a ser la activa: el cursor va adentro SIN scroll (la persona la está mirando: abrió su
   * menú), así el panel y la tira hablan de la misma.
   */
  const abrirAnimar = useCallback((modo: ModoAnimar, tarjetaId?: string) => {
    const e = editorRef.current;
    if (tarjetaId && e && !e.isDestroyed) {
      const s = seccionPorId(e.state.doc, tarjetaId);
      if (s) {
        try {
          e.view.dispatch(e.state.tr.setSelection(TextSelection.near(e.state.doc.resolve(s.pos + 1))));
        } catch { /* una sección sin texto: alcanza con marcarla activa */ }
        setTarjetaActiva(tarjetaId);
      }
    }
    setPedidoAnimar((p) => ({ modo, n: (p?.n ?? 0) + 1 }));
    setPanelDer('animacion');
  }, [setTarjetaActiva]);

  // Las secciones del lienzo llevan los data-* de su animación por un plugin de decoraciones
  // (animacion-reglas.ts): la config le llega acá. `revision` cambia al abrir cada página (un EditorState nuevo).
  const animacionesPagina = config.pagina.animaciones;
  const estiloPagina = config.pagina.estiloAnimacion;
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      ponerAnimacionDePagina(editor.view, { animaciones: animacionesPagina, estiloAnimacion: estiloPagina });
    } catch { /* la vista todavía no está montada: el próximo `revision` lo vuelve a intentar */ }
  }, [editor, revision, animacionesPagina, estiloPagina]);

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
  const setPanelIzq = useCallback((p: PanelIzq) => { setPanelIzqEstado(p); }, []);
  // El chat no se pliega: «apagar» el modo IA no cierra nada (la tarjeta siempre está); prenderlo vuelve al chat.
  const setModoIA = useCallback((v: boolean) => { if (v) setPanelIzqEstado('agente'); }, []);
  /**
   * «Nueva landing» NO navega ni cambia la tarjeta de la izquierda (24/10/2026, Martín, textual: «NO me debe redireccionar a
   * otra ruta... Y la sidebar no debe cambiar... Solamente debe aparecer el "¿Qué vas a crear hoy?" con los templates en lugar
   * de la topbar de edición y el lienzo»). Lo pendiente de esta landing se guarda antes; la barra y el lienzo quedan
   * montados (ocultos), así que volver a ella es instantáneo y con el deshacer intacto.
   */
  const setNueva = useCallback((v: boolean) => {
    if (v) {
      void guardarAhora();
      setPanelDer(null);
      setPanelIzqEstado('landings');
    }
    setNuevaEstado(v);
    setPanelEntero(false);
    // «Nueva landing» a secas es el cuadro de crear: lo pedido por una réplica sin terminar no se vuelve a abrir solo.
    setPedidoNueva(null);
  }, [guardarAhora]);
  const verPanel = useCallback(() => { setNueva(true); setPanelEntero(true); }, [setNueva]);
  /**
   * Ticket #54 (4/11/2026): una réplica sin terminar se retoma ACÁ, en «Nueva landing», con lo leído (el borrador de la
   * lectura, lib/editor-landing/replica-borrador.ts). Antes, volver al chat desde la lista cerraba «Nueva landing» y lo leído
   * se perdía. El `n` sube en cada pedido: el Panel embebido abre la réplica cuando cambia (sin remontarlo).
   */
  const retomarReplica = useCallback((url: string, adaptar: boolean) => {
    setNueva(true);
    pedidos.current += 1;
    setPedidoNueva({ n: pedidos.current, derecha: { tipo: 'replicar', url, ...(adaptar ? { adaptar: true } : {}), auto: true } });
  }, [setNueva]);
  // Ir al chat o a las páginas es volver a ESTA landing: «Nueva landing» se cierra (vale también para Mod+E).
  useEffect(() => {
    if (panelIzq !== 'landings') setNuevaEstado(false);
  }, [panelIzq]);
  const creando = nueva && panelIzq === 'landings';
  const volverAgente = useCallback(() => setPanelIzqEstado('agente'), []);
  useEffect(() => {
    if (creando || !seDiagnosticoLaAbierta.current) return;
    seDiagnosticoLaAbierta.current = false;
    void recargar();
  }, [creando, recargar]);
  // Las miniaturas de las plantillas se dibujan con la fuente de su tema (el Panel las carga todas en su página).
  const fuentesPlantillas = useMemo(
    () => (creando ? urlFuentes([...TEMAS, ...propios.map((p) => temaPorId('ws:' + p.id, propios))]) : ''),
    [creando, propios],
  );

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
    marcarActiva: setTarjetaActiva,
    modoIA,
    setModoIA,
    panelIzq,
    setPanelIzq,
    nueva: creando && !panelEntero,
    setNueva,
    panelEntero: creando && panelEntero,
    verPanel,
    retomarReplica,
    revisionLista,
    panelDer,
    setPanelDer,
    abrirAnimar,
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
    irAPagina, setPaginas, editor, tarjetaActiva, irATarjeta, setTarjetaActiva, modoIA, setModoIA, panelIzq, setPanelIzq, panelEntero, verPanel, retomarReplica, revisionLista, creando, setNueva, panelDer, abrirAnimar,
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
  /** Cerrar las páginas o la tira vuelve al chat: la tarjeta nunca queda vacía. */
  const cerrarPaginas = useCallback(() => setPanelIzqEstado('agente'), []);
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
        // Mod+E lleva al chat (ya no lo cierra: el chat no se pliega) y pone el cursor en su caja.
        e.preventDefault();
        setPanelIzqEstado('agente');
        window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.gma-ag textarea')?.focus());
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
        else if (u.panelIzq === 'paginas' || u.panelIzq === 'tira') cerrarPaginas();
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
  // Preferencias de quien mira (el zoom y la barra del editor de texto): se restauran del navegador si se puede. (La tira
  // ya no es una columna que se recuerda: es una vista de la tarjeta de la izquierda, 24/10/2026.)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const z = Number(localStorage.getItem(CLAVE_ZOOM));
      if ((ZOOMS as readonly number[]).includes(z)) setZoom(z);
      if (localStorage.getItem(CLAVE_FORMATO) === 'si') setFormatoAbierto(true);
    } catch { /* sin almacenamiento: quedan las de siempre */ }
  }, []);
  const cambiarZoom = useCallback((z: number) => {
    setZoom(z);
    try { localStorage.setItem(CLAVE_ZOOM, String(z)); } catch { /* sin almacenamiento */ }
  }, []);
  const cambiarFormato = useCallback((v: boolean) => {
    setFormatoAbierto(v);
    try { localStorage.setItem(CLAVE_FORMATO, v ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
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

  // ── Compartir ▾ y el panel Compartir: Vista previa abre el borrador por el link privado, con lo pendiente mandado ──
  // (`window.open` va primero y sin `await` antes: tiene que salir en el mismo clic, o el navegador lo bloquea.)
  const vistaPrevia = async () => {
    const ventana = window.open('', '_blank');
    await guardarAhora();
    const r = await pedirDocs({ accion: 'vistaPrevia', id: docId });
    if (!r.ok) { ventana?.close(); avisar('No se pudo abrir'); return; }
    if (ventana) { ventana.opener = null; ventana.location.href = r.url; return; }
    // Con las ventanas emergentes bloqueadas no pasaba NADA al tocar «Vista previa» (12/11/2026, medido en el navegador de la
    // app de Claude): la pestaña del clic no se abre y la de después del `await` tampoco. Que se sepa por qué.
    // (Sin `noopener` en el pedido: con él `window.open` devuelve null SIEMPRE y no se sabría si se abrió.)
    const otra = window.open(r.url, '_blank');
    if (otra) otra.opener = null;
    else avisar('Tu navegador bloqueó la pestaña: habilita las ventanas emergentes', undefined, 6000);
  };

  // El ancho del lienzo, para la letra base de una diapositiva fija y de una página en el escritorio (baseDelLienzo). Se
  // redondea a 8 px: un ResizeObserver dispara por cada píxel al abrir un panel. Con «Nueva landing» o el Panel el lienzo se
  // desmonta (`creando`): al volver se mide el nuevo.
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const medir = () => setAnchoLienzo(Math.round(el.clientWidth / 8) * 8);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [creando]);

  const paginaRota = rota !== null && rota === paginaActual;
  const sinPaginas = contenido.paginas.length === 0;
  const estiloDoc = useMemo(
    () => ({ ...varsDeTema(tema), ...baseDelLienzo(dispositivo, zoom, fija ? { ancho: anchoLienzo } : null, anchoLienzo) }) as CSSProperties,
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

        {/* ⚠️ ACÁ HABÍA UNA SEGUNDA BARRA arriba de la de herramientas (casa, páginas, título, guardado, Compartir, Publicar,
            ⋯ y el avatar). Martín, 24/10/2026: «Hay 2 topbar de edición, debería haber solo 1... fijate como en diseño que
            entre todo bien». Todo pasó a la de herramientas (abajo); la casa la reemplaza la «←» del chat (la lista de la
            tarjeta) y el avatar ya está en la barra lateral de la app. */}

        {estado === 'conflicto' ? (
          <div className="gma-aviso" role="alert">
            Hay una versión más nueva de esta landing.
            <button type="button" className="gma-boton gma-boton--chico gma-boton--primario" onClick={() => { void recargar(); }}>Recargar</button>
            <ReportarASoporte />
          </div>
        ) : null}

        <div className="gma-cuerpo">
          {/* ── Panel izquierdo: el agente o las páginas ── */}
          {/* Columnas en <section> y no en <aside> (22/10/2026): con la barra de la agencia, `[data-barra-agencia] aside`
              (app/globals.css) le fuerza a todo <aside> el alto de la ventana, y la columna se pasaba 48 px del cuerpo: la caja
              del agente quedaba fuera de la vista. Medido en producción, ws3 (761 px en un cuerpo de 713). */}
          {panelIzq === 'landings' ? (
            <section role="complementary" className="gma-izq" data-panel="landings" aria-label="Tus landings">
              <div className="gma-izq-cuerpo"><PanelLandings /></div>
            </section>
          ) : panelIzq === 'agente' ? (
            <section role="complementary" className="gma-izq" data-panel="agente" aria-label="Edición con IA">
              {/* Sin cabecera propia: la del agente (casa, título y plegar) es la única. Había dos. */}
              <div className="gma-izq-cuerpo"><PanelAgente /></div>
            </section>
          ) : panelIzq === 'paginas' ? (
            <section role="complementary" className="gma-izq" data-panel="paginas" aria-label="Páginas">
              <PanelPaginas onCerrar={cerrarPaginas} />
            </section>
          ) : (
            // La tira de secciones, en la MISMA tarjeta del chat (24/10/2026, Martín: «"Abrir tira de imagenes" debería ser
            // un botón en la topbar, y se debería abrir donde está el chat de mako»). Antes era una columna entre la tarjeta
            // y el lienzo, con su botón flotando en la esquina del lienzo, encima de los controles de la primera sección.
            <section role="complementary" className="gma-izq" data-panel="tira" aria-label="Secciones">
              <TiraSecciones revision={revision} onCerrar={cerrarPaginas} />
            </section>
          )}

          {/* ── «Nueva landing»: «¿Qué vas a crear hoy?» y las plantillas EN LUGAR de la barra y el lienzo, sin navegar ── */}
          {creando ? (
            <div className="gma-centro" role="region" aria-label={panelEntero ? 'Panel' : 'Nueva landing'}>
              {fuentesPlantillas ? <link rel="stylesheet" href={fuentesPlantillas} precedence="default" /> : null}
              <Suspense fallback={<div className="gma-vacio"><p className="gma-vacio-texto">Cargando…</p></div>}>
                <InicioEmbebido
                  embebido
                  conLista={panelEntero}
                  docAbierto={docId}
                  onCambioLista={listaCambio}
                  onCambioAnalizadas={setAnalizadasVivas}
                  onDiagnosticoDeLaAbierta={marcarDiagnostico}
                  onVolverALaLanding={volverAgente}
                  docs={[]}
                  errorLista={null}
                  analizadas={analizadasVivas}
                  errorAnalizadas={errorAnalizadas ?? null}
                  propios={propios}
                  errorTemas={null}
                  bases={bases?.length ? bases : [doc.baseLandings]}
                  ahora={Date.now()}
                  derechaInicial={{ tipo: 'crear' }}
                  derechaPedida={pedidoNueva}
                />
              </Suspense>
            </div>
          ) : null}

          {/* La landing abierta queda MONTADA mientras se elige una nueva (oculta): volver es instantáneo y no se pierde el
              deshacer ni el foco del texto. */}
          <main className="gma-centro" style={creando ? { display: 'none' } : undefined}>
            {/* ── Barra de herramientas ── */}
            <div className="gma-herramientas" role="toolbar" aria-label="Herramientas">
              {/* Sin «Edición manual / Edición con IA»: con el agente abierto se edita a mano igual. Lo
                  único que queda es volver a abrirlo si se plegó. */}
              {/* El título, al principio de la barra única, con lugar para leerse: «Guardado» se fue (24/10/2026, Martín:
                  «Elimina "Guardado", ya que no deja ver bien el título de la pagina... Y extiende mas la sección del titulo»).
                  El indicador sólo aparece cuando hay algo que hacer (no se guardó, o hay una versión más nueva). */}
              <input
                className="gma-titulo"
                value={titulo}
                placeholder="Sin título"
                aria-label="Editar título"
                title={titulo || 'Sin título'}
                maxLength={TOPES.titulo}
                size={Math.min(40, Math.max(12, (titulo || 'Sin título').length + 1))}
                onChange={(e) => setTitulo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
              />
              <IndicadorGuardado estado={estado} onReintentar={() => { void guardarAhora(); }} />
              <span className="gma-sep" />
              {/* PRIMERO de las herramientas (25/10/2026, Martín: «el botón de "texto" debe estar al principio de todo, no al
                  final»). El editor de texto es UN botón que abre la segunda barra, abajo (24/10/2026, Martín: «El editor de texto quedó
                  en un scroll muy chiquito, lo que te propongo es que sea un botón el editor de texto y se abra otra topbar
                  tipo edición de texto con todas las opciones»). Como la barra contextual de Canva al tocar un texto. */}
              <button type="button" className="gma-herr-boton gma-tip" data-tip="Editor de texto" aria-label="Editor de texto"
                aria-pressed={formatoAbierto} disabled={!editor || paginaRota}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => cambiarFormato(!formatoAbierto)}>
                <Ico n="texto-aa" t={16} /> <span className="gma-herr-texto">Texto</span>
              </button>
              {/* (Acá estaba «Abrir MaKo», para cuando el chat se plegaba: ya no se pliega.) Las otras vistas de la tarjeta de
                  la izquierda: las páginas y la tira de secciones, que vuelven al chat con un segundo clic. */}
              <button type="button" className="gma-herr-boton gma-tip" data-tip="Páginas" aria-label="Abrir panel de páginas"
                aria-pressed={panelIzq === 'paginas'} onClick={() => (panelIzq === 'paginas' ? cerrarPaginas() : setPanelIzqEstado('paginas'))}>
                <Ico n="paginas" t={16} />
              </button>
              <button type="button" className="gma-herr-boton gma-tip" data-tip="Tira de imágenes" aria-label="Abrir tira de imágenes"
                aria-pressed={panelIzq === 'tira'} onClick={() => (panelIzq === 'tira' ? cerrarPaginas() : setPanelIzqEstado('tira'))}>
                <Ico n="diseno" t={16} />
              </button>
              <DeshacerRehacer editor={editor} mod={mod} />
              <span className="gma-sep" />
              <button type="button" className="gma-herr-boton gma-herr-plegable gma-tip" data-tip="Agregar bloque" aria-label="Agregar bloque"
                aria-expanded={!!agregarBloque} disabled={!editor || paginaRota}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => setAgregarBloque(agregarBloque ? null : e.currentTarget)}>
                <Ico n="grilla-mas" t={16} /> <span className="gma-herr-texto">Agregar bloque</span>
              </button>
              {/* «Animar» (Canva: «On the toolbar above the editor, select Animate»; el AnimateTool del Image Editor):
                  abre o cierra el panel, en la vista de la sección activa si la hay. */}
              <button type="button" className="gma-herr-boton gma-herr-plegable gma-tip" data-tip="Animar" aria-label="Animar"
                aria-pressed={panelDer === 'animacion'} disabled={!editor || paginaRota}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (panelDer === 'animacion' ? setPanelDer(null) : abrirAnimar(tarjetaActivaRef.current ? 'seccion' : 'pagina'))}>
                <Ico n="brillo" t={16} /> <span className="gma-herr-texto">Animar</span>
              </button>
              <div className="gma-herr-ctx" />
              <div className="gma-herr-der">
                <div className="gma-dispositivos" role="group" aria-label="Vista por dispositivo">
                  {DISPOSITIVOS.map((d) => (
                    <button key={d.id} type="button" className="gma-herr-boton gma-tip" data-tip={d.nombre} aria-label={d.nombre}
                      aria-pressed={dispositivo === d.id} onClick={() => setDispositivo(d.id)}>
                      <Ico n={d.icono} t={15} />
                    </button>
                  ))}
                </div>
                <span className="gma-sep" />
                {/* T3: en una presentación, Presentar sigue a un clic (Gamma pone «Present» al lado de «Share»), chico. */}
                {presentacion ? (
                  <button type="button" className="gma-herr-boton gma-tip" data-tip="Presentar" data-atajo={`${mod}↵`} aria-label="Presentar"
                    onClick={() => setDialogo('presentar')}>
                    <Ico n="presentar" t={16} />
                  </button>
                ) : null}
                {/* UN solo botón, azul, que dice «Compartir» (24/10/2026, Martín: «Te pedí que "Compartir" y "publicar" sean un
                    solo botón, azul y que diga "compartir"... Con el desplegable de la vista previa y las otras opciones»).
                    El botón abre el panel Compartir (enlace, Publicar, Descargar…: DialogoCompartir, copiado de Canva); el ▾,
                    Publicar, Vista previa, la página publicada, Descargar y Presentar. */}
                <div className="gma-partido">
                  <button type="button" className="gma-boton gma-boton--primario gma-partido-principal gma-tip"
                    data-tip={cambiosSinPublicar ? 'Tienes cambios que publicar' : 'Compartir'}
                    aria-expanded={dialogo === 'compartir'}
                    onClick={(e) => { setAnclaCompartir(e.currentTarget); setDialogo(dialogo === 'compartir' ? null : 'compartir'); }}>
                    <Ico n="compartir" t={15} /> <span className="gma-partido-texto">Compartir</span>
                  </button>
                  <button type="button" className="gma-boton gma-boton--primario gma-partido-flecha" aria-label="Más opciones para compartir"
                    aria-expanded={!!menuPublicar} onClick={(e) => setMenuPublicar(menuPublicar ? null : e.currentTarget)}>
                    <Ico n="chevron-abajo" t={14} />
                  </button>
                  {cambiosSinPublicar ? <span className="gma-punto-cambios" aria-hidden /> : null}
                </div>
                <button type="button" className="gma-herr-boton gma-tip" data-tip="Más" aria-label="Menú del documento"
                  aria-expanded={!!menuDoc} onClick={(e) => setMenuDoc(menuDoc ? null : e.currentTarget)}>
                  <Ico n="puntos" t={18} />
                </button>
              </div>
            </div>

            {/* ── La segunda barra: el editor de texto con TODAS sus opciones, sin scroll (se parte en dos renglones si no
                entra). La abre y la cierra el botón «Texto»; queda recordada en el navegador. ── */}
            {formatoAbierto ? (
              <div className="gma-herramientas gma-formato">
                <BarraFormato modo="fija" />
              </div>
            ) : null}

            <div className="gma-area">
              {/* (La tira y su botón flotante ya no van acá: la tira es una vista de la tarjeta de la izquierda y su botón
                  está en la barra. El botón flotaba en la esquina del lienzo, sobre la columna de la primera sección.) */}

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
                    <ReportarASoporte />
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
          {panelDer && !creando ? (
            <section role="complementary" className="gma-der" aria-label={panelDer === 'tema' ? 'Tema' : panelDer === 'comentarios' ? 'Comentarios' : panelDer === 'animacion' ? 'Animar' : 'Historial de versiones'}>
              {panelDer === 'tema' ? <PanelTema onCerrar={cerrarPanelDer} /> : null}
              {panelDer === 'comentarios' ? <PanelComentarios /> : null}
              {panelDer === 'historial' ? <PanelHistorial /> : null}
              {panelDer === 'animacion' ? <PanelAnimacion onCerrar={cerrarPanelDer} pedido={pedidoAnimar} /> : null}
            </section>
          ) : null}
        </div>

        {/* ── Menús ── */}
        <MenuDocumento abierto={!!menuDoc} ancla={menuDoc} onCerrar={() => setMenuDoc(null)} info={info} />
        {menuPublicar ? (
          <Menu ancla={menuPublicar} onCerrar={() => setMenuPublicar(null)} alinear="fin" etiqueta="Compartir" ancho={240}>
            <ItemMenu icono="globo" texto={urlPublica && cambiosSinPublicar ? 'Actualizar publicación' : 'Publicar'} onClick={() => setDialogo('publicar')} />
            <ItemMenu icono="ojo" texto="Vista previa" onClick={() => { void vistaPrevia(); }} />
            {urlPublica ? (
              <ItemMenu icono="flecha-externa" texto="Ver página publicada"
                onClick={() => { window.open(urlPublica, '_blank', 'noopener,noreferrer'); }} />
            ) : null}
            <SepMenu />
            <ItemMenu icono="descargar" texto="Descargar…" onClick={() => setDialogo('exportar')} />
            <ItemMenu icono="presentar" texto="Presentar" atajo={`${mod}↵`} onClick={() => setDialogo('presentar')} />
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
        {dialogo === 'compartir' ? <DialogoCompartir onCerrar={cerrarDialogo} ancla={anclaCompartir} onVistaPrevia={vistaPrevia} /> : null}
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

/**
 * El guardado, al lado del título, SÓLO cuando hay algo que hacer. «Guardado», «Guardando…» y «Sin guardar» ya no se
 * dibujan (24/10/2026, Martín: «Elimina "Guardado", ya que no deja ver bien el título de la pagina»): el autoguardado
 * trabaja solo. Lo que no se puede callar sigue: no se guardó (con Reintentar) y la versión más nueva (además del aviso).
 */
function IndicadorGuardado({ estado, onReintentar }: { estado: EstadoGuardado; onReintentar: () => void }) {
  if (estado === 'guardando' || estado === 'guardado' || estado === 'sin-guardar') return null;
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
      <button type="button" className="gma-herr-boton gma-herr-plegable gma-tip" data-tip="Deshacer" data-atajo={`${mod}Z`} aria-label="Deshacer"
        disabled={!puede.deshacer} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.commands.undo()}>
        <Ico n="deshacer" t={16} />
      </button>
      <button type="button" className="gma-herr-boton gma-herr-plegable gma-tip" data-tip="Rehacer" data-atajo={`${mod}Shift+Z`} aria-label="Rehacer"
        disabled={!puede.rehacer} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.commands.redo()}>
        <Ico n="rehacer" t={16} />
      </button>
    </>
  );
}
