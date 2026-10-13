'use client';

// =============================================================================
// EditorInforme — la tab Dashboard ENTERA: un editor de informes estilo Looker Studio con los gráficos de MaKo
// =============================================================================
// Pedidos de Martín (10-11/10/2026): «Puedes copiar la app de Google Data Studio para esto», «Todo la tab
// de Dashboard debe ser el editable, no lo pongas como un recuadro abajo», y el feedback de veinticuatro
// puntos del 11/10 (el texto literal está en app/admin/dev/dashboard/bitacora.ts) y la tanda de la TOPBAR
// del mismo día (nueve puntos: «La topbar se tiene que ver igual a la de looker»). Cómo quedó, de arriba
// abajo:
//
//   · LA TOPBAR (./Cabecera.tsx, `BarraSuperior`), como la de Looker: el emoji, el TÍTULO de la hoja con
//     su ▾ (el desplegable de las hojas, con «Nueva hoja» primera) y debajo el SUBTÍTULO, donde Looker
//     pone «Archivo · Vista · Página · Ayuda»; los tres se editan con un clic, también mirando. A la
//     derecha: los FILTROS de la hoja (./BarraControles.tsx, siempre a la vista; agregarlos o quitarlos,
//     sólo editando), Compartir (./CompartirInforme.tsx, del paquete «Compartir»), Editar/Ver y el ⋮ con
//     AI Analyst, Exportar (CSV y PDF) y la guía. Sin pestañas, sin el ícono de la tab, sin «Restablecer
//     el informe» y sin «Guardado»: un guardado que falla avisa con un toast.
//   · LA BARRA DE EDICIÓN, sólo editando, DEBAJO de la topbar (la topbar no se mueve al apretar Editar),
//     en el orden de la de Looker: deshacer, rehacer · Añadir datos · Añadir un gráfico · lo que se
//     inserta, un ícono por cosa (`BARRA_INSERTAR`, ./Galeria.tsx) · y a la derecha Estilo de la hoja
//     (./PanelEstilo.tsx).
//   · EL LIENZO, que es lo único que scrollea: la grilla. Una sola superficie: var(--bg) de punta a punta
//     (./editor-css.ts), sin filete entre la topbar y el lienzo.
//   · EL PANEL DE PROPIEDADES, sólo con algo elegido (./Propiedades.tsx): el CONTENIDO del componente.
//   · EL AI ANALYST, un panel en la fila del lienzo (./PanelAnalista.tsx): es un `aside` de alto completo,
//     no un modal.
//
// ESTADO, en tres capas que no se mezclan:
//   1. EL INFORME (`tablero`): lo que se guarda. Todo cambio pasa por `mutar`, que apila el deshacer, y
//      se autoguarda con un respiro. Si la lectura falló (`lecturaFallo`), NO se guarda nada: el primer
//      cambio pisaría el informe real de la persona.
//   2. LA VISTA (`vista`): lo que alguien elige en un control MIRANDO, y desde v5 qué secciones están
//      plegadas (`plegadasVista`). Es como en Looker: no se guarda, no pasa por `mutar` y no dispara el
//      autoguardado (tests/dashboard-pantalla.test.ts).
//   3. LOS DATOS: los pide cada gráfico con `efectivoDe` (el período, los filtros y el «agrupar por» que le
//      tocan, lib/graficos-catalogo.ts), y sólo si cambió su FIRMA (./exportar.ts). `version` sube con
//      `refrescar()`, después de una acción que cambia los datos (marcar una cuota cobrada en el detalle).
//
// ⚠️ MIRAR NO GUARDA: la grilla avisa un cambio también al MONTAR, cuando compacta lo que vino. Así se
//    guardó el informe de Mauricio el 11/10 a las 01:59 sin que tocara nada. `alMoverGrilla` sólo
//    escribe editando (tests/graficos.test.ts).
// ⚠️ Cambiar de hoja usa `window.history.replaceState` y no `router.replace`: con el router, cada clic de
//    pestaña volvía a correr la página del server (el informe y TODOS los datos de esa hoja) para tirar
//    el resultado. Next integra el replaceState nativo a su router.
// ⚠️ Mientras corre un recorrido, los atajos (Supr, Ctrl+Z) se apagan: el recorrido sólo frena Escape y
//    Tab, y debajo del velo Supr borraba el componente elegido sin que se viera.
//
// DESDE EL 11/10/2026 (Closing, Ads y Landing Analyst se retiraron y traen acá con `?hoja=`):
//   · `hojaAgregada`: la plantilla que pidió el link y no estaba (`hojaDestino`, lib/graficos-plantillas.ts).
//     Entra en el informe del PRIMER render —así no hay un parpadeo de la primera hoja— y como
//     `ultimoGuardado` sigue siendo el informe que vino, el autoguardado la escribe: la persona fue a
//     buscarla. No se apila en el deshacer: no es un cambio suyo.
//   · `soloLectura` (el closer, decisión 6 de Martín): sin Editar, sin Nueva hoja, sin menú de hoja, sin
//     AI Analyst ni el chat de MaKo de cada gráfico, sin el detalle de un número y sin guardar nunca;
//     Exportar sí, y desde v5 los POP-UPS (la ficha de una llamada de la tabla «Las llamadas» era lo que su
//     bloque hacía). ⚠️ La pantalla sólo esconde: lo que cierra es /api/graficos (`puedePedir`).
//   · `llamadaInicial` (`?llamada=`): abre la ficha de esa llamada (./bloques/extra/FichaLlamada.tsx);
//     al cerrarla se saca de la URL con el mismo replaceState que usa la hoja.
//
// `compartido` (punto 9, el link que arma el paquete «Compartir»): quien lo abre NO tiene sesión. Sin
// Editar, sin Compartir, sin AI Analyst, sin «Nueva hoja» ni el menú de una hoja, sin el chat de MaKo de
// cada gráfico, sin el DETALLE de un número ni los pop-ups (son listas de personas: el endpoint público lo
// contesta 403, así que el clic no lo ofrece), sin guía y sin guardar nunca; el ⋮ sólo con Exportar. Y TODO
// lo que se LEE va a /api/compartido/graficos con el token, el id de la hoja y el de cada componente
// (`pedidoDeLectura`, ./lectura-compartida.ts, que es el contrato con ese endpoint). Igual que con el
// closer: la pantalla sólo esconde; lo que cierra es el endpoint.
//
// TANDA v5 (12/10/2026, contrato docs/relevo/dashboard-v5.md, paquete «Edición»):
//   · LA VERSIÓN: el autoguardado manda la versión que leyó y va en COLA, uno detrás del otro
//     (./guardado.ts). Con un 409 deja de guardar y lo dice, con «Recargar».
//   · EL PANEL SUPERPUESTO (punto 19): el de propiedades va ENCIMA del lienzo, del lado opuesto a lo elegido
//     (el lado se fija AL ELEGIR, no mientras se arrastra), y el lienzo no cambia de ancho (./edicion-css.ts).
//   · LA SECCIÓN (puntos 12 y 24): plegar es estado de la vista; lo plegado sale de la grilla y no pide datos,
//     y lo que la grilla avisa de vuelta se traduce a lo guardado (lib/graficos-secciones.ts) para que editar
//     con algo plegado no pierda el orden. En el PDF sale todo desplegado.
//   · LOS CONECTORES (punto 11, ./Conectores.tsx): una capa encima de la grilla; borrar una tarjeta borra los
//     suyos en el MISMO cambio (un Deshacer los devuelve juntos).
//   · EL POP-UP (punto 7, ./Popup.tsx): mirando, un clic en un gráfico con `alClic: 'popup'` abre su mini-hoja
//     con el contexto de lo clickeado. Editando, «Editar el pop-up» pone el lienzo sobre la mini-hoja del
//     gráfico (`lienzo`), con una miga para volver, la misma grilla y la misma barra de insertar, y la primera
//     fila del gráfico como muestra.
//   · Los montajes de los otros paquetes: el «Filtro» de cada tarjeta (./MenuFiltro.tsx, interfaz I1) y la
//     barra de búsqueda de una tabla (./BuscarEnHoja.tsx, I2).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import { absoluteStrategy } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import { Banner, Modal, Toast, useToast } from '@/app/_ui';
import { useWs } from '@/app/_ui/Link';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Recorrido, useRecorrido } from '@/app/_ui/Recorrido';
import { EmojiPicker } from '@/app/whatsapp/EmojiPicker';
import { useHojasDeFuentes } from '@/app/_cursos/SelectorFuente';
import { useFocoInicial } from '@/app/customer-success/curso/dialogo-foco';
import { conWs } from '@/lib/ws-tab';
import {
  AREAS, COLS, FUENTES, MAX_COMPONENTES, MAX_CONECTORES, MAX_CONTROLES, MAX_HOJAS, MAX_IA_POR_HOJA, MAX_POPUP, TIPOS_ELEMENTO,
  abajoDeTodo, campoDe, efectivoDe, esElemento, esGrafico, minimoDeElemento, nuevoControlVista, nuevoElemento, nuevoGrafico, nuevoId,
  sanearComponente, sanearControlVista, sanearControles, sanearElemento, tituloDe, tonoDe,
  type Componente, type Conector, type ControlVista, type Efectivo, type Elemento, type Grafico, type Hoja, type Tablero, type TipoElemento, type ValorControl, type VistaValores,
} from '@/lib/graficos-catalogo';
import { colorDeTono, estiloEfectivo, letrasDe, paletaDe, sanearTema, varsDeTema, type TemaHoja } from '@/lib/graficos-temas';
import { conHojaAgregada } from '@/lib/graficos-plantillas';
import { aGuardado, aVista, fondosDe, gruposDe, ocultosPorPlegado, plegadasDe, type GrupoSeccion } from '@/lib/graficos-secciones';
import { conectorNuevo, puedeConectar, sinConectoresDe } from '@/lib/graficos-conectores';
import type { Resultado } from '@/lib/graficos-agregar';
import type { DatosGrafico } from '@/lib/graficos-datos';
import type { DatosBloque } from '@/lib/graficos-bloques';
import { accionInicial, entidadDeGrafico, piezaInicial, type SelDetalle } from '@/lib/graficos-acciones';
import { CuerpoGrafico, esTarjetaNumero, ocultaSiCero, type EstadoDatos } from './Grafico';
import { CuerpoElemento, IconoElemento, PropsElemento, type ContextoElemento } from './Elemento';
import { NuevaHoja } from './NuevaHoja';
import { ChatMakoGrafico, LogoMako, PanelAnalista, PuntoNuevo, useAnalisisNuevo } from './PanelAnalista';
import { BarraControles } from './BarraControles';
import { MenuFiltro } from './MenuFiltro';
import { BuscarEnTabla } from './BuscarEnHoja';
import { DetalleModal } from './Detalle';
import { FichaLlamada } from './bloques/extra/FichaLlamada';
import { BarraSuperior, MenuHojas } from './Cabecera';
import { BotonCompartir, RenglonCompartir } from './CompartirInforme';
import { PropsGrafico } from './Propiedades';
import { PanelEstilo } from './PanelEstilo';
import { FondosSecciones } from './Seccion';
import { CapaConectores, PropsConector } from './Conectores';
import { PopupGrafico, contextoPopupDe, entidadAbierta, hojaDelPopup, muestraDe, type ContextoPopup } from './Popup';
import {
  Flotante, Galeria, MenuElementos, MenuInsertar, SvgAgregarDatos, SvgAgregarGrafico, SvgDeshacer, SvgEstilo, SvgFlecha, SvgInsertar, SvgLapiz, SvgLupa, SvgOjo,
  lugaresInsertar, type MenuBarra, type OpcionInsertar,
} from './Galeria';
import { CSS } from './editor-css';
import { CSS_EDICION } from './edicion-css';
import { conBusqueda, contextoDeGrafico, csvDeHoja, enOrden, idBusquedaDe, loQueSeVeDe, nombreArchivo, pedidosDeHoja, periodoDeHoja, type PedidosHoja } from './exportar';
import { crearColaGuardado, leerRespuestaGuardado, type ColaGuardado } from './guardado';
import { pedidoDeLectura, type Compartido } from './lectura-compartida';
import { AccionesFilaProvider } from './entidades/acciones-fila';
import { PASOS_DASHBOARD, PASOS_DASHBOARD_EDICION, RECORRIDO_DASHBOARD, RECORRIDO_DASHBOARD_EDICION } from './recorridos-dashboard';
import { hojaConIdsNuevos } from '@/lib/graficos-copia';
import { tokenDeDashboard } from './copia-dash-cliente';
import { copiarAlPortapapeles } from '@/app/automations/copia-flujo-cliente';

/** La grilla: 12 columnas, filas de 30 px y 16 px entre tarjetas. ⚠️ El PDF (editor-css.ts) repite estos números. */
const FILA = 30;
const MARGEN = 16;
/** Por debajo de este ancho, la grilla de 12 columnas no se lee: las tarjetas van una abajo de la otra. */
const ANCHO_PILA = 640;
/**
 * Lo más chico que se puede achicar una tarjeta. El de un elemento sale del catálogo (`minimoDeElemento`,
 * TIPOS_ELEMENTO): un video o una página insertada más chicos que 3 × 4 no se ven ni se tocan.
 */
const minimoDe = (c: Componente): { w: number; h: number } => (esElemento(c) ? minimoDeElemento(c.tipo) : { w: 2, h: 2 });
/** Cuánto espera el respiro del autoguardado y el de los pedidos de datos. */
const RESPIRO_GUARDAR_MS = 700;
const RESPIRO_DATOS_MS = 250;
/** Lo más que espera el PDF a que lleguen los datos de lo que estaba plegado. */
const ESPERA_PDF_MS = 15_000;

/**
 * Los flotantes del editor: uno a la vez. `hojas` es el desplegable del título; `mas`, el ⋮ de la topbar;
 * `menuInsertar`, uno de los menús de la barra de inserción (`BARRA_INSERTAR`, el que nombra `lugar`).
 */
type Menu =
  | { ancla: HTMLElement; tipo: 'graficos' | 'cambiarTipo' | 'insertar' | 'estilo' | 'mas' | 'hojas' | 'emoji' }
  | { ancla: HTMLElement; tipo: 'menuInsertar'; lugar: MenuBarra }
  | null;

/** Lo que se abrió con un clic mirando: el gráfico, lo clickeado, su período y la hoja de ese momento. */
type PopupAbierto = { g: Grafico; ctx: ContextoPopup; periodo: { desde: string; hasta: string }; hoja: Hoja };

function aEstado(d: DatosGrafico | undefined): EstadoDatos {
  if (!d) return { cargando: true };
  return d.ok ? { cargando: false, resultado: d.resultado } : { cargando: false, error: d.error };
}
/** Si el foco está donde se tipea, las teclas son del texto, no del editor. */
function enUnTexto(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT');
}
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Lo de un componente que tiene id propio (él, sus controles y lo de su pop-up), nuevo: para duplicar sin compartir lo elegido mirando. */
function conIdsNuevos(c: Componente): Componente {
  if (esElemento(c)) return { ...c, id: nuevoId() };
  const base = { ...c, id: nuevoId(), controles: c.controles.map((k) => ({ ...k, id: nuevoId() })) };
  return esGrafico(c) && c.popup ? { ...base, popup: { ...c.popup, componentes: c.popup.componentes.map(conIdsNuevos) } } as Grafico : base;
}
const altoDe = (h: number) => h * FILA + (h - 1) * MARGEN;
/** El `title` de un ícono suelto de la barra de inserción: la acción y su objeto («Insertar imagen»). */
const etiquetaInsertar = (t: TipoElemento) => (t === 'insertado' ? 'Insertar una página o un código' : `Insertar ${(TIPOS_ELEMENTO.find((x) => x.id === t)?.nombre ?? t).toLowerCase()}`);
function descargar(texto: string, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type Caja = { x: number; y: number; w: number; h: number };
/**
 * El informe con las posiciones nuevas de los componentes de una hoja, o del pop-up del gráfico `duenoId` (el que
 * se está editando). Sin cambios, el MISMO objeto: así la grilla que avisa al montar no dispara un guardado.
 */
function conPosiciones(t: Tablero, idHoja: string, duenoId: string | null, pos: ReadonlyMap<string, Caja>): Tablero {
  let cambio = false;
  const mover = (cs: Componente[]) => cs.map((c) => {
    const it = pos.get(c.id);
    if (!it || (it.x === c.x && it.y === c.y && it.w === c.w && it.h === c.h)) return c;
    cambio = true;
    return { ...c, x: it.x, y: it.y, w: it.w, h: it.h };
  });
  const hojas = t.hojas.map((h) => {
    if (h.id !== idHoja) return h;
    if (!duenoId) { const componentes = mover(h.componentes); return cambio ? { ...h, componentes } : h; }
    const componentes = h.componentes.map((c) => (c.id === duenoId && esGrafico(c) && c.popup ? { ...c, popup: { ...c.popup, componentes: mover(c.popup.componentes) } } : c));
    return cambio ? { ...h, componentes } : h;
  });
  return cambio ? { ...t, hojas } : t;
}

/**
 * De qué lado va el panel (punto 19): del lado OPUESTO a lo elegido. Lo que ocupa casi todo el ancho (y nada
 * elegido), a la derecha como en Looker; con el AI Analyst abierto (que va a la derecha), a la izquierda.
 */
function ladoDelPanel(c: Componente | null, analista: boolean): 'izq' | 'der' {
  if (analista) return 'izq';
  if (!c || c.w >= 10) return 'der';
  return c.x + c.w / 2 <= COLS / 2 ? 'der' : 'izq';
}

/**
 * Un elemento nuevo de la barra de inserción, en la hoja o en un pop-up. Los tipos que necesitan algo para
 * existir lo traen de entrada (el saneo descarta una acción sin acción o una ficha sin pieza): una SECCIÓN nace
 * con título (sin título y no plegable es un divisor) y con lo que trae su variante (el «Desplegable» es plegable,
 * `inicial` de ./Galeria.tsx); una ACCIÓN y una FICHA, lo que dice el paquete de IA y entidades para ESE lugar
 * (`accionInicial`, `piezaInicial`, lib/graficos-acciones.ts); una caja de MaKo en un pop-up lee lo que se abrió.
 * null = no se puede (una ficha en la hoja, o en el pop-up de un gráfico que no abre una ficha).
 */
function nuevoElementoEn(t: TipoElemento, componentes: Componente[], dueno: Grafico | null, inicial?: OpcionInsertar['inicial']): Elemento | null {
  const info = TIPOS_ELEMENTO.find((x) => x.id === t);
  if (!info) return null;
  const ctx = { enPopup: !!dueno };
  const base = { id: nuevoId(), tipo: t, x: 0, y: abajoDeTodo(componentes), w: info.w, h: info.h };
  const entidad = dueno ? entidadDeGrafico(dueno) : null;
  if (t === 'seccion') {
    const seccion = inicial?.seccion ?? { fondo: null, plegable: false, abierto: true };
    return sanearElemento({ ...base, texto: seccion.plegable ? 'Desplegable' : 'Sección', seccion }, ctx);
  }
  if (t === 'accion') return sanearElemento({ ...base, texto: '', accion: accionInicial(entidad) }, ctx);
  if (t === 'ia') return sanearElemento({ ...base, texto: 'Conclusiones de MaKo', ia: { lee: dueno ? 'entidad' : 'hoja' } }, ctx);
  if (t === 'entidad') return dueno && entidad ? sanearElemento({ ...base, texto: '', entidad: piezaInicial(entidad) }, ctx) : null;
  return nuevoElemento(t, componentes);
}

export function EditorInforme({
  inicial, datosIniciales, lecturaFallo, hoy, hojaInicial, versionInicial = null,
  hojaAgregada = null, aviso = null, soloLectura = false, llamadaInicial = null, compartido = null, sinPaginas = false,
}: {
  inicial: Tablero;
  datosIniciales: Record<string, DatosGrafico>;
  /**
   * @deprecated v5: los bloques se migran en el saneo (lib/graficos-migrar-v5.ts) y ninguno llega acá. Queda
   * opcional hasta que la página y el link dejen de pasarlo; no se lee.
   */
  bloquesIniciales?: Record<string, DatosBloque>;
  lecturaFallo: boolean;
  hoy: string;
  hojaInicial: string;
  /** La versión del informe que se leyó (`leerTablero().version`): el autoguardado la manda (compare-and-set). */
  versionInicial?: string | null;
  /** La plantilla que pidió `?hoja=` y no estaba: se suma al informe y se guarda. */
  hojaAgregada?: Hoja | null;
  /** Un aviso para mostrar al abrir (el link pidió una hoja y el informe ya no tiene lugar). */
  aviso?: string | null;
  /** El closer: mira la hoja Closing, exporta, y nada más. */
  soloLectura?: boolean;
  /** `?llamada=`: el recording_id de la llamada cuya ficha se abre al entrar. */
  llamadaInicial?: number | null;
  /** El link compartido (sin sesión): se mira y se exporta; lo que se lee va por la ruta del link. */
  compartido?: Compartido | null;
  /**
   * La persona nunca guardó un informe: la pantalla arranca EN BLANCO con «Crear una página», y lo primero que
   * crea es su única página (el inicial que viene en `inicial` no se muestra ni se guarda).
   */
  sinPaginas?: boolean;
}) {
  // El informe del primer render: el que vino, más la hoja que pidió el link si no estaba.
  const [arranque] = useState<Tablero>(() => conHojaAgregada(inicial, hojaAgregada));
  const [tablero, setTablero] = useState<Tablero>(arranque);
  const tableroRef = useRef(tablero);
  tableroRef.current = tablero;
  const [hojaId, setHojaId] = useState(hojaInicial);
  const [llamada, setLlamada] = useState<number | null>(llamadaInicial);
  const [editando, setEditando] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [modalDatos, setModalDatos] = useState(false);
  const [nuevaHoja, setNuevaHoja] = useState(false);
  const [enBlanco, setEnBlanco] = useState(sinPaginas && !soloLectura && !compartido);
  const [analista, setAnalista] = useState(false);
  const [detalle, setDetalle] = useState<{ id: string; sel: SelDetalle } | null>(null);
  const [vista, setVista] = useState<VistaValores>({});
  const [version, setVersion] = useState(0);
  const [imprimiendo, setImprimiendo] = useState(false);
  // v5: las secciones plegadas MIRANDO (o editando): estado de la vista, no se guarda.
  const [plegadasVista, setPlegadasVista] = useState<Record<string, boolean>>({});
  // v5: el conector elegido, el modo «Conectar», el pop-up abierto mirando y el que se está editando.
  const [conSel, setConSel] = useState<string | null>(null);
  const [conectando, setConectando] = useState<{ desde: string | null } | null>(null);
  const [popup, setPopup] = useState<PopupAbierto | null>(null);
  const [editPopup, setEditPopup] = useState<string | null>(null);
  const [enGesto, setEnGesto] = useState(false);
  const [conflicto, setConflicto] = useState(false);
  // Compartir (punto 3 de v5, paquete de la topbar): un renglón del ⋮ que abre el modal, montado AFUERA del menú.
  const [compartir, setCompartir] = useState(false);
  const [datos, setDatos] = useState<Record<string, EstadoDatos>>(() => {
    const o: Record<string, EstadoDatos> = {};
    for (const [id, d] of Object.entries(datosIniciales)) o[id] = aEstado(d);
    return o;
  });
  const { toast, show, clear } = useToast(6000);
  const { width, containerRef, mounted } = useContainerWidth();
  const grillaRef = useRef<HTMLDivElement>(null);
  const ws = useWs();
  // Mirando sin poder guardar: la lectura falló (el primer cambio pisaría el informe real), es el closer o
  // es un link compartido.
  const guardable = !lecturaFallo && !soloLectura && !compartido;
  // Sólo mirar, sin nada de lo que es del admin (Editar, AI Analyst, el chat de MaKo, el detalle de un número).
  const soloMirar = soloLectura || !!compartido;

  const hoja = tablero.hojas.find((h) => h.id === hojaId) ?? tablero.hojas[0];
  // ── El LIENZO: la hoja, o la mini-hoja del pop-up que se está editando (con la primera fila del gráfico de
  // muestra: sus gráficos se filtran por ella, y las piezas de la ficha la abren).
  const dueno = editando && editPopup ? (hoja.componentes.find((c): c is Grafico => c.id === editPopup && esGrafico(c) && !!c.popup) ?? null) : null;
  const muestra = useMemo(() => (dueno ? muestraDe(dueno, datos[dueno.id]?.resultado) : null), [dueno, datos]);
  const efectivosHoja = useMemo(() => {
    const o: Record<string, Efectivo> = {};
    for (const c of hoja.componentes) if (esGrafico(c)) o[c.id] = efectivoDe(conBusqueda(c), hoja, vista, hoy);
    return o;
  }, [hoja, vista, hoy]);
  const lienzo = useMemo(
    () => (dueno ? hojaDelPopup(hoja, dueno, muestra, efectivosHoja[dueno.id] ?? efectivoDe(dueno, hoja, {}, hoy)) : hoja),
    [dueno, hoja, muestra, efectivosHoja, hoy],
  );
  const sel = editando ? lienzo.componentes.find((c) => c.id === selId) ?? null : null;
  const conectorSel = editando && !dueno ? (hoja.conectores ?? []).find((k) => k.id === conSel) ?? null : null;

  // ── Las secciones: qué está plegado ahora (en el PDF, nada), qué no se pide y qué no se dibuja ──────
  const grupos = useMemo(() => gruposDe(lienzo.componentes), [lienzo.componentes]);
  const plegadas = useMemo(() => (imprimiendo ? new Set<string>() : plegadasDe(lienzo.componentes, plegadasVista)), [lienzo.componentes, plegadasVista, imprimiendo]);
  const noSePiden = useMemo(() => ocultosPorPlegado(lienzo.componentes, plegadas), [lienzo.componentes, plegadas]);
  const alternarPlegado = useCallback((id: string) => setPlegadasVista((v) => ({ ...v, [id]: !plegadas.has(id) })), [plegadas]);

  // ── El recorrido: uno para mirar y otro para editar (el «?» abre el del lugar) ─────────────────
  // No se abre solo con un menú o un modal abierto: los flotantes del editor van por encima del velo.
  const capaAbierta = !!menu || modalDatos || nuevaHoja || analista || !!detalle || llamada != null || !!popup || compartir;
  // En un link compartido no hay guía: quien entra no tiene sesión (`soloLocal`: no le pregunta nada al
  // server) y el ⋮ es sólo Exportar.
  const conGuia = !compartido;
  // En blanco no se abre sola: lo que la guía señala (el título, los filtros, los gráficos) todavía no existe.
  const recorrido = useRecorrido(RECORRIDO_DASHBOARD, { autoabrir: conGuia && !enBlanco && !editando && !capaAbierta, soloLocal: !conGuia });
  const recorridoEdicion = useRecorrido(RECORRIDO_DASHBOARD_EDICION, { autoabrir: conGuia && editando && !recorrido.abierto && !capaAbierta, soloLocal: !conGuia });
  const enRecorrido = recorrido.abierto || recorridoEdicion.abierto;

  // ── El tema de la hoja: su letra se baja, sus variables pintan el lienzo ─────────────────────
  useHojasDeFuentes(letrasDe(hoja.tema));
  const estilo = useMemo(() => estiloEfectivo(hoja.tema), [hoja.tema]);
  const colores = useMemo(() => paletaDe(hoja.tema), [hoja.tema]);
  const varsTema = useMemo(() => varsDeTema(hoja.tema) as CSSProperties, [hoja.tema]);

  // ── Deshacer / rehacer (y Ctrl+Z / Ctrl+Y, sólo editando y nunca debajo de un recorrido) ─────────
  const pila = usePilaDeshacer<Tablero>((estado) => {
    const actual = tableroRef.current;
    setTablero(estado);
    return actual;
  }, { activa: editando && !enRecorrido });
  const { apilar, deshacer } = pila;
  /** Todo cambio de una persona al INFORME pasa por acá: así cada uno se puede deshacer y se guarda. */
  const mutar = useCallback((fn: (t: Tablero) => Tablero) => {
    apilar(tableroRef.current);
    setTablero((t) => fn(t));
  }, [apilar]);
  const mutarHoja = useCallback((fn: (h: Hoja) => Hoja, id = hoja.id) => {
    mutar((t) => ({ ...t, hojas: t.hojas.map((h) => (h.id === id ? fn(h) : h)) }));
  }, [mutar, hoja.id]);
  /**
   * Los componentes del LIENZO (la hoja, o el pop-up que se edita) y, en la hoja, sus conectores: en el MISMO
   * cambio, así un Deshacer devuelve una tarjeta borrada con sus flechas.
   */
  const duenoId = dueno?.id ?? null;
  const mutarComponentes = useCallback((fn: (cs: Componente[]) => Componente[], fnCon?: (ks: Conector[]) => Conector[]) => {
    mutarHoja((h) => {
      if (duenoId) {
        return { ...h, componentes: h.componentes.map((c) => (c.id === duenoId && esGrafico(c) && c.popup ? { ...c, popup: { ...c.popup, componentes: fn(c.popup.componentes) } } : c)) };
      }
      const componentes = fn(h.componentes);
      if (!fnCon) return { ...h, componentes };
      const conectores = fnCon(h.conectores ?? []);
      return { ...h, componentes, conectores: conectores.length ? conectores : undefined };
    });
  }, [mutarHoja, duenoId]);

  // ── Los datos: sólo lo de la hoja a la vista (sin lo plegado), y sólo si su firma cambió ──────────
  const firmaPedida = useRef<Record<string, string> | null>(null);
  if (firmaPedida.current === null) {
    // Lo que trajo el server en la primera pintada ya está pedido: con la vista vacía y la versión 0,
    // con la MISMA función que usó page.tsx (y sobre el MISMO informe: el que incluye la hoja agregada).
    // Sin `ocultos`: se anota la firma de todo lo que LLEGÓ, y lo que el server no pidió no está en
    // `datosIniciales`, así que se pedirá al abrirse.
    const h0 = arranque.hojas.find((h) => h.id === hojaInicial) ?? arranque.hojas[0];
    const p0 = pedidosDeHoja(h0, {}, hoy, 0);
    const f: Record<string, string> = {};
    for (const x of p0.graficos) if (datosIniciales[x.g.id]) f[x.g.id] = x.firma;
    firmaPedida.current = f;
  }
  // El link compartido por el que se entró (o nadie): decide a qué ruta van las LECTURAS (./lectura-compartida.ts).
  const tokenLink = compartido?.token ?? null;
  useEffect(() => {
    if (enBlanco) return;
    const firmas = firmaPedida.current!;
    const p = pedidosDeHoja(lienzo, vista, hoy, version, noSePiden);
    const graficos = p.graficos.filter((x) => firmas[x.g.id] !== x.firma);
    if (!graficos.length) return;
    const link = tokenLink ? { token: tokenLink } : null;

    const pedirGraficos = async (lista: PedidosHoja['graficos']) => {
      setDatos((prev) => {
        const n = { ...prev };
        for (const { g } of lista) n[g.id] = { ...(n[g.id] ?? {}), cargando: true };
        return n;
      });
      let respuesta: Record<string, DatosGrafico> = {};
      let fallo = false;
      try {
        // Con sesión, /api/graficos con el cuerpo de siempre; en un link compartido, la ruta del link con
        // el token, la hoja y el id de cada gráfico. EDITANDO un pop-up, sin `popupDe`: vale la definición de
        // la pantalla, que todavía no se guardó (./Popup.tsx).
        const { ruta, cuerpo } = pedidoDeLectura({ accion: 'datos', hojaId: hoja.id, pedidos: lista.map((x) => ({ id: x.g.id, pedido: x.pedido })) }, link);
        const r = await fetch(ruta, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(cuerpo),
          signal: AbortSignal.timeout(65_000),
        });
        if (!r.ok) fallo = true; else respuesta = (await r.json()).datos ?? {};
      } catch { fallo = true; }
      setDatos((prev) => {
        const n = { ...prev };
        for (const x of lista) {
          // Si entre medio cambió el gráfico (o la vista, o la versión), esta respuesta ya es vieja.
          if (firmas[x.g.id] !== x.firma) continue;
          n[x.g.id] = fallo ? { cargando: false, error: 'No pude leer los datos' } : aEstado(respuesta[x.g.id] ?? { ok: false, error: 'Sin respuesta' });
        }
        return n;
      });
    };

    const t = setTimeout(() => {
      for (const x of graficos) firmas[x.g.id] = x.firma;
      void pedirGraficos(graficos);
    }, RESPIRO_DATOS_MS);
    return () => clearTimeout(t);
  }, [lienzo, hoja.id, vista, hoy, version, tokenLink, noSePiden]);
  /** Después de una acción que cambia los datos (una cuota cobrada): todo lo de la hoja se vuelve a pedir. */
  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  /** Lo que mira cada gráfico del lienzo, resuelto una vez: lo usan el «Filtro» de cada tarjeta, el detalle y el pop-up. */
  const efectivos = useMemo(() => {
    if (lienzo === hoja) return efectivosHoja;
    const o: Record<string, Efectivo> = {};
    for (const c of lienzo.componentes) if (esGrafico(c)) o[c.id] = efectivoDe(conBusqueda(c), lienzo, vista, hoy);
    return o;
  }, [lienzo, hoja, efectivosHoja, vista, hoy]);
  const resultados = useMemo(() => {
    const o: Record<string, Resultado | undefined> = {};
    for (const [id, e] of Object.entries(datos)) o[id] = e.resultado;
    return o;
  }, [datos]);

  // ── El guardado: solo, con un respiro, en COLA y con la versión; nunca si la lectura falló ────────
  // Lo guardado es el informe que VINO (`inicial`), no el del primer render: si el link sumó una hoja,
  // la diferencia la escribe el autoguardado de abajo sin que nadie toque nada.
  // `ultimoGuardado` es lo último PEDIDO (si falla, vuelve a lo último confirmado): comparar contra lo
  // confirmado mientras otra cosa viaja dejaría sin guardar una vuelta a lo de antes (./guardado.ts).
  const ultimoGuardado = useRef(JSON.stringify(inicial));
  const pendienteGuardar = useRef<string | null>(null);
  const versionLeida = useRef(versionInicial);
  const colaRef = useRef<ColaGuardado | null>(null);
  const mandar = useCallback(async (json: string, keepalive = false) => {
    if (!guardable || json === ultimoGuardado.current) return;
    const cola = (colaRef.current ??= crearColaGuardado({
      version: versionLeida.current,
      ultimo: ultimoGuardado.current,
      // El único fetch a mano a /api/graficos: guardar (las lecturas van por `pedidoDeLectura`).
      enviar: async (j, v, ka) => leerRespuestaGuardado(await fetch('/api/graficos', {
        method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: ka,
        body: `{"accion":"guardar","version":${JSON.stringify(v)},"tablero":${j}}`,
      })),
      alFallar: (ka, j) => {
        ultimoGuardado.current = colaRef.current?.ultimo() ?? ultimoGuardado.current;
        // Lo que no entró queda pendiente: sale con el próximo cambio o al ocultar la pestaña (si no hay uno más nuevo).
        pendienteGuardar.current ??= j;
        // «Guardado» se fue de la fila de arriba (punto 3); lo que no puede irse es el aviso de que NO se guardó.
        if (!ka) show('No se guardó', undefined, 'bad');
      },
      // Otro escritor guardó en el medio (otra pestaña, la API de MaKo) o la ruta no reconoce el pedido: seguir
      // pisaría algo. La cola se para y se dice, con «Recargar» en la cinta de arriba.
      alConflicto: () => { setConflicto(true); show('Cambió en otra pestaña', undefined, 'bad'); },
    }));
    ultimoGuardado.current = json;
    if (pendienteGuardar.current === json) pendienteGuardar.current = null;
    await cola.pedir(json, keepalive);
  }, [guardable, show]);
  useEffect(() => {
    const json = JSON.stringify(tablero);
    if (json === ultimoGuardado.current) return;
    pendienteGuardar.current = json;
    const t = setTimeout(() => { void mandar(json); }, RESPIRO_GUARDAR_MS);
    return () => clearTimeout(t);
  }, [tablero, mandar]);
  useEffect(() => {
    const flush = () => { if (pendienteGuardar.current) void mandar(pendienteGuardar.current, true); };
    const alOcultar = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => { document.removeEventListener('visibilitychange', alOcultar); flush(); };
  }, [mandar]);
  /** «Recargar» después de un conflicto: la misma pantalla, con el cliente que se mira (`?ws=`). */
  const recargar = useCallback(() => { window.location.href = conWs(`${window.location.pathname}${window.location.search}`, ws); }, [ws]);

  // ── Las hojas ─────────────────────────────────────────────────────────────────────────────────
  const irAHoja = useCallback((id: string) => {
    setHojaId(id);
    setSelId(null);
    setConSel(null);
    setEditPopup(null);
    setDetalle(null);
    try {
      const qs = new URLSearchParams(window.location.search);
      qs.set('hoja', id);
      window.history.replaceState(null, '', conWs(`${window.location.pathname}?${qs.toString()}`, ws));
    } catch { /* sin history: la hoja ya cambió en pantalla, y el link copiado abre la primera */ }
  }, [ws]);
  /** La ficha de la llamada que abrió el link (`?llamada=`): al cerrarla, el parámetro se va de la URL. */
  const cerrarLlamada = useCallback(() => {
    setLlamada(null);
    try {
      const qs = new URLSearchParams(window.location.search);
      qs.delete('llamada');
      const q = qs.toString();
      window.history.replaceState(null, '', conWs(`${window.location.pathname}${q ? `?${q}` : ''}`, ws));
    } catch { /* sin history: la ficha ya se cerró, y recargar la vuelve a abrir */ }
  }, [ws]);
  // Lo que pasó al abrir sin que la persona tocara nada: se dice una vez, corto.
  const avisado = useRef(false);
  useEffect(() => {
    if (avisado.current) return;
    avisado.current = true;
    if (hojaAgregada && arranque.hojas.some((h) => h.id === hojaAgregada.id) && !inicial.hojas.some((h) => h.id === hojaAgregada.id)) {
      show(`Hoja ${hojaAgregada.nombre} agregada`);
    } else if (aviso) show(aviso);
  }, [hojaAgregada, arranque, inicial, aviso, show]);
  /** Lo que devuelve «Nueva hoja» (en blanco, de una plantilla o armada por MaKo), ya saneado. */
  const crearHoja = useCallback((h: Hoja, aviso?: string) => {
    const t = tableroRef.current;
    if (t.hojas.length >= MAX_HOJAS) { show('Máximo de hojas'); return; }
    const nueva: Hoja = t.hojas.some((x) => x.id === h.id) ? { ...h, id: nuevoId() } : h;
    // En blanco, la que se crea es la ÚNICA: el inicial que viajaba por dentro no se guarda.
    mutar((tt) => ({ ...tt, hojas: enBlanco ? [nueva] : [...tt.hojas, nueva] }));
    setEnBlanco(false);
    setNuevaHoja(false);
    irAHoja(nueva.id);
    if (aviso) show(aviso);
  }, [mutar, irAHoja, show, enBlanco]);
  const duplicarHoja = (id: string) => {
    const h = tablero.hojas.find((x) => x.id === id);
    if (!h || tablero.hojas.length >= MAX_HOJAS) return;
    // TODO lo que tiene id se acuña de nuevo (la hoja, sus controles, sus componentes y los controles de
    // cada uno): con el mismo id, lo elegido mirando en una se vería en la otra. Los conectores y lo que lee
    // una caja de MaKo siguen a sus componentes por el id NUEVO (la misma función que pegar un dashboard).
    const copia = hojaConIdsNuevos(h, `${h.nombre} (copia)`);
    mutar((t) => { const i = t.hojas.findIndex((x) => x.id === id); const hs = [...t.hojas]; hs.splice(i + 1, 0, copia); return { ...t, hojas: hs }; });
    irAHoja(copia.id);
  };
  /**
   * «COPIAR DASHBOARD» (lib/graficos-copia.ts): el server guarda la hoja como está en pantalla (sin los filtros sobre
   * personas) y al portapapeles va su TOKEN, que se pega en «Nueva hoja» de este informe, de otra persona o de otro
   * negocio. `copiarAlPortapapeles` toma el permiso en el clic aunque el token llegue después (Safari).
   */
  const copiarHoja = (id: string) => {
    const h = tablero.hojas.find((x) => x.id === id);
    if (!h) return;
    copiarAlPortapapeles(tokenDeDashboard(h))
      .then(() => show('Dashboard copiado'))
      .catch((e: unknown) => show(e instanceof Error && e.message !== 'sin portapapeles' ? e.message : 'No se pudo copiar', undefined, 'bad'));
  };
  const eliminarHoja = (id: string) => {
    if (tablero.hojas.length <= 1) return;
    const i = tablero.hojas.findIndex((x) => x.id === id);
    mutar((t) => ({ ...t, hojas: t.hojas.filter((x) => x.id !== id) }));
    if (id === hoja.id) irAHoja(tablero.hojas[i === 0 ? 1 : i - 1].id);
    show('Hoja eliminada', () => pila.deshacer());
  };
  const moverHoja = (id: string, delta: number) => mutar((t) => {
    const i = t.hojas.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= t.hojas.length) return t;
    const hs = [...t.hojas];
    [hs[i], hs[j]] = [hs[j], hs[i]];
    return { ...t, hojas: hs };
  });
  const renombrarHoja = (id: string, nombre: string) => mutarHoja((h) => ({ ...h, nombre: nombre.slice(0, 40) }), id);
  const cambiarCabecera = (p: Partial<Pick<Hoja, 'nombre' | 'emoji' | 'subtitulo'>>) => mutarHoja((h) => ({ ...h, ...p }));
  const cambiarTema = (p: Partial<TemaHoja>) => mutarHoja((h) => ({ ...h, tema: sanearTema({ ...h.tema, ...p }) }));

  // ── Los componentes ──────────────────────────────────────────────────────────────────────────
  const cambiar = useCallback((id: string, parche: Record<string, unknown>) => {
    mutarComponentes((cs) => cs.map((c) => (c.id === id ? sanearComponente({ ...c, ...parche }, { enPopup: !!duenoId }) ?? c : c)));
  }, [mutarComponentes, duenoId]);
  const aMirar = useRef<string | null>(null);
  // El id se acuña AFUERA del updater: en modo estricto React lo corre dos veces.
  const agregarComponente = (c: Componente) => {
    const tope = dueno ? MAX_POPUP : MAX_COMPONENTES;
    if (lienzo.componentes.length >= tope) { show('Máximo de componentes'); return; }
    mutarComponentes((cs) => [...cs, c]);
    setSelId(c.id);
    setConSel(null);
    aMirar.current = c.id;
  };
  // Lo que se acaba de agregar nace abajo de todo: se lleva a la vista.
  useEffect(() => {
    const id = aMirar.current;
    if (!id) return;
    aMirar.current = null;
    const t = window.setTimeout(() => document.querySelector(`[data-comp="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80);
    return () => window.clearTimeout(t);
  }, [tablero]);
  const duplicar = (c: Componente) => agregarComponente({ ...conIdsNuevos(c), y: c.y + c.h });
  const borrar = useCallback((c: Componente) => {
    // Sus conectores se van en el MISMO cambio: un Deshacer devuelve la tarjeta con sus flechas.
    mutarComponentes((cs) => cs.filter((x) => x.id !== c.id), (ks) => sinConectoresDe(ks, new Set([c.id])));
    setSelId(null);
    show(esElemento(c) ? 'Elemento eliminado' : 'Gráfico eliminado', () => deshacer());
  }, [mutarComponentes, show, deshacer]);
  const anadirFuente = (id: string) => {
    setModalDatos(false);
    agregarComponente(nuevoGrafico('tabla', lienzo.componentes, id));
  };
  const fuenteParaNuevo = () => (sel && esGrafico(sel) ? sel.fuente : 'negocio');
  // «Restablecer el informe» se fue (punto 2 de la tanda de la topbar: «eso no tiene sentido, eliminalo»).

  // ── Los conectores (punto 11): sólo en la hoja (un pop-up no tiene) ────────────────────────────
  const unir = useCallback((desde: string, hasta: string) => {
    const ks = tableroRef.current.hojas.find((h) => h.id === hojaId)?.conectores;
    if (!puedeConectar(ks, desde, hasta, MAX_CONECTORES)) { show(desde === hasta ? 'Elige otra tarjeta' : (ks?.length ?? 0) >= MAX_CONECTORES ? 'Máximo de conectores' : 'Ya están unidas'); return; }
    const k = conectorNuevo(nuevoId(), desde, hasta);
    mutarHoja((h) => ({ ...h, conectores: [...(h.conectores ?? []), k] }));
    setSelId(null);
    setConSel(k.id);
  }, [hojaId, mutarHoja, show]);
  const cambiarConector = (id: string, p: Partial<Conector>) => mutarHoja((h) => ({ ...h, conectores: (h.conectores ?? []).map((k) => (k.id === id ? { ...k, ...p } : k)) }));
  const borrarConector = useCallback((id: string) => {
    mutarHoja((h) => { const ks = (h.conectores ?? []).filter((k) => k.id !== id); return { ...h, conectores: ks.length ? ks : undefined }; });
    setConSel(null);
    show('Conector quitado', () => deshacer());
  }, [mutarHoja, show, deshacer]);
  /** «Conectar» (interfaz I7): con una tarjeta elegida arranca de ella; si no, se eligen las dos. */
  const iniciarConectar = useCallback(() => {
    setMenu(null);
    if (dueno) { show('Sólo en la hoja'); return; }
    setConectando({ desde: sel ? sel.id : null });
    setConSel(null);
  }, [dueno, sel, show]);
  const elegirParaConectar = (id: string) => {
    if (!conectando) return;
    if (!conectando.desde) { setConectando({ desde: id }); return; }
    if (id === conectando.desde) return;
    unir(conectando.desde, id);
    setConectando(null);
  };

  // ── El pop-up (punto 7) ──────────────────────────────────────────────────────────────────────
  const abrirPopup = useCallback((g: Grafico, s: SelDetalle) => {
    const ef = efectivosHoja[g.id] ?? efectivoDe(g, hoja, vista, hoy);
    setPopup({ g, ctx: contextoPopupDe(g, s, datos[g.id]?.resultado), periodo: { desde: ef.desde, hasta: ef.hasta }, hoja });
  }, [efectivosHoja, hoja, vista, hoy, datos]);
  const cerrarPopup = useCallback(() => setPopup(null), []);
  /** Qué hace un clic mirando: el detalle de siempre, el pop-up, o nada (sin `onDetalle`, no se pinta clicable). */
  const alClicDe = (c: Grafico): ((s: SelDetalle) => void) | undefined => {
    if (c.alClic === 'nada') return undefined;
    if (c.alClic === 'popup' && c.popup) return (s) => abrirPopup(c, s);
    return (s) => setDetalle({ id: c.id, sel: s });
  };
  const editarPopup = (id: string) => { setEditPopup(id); setSelId(null); setConSel(null); setConectando(null); };
  const salirDelPopup = () => { const id = editPopup; setEditPopup(null); setSelId(id); };

  // ── Los controles de la hoja (la barra de arriba) y los de cada gráfico (su «Filtro») ─────────
  /**
   * Lo que alguien elige MIRANDO: estado de la vista. ⚠️ No pasa por `mutar`, no se guarda y no dispara el
   * autoguardado (como en Looker). Lo que se guarda es lo que el control muestra de entrada.
   */
  const onVista = useCallback((id: string, valor: ValorControl) => {
    setVista((v) => ({ ...v, [id]: { ...v[id], ...valor } }));
  }, []);
  const agregarControl = (c: ControlVista) => {
    if (hoja.controles.length >= MAX_CONTROLES) { show('Máximo de filtros'); return; }
    // Uno por cosa (un período, un «agrupar por», uno por campo): el saneo descarta el repetido.
    mutarHoja((h) => ({ ...h, controles: sanearControles([...h.controles, c]) }));
  };
  /**
   * Cambiar lo de ENTRADA de un control olvida lo elegido mirando en él. Sin esto la tarjeta seguía
   * mostrando lo de antes, con el punto de «distinto de lo de entrada», hasta apretar «Restablecer».
   */
  const olvidarVista = (ids: string[]) => {
    if (ids.length) setVista((v) => Object.fromEntries(Object.entries(v).filter(([id]) => !ids.includes(id))));
  };
  const cambiarControl = (id: string, parche: Partial<ControlVista>) => {
    mutarHoja((h) => ({ ...h, controles: sanearControles(h.controles.map((c) => (c.id === id ? sanearControlVista({ ...c, ...parche }) ?? c : c))) }));
    olvidarVista([id]);
  };
  /** Lo que cambia el panel de propiedades; si tocó los controles del gráfico, olvida la vista de los que cambiaron. */
  const cambiarDesdePanel = (c: Componente, p: Record<string, unknown>) => {
    cambiar(c.id, p);
    if (esElemento(c) || !Array.isArray(p.controles)) return;
    const nuevos = p.controles as ControlVista[];
    const antes = new Map(c.controles.map((k) => [k.id, JSON.stringify(k)]));
    olvidarVista([
      ...nuevos.filter((k) => antes.get(k.id) !== JSON.stringify(k)).map((k) => k.id),
      ...c.controles.filter((k) => !nuevos.some((x) => x.id === k.id)).map((k) => k.id),
    ]);
  };
  const quitarControl = (id: string) => {
    mutarHoja((h) => ({ ...h, controles: h.controles.filter((c) => c.id !== id) }));
    setVista((v) => { const n = { ...v }; delete n[id]; return n; });
  };
  /** «Restablecer» de la barra: lo elegido mirando en ESTA hoja vuelve a lo de entrada (también la búsqueda de una tabla). */
  const restablecerVista = () => {
    const ids = new Set([
      ...hoja.controles.map((c) => c.id),
      ...hoja.componentes.flatMap((c) => (esElemento(c) ? [] : [...c.controles.map((k) => k.id), ...(esGrafico(c) ? [idBusquedaDe(c) ?? ''] : [])])),
    ]);
    setVista((v) => Object.fromEntries(Object.entries(v).filter(([id]) => !ids.has(id))));
  };

  // ── El detalle de un número (clic en una KPI, una barra, una fila) ─────────────────────────────
  const cerrarDetalle = useCallback(() => setDetalle(null), []);
  /**
   * «Filtrar la página por esto», desde el detalle: si la hoja ya tiene una lista de ese campo, se elige
   * el valor EN LA VISTA (no se guarda); si no, se agrega el control (eso sí se guarda, con `mutar`) y el
   * valor va igual a la vista: lo que se guarda es «todos».
   */
  const filtrarPor = useCallback((campo: string, valor: string) => {
    if (!campoDe(campo)) return;
    const h = tableroRef.current.hojas.find((x) => x.id === hojaId) ?? tableroRef.current.hojas[0];
    const existente = h.controles.find((c) => c.tipo === 'lista' && c.campo === campo);
    if (existente) {
      setVista((v) => ({ ...v, [existente.id]: { ...v[existente.id], valores: [valor] } }));
      setDetalle(null);
      return;
    }
    if (h.controles.length >= MAX_CONTROLES) { show('Máximo de filtros'); return; }
    const c = nuevoControlVista('lista', campo);
    if (!c) return;
    mutarHoja((hh) => ({ ...hh, controles: sanearControles([...hh.controles, c]) }), h.id);
    setVista((v) => ({ ...v, [c.id]: { valores: [valor] } }));
    setDetalle(null);
  }, [hojaId, mutarHoja, show]);

  // ── Los modales: onCerrar con identidad FIJA (AGENTS.md: si no, el foco salta en cada tecla) ──────
  const cerrarNuevaHoja = useCallback(() => setNuevaHoja(false), []);
  const cerrarAnalista = useCallback(() => setAnalista(false), []);
  const alternarAnalista = useCallback(() => { setMenu(null); setAnalista((v) => !v); }, []);
  const cerrarModalDatos = useCallback(() => setModalDatos(false), []);
  const abrirCompartir = useCallback(() => { setMenu(null); setCompartir(true); }, []);
  const cerrarCompartir = useCallback(() => setCompartir(false), []);
  const loQueSeVe = useMemo(() => (analista ? loQueSeVeDe(hoja, resultados, efectivosHoja) : []), [analista, hoja, resultados, efectivosHoja]);
  // El punto de «hay un análisis nuevo», en el ⋮ y en su opción. Al closer y a un link, nada: no tienen AI Analyst.
  const analisisNuevo = useAnalisisNuevo(hoja.id, analista, !soloMirar);

  // ── Exportar ─────────────────────────────────────────────────────────────────────────────────
  const exportarCsv = () => {
    setMenu(null);
    const { csv, salteados } = csvDeHoja({ hoja, resultados, efectivos: efectivosHoja, hoy });
    descargar(csv, nombreArchivo(hoja.nombre, hoy, 'csv'), 'text/csv;charset=utf-8');
    const n = salteados.bloques + salteados.elementos + salteados.sinDatos;
    show(n ? `CSV sin ${n} piezas` : 'CSV descargado');
  };
  /**
   * El PDF es la impresión del navegador: primero el lienzo pasa al ancho del papel (y se despliega todo lo
   * plegado), se espera a que lleguen los datos de lo que estaba plegado (hasta ESPERA_PDF_MS) y se imprime.
   */
  const exportarPdf = () => { setMenu(null); setSelId(null); setConSel(null); setImprimiendo(true); };
  const faltanDatos = useRef<() => boolean>(() => false);
  useEffect(() => {
    faltanDatos.current = () => lienzo.componentes.some((c) => esGrafico(c) && !noSePiden.has(c.id) && (datos[c.id]?.cargando ?? true));
  });
  useEffect(() => {
    if (!imprimiendo) return;
    let hecho = false;
    const fin = () => { if (!hecho) { hecho = true; setImprimiendo(false); } };
    window.addEventListener('afterprint', fin);
    const inicio = Date.now();
    let t = 0;
    // El respiro deja que la grilla y los gráficos se vuelvan a medir con el ancho del papel.
    const intentar = () => {
      if (faltanDatos.current() && Date.now() - inicio < ESPERA_PDF_MS) { t = window.setTimeout(intentar, 300); return; }
      window.print();
      fin();
    };
    t = window.setTimeout(intentar, 450);
    return () => { window.clearTimeout(t); window.removeEventListener('afterprint', fin); };
  }, [imprimiendo]);

  // ── El teclado del editor: Escape suelta, Suprimir borra (editando, fuera de un texto, sin recorrido) ──
  const alTecla = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (conectando) setConectando(null); else if (conSel) setConSel(null); else setSelId(null);
      return;
    }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (conectorSel) { e.preventDefault(); borrarConector(conectorSel.id); return; }
    if (sel) { e.preventDefault(); borrar(sel); }
  }, [conectando, conSel, conectorSel, sel, borrar, borrarConector]);
  useEffect(() => {
    if (!editando) return;
    const k = (e: KeyboardEvent) => {
      if (enRecorrido || enUnTexto() || capaAbierta) return;
      alTecla(e);
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [editando, enRecorrido, capaAbierta, alTecla]);

  // ── La grilla ────────────────────────────────────────────────────────────────────────────────
  // Lo GUARDADO (con lo plegado), y lo DIBUJADO: sin lo plegado y lo de abajo subido (lib/graficos-secciones.ts).
  // Mirando, una tarjeta que pidió «ocultar si da cero» y da cero tampoco se dibuja.
  const layoutGuardado: Layout = useMemo(
    () => lienzo.componentes.map((c) => { const m = minimoDe(c); return { i: c.id, x: c.x, y: c.y, w: c.w, h: c.h, minW: m.w, minH: m.h }; }),
    [lienzo.componentes],
  );
  const noSeDibujan = useMemo(() => {
    const out = new Set(noSePiden);
    if (!editando) for (const c of lienzo.componentes) if (esGrafico(c) && c.ocultarSiCero && ocultaSiCero(c, datos[c.id] ?? { cargando: true })) out.add(c.id);
    return out;
  }, [noSePiden, editando, lienzo.componentes, datos]);
  const layout: Layout = useMemo(
    () => aVista(layoutGuardado.filter((it) => !noSeDibujan.has(it.i) || noSePiden.has(it.i)), grupos, plegadas),
    [layoutGuardado, noSeDibujan, noSePiden, grupos, plegadas],
  );
  const visibles = useMemo(() => lienzo.componentes.filter((c) => !noSeDibujan.has(c.id)), [lienzo.componentes, noSeDibujan]);
  const fondos = useMemo(() => fondosDe(grupos, plegadas), [grupos, plegadas]);
  const cajasDibujadas = useMemo(() => new Map(layout.map((it) => [it.i, { x: it.x, y: it.y, w: it.w, h: it.h }] as const)), [layout]);
  // Lo que la vuelta de la grilla necesita, al día ANTES de que la grilla avise (sus avisos van en efectos
  // pasivos; éste es de layout y corre antes que cualquiera de ellos, también al montar).
  const vueltaRef = useRef<{ guardado: Layout; grupos: GrupoSeccion[]; plegadas: ReadonlySet<string>; duenoId: string | null }>({ guardado: [], grupos: [], plegadas: new Set(), duenoId: null });
  useLayoutEffect(() => { vueltaRef.current = { guardado: layoutGuardado, grupos, plegadas, duenoId }; });
  // Arrastrar y agrandar: se apila UNA vez al empezar el gesto, no en cada píxel. Durante el gesto, los
  // conectores siguen a las tarjetas desde el DOM (./Conectores.tsx).
  const alEmpezarGesto = useCallback(() => { apilar(tableroRef.current); setEnGesto(true); }, [apilar]);
  const alTerminarGesto = useCallback(() => setEnGesto(false), []);
  const idHoja = hoja.id;
  // La grilla avisa un cambio también al MONTAR, cuando compacta lo que vino (medido el 11/10: así se
  // guardó el informe de Mauricio a las 01:59 sin que tocara nada). Mirando, no se escribe: sólo editando.
  // Lo que avisa son filas DIBUJADAS: `aGuardado` las vuelve a las guardadas (lo plegado, en su lugar).
  const alMoverGrilla = useCallback((l: Layout) => {
    if (!editando) return;
    const v = vueltaRef.current;
    const pos = aGuardado(l, v.guardado, v.grupos, v.plegadas);
    setTablero((t) => conPosiciones(t, idHoja, v.duenoId, pos));
  }, [idHoja, editando]);

  const angosto = mounted && width > 0 && width < ANCHO_PILA && !imprimiendo;
  // El que el recorrido señala: el primero EN PANTALLA (arriba a la izquierda), no el primero del arreglo,
  // que puede ser el último que se agregó y estar abajo de todo. El de MaKo, el primero QUE LO TIENE.
  const ordenados = enOrden(visibles);
  const primerGrafico = ordenados.find(esGrafico)?.id ?? null;
  const primerConMako = ordenados.find((c): c is Grafico => esGrafico(c) && c.mako !== false && !!datos[c.id]?.resultado)?.id ?? null;
  const alternarEdicion = () => { setEditando((v) => !v); setSelId(null); setConSel(null); setConectando(null); setEditPopup(null); setMenu(null); setDetalle(null); };
  const puedeNuevaHoja = guardable && tablero.hojas.length < MAX_HOJAS;
  /**
   * Un elemento de la barra de inserción (o de su menú), agregado al lienzo. `inicial` es lo que trae una variante
   * (el «Desplegable» es una sección plegable: interfaz I7, ./Galeria.tsx).
   */
  const insertar = (t: TipoElemento, inicial?: OpcionInsertar['inicial']) => {
    setMenu(null);
    if (t === 'ia' && lienzo.componentes.filter((c) => esElemento(c) && c.tipo === 'ia').length >= MAX_IA_POR_HOJA) { show(`Máximo ${MAX_IA_POR_HOJA} cajas de MaKo`); return; }
    const e = nuevoElementoEn(t, lienzo.componentes, dueno, inicial);
    if (e) agregarComponente(e); else if (t === 'entidad') show(dueno ? 'Este gráfico no abre una ficha' : 'Sólo en un pop-up');
  };
  /** Abre (o cierra, si ya estaba abierto) un flotante anclado a `ancla`. */
  const alternarMenu = (tipo: Exclude<NonNullable<Menu>['tipo'], 'menuInsertar'>, ancla: HTMLElement) => setMenu((m) => (m && m.tipo === tipo ? null : { ancla, tipo }));
  const abrirMenu = (tipo: Exclude<NonNullable<Menu>['tipo'], 'menuInsertar'>) => (e: ReactMouseEvent<HTMLElement>) => {
    const ancla = e.currentTarget;
    alternarMenu(tipo, ancla);
  };
  const abrirMenuInsertar = (lugar: MenuBarra) => (e: ReactMouseEvent<HTMLElement>) => {
    const ancla = e.currentTarget;
    setMenu((m) => (m && m.tipo === 'menuInsertar' && m.lugar === lugar ? null : { ancla, tipo: 'menuInsertar', lugar }));
  };
  const menuInsertarAbierto = menu?.tipo === 'menuInsertar' ? menu.lugar : null;

  // ── De qué lado va el panel (punto 19): se fija AL ELEGIR y no se mueve mientras se arrastra ─────────
  const claveSel = `${sel?.id ?? (conectorSel ? `k:${conectorSel.id}` : '')}|${analista ? 'a' : ''}`;
  const [lado, setLado] = useState<{ clave: string; lado: 'izq' | 'der' }>({ clave: '', lado: 'der' });
  if (lado.clave !== claveSel) setLado({ clave: claveSel, lado: ladoDelPanel(sel, analista) });

  /**
   * Lo que la pantalla le cuenta a un elemento (interfaz I3): la hoja ENTERA (una caja de IA la manda al generar),
   * el pop-up donde vive y lo abierto (editándolo, la fila de muestra), quién puede generar, lo que se ve, y su
   * sección. `loQueSeVe` es el del lienzo: una caja compara su firma con lo que muestran los gráficos de su lugar.
   */
  const abiertoEnPopup = useMemo(() => entidadAbierta(muestra), [muestra]);
  const loQueSeVeLienzo = useMemo(() => loQueSeVeDe(lienzo, resultados, efectivos), [lienzo, resultados, efectivos]);
  const ctxDe = (c: Elemento): ContextoElemento => {
    const grupo = c.tipo === 'seccion' ? grupos.find((g) => g.id === c.id) : undefined;
    return {
      hoja, popupDe: duenoId, abierto: dueno ? abiertoEnPopup : null,
      periodo: dueno ? efectivosHoja[dueno.id] ?? null : null,
      puedeGenerar: !soloMirar, compartido: !!compartido, loQueSeVe: loQueSeVeLienzo, vista, onCambio: refrescar,
      ...(grupo ? { seccion: { plegada: plegadas.has(c.id), onPlegar: grupo.plegable ? () => alternarPlegado(c.id) : undefined, miembros: grupo.miembros.length } } : {}),
    };
  };

  /** Una tarjeta de la grilla (o de la pila del celular). */
  const tarjeta = (c: Componente, enPila = false) => {
    const elegido = editando && c.id === selId;
    const marcada = conectando?.desde === c.id;
    // La posición en la grilla del PDF (editor-css.ts): el lugar de la tarjeta, en columnas y filas.
    const base = { '--lk-col': `${c.x + 1} / span ${c.w}`, '--lk-fila': `${c.y + 1} / span ${c.h}`, ...(enPila ? { height: altoDe(c.h) } : {}) } as CSSProperties;
    const alClic = (ev: ReactMouseEvent) => {
      if (!editando) return;
      ev.stopPropagation();
      if (conectando) { elegirParaConectar(c.id); return; }
      setSelId(c.id);
      setConSel(null);
    };
    if (esElemento(c)) {
      return (
        <div key={c.id} data-comp={c.id} className={`lk-comp lk-comp--elemento${elegido || marcada ? ' lk-comp--sel' : ''}`} style={base} onClick={alClic}>
          <CuerpoElemento e={c} colores={colores} editando={editando} onCambiar={(p) => cambiar(c.id, p)} ctx={ctxDe(c)} />
        </div>
      );
    }
    if (!esGrafico(c)) return null;
    const ef = efectivos[c.id] ?? efectivoDe(conBusqueda(c), lienzo, vista, hoy);
    const est = datos[c.id] ?? { cargando: true };
    // Punto 15: mirando, una tarjeta con «ocultar si da cero» que da cero no se dibuja (tampoco ocupa lugar).
    if (!editando && ocultaSiCero(c, est)) return null;
    const kpi = esTarjetaNumero(c.tipo);
    // El filete y el color de una KPI salen de lo que SIGNIFICA su métrica (lo cobrado, verde; lo
    // pendiente, rojo), no de un color elegido a mano: el estilo es de la hoja.
    const filete = kpi && estilo.filete;
    const tono = filete ? colorDeTono(tonoDe(c.fuente, c.metricas[0]), hoja.tema) : null;
    const clases = ['lk-comp', kpi && 'lk-comp--kpi', kpi && estilo.kpiEtiqueta === 'mono' && 'lk-comp--mono', filete && 'lk-comp--filete', (elegido || marcada) && 'lk-comp--sel'].filter(Boolean).join(' ');
    // La barra de búsqueda de una tabla (interfaz I2): lo escrito va a la VISTA, en el control de su barra
    // (`idBusquedaDe`/`conBusqueda`, ./exportar.ts). Sin ese control (sobre el campo ya hay otro filtro), no hay barra.
    const conBarra = !!c.tabla?.buscar && !!idBusquedaDe(c);
    // El closer abre los pop-ups (la ficha de una llamada era lo que su bloque hacía); el detalle de un
    // número, no (son listas de personas: /api/graficos le contesta 403).
    const popupDelCloser = soloLectura && !compartido && !editando && c.alClic === 'popup' && c.popup ? (s: SelDetalle) => abrirPopup(c, s) : undefined;
    return (
      <div key={c.id} data-comp={c.id} className={clases} style={{ ...base, ...(tono ? { '--lk-filete': tono } : {}) } as CSSProperties} onClick={alClic}
        data-recorrido={c.id === primerGrafico ? (editando ? 'dash-componente' : 'dash-grafico') : undefined}>
        <div className="lk-comp-cab">
          <div className="lk-comp-tit">
            <span title={tituloDe(c)}>{tituloDe(c)}</span>
            {est.cargando && est.resultado && <span className="lk-mini-giro" aria-label="Actualizando" />}
          </div>
          <div className="lk-comp-acciones lk-no-arrastrar" onClick={(e) => e.stopPropagation()}>
            {conBarra && <BuscarEnTabla grafico={c} hoja={lienzo} vista={vista} onVista={onVista} compartido={compartido} />}
            {/* El «Filtro» de la tarjeta (interfaz I1, ./MenuFiltro.tsx): reemplaza a los chips sueltos. */}
            <MenuFiltro modo="tarjeta" comp={c} hoja={lienzo} vista={vista} efectivo={ef} hoy={hoy} editando={editando} onVista={onVista} onCambiarComp={(p) => cambiarDesdePanel(c, p)} compartido={compartido} />
            {/* El chat de MaKo de cada gráfico (el de las tabs viejas), también mirando, con el botón CHICO (sólo
                el logo sobre negro, punto 3). Sin personas: ./exportar.ts. Al closer y a un link no: su tab de
                antes no lo tenía, es IA que gasta en una vista de sólo lectura, y sin sesión no hay chat. Desde
                v5 se apaga por gráfico (punto 15: ausente = prendido). */}
            {est.resultado && !soloMirar && (c.mako !== false) && (
              <span className="lk-mako" data-recorrido={c.id === primerConMako ? 'dash-mako' : undefined}>
                <ChatMakoGrafico chartKey={`dashboard:${hoja.id}:${c.id}`} titulo={tituloDe(c)} contexto={contextoDeGrafico(c, est.resultado, ef)} />
              </span>
            )}
          </div>
        </div>
        {!kpi && c.subtitulo && <div className="lk-comp-sub" title={c.subtitulo}>{c.subtitulo}</div>}
        {/* El detalle de un número pide `detalle` a /api/graficos: al closer le contesta 403, y en un link
            compartido no se ofrece (son listas de personas; el endpoint del link también lo contesta 403).
            Sin `onDetalle`, el clic en un número no hace nada y no se pinta como clicable. Desde v5, lo que
            abre lo decide el gráfico (`alClicDe`: el detalle, su pop-up o nada). */}
        {(() => {
          const cuerpo = popupDelCloser ? <CuerpoGrafico g={c} estado={est} tema={hoja.tema} onDetalle={popupDelCloser} efectivo={ef} />
            : <CuerpoGrafico g={c} estado={est} tema={hoja.tema} onDetalle={editando || soloMirar ? undefined : alClicDe(c)} efectivo={ef} />;
          // Las acciones EN LA FILA (`tabla.acciones`: «Marcar cobrada»…) van sólo mirando y con sesión: sin este
          // provider la tabla no dibuja la columna (useColumnaAcciones devuelve null).
          return c.tabla?.acciones && !editando && !compartido
            ? <AccionesFilaProvider g={c} efectivo={ef} onCambio={refrescar}>{cuerpo}</AccionesFilaProvider> : cuerpo;
        })()}
      </div>
    );
  };

  const gDetalle = detalle ? hoja.componentes.find((c) => c.id === detalle.id) : undefined;

  // En blanco la pantalla es la de siempre (Martín, 12/10: «poner todo exactamente igual y en el lugar donde irían
  // los gráficos, en el medio poner un botón de 'Nuevo Dashboard' nada más»): la topbar muestra una hoja vacía y sin
  // filtros, sin el desplegable de hojas (por dentro viaja el inicial) y sin editar el título.
  const hojaTop: Hoja = enBlanco ? { ...hoja, nombre: 'Dashboard', emoji: '📊', subtitulo: '', controles: [], componentes: [] } : hoja;

  return (
    <div className={`lk lk-app${editando ? ' lk--editando' : ''}${imprimiendo ? ' lk--imprimir' : ''}${conectando ? ' lk--conectando' : ''}`}>
      {lecturaFallo && <div className="lk-sin-imprimir" style={{ padding: '8px 16px 0' }}><Banner tono="warn" alcance="local">No pude leer tu informe. Los cambios no se guardan.</Banner></div>}
      {conflicto && <div className="lk-sin-imprimir" style={{ padding: '8px 16px 0' }}><Banner tono="warn" alcance="local" accion={{ label: 'Recargar', onClick: recargar }}>Cambió en otra pestaña. Lo de aquí no se guarda.</Banner></div>}

      {/* ── La topbar, como la de Looker: el título de la hoja (con su desplegable) y a la derecha los
             filtros, Compartir, Editar y el ⋮ ── */}
      <BarraSuperior
        hoja={hojaTop} editable={guardable && !enBlanco} conHojas={!enBlanco && (puedeNuevaHoja || tablero.hojas.length > 1)}
        hojasAbierto={menu?.tipo === 'hojas'} emojiAbierto={menu?.tipo === 'emoji'} periodo={periodoDeHoja(hojaTop, vista, hoy)}
        onHojas={(ancla) => alternarMenu('hojas', ancla)} onEmoji={(ancla) => alternarMenu('emoji', ancla)} onCambiar={cambiarCabecera}
        derecha={(
          <>
            {/* Los filtros de la hoja, SIEMPRE a la vista (punto 7); agregarlos y quitarlos, sólo editando. */}
            <div className="lk-top-filtros" data-recorrido="dash-controles">
              <BarraControles
                hoja={hojaTop} vista={vista} editando={editando} guardable={guardable} hoy={hoy} compartido={compartido}
                onVista={onVista} onAgregar={agregarControl} onCambiar={cambiarControl} onQuitar={quitarControl} onRestablecer={restablecerVista}
              />
            </div>
            {/* «Editar» en azul (punto 3 de v5). Compartir se fue al ⋮. */}
            {!soloMirar && (
              <button type="button" className="lk-pill lk-pill--azul" data-recorrido={editando ? 'dash-ver' : 'dash-editar'} disabled={!guardable && !editando} onClick={enBlanco ? () => setNuevaHoja(true) : alternarEdicion}>
                {editando ? <><SvgOjo /> Ver</> : <><SvgLapiz /> Editar</>}
              </button>
            )}
            {/* El ⋮ (punto 4): el AI Analyst, Exportar y la guía. «Restablecer el informe» se fue (punto 2). */}
            <button type="button" className="lk-pill lk-pill--icono lk-mas" data-recorrido="dash-ayuda" aria-label={analisisNuevo ? 'Más opciones: hay un análisis nuevo' : 'Más opciones'}
              title="Más opciones" aria-haspopup="menu" aria-expanded={menu?.tipo === 'mas'} onClick={abrirMenu('mas')}>
              <span aria-hidden>⋮</span>
              {analisisNuevo && <PuntoNuevo />}
            </button>
          </>
        )}
      />

      {/* ── La barra de edición: DEBAJO de la topbar (la topbar no se mueve al apretar Editar), en el orden
             de la de Looker. Agregar un filtro está en la topbar, al lado de los filtros (sólo editando). ── */}
      {editando && (
        <div className="lk-barra" role="toolbar" aria-label="Herramientas de la hoja">
          <button type="button" className="lk-herr lk-herr--icono" data-recorrido="dash-deshacer" onClick={pila.deshacer} disabled={!pila.puedeDeshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><SvgDeshacer /></button>
          <button type="button" className="lk-herr lk-herr--icono" onClick={pila.rehacer} disabled={!pila.puedeRehacer} title="Rehacer (Ctrl+Y)" aria-label="Rehacer"><SvgDeshacer espejo /></button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" data-recorrido="dash-datos" onClick={() => setModalDatos(true)}><SvgAgregarDatos /> Añadir datos</button>
          <span className="lk-sep" />
          <button type="button" className="lk-herr" data-recorrido="dash-anadir-grafico" aria-haspopup="menu" aria-expanded={menu?.tipo === 'graficos'} onClick={abrirMenu('graficos')}>
            <SvgAgregarGrafico /> Añadir un gráfico <SvgFlecha />
          </button>
          <span className="lk-sep" />
          {/* Lo que se inserta, un ícono por cosa y en el orden de Looker (`BARRA_INSERTAR` de ./Galeria.tsx, del
              paquete de la topbar; `lugaresInsertar` saca la Ficha fuera de un pop-up). En el celular no entran: un
              solo «Insertar ▾» con todos. */}
          <div className="lk-insertar" role="group" aria-label="Insertar" data-recorrido="dash-insertar">
            <span className="lk-ins-sueltos">
              {lugaresInsertar(!!dueno).map((l) => (l.clase === 'suelto' ? (
                <button key={l.tipo} type="button" className="lk-herr lk-herr--icono" title={etiquetaInsertar(l.tipo)} aria-label={etiquetaInsertar(l.tipo)}
                  onClick={() => insertar(l.tipo)}>
                  <IconoElemento tipo={l.tipo} size={19} />
                </button>
              ) : (
                <button key={l.menu} type="button" className="lk-herr lk-herr--menu" title={l.nombre} aria-label={l.nombre} aria-haspopup="menu"
                  aria-expanded={menuInsertarAbierto === l.menu} onClick={abrirMenuInsertar(l.menu)}>
                  <IconoElemento tipo={l.icono} size={19} /> <SvgFlecha />
                </button>
              )))}
            </span>
            <button type="button" className="lk-herr lk-ins-menu" aria-haspopup="menu" aria-expanded={menu?.tipo === 'insertar'} onClick={abrirMenu('insertar')}>
              <SvgInsertar /> Insertar <SvgFlecha />
            </button>
          </div>
          <button type="button" className="lk-herr lk-herr--fin" data-recorrido="dash-estilo" aria-haspopup="dialog" aria-expanded={menu?.tipo === 'estilo'} onClick={abrirMenu('estilo')}>
            <SvgEstilo /> Estilo de la hoja <SvgFlecha />
          </button>
        </div>
      )}

      {/* ── El lienzo (lo único que scrollea) y, encima, el panel de propiedades y el AI Analyst ── */}
      <div className="lk-cuerpo">
        <div className="lk-lienzo" style={varsTema} onClick={() => { if (editando) { setSelId(null); setConSel(null); } }}>
          <div className="lk-pagina" ref={containerRef}>
            {dueno && (
              <nav className="lk-miga lk-no-arrastrar" aria-label="Ubicación" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={salirDelPopup}>{hoja.nombre}</button>
                <span aria-hidden>›</span>
                <span className="lk-miga-actual">Pop-up · {dueno.popup?.titulo || tituloDe(dueno)}</span>
                {muestra?.etiqueta && <span className="lk-miga-muestra">Muestra: {muestra.etiqueta}</span>}
              </nav>
            )}
            {enBlanco ? (
              <div className="lk-vacio lk-en-blanco">
                <button type="button" className="lk-pill lk-pill--azul" onClick={(e) => { e.stopPropagation(); setNuevaHoja(true); }} disabled={!guardable}>＋ Nuevo Dashboard</button>
              </div>
            ) : !lienzo.componentes.length ? (
              <div className="lk-vacio">
                <p>{dueno ? 'Este pop-up está vacío.' : 'Esta hoja no tiene gráficos.'}</p>
                {editando ? (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={(e) => { e.stopPropagation(); setMenu({ ancla: e.currentTarget, tipo: 'graficos' }); }}>Añadir un gráfico</button>
                ) : !soloMirar && (
                  <button type="button" className="lk-pill lk-pill--azul" onClick={alternarEdicion} disabled={!guardable}>Editar</button>
                )}
              </div>
            ) : angosto ? (
              // En el celular la grilla de 12 columnas no se lee: una tarjeta abajo de la otra, en el orden
              // en que se leen. No se arrastra (no hay dónde), pero se elige y se edita igual.
              <div className="lk-pila">{ordenados.map((c) => tarjeta(c, true))}</div>
            ) : mounted && (
              <div className="lk-grilla" ref={grillaRef}>
                <FondosSecciones fondos={fondos} colores={colores} ancho={width} fila={FILA} margen={MARGEN} />
                {/* ⚠️ `absoluteStrategy` (top/left) y NO el transform de siempre: un ancestro con `transform`
                    vuelve a un `position: fixed` relativo a ÉL. El modal del chat de MaKo (antes MakoButton), el
                    toast de «Marcar cobrada» y los menús que no van en portal se dibujaban ADENTRO de la
                    tarjeta, recortados por su overflow. */}
                <ReactGridLayout
                  positionStrategy={absoluteStrategy}
                  width={width}
                  layout={layout}
                  gridConfig={{ cols: COLS, rowHeight: FILA, margin: [MARGEN, MARGEN], containerPadding: [0, 0] }}
                  dragConfig={{ enabled: editando && !conectando, cancel: '.lk-no-arrastrar' }}
                  resizeConfig={{ enabled: editando && !conectando, handles: ['se', 'e', 's'] }}
                  compactor={verticalCompactor}
                  onDragStart={alEmpezarGesto}
                  onResizeStart={alEmpezarGesto}
                  onDragStop={alTerminarGesto}
                  onResizeStop={alTerminarGesto}
                  onLayoutChange={alMoverGrilla}
                >
                  {visibles.map((c) => tarjeta(c))}
                </ReactGridLayout>
                {!dueno && (
                  <CapaConectores
                    conectores={hoja.conectores ?? []} cajas={cajasDibujadas} ancho={width} fila={FILA} margen={MARGEN} colores={colores}
                    editando={editando} seleccionado={conectorSel?.id ?? null} onElegir={(id) => { setConSel(id); setSelId(null); }} onBorrar={borrarConector}
                    enGesto={enGesto} contenedor={grillaRef} tiradoresDe={sel && !conectando ? sel.id : null} onUnir={unir}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {conectando && (
          <div className="lk-conectar-aviso lk-sin-imprimir" role="status">
            <span>{conectando.desde ? 'Elige la otra tarjeta' : 'Elige la primera tarjeta'}</span>
            <button type="button" onClick={() => setConectando(null)}>Cancelar</button>
          </div>
        )}

        {sel && (
          <aside className="lk-props" data-lado={lado.lado} aria-label="Propiedades" onClick={(e) => e.stopPropagation()}>
            {esGrafico(sel) ? (
              <PropsGrafico key={sel.id} g={sel} hoja={lienzo} hoy={hoy} enPopup={!!dueno} onCambiar={(p) => cambiarDesdePanel(sel, p)}
                onCambiarTipo={(el) => setMenu({ ancla: el, tipo: 'cambiarTipo' })} onDuplicar={() => duplicar(sel)} onBorrar={() => borrar(sel)} onCerrar={() => setSelId(null)}
                onEditarPopup={dueno ? undefined : () => editarPopup(sel.id)} />
            ) : esElemento(sel) ? (
              <PropsElemento key={sel.id} e={sel} colores={colores} hoja={hoja} popupDe={duenoId} contexto={dueno ? abiertoEnPopup : null}
                entidad={dueno ? entidadDeGrafico(dueno) : null} vista={vista} onCambiar={(p) => cambiar(sel.id, p)}
                onDuplicar={() => duplicar(sel)} onBorrar={() => borrar(sel)} onCerrar={() => setSelId(null)} />
            ) : null}
          </aside>
        )}
        {!sel && conectorSel && (
          <aside className="lk-props" data-lado={lado.lado} aria-label="Propiedades del conector" onClick={(e) => e.stopPropagation()}>
            <PropsConector key={conectorSel.id} k={conectorSel} colores={colores} onCambiar={(p) => cambiarConector(conectorSel.id, p)}
              onBorrar={() => borrarConector(conectorSel.id)} onCerrar={() => setConSel(null)} />
          </aside>
        )}

        {/* El AI Analyst es un panel (un `aside` de alto completo), no un modal: va en esta fila, encima del
            lienzo en la compu (./edicion-css.ts). Con la vista: el análisis a mano mira lo que la persona eligió. */}
        {analista && <PanelAnalista hoja={hoja} loQueSeVe={loQueSeVe} vista={vista} onCerrar={cerrarAnalista} />}
      </div>

      {/* ── Los menús de la fila de arriba y de la barra ── */}
      {menu?.tipo === 'graficos' || menu?.tipo === 'cambiarTipo' ? (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={372}>
          <Galeria
            actual={menu.tipo === 'cambiarTipo' && sel && esGrafico(sel) ? sel.tipo : undefined}
            onElegir={(tipo) => {
              const m = menu;
              setMenu(null);
              if (m.tipo === 'cambiarTipo' && sel && esGrafico(sel)) cambiar(sel.id, { tipo });
              else agregarComponente(nuevoGrafico(tipo, lienzo.componentes, fuenteParaNuevo()));
            }}
          />
        </Flotante>
      ) : null}
      {menu?.tipo === 'insertar' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={220}>
          <MenuInsertar onElegir={insertar} componentes={lienzo.componentes} enPopup={!!dueno} onConectar={iniciarConectar} />
        </Flotante>
      )}
      {menu?.tipo === 'menuInsertar' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={220}>
          <MenuElementos menu={menu.lugar} onElegir={insertar} componentes={lienzo.componentes} enPopup={!!dueno} onConectar={iniciarConectar} />
        </Flotante>
      )}
      {menu?.tipo === 'estilo' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={340}>
          <PanelEstilo tema={hoja.tema} onCambiar={cambiarTema} />
        </Flotante>
      )}
      {/* El ⋮: AI Analyst (no al closer ni a un link), Exportar y la guía (no en un link). */}
      {menu?.tipo === 'mas' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={240}>
          <div className="lk-lista" role="menu">
            {/* Compartir (punto 9; desde v5 un renglón del ⋮): sólo quien puede guardar comparte (el closer no, y
                desde un link no se re-comparte). El modal va AFUERA del menú: adentro, cerrar el menú lo desmontaría. */}
            {guardable && (
              <>
                <RenglonCompartir onClick={abrirCompartir} />
                <div className="lk-sep-h" />
              </>
            )}
            {!soloMirar && (
              <>
                <button type="button" role="menuitem" className="lk-opcion lk-opcion--mako" data-abierto={analista || undefined} onClick={alternarAnalista}
                  title="MaKo analiza los gráficos de esta hoja">
                  <LogoMako lado={22} /> <span>AI Analyst</span>
                  {analisisNuevo && <PuntoNuevo enMenu />}
                </button>
                <div className="lk-sep-h" />
              </>
            )}
            <div className="lk-lista-grupo">Exportar</div>
            <button type="button" role="menuitem" className="lk-opcion" onClick={exportarCsv}><IconoMenu nombre="descargar" size={17} /> <span>Datos (CSV)</span></button>
            <button type="button" role="menuitem" className="lk-opcion" onClick={exportarPdf}><IconoMenu nombre="archivo" size={17} /> <span>PDF</span></button>
            {conGuia && (
              <>
                <div className="lk-sep-h" />
                <button type="button" role="menuitem" className="lk-opcion" onClick={() => { setMenu(null); (editando ? recorridoEdicion.reabrir : recorrido.reabrir)(); }}>
                  <IconoMenu nombre="pregunta" size={17} /> <span>{editando ? 'Guía de edición' : 'Guía del Dashboard'}</span>
                </button>
              </>
            )}
          </div>
        </Flotante>
      )}
      {/* El desplegable del título: «Nueva hoja» primera, y las hojas (punto 1). */}
      {menu?.tipo === 'hojas' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={300}>
          <MenuHojas
            hojas={tablero.hojas} activa={hoja.id} puedeNueva={puedeNuevaHoja}
            acciones={guardable ? { onRenombrar: renombrarHoja, onDuplicar: duplicarHoja, onCopiar: copiarHoja, onMover: moverHoja, onEliminar: eliminarHoja } : null}
            onIr={(id) => { setMenu(null); irAHoja(id); }}
            onNueva={() => { setMenu(null); setNuevaHoja(true); }}
          />
        </Flotante>
      )}
      {menu?.tipo === 'emoji' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={320}>
          <EmojiPicker embebido onPick={(e) => { setMenu(null); cambiarCabecera({ emoji: e }); }} onClose={() => setMenu(null)} />
        </Flotante>
      )}

      {/* ── Los modales ── */}
      {guardable && <BotonCompartir hojaId={hoja.id} titulo={hoja.nombre} abierto={compartir} onCerrar={cerrarCompartir} />}
      {modalDatos && <ModalDatos onElegir={anadirFuente} onCerrar={cerrarModalDatos} />}
      {nuevaHoja && <NuevaHoja onCerrar={cerrarNuevaHoja} onCrear={crearHoja} enBlanco={enBlanco ? 'Página 1' : `Página ${tablero.hojas.length + 1}`} />}
      {gDetalle && esGrafico(gDetalle) && detalle && (
        <DetalleModal g={gDetalle} hoja={hoja} efectivo={efectivosHoja[gDetalle.id] ?? efectivoDe(gDetalle, hoja, vista, hoy)} sel={detalle.sel} tema={hoja.tema}
          onCerrar={cerrarDetalle} onCambio={refrescar} onFiltrar={filtrarPor} />
      )}
      {/* El pop-up de un gráfico (punto 7), mirando. Nunca en un link compartido (el clic no lo ofrece). */}
      {popup && !compartido && (
        <PopupGrafico g={popup.g} hoja={popup.hoja} contexto={popup.ctx} periodo={popup.periodo} hoy={hoy} onCerrar={cerrarPopup} onCambio={refrescar} puedeGenerar={!soloMirar} />
      )}
      {/* La llamada del link (`?llamada=`). Sus tareas (re-analizar, revisar) son también del closer:
          la ficha no va en sólo lectura. Después de una, los datos se vuelven a pedir. */}
      {llamada != null && !compartido && <FichaLlamada recordingId={llamada} onCerrar={cerrarLlamada} onCambio={refrescar} />}

      <Recorrido id={RECORRIDO_DASHBOARD} pasos={PASOS_DASHBOARD} abierto={recorrido.abierto} onCerrar={recorrido.onCerrar} />
      <Recorrido id={RECORRIDO_DASHBOARD_EDICION} pasos={PASOS_DASHBOARD_EDICION} abierto={recorridoEdicion.abierto} onCerrar={recorridoEdicion.onCerrar} />
      <Toast state={toast} onClose={clear} />
      <style>{CSS}</style>
      <style>{CSS_EDICION}</style>
    </div>
  );
}

// ── «Añadir datos»: más simple que Looker, porque la fuente es una sola, MaKo ─────────────────
// Con el `Modal` de la casa (entra en la pila de modales: queda arriba del recorrido y el Escape cierra
// sólo esto). El foco va al buscador con `useFocoInicial`: `autoFocus` adentro de un Modal no llega.

function ModalDatos({ onElegir, onCerrar }: { onElegir: (id: string) => void; onCerrar: () => void }) {
  const [q, setQ] = useState('');
  useFocoInicial('lk-buscar-datos');
  const filtro = norm(q.trim());
  return (
    <Modal titulo="Añadir datos de MaKo" onCerrar={onCerrar} ancho={640}>
      <div className="lk">
        <div className="lk-buscar lk-buscar--modal"><SvgLupa /><input id="lk-buscar-datos" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar datos" /></div>
        {AREAS.map((area) => {
          const fs = FUENTES.filter((f) => f.area === area && (!filtro || norm(`${f.nombre} ${f.descripcion} ${area}`).includes(filtro)));
          if (!fs.length) return null;
          return (
            <div key={area}>
              <div className="lk-darea-tit">{area}</div>
              {fs.map((f) => (
                <button key={f.id} type="button" className="lk-dato" onClick={() => onElegir(f.id)}>
                  <span className="lk-fuente-ico"><IconoMenu nombre="grafico" size={14} /></span>
                  <span className="lk-dato-txt"><span className="lk-dato-nom">{f.nombre}</span><span className="lk-dato-desc">{f.descripcion}</span></span>
                  <span className="lk-dato-mas">Añadir</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
