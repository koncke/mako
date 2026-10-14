import { Scaling } from 'lucide-react'
import { ColorTool } from '../../chrome/ColorTool'
import { runCommand } from '../../commands'
import { useDocument, useEditor, useEditorState } from '../../context'
import { backgroundFill, fillToBackground } from '../../panels/backgroundFill'
import { DurationChip } from '../../presenter/DurationChip'
import { t } from '../../strings'
import { AnimateTool } from '../controls'
import { ColorSlot, ToolButton } from '../parts'
import bar from '../parts.module.css'

/**
 * Sin nada elegido, la barra es la de la página de Canva: el color de fondo, «Redimensionar», «Animar» y «Duración».
 * Agregar, duplicar y eliminar páginas están en el encabezado de cada página y en la tira de páginas.
 */
export function PageSection() {
  const editor = useEditor()
  const doc = useDocument()
  const activeId = useEditorState((s) => s.activePageId)
  const index = Math.max(0, doc.pages.findIndex((p) => p.id === activeId))
  const page = doc.pages[index]
  return (
    <>
      <ColorSlot>
        <ColorTool label={t.toolbar.pageColor} value={backgroundFill(page.background)} allowGradient testId="ed-page-bg" onChange={(f, key) => editor.pages.setBackground(page.id, fillToBackground(f), key ?? 'bg-fill')} />
      </ColorSlot>
      <ToolButton label={t.toolbar.pageResize} text={t.toolbar.pageResize} testId="ed-page-resize" onClick={() => runCommand(editor, 'file.resize')}>
        <Scaling size={18} aria-hidden="true" />
      </ToolButton>
      <AnimateTool />
      <span className={bar.durationSlot}>
        <DurationChip pageId={page.id} />
      </span>
    </>
  )
}
