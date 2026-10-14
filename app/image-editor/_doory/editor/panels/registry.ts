/**
 * Tool registry. Con el armazón de Canva (tanda 2) los paneles con `rail: true` son las pestañas del riel izquierdo
 * (Diseño, Elementos, Texto, Marca, Subidos, Herramientas, Proyectos, Apps) y se abren como la tarjeta flotante de la
 * izquierda (`SidebarHost`); un `drawer` sólo se abre como popover si alguien registró su botón ancla
 * (`useChrome().setAnchor`), si no también va a la izquierda. Features add tools without touching core files:
 *
 * ```tsx
 * registerPanel({ id: 'charts', label: 'Charts', icon: <ChartBar size={18} />, order: 45, placement: 'drawer', component: ChartsDrawer })
 * ```
 *
 * Below the desktop breakpoint every tool opens as a bottom sheet.
 */
import type { ComponentType, ReactNode } from 'react'
import type { EditorEngine } from '../engine/editor'
import { Registry } from '../engine/registry'
import type { EditorState } from '../store/editorStore'

export interface PanelProps {
  /** Closes the tool (drawers call it after an item was added). */
  close(): void
}

export interface PanelDefinition {
  id: string
  /** Label under the icon in the top bar. */
  label: string
  icon: ReactNode
  /** Lower comes first in the top bar. Built-ins use 10, 20, 30… */
  order: number
  /** Rendered inside the drawer / sidebar; use `useEditor()` & friends for state. */
  component: ComponentType<PanelProps>
  /** Hide the tool when this returns false (e.g. needs an account service). */
  requires?(ctx: { editor: EditorEngine; state: EditorState }): boolean
  /** Sidebar / sheet heading (defaults to `label`). */
  title?: string
  /** `drawer`: popover under the top-bar button. `sidebar`: docked at the left of the workspace. Default `sidebar`. */
  placement?: 'drawer' | 'sidebar'
  /** Drawer width in px (default 320). */
  width?: number
  /** Shortcut hint for the tooltip. */
  shortcut?: string
  /** `tools`: icon-over-label entry in the middle of the top bar (default). `end`: icon button at the right end. */
  slot?: 'tools' | 'end'
  /**
   * Pestaña del riel izquierdo de Canva (chrome/RielCanva.tsx), en el orden de `order`. Los paneles sin `rail`
   * (Animar, Audio, Capas, Comentarios) siguen registrados: los abren la barra del objeto, «Apps» y los comandos.
   */
  rail?: boolean
  /** Starts downloading the panel's code (lazy panels); the top-bar button calls it when it is hovered or focused. */
  preload?(): void
  /** Also offered while the design is open view-only or comment-only (a shared link), e.g. Comments. */
  readOnly?: boolean
}

export const panels = new Registry<PanelDefinition>((a, b) => a.order - b.order)

export function registerPanel(panel: PanelDefinition): () => void {
  return panels.register(panel)
}
