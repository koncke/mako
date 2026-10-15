import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, X } from 'lucide-react'
import { useEditorState, usePortalRoot } from '../context'
import { type PanelDefinition } from '../panels/registry'
import { useVisiblePanels } from '../panels/useVisiblePanels'
import { t } from '../strings'
import { Popover } from '../ui/Popover'
import { useChrome, useOpenTool } from './ChromeContext'
import ed from './ed.module.css'
import styles from './ToolHost.module.css'

function useOpenPanel(): PanelDefinition | undefined {
  const { openId } = useOpenTool()
  const visible = useVisiblePanels()
  return useMemo(() => visible.find((p) => p.id === openId), [visible, openId])
}

/**
 * Un `drawer` se abre como popover sólo si alguien registró su botón ancla (`useChrome().setAnchor`). Con el riel de
 * Canva no hay botones de herramientas en la barra superior: sin ancla, el panel va a la tarjeta de la izquierda
 * como todos (en Canva no hay paneles colgando de la barra).
 */
function asDrawer(panel: PanelDefinition, chrome: ReturnType<typeof useChrome>): boolean {
  return panel.placement === 'drawer' && chrome.getAnchor(panel.id) !== null
}

/** The drawer of the open tool: a popover under its anchor button; below the desktop breakpoint, every tool as a bottom sheet. */
export function DrawerHost() {
  const panel = useOpenPanel()
  const compact = useEditorState((s) => s.ui.compact)
  const { close } = useOpenTool()
  const chrome = useChrome()
  if (!panel) return null
  if (compact) return <Sheet panel={panel} onClose={close} />
  if (!asDrawer(panel, chrome)) return null
  return <DrawerPopover panel={panel} onClose={close} />
}

function DrawerPopover({ panel, onClose }: { panel: PanelDefinition; onClose: () => void }) {
  const chrome = useChrome()
  const anchorRef = useMemo(() => ({ current: chrome.getAnchor(panel.id) }), [chrome, panel.id])
  const Body = panel.component
  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} label={panel.title ?? panel.label} placement="bottom" width={panel.width ?? 320} variant="plain" cover gap={8} focusOnOpen={chrome.isKeyboardOpen()}>
      <div className={styles.drawerScroll} data-testid={`drawer-${panel.id}`}>
        <div className={ed.drawerBody}>
          <Body close={onClose} />
        </div>
      </div>
    </Popover>
  )
}

/**
 * El panel lateral de Canva 2025–26: una tarjeta blanca flotante de ~350 px a la derecha del riel, separada 8 px del
 * riel y de la barra superior, con radio y sombra elevada; título de 16 px semibold y «‹» para cerrarla
 * (relevamiento-canva-armazon.md §1.1 y §3.2). Desktop only: below 1024 px the tool opens as a bottom sheet.
 */
export function SidebarHost() {
  const panel = useOpenPanel()
  const compact = useEditorState((s) => s.ui.compact)
  const { close } = useOpenTool()
  const chrome = useChrome()
  const ref = useRef<HTMLElement>(null)
  const id = panel?.id

  // Abierto con el teclado (Enter en una pestaña del riel): el foco entra al panel, como en un diálogo no modal.
  useEffect(() => {
    if (id && chrome.isKeyboardOpen()) ref.current?.focus({ preventScroll: true })
  }, [id, chrome])

  if (!panel || compact || asDrawer(panel, chrome)) return null
  const Body = panel.component
  const title = panel.title ?? panel.label
  return (
    <aside ref={ref} className={styles.sidebar} aria-label={title} tabIndex={-1} data-testid={`sidebar-${panel.id}`} data-panel={panel.id}>
      <header className={styles.sidebarHead}>
        <h2 className={styles.sidebarTitle}>{title}</h2>
        <button type="button" className={styles.close} onClick={close} aria-label={t.chrome.closeTool(title)} title={t.chrome.closeTool(title)} data-testid="sidebar-close">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.sidebarBody}>
        <Body close={close} />
      </div>
    </aside>
  )
}

function Sheet({ panel, onClose }: { panel: PanelDefinition; onClose: () => void }) {
  const root = usePortalRoot()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])
  if (!root) return null
  const Body = panel.component
  const drawer = panel.placement === 'drawer'
  return createPortal(
    <>
      <div className={styles.backdrop} onPointerDown={onClose} aria-hidden="true" />
      <div ref={ref} className={styles.sheet} role="dialog" aria-label={panel.title ?? panel.label} tabIndex={-1} data-testid={`sheet-${panel.id}`}>
        <span className={styles.grab} aria-hidden="true" />
        <header className={styles.sheetHead}>
          <h2 className={styles.sidebarTitle}>{panel.title ?? panel.label}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.chrome.closeTool(panel.title ?? panel.label)} data-testid="sheet-close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.sheetBody}>
          {drawer ? (
            <div className={ed.drawerBody}>
              <Body close={onClose} />
            </div>
          ) : (
            <div className={styles.sidebarBody}>
              <Body close={onClose} />
            </div>
          )}
        </div>
      </div>
    </>,
    root,
  )
}
