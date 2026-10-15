import { memo } from 'react'
import type { DocPage } from '@/app/image-editor/_doory/types/document'
import { useEditor } from '../context'
import { fitBox } from '../engine/pageSizes'
import { useInView } from '../hooks/useInView'
import { t } from '../strings'
import { Skeleton } from '../ui/Skeleton'
import { usePageSnapshot } from './useSnapshot'
import styles from './PageThumb.module.css'

interface PageThumbProps {
  page: DocPage
  index: number
  active: boolean
  /** La tira de miniaturas de abajo (chica) o la vista de cuadrícula (grande). */
  variant: 'strip' | 'grid'
  dragOver: 'before' | 'after' | null
  draggable: boolean
  onSelect: () => void
  /** Doble clic o Enter: abre la página (en la cuadrícula, vuelve al lienzo sobre ella). */
  onOpen?: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onMove: (delta: number) => void
}

/**
 * Cada página se dibuja dentro de la misma caja, con sus propias proporciones. Canva: en la tira las miniaturas
 * tienen el mismo ALTO (una 16:9 sale ancha, una historia sale angosta); en la cuadrícula, mosaicos parejos.
 */
const BOXES = {
  strip: { width: 112, height: 64 },
  grid: { width: 200, height: 150 },
} as const
const MIN_SIDE = 6

export const PageThumb = memo(function PageThumb({ page, index, active, variant, dragOver, draggable, onSelect, onOpen, onDragStart, onDragOver, onDrop, onDragEnd, onMove }: PageThumbProps) {
  const editor = useEditor()
  const size = editor.pageSizeOf(page.id)
  // Sólo se dibujan las miniaturas que se ven: un diseño largo tiene una tira larga, y cada imagen cuesta un render de página.
  const [seenRef, seen] = useInView<HTMLDivElement>()
  const url = usePageSnapshot(page, size, seen)
  const limit = BOXES[variant]
  const fit = fitBox(size, limit.width, limit.height)
  const box = { width: Math.max(MIN_SIDE, fit.width), height: Math.max(MIN_SIDE, fit.height) }
  const name = page.name?.trim()
  const label = name || t.workspace.page(index + 1)
  return (
    <div
      ref={seenRef}
      className={`${styles.item} ${styles[variant]} ${active ? styles.active : ''} ${dragOver ? styles[dragOver] : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className={styles.frame} style={{ height: limit.height }}>
        <button
          type="button"
          className={styles.thumb}
          style={box}
          aria-label={active ? `${label}, ${t.workspace.currentPage}` : label}
          aria-current={active || undefined}
          onClick={onSelect}
          onDoubleClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onOpen) {
              e.preventDefault()
              onOpen()
              return
            }
            if (!draggable || !e.altKey) return
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
              e.preventDefault()
              onMove(-1)
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
              e.preventDefault()
              onMove(1)
            }
          }}
        >
          {url ? <img src={url} alt="" draggable={false} /> : <Skeleton width="100%" height="100%" radius={0} />}
        </button>
      </span>
      <span className={styles.caption}>
        {variant === 'grid' && name ? `${index + 1} - ${name}` : index + 1}
      </span>
    </div>
  )
})
