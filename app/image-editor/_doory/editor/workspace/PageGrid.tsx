import { Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useEditor, useEditorState } from '../context'
import { fitBox } from '../engine/pageSizes'
import { t } from '../strings'
import { PageThumb } from './PageThumb'
import { usePageDnd } from './usePageDnd'
import styles from './PageGrid.module.css'

interface PageGridProps {
  onClose: () => void
}

/**
 * La «Vista de cuadrícula» de Canva (relevamiento §6): las páginas como mosaicos sobre el área del lienzo. Clic
 * elige la página, arrastrar reordena, doble clic (o Enter) vuelve al lienzo sobre ella, Esc vuelve sin cambiar.
 * Doory no tenía esta vista: se arma con las mismas miniaturas y el mismo arrastre de la tira.
 */
export function PageGrid({ onClose }: PageGridProps) {
  const editor = useEditor()
  const doc = useEditorState((s) => s.doc)
  const activePageId = useEditorState((s) => s.activePageId)
  const readOnly = useEditorState((s) => s.readOnly)
  const dnd = usePageDnd((id, to) => editor.pages.move(id, to))
  const order = doc.pages.map((p) => p.id)
  const ref = useRef<HTMLDivElement>(null)
  const last = doc.pages[doc.pages.length - 1]
  /** La baldosa «+» toma la forma de la última página, dentro de la misma caja que los mosaicos. */
  const addBox = fitBox(editor.pageSizeOf(last.id), 200, 150)

  // El foco entra a la página elegida (teclado: flechas con Alt reordenan, Enter abre). Esc se escucha en el propio
  // mosaico, antes que los atajos del editor (que viven en la raíz y con Esc limpian la selección).
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus({ preventScroll: false })
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div ref={ref} className={styles.grid} role="region" aria-label={t.statusBar.gridView} data-testid="ed-page-grid">
      <ol className={styles.list}>
        {doc.pages.map((page, index) => (
          <li key={page.id} className={styles.cell}>
            <PageThumb
              page={page}
              index={index}
              active={page.id === activePageId}
              variant="grid"
              draggable={!readOnly}
              dragOver={dnd.overFor(page.id)}
              onSelect={() => editor.pages.activate(page.id)}
              onOpen={() => {
                editor.pages.activate(page.id)
                onClose()
              }}
              onMove={(d) => editor.pages.moveBy(page.id, d)}
              {...dnd.handlers(page.id, index, order, true)}
            />
          </li>
        ))}
        {readOnly ? null : (
          <li className={styles.cell}>
            <span className={styles.addFrame}>
              <button
                type="button"
                className={styles.add}
                style={{ width: Math.max(24, addBox.width), height: Math.max(24, addBox.height) }}
                aria-label={t.workspace.addPage}
                title={t.workspace.addPage}
                onClick={() => editor.pages.add(doc.pages.length)}
              >
                <Plus size={24} aria-hidden="true" />
              </button>
            </span>
          </li>
        )}
      </ol>
    </div>
  )
}
