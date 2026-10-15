import { ChevronDown, ChevronUp, CopyPlus, SquarePlus, Trash2 } from 'lucide-react'
import { type CSSProperties, memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DocPage } from '@/app/image-editor/_doory/types/document'
import { useEditor, useEditorState } from '../context'
import { gradientCss } from '../engine/objects/fills'
import { backgroundToFill } from '../engine/objects/background'
import { DurationChip } from '../presenter/DurationChip'
import { t } from '../strings'
import { IconButton } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { PageSizeChip } from './PageSizeChip'
import { PresenceLayer } from './PresenceLayer'
import { usePageSnapshot } from './useSnapshot'
import styles from './PageSlot.module.css'

interface PageSlotProps {
  page: DocPage
  index: number
  total: number
  width: number
  height: number
  zoom: number
  headerHeight: number
  gap: number
  live: boolean
  /** The page is within a few screens of the viewport: only then is its picture prepared while it has no live canvas. */
  near: boolean
  active: boolean
  registerArtboard: (id: string, el: HTMLDivElement | null) => void
}

/** El encabezado nunca es más angosto de lo que piden el título y los íconos, por chica que sea la página. */
const HEADER_MIN_WIDTH = 372
/** El título de una página, como el resto de los nombres del editor. */
const TITLE_MAX = 60

/** The header spans the artboard; on a page narrower than the minimum it overhangs both sides equally, so the slot stays as wide as the page. */
const headerStyle = (width: number, height: number): CSSProperties => {
  const headerWidth = Math.max(width, HEADER_MIN_WIDTH)
  return { height, width: headerWidth, marginInline: (width - headerWidth) / 2 }
}

function backgroundCss(page: DocPage): string | undefined {
  const bg = page.background
  if (bg.type === 'image') return undefined
  const fill = backgroundToFill(bg)
  return fill.type === 'gradient' ? gradientCss(fill) : fill.color
}

/**
 * El título de la página, como en Canva: «Página 1 - Agregar título de página», donde lo segundo es un campo
 * escribible en el mismo renglón. Se guarda al salir del campo o con Enter; Esc lo deja como estaba. Un cambio que
 * llega de otro lado (deshacer, un colaborador) se adopta mientras no se esté escribiendo.
 */
function PageTitle({ page, readOnly }: { page: DocPage; readOnly: boolean }) {
  const editor = useEditor()
  const saved = page.name ?? ''
  const [text, setText] = useState(saved)
  const [synced, setSynced] = useState(saved)
  const [editing, setEditing] = useState(false)
  const cancelled = useRef(false)

  if (saved !== synced) {
    setSynced(saved)
    if (!editing) setText(saved)
  }

  if (readOnly) return saved.trim() ? <span className={styles.titleText}>{saved}</span> : null
  const shown = text || t.workspace.pageTitle
  return (
    <input
      className={styles.titleInput}
      // El campo mide lo que su texto (o el texto de ayuda): el encabezado queda como una sola frase.
      style={{ width: `calc(${Math.min(TITLE_MAX, shown.length) + 1}ch + 12px)` }}
      value={text}
      placeholder={t.workspace.pageTitle}
      aria-label={t.panels.pageName}
      maxLength={TITLE_MAX}
      spellCheck={false}
      onFocus={() => {
        cancelled.current = false
        setEditing(true)
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false)
        if (cancelled.current) {
          setText(saved)
          return
        }
        if (text.trim() !== saved.trim()) editor.pages.rename(page.id, text.trim())
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** Una página de la pila: el encabezado de Canva, la mesa de trabajo, y el lienzo vivo de Fabric o su imagen guardada. */
export const PageSlot = memo(function PageSlot({ page, index, total, width, height, zoom, headerHeight, gap, live, near, active, registerArtboard }: PageSlotProps) {
  const editor = useEditor()
  const readOnly = useEditorState((s) => s.readOnly)
  const loading = useEditorState((s) => s.loadingPages.includes(page.id))
  const hostRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<HTMLDivElement>(null)
  const pageSize = editor.pageSizeOf(page.id)
  const snapshot = usePageSnapshot(page, pageSize, near && (!live || loading))

  useLayoutEffect(() => {
    registerArtboard(page.id, artRef.current)
    return () => registerArtboard(page.id, null)
  }, [page.id, registerArtboard])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!live || !host) return
    editor.mountPage(page.id, host)
    editor.view.relayout()
    return () => editor.unmountPage(page.id)
  }, [live, editor, page.id])

  useEffect(() => {
    if (live) editor.view.relayout()
  }, [live, zoom, width, height, editor])

  const number = t.workspace.page(index + 1)
  const label = page.name?.trim() || number
  const several = total > 1
  const showDash = !readOnly || Boolean(page.name?.trim())

  return (
    <section className={styles.slot} data-page-id={page.id} data-active={active || undefined} data-multi={several || undefined} style={{ height: headerHeight + height, marginBottom: gap }} aria-label={label}>
      <header className={styles.header} style={headerStyle(width, headerHeight)} hidden={headerHeight === 0}>
        <div className={styles.lead}>
          <span className={styles.number}>{number}</span>
          {showDash ? (
            <span className={styles.dash} aria-hidden="true">
              -
            </span>
          ) : null}
          <PageTitle page={page} readOnly={readOnly} />
        </div>
        <div className={styles.actions}>
          <span className={styles.meta}>
            <PageSizeChip pageId={page.id} number={index + 1} />
            <DurationChip pageId={page.id} className={styles.time} />
          </span>
          {readOnly ? null : (
            <>
              {several ? (
                <>
                  <IconButton label={t.workspace.moveUp} size="sm" disabled={index === 0} onClick={() => editor.pages.moveBy(page.id, -1)}>
                    <ChevronUp size={18} />
                  </IconButton>
                  <IconButton label={t.workspace.moveDown} size="sm" disabled={index === total - 1} onClick={() => editor.pages.moveBy(page.id, 1)}>
                    <ChevronDown size={18} />
                  </IconButton>
                </>
              ) : null}
              <IconButton label={t.workspace.duplicatePage} size="sm" onClick={() => editor.pages.duplicate(page.id)}>
                <CopyPlus size={18} />
              </IconButton>
              {several ? (
                <IconButton label={t.workspace.deletePage} size="sm" onClick={() => editor.pages.remove(page.id)}>
                  <Trash2 size={18} />
                </IconButton>
              ) : null}
              <IconButton label={t.workspace.addPageHere} size="sm" onClick={() => editor.pages.add(index + 1)}>
                <SquarePlus size={18} />
              </IconButton>
            </>
          )}
        </div>
      </header>
      <div ref={artRef} className={styles.artboard} style={{ width, height, background: backgroundCss(page) }} data-artboard data-page-id={page.id}>
        {snapshot && (!live || loading) ? <img className={styles.snapshot} src={snapshot} alt={t.workspace.snapshotAlt(index + 1)} draggable={false} /> : null}
        {live ? <div ref={hostRef} className={styles.host} role="img" aria-label={t.workspace.canvasLabel(index + 1)} /> : null}
        {(loading || (!live && !snapshot)) && page.objects.length > 0 ? <Skeleton className={styles.skeleton} height="100%" width="100%" radius={0} /> : null}
        {page.objects.length === 0 && !loading ? <p className={styles.empty}>{t.workspace.emptyHint}</p> : null}
        <PresenceLayer pageId={page.id} zoom={zoom} />
      </div>
    </section>
  )
})
