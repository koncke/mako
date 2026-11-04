'use client';

// =============================================================================
// El contexto del editor — el contrato entre el armazón y sus piezas
// =============================================================================
// El armazón (EditorLanding.tsx) es el ÚNICO dueño del documento: guarda, publica
// y cambia de página. Las piezas (paneles, diálogos, NodeViews, menús) leen y
// piden cosas por acá; ninguna llama a /api/landing-generator para escribir el
// documento por su cuenta (AGENTS.md: «dos componentes que llaman al mismo setter
// de un objeto completo son un bug esperando»). Diseño: docs/diseno-editor-landing.md.
// =============================================================================

import { createContext, useContext } from 'react';
import type { Editor } from '@tiptap/react';
import type { LandingContenido, Pagina, JsonNodo } from '@/lib/editor-landing/doc';
import type { ConfigLanding } from '@/lib/editor-landing/api-tipos';
import type { Tema } from '@/lib/editor-landing/temas';

// 'landings' = la lista de la tarjeta izquierda (la otra vista del chat, como en Automations: 24/10/2026).
/**
 * La TARJETA de la izquierda: siempre está (24/10/2026, Martín: «La sidebar del chat de MaKo NO se debe poder cerrar nunca.
 * Elimina el boton de plegar»). Cambia de vista: el chat, las páginas, tus landings o la tira de secciones («"Abrir tira de
 * imagenes" debería ser un botón en la topbar, y se debería abrir donde está el chat de mako»).
 */
export type PanelIzq = 'agente' | 'paginas' | 'landings' | 'tira';
/** `animacion` = el panel «Animar» (paneles/PanelAnimacion.tsx). */
export type PanelDer = 'tema' | 'comentarios' | 'historial' | 'animacion' | null;
/** Las dos vistas del panel «Animar» (el «Elemento | Página» del Image Editor). */
export type ModoAnimar = 'seccion' | 'pagina';
/** Lo que pidió quien abrió «Animar» (la barra, el menú de una sección): `n` sube con cada pedido. */
export type PedidoAnimar = { modo: ModoAnimar; n: number };
export type Dialogo = 'compartir' | 'publicar' | 'exportar' | 'configuracion' | 'analitica' | 'atajos' | 'presentar' | null;

export type EstadoGuardado = 'guardado' | 'guardando' | 'sin-guardar' | 'error' | 'conflicto';

export type OpcionesImagen = {
  /** Qué pestañas ofrece el selector. */
  modo?: 'imagen' | 'video';
  /** Texto para la búsqueda de stock (lo propone la IA o el título de la sección). */
  sugerencia?: string;
};

export type CtxEditorLanding = {
  docId: number;
  titulo: string;
  setTitulo: (t: string) => void;
  /**
   * ⚠️ La página ABIERTA trae lo del último guardado (se refresca en cada guardado, con el respiro
   * de 1,5 s); lo vivo de esa página es `editor`. Las demás páginas sí están al día.
   */
  contenido: LandingContenido;
  config: ConfigLanding;
  /** Reemplaza la config ENTERA (la arma quien llama, partiendo de `config`). */
  setConfig: (c: ConfigLanding) => void;
  tema: Tema;
  version: number;
  estado: EstadoGuardado;
  /** Manda lo pendiente ya (cancela el respiro del autoguardado) y devuelve la versión nueva. */
  guardarAhora: () => Promise<number | null>;

  paginas: Pagina[];
  paginaActual: string;              // id
  irAPagina: (id: string) => void;
  /** Agrega, renombra, mueve, borra páginas: el armazón aplica y guarda. */
  setPaginas: (p: Pagina[]) => void;

  /** El editor TipTap de la página abierta (null mientras monta). */
  editor: Editor | null;
  /** Sección (tarjeta) donde está el cursor, o la última tocada. */
  tarjetaActiva: string | null;
  irATarjeta: (id: string) => void;
  /**
   * La sección pasa a ser la activa SIN mover el cursor ni el scroll (24/10/2026): un clic adentro de un «Diseño
   * editable» pasa en su iframe y ProseMirror no lo ve, así que la sección no se activaba («clickeo y no se pueden editar
   * las secciones», Martín).
   */
  marcarActiva: (id: string) => void;

  /** Lo de MaKo (Edición con IA). */
  modoIA: boolean;
  setModoIA: (v: boolean) => void;

  panelIzq: PanelIzq;
  setPanelIzq: (p: PanelIzq) => void;
  /**
   * «Nueva landing» abierta: «¿Qué vas a crear hoy?» ocupa el lugar de la barra y el lienzo, SIN navegar y sin cambiar la
   * tarjeta de la izquierda (24/10/2026, Martín). `setNueva(false)` vuelve a la landing abierta tal como estaba.
   */
  nueva: boolean;
  setNueva: (v: boolean) => void;
  /**
   * «Ver todo en el Panel», en el mismo lugar que «Nueva landing» y sin navegar (30/10/2026, el Cerebro, sobre lo que Martín
   * pidió el 24/10: que ir al Panel no cambie de ruta ni de barra). Suma su columna: Plantillas, Temas, Papelera y lo analizado.
   */
  panelEntero: boolean;
  verPanel: () => void;
  /**
   * Retomar una réplica sin terminar (ticket #54, 4/11/2026): abre «Nueva landing» con lo leído de esa página, sin volver a
   * leerla (lib/editor-landing/replica-borrador.ts). Lo ofrece la lista de landings, en «Sin terminar».
   */
  retomarReplica: (url: string, adaptar: boolean) => void;
  /** Sube cuando el Panel cambió la lista (renombrar, duplicar, archivar, eliminar): la de la tarjeta se vuelve a leer. */
  revisionLista: number;
  panelDer: PanelDer;
  setPanelDer: (p: PanelDer) => void;
  /**
   * Abre el panel «Animar» en una vista. Con `tarjetaId` (el menú de una sección, «Animar sección»), esa sección
   * pasa a ser la activa sin mover el scroll.
   */
  abrirAnimar: (modo: ModoAnimar, tarjetaId?: string) => void;
  dialogo: Dialogo;
  setDialogo: (d: Dialogo) => void;

  /** Sube un archivo al bucket público y devuelve su URL (con progreso real por XHR). */
  subirArchivo: (f: File, onProgreso?: (pct: number) => void) => Promise<string>;
  /** Abre el selector (Subir · Buscar · Enlace · Biblioteca) y resuelve con la URL elegida o null. */
  elegirImagen: (op?: OpcionesImagen) => Promise<string | null>;

  /** Toast corto (3-4 palabras), con deshacer opcional. */
  avisar: (texto: string, onDeshacer?: () => void) => void;

  /** Reemplaza secciones por id (lo usa «Edición con IA» al aceptar), en UNA transacción deshacible. */
  reemplazarTarjetas: (nuevas: JsonNodo[]) => void;
  /** Inserta secciones después de la activa (o al final), en una transacción. */
  insertarTarjetas: (nuevas: JsonNodo[], despuesDe?: string | null) => void;

  urlPublica: string | null;
  /**
   * Lo que va antes del slug en la dirección pública (`https://hola-mako.site` en producción, tanda 4).
   * Viene del server (`LandingCompleta.baseLandings`): el navegador no sabe en qué entorno corre.
   */
  baseLandings: string;
  cambiosSinPublicar: boolean;
  /** Recarga lo del server (después de publicar, restaurar una versión, etc.). */
  recargar: () => Promise<void>;
};

export const EditorLandingContext = createContext<CtxEditorLanding | null>(null);

export function useEditorLanding(): CtxEditorLanding {
  const c = useContext(EditorLandingContext);
  if (!c) throw new Error('useEditorLanding fuera del editor');
  return c;
}
