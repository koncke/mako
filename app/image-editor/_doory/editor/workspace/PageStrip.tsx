import { Plus } from 'lucide-react'
import { useEditor, useEditorState } from '../context'
import { t } from '../strings'
import { PageThumb } from './PageThumb'
import { usePageDnd } from './usePageDnd'
import styles from './PageStrip.module.css'

/**
 * La tira de miniaturas de Canva (se abre con «Páginas» en la barra inferior): una miniatura por página, la elegida
 * con el anillo violeta, arrastrar para reordenar y al final la baldosa gris con «+».
 */
export function PageStrip() {
  const editor = useEditor()
  const doc = useEditorState((s) => s.doc)
  const activePageId = useEditorState((s) => s.activePageId)
  const readOnly = useEditorState((s) => s.readOnly)
  const dnd = usePageDnd((id, to) => editor.pages.move(id, to))
  const order = doc.pages.map((p) => p.id)
  return (
    <nav className={styles.strip} aria-label={t.workspace.pageStrip} data-testid="ed-page-strip">
      <ol className={styles.list}>
        {doc.pages.map((page, index) => (
          <li key={page.id}>
            <PageThumb
              page={page}
              index={index}
              active={page.id === activePageId}
              variant="strip"
              draggable={!readOnly}
              dragOver={dnd.overFor(page.id)}
              onSelect={() => editor.pages.activate(page.id)}
              onMove={(d) => editor.pages.moveBy(page.id, d)}
              {...dnd.handlers(page.id, index, order, true)}
            />
          </li>
        ))}
        {readOnly ? null : (
          <li>
            <button type="button" className={styles.add} aria-label={t.workspace.addPage} title={t.workspace.addPage} onClick={() => editor.pages.add(doc.pages.length)}>
              <Plus size={20} aria-hidden="true" />
            </button>
          </li>
        )}
      </ol>
    </nav>
  )
}
