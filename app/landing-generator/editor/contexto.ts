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

export type PanelIzq = 'agente' | 'paginas' | null;
export type PanelDer = 'tema' | 'comentarios' | 'historial' | null;
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

  /** Lo de MaKo (Edición con IA). */
  modoIA: boolean;
  setModoIA: (v: boolean) => void;

  panelIzq: PanelIzq;
  setPanelIzq: (p: PanelIzq) => void;
  panelDer: PanelDer;
  setPanelDer: (p: PanelDer) => void;
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
