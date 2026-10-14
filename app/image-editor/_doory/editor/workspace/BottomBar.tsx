import { LayoutGrid, Maximize2, Minimize2, NotebookPen, Timer } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, useEditorState } from '../context'
import { toggleNotes, useNotesOpen } from '../panels/notesVisibility'
import { t } from '../strings'
import { Tooltip } from '../ui/Tooltip'
import { LazyTimelineHost } from './TimelineLoader'
import { toggleTimeline, useTimelineView } from './timelineVisibility'
import { ZoomControls } from './ZoomControls'
import styles from './BottomBar.module.css'

interface BottomBarProps {
  stripOpen: boolean
  onToggleStrip: () => void
  grid: boolean
  onToggleGrid: () => void
}

/** La raíz del editor a pantalla completa (la barra, sus menús y sus diálogos viven adentro); el estado sigue al navegador, que también sale con Esc. */
function useFullscreen(ref: RefObject<HTMLElement | null>): { supported: boolean; on: boolean; toggle: () => void } {
  const [supported] = useState(() => typeof document !== 'undefined' && document.fullscreenEnabled === true)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const sync = (): void => {
      const root = ref.current?.closest('[data-editor-root]') ?? null
      setOn(root !== null && document.fullscreenElement === root)
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [ref])
  const toggle = useCallback(() => {
    const root = ref.current?.closest<HTMLElement>('[data-editor-root]')
    if (!root) return
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void root.requestFullscreen().catch(() => undefined)
  }, [ref])
  return { supported, on, toggle }
}

/**
 * La barra inferior de Canva (relevamiento §7), a todo el ancho del área principal y en el gris del cromo: a la
 * izquierda «Notas» y «Duración» (la línea de tiempo); a la derecha el zoom, «Páginas 1 / 3» (la tira de
 * miniaturas), la vista de cuadrícula y la pantalla completa.
 *
 * Se dibuja como HERMANA del área del lienzo (Workspace devuelve las dos) y `order` la manda al pie de la columna
 * del armazón, debajo de las notas, la línea de tiempo y la tira, como en Canva.
 */
export function BottomBar({ stripOpen, onToggleStrip, grid, onToggleGrid }: BottomBarProps) {
  const editor = useEditor()
  const total = useEditorState((s) => s.doc.pages.length)
  const index = useEditorState((s) => Math.max(0, s.doc.pages.findIndex((p) => p.id === s.activePageId)))
  const notesOpen = useNotesOpen()
  const timelineOpen = useTimelineView().open
  const ref = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(ref)
  const timelineLabel = timelineOpen ? t.animation.timeline.hide : t.animation.timeline.show
  const stripLabel = stripOpen ? t.statusBar.hideStrip : t.statusBar.showStrip
  const gridLabel = grid ? t.statusBar.closeGrid : t.statusBar.gridView
  const fullLabel = fullscreen.on ? t.statusBar.exitFullscreen : t.statusBar.fullscreen

  return (
    <div ref={ref} className={styles.bar} role="group" aria-label={t.statusBar.label} data-testid="ed-bottombar">
      <div className={styles.start}>
        <Tooltip label={t.notes.title} shortcut="Shift+N" side="top">
          <button type="button" className={styles.textBtn} aria-pressed={notesOpen} aria-label={t.notes.title} data-testid="ed-notes-toggle" onClick={() => toggleNotes(editor)}>
            <NotebookPen size={18} aria-hidden="true" />
            <span className={styles.text}>{t.notes.title}</span>
          </button>
        </Tooltip>
        <Tooltip label={timelineLabel} shortcut="Shift+T" side="top">
          <button
            type="button"
            className={styles.textBtn}
            aria-pressed={timelineOpen}
            aria-label={timelineLabel}
            data-testid="ed-timeline-toggle"
            onPointerEnter={() => void LazyTimelineHost.preload()}
            onFocus={() => void LazyTimelineHost.preload()}
            onClick={() => toggleTimeline(editor)}
          >
            <Timer size={18} aria-hidden="true" />
            <span className={styles.text}>{t.statusBar.duration}</span>
          </button>
        </Tooltip>
      </div>
      <div className={styles.end}>
        <ZoomControls />
        <Tooltip label={stripLabel} side="top">
          <button type="button" className={styles.textBtn} aria-pressed={stripOpen} aria-label={`${stripLabel}: ${t.workspace.pageOf(index + 1, total)}`} data-testid="ed-pages-toggle" onClick={onToggleStrip}>
            <span className={styles.text}>{t.statusBar.pages}</span>
            <span className={styles.count} data-testid="ed-pages-text">
              {index + 1} / {total}
            </span>
          </button>
        </Tooltip>
        <Tooltip label={gridLabel} side="top">
          <button type="button" className={styles.iconBtn} aria-pressed={grid} aria-label={gridLabel} data-testid="ed-grid-view" onClick={onToggleGrid}>
            <LayoutGrid size={18} aria-hidden="true" />
          </button>
        </Tooltip>
        {fullscreen.supported ? (
          <Tooltip label={fullLabel} side="top">
            <button type="button" className={styles.iconBtn} aria-pressed={fullscreen.on} aria-label={fullLabel} data-testid="ed-fullscreen" onClick={fullscreen.toggle}>
              {fullscreen.on ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
            </button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}
