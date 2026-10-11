// =============================================================================
// Las RANURAS del Video Editor: dónde se enchufa cada funcionalidad
// =============================================================================
// La copia de CapCut tiene tres lugares donde aparecen las funciones y que
// tocarían todas a la vez si cada una se escribiera adentro:
//
//   · el panel derecho (Propiedades): pestañas «Video · Velocidad · Animación ·
//     Ajustar», «Básico · Modificador de voz», «Texto · Animación · Texto a voz»,
//     y las sub-pestañas «Básico · Eliminar fondo · Máscara · Retoque»;
//   · la biblioteca (panel izquierdo): Multimedia, Audio, Texto, Stickers,
//     Efectos, Transiciones, Subtítulos, Filtros, Ajuste, cada una con su columna
//     de subcategorías;
//   · la barra de herramientas de la línea de tiempo: Dividir, Borrar a la
//     izquierda, Congelar, Revertir, Reflejar, Recortar, Grabar…
//
// Cada pantalla (la cáscara) DIBUJA lo que hay registrado acá, en el orden que
// diga `orden`; cada funcionalidad se REGISTRA desde su propio archivo. Así una
// función nueva no edita la cáscara, y la cáscara se puede re-vestir sin tocar
// las funciones. El registro se hace al importar el módulo: todos los archivos de
// registro se importan desde ./extensiones.ts, que la raíz del editor importa
// antes de dibujar.
//
// Los rótulos van como los muestra CapCut en español (es-LA.po de CapCut 9.3,
// ver docs/diseno-editor-video.md §Textos), en español neutro (tú): el texto que
// ve el cliente no va en voseo (AGENTS.md, «La voz de MaKo es rioplatense, y el
// texto DEL CLIENTE no»).

import type { ComponentType } from 'react';
import type { EditorCore } from '../_opencut/core';
import type { ElementRef, TimelineElement, TimelineTrack } from '../_opencut/timeline';
import type { MediaAsset } from '../_opencut/media/types';

// ── Registro genérico ───────────────────────────────────────────────────────

/** Una lista con id único y orden. Registrar dos veces el mismo id REEMPLAZA (HMR). */
class Ranura<T extends { id: string; orden: number }> {
  private items = new Map<string, T>();
  constructor(readonly nombre: string) {}
  registrar(item: T): void { this.items.set(item.id, item); }
  todos(): T[] { return [...this.items.values()].sort((a, b) => a.orden - b.orden); }
  filtrar(pred: (item: T) => boolean): T[] { return this.todos().filter(pred); }
}

// ── 1. Panel derecho (Propiedades) ──────────────────────────────────────────

export type ContextoInspector = {
  element: TimelineElement;
  track: TimelineTrack;
  mediaAssets: MediaAsset[];
};

/** Una pestaña de arriba del panel derecho («Video», «Velocidad», «Animación»…). */
export type PestanaInspector = {
  id: string;
  etiqueta: string;
  orden: number;
  aplica: (ctx: ContextoInspector) => boolean;
  /** Si la pestaña tiene sub-pestañas (Video → Básico · Eliminar fondo · Máscara · Retoque),
   *  el contenido lo arma la cáscara con las `SubpestanaInspector` de esta pestaña. */
  Contenido?: ComponentType<ContextoInspector>;
};

/** Una sub-pestaña del control segmentado de una pestaña. */
export type SubpestanaInspector = {
  pestana: string;
  id: string;
  etiqueta: string;
  orden: number;
  aplica: (ctx: ContextoInspector) => boolean;
  Contenido: ComponentType<ContextoInspector>;
};

export const pestanasInspector = new Ranura<PestanaInspector>('pestañas del panel derecho');
export const subpestanasInspector = new Ranura<SubpestanaInspector>('sub-pestañas del panel derecho');

// ── 2. Biblioteca (panel izquierdo) ─────────────────────────────────────────

export type CategoriaBiblioteca =
  | 'multimedia' | 'audio' | 'texto' | 'stickers' | 'efectos'
  | 'transiciones' | 'subtitulos' | 'filtros' | 'ajuste';

/** Una subcategoría de la columna izquierda de una pestaña de la biblioteca. */
export type SeccionBiblioteca = {
  categoria: CategoriaBiblioteca;
  id: string;
  etiqueta: string;
  orden: number;
  /** Subcategorías anidadas (▾) en la columna; opcional. */
  padre?: string;
  Contenido: ComponentType;
};

export const seccionesBiblioteca = new Ranura<SeccionBiblioteca>('secciones de la biblioteca');

// ── 3. Barra de herramientas de la línea de tiempo ──────────────────────────

export type ContextoHerramienta = {
  editor: EditorCore;
  seleccion: ElementRef[];
};

export type HerramientaLinea = {
  id: string;
  etiqueta: string;
  /** Como lo muestra el tooltip de CapCut: «Ctrl+B», «Q», «P». */
  atajo?: string;
  orden: number;
  lado: 'izquierda' | 'derecha';
  /** Herramientas que van juntas detrás de un ◢ (Reflejar / Girar / Congelar / Revertir). */
  grupo?: string;
  Icono: ComponentType<{ className?: string }>;
  visible?: (ctx: ContextoHerramienta) => boolean;
  habilitada: (ctx: ContextoHerramienta) => boolean;
  /** Para los interruptores (Imán de la pista principal, Ajuste automático…). */
  activa?: (ctx: ContextoHerramienta) => boolean;
  ejecutar: (ctx: ContextoHerramienta) => void;
};

export const herramientasLinea = new Ranura<HerramientaLinea>('herramientas de la línea de tiempo');
