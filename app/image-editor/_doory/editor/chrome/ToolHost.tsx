import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useEditorState, usePortalRoot } from '../context'
import { type PanelDefinition } from '../panels/registry'
import { useVisiblePanels } from '../panels/useVisiblePanels'
import { t } from '../strings'
import { Popover } from '../ui/Popover'
import { I } from './icons'
import { useChrome, useOpenTool } from './ChromeContext'
import ed from './ed.module.css'
import styles from './ToolHost.module.css'

function useOpenPanel(): PanelDefinition | undefined {
  const { openId } = useOpenTool()
  const visible = useVisiblePanels()
  return useMemo(() => visible.find((p) => p.id === openId), [visible, openId])
}

/** The drawer of the open tool: a popover under its top-bar button (a bottom sheet on small screens). */
export function DrawerHost() {
  const panel = useOpenPanel()
  const compact = useEditorState((s) => s.ui.compact)
  const { close } = useOpenTool()
  if (!panel) return null
  if (compact) return <Sheet panel={panel} onClose={close} />
  if (panel.placement !== 'drawer') return null
  return <DrawerPopover panel={panel} onClose={close} />
}

function DrawerPopover({ panel, onClose }: { panel: PanelDefinition; onClose: () => void }) {
  const chrome = useChrome()
  // The top-bar button of the tool, or the "More" button when the tool is collapsed into it.
  const anchorRef = useMemo(() => ({ current: chrome.getAnchor(panel.id) ?? chrome.getAnchor('more') }), [chrome, panel.id])
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

/** The docked sidebar of the open tool (desktop only). */
export function SidebarHost() {
  const panel = useOpenPanel()
  const compact = useEditorState((s) => s.ui.compact)
  const { close } = useOpenTool()
  if (!panel || compact || panel.placement === 'drawer') return null
  const Body = panel.component
  return (
    <aside className={styles.sidebar} aria-label={panel.title ?? panel.label} data-testid={`sidebar-${panel.id}`} data-panel={panel.id}>
      <header className={styles.sidebarHead}>
        <h2 className={styles.sidebarTitle}>{panel.title ?? panel.label}</h2>
        <button type="button" className={styles.close} onClick={close} aria-label={t.chrome.closeTool(panel.title ?? panel.label)} data-testid="sidebar-close">
          {I.xClear}
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
            <X size={16} />
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
