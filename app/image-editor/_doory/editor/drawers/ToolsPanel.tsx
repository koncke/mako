import { Frame, Shapes, Spline, Type } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useEditor } from '../context'
import { BackgroundPanel } from '../panels/BackgroundPanel'
import type { PanelProps } from '../panels/registry'
import { t } from '../strings'
import { TileGrid, useShapeCards } from './ShapesDrawer'
import { useInsertDone } from './useInsertDone'
import styles from './Drawers.module.css'

type Open = 'shapes' | 'lines' | null

/**
 * El panel «Herramientas» de Canva (reemplazó a «Dibujar», relevamiento §3.1–3.2): mosaicos que agregan al diseño
 * —Formas y Líneas abren su grilla debajo, Texto activa la herramienta de escribir donde hagas clic (la «T»), Marco
 * agrega un marco de foto— y, abajo, el «Fondo» de la página (color, degradado, patrón o imagen).
 *
 * Canva también tiene «Notas adhesivas», «Dibujo» y «Tablas»: Doory no las trae (tanda 5 del plano).
 */
export function ToolsPanel({ close }: PanelProps) {
  const editor = useEditor()
  const done = useInsertDone(close)
  const { shapes, lines } = useShapeCards()
  const [open, setOpen] = useState<Open>(null)

  const toggle = (which: Exclude<Open, null>) => () => setOpen((cur) => (cur === which ? null : which))
  const textTool = (): void => {
    editor.setTool('text')
    editor.toast(t.toolsPanel.textHint, 'info')
    done()
  }
  const frame = (): void => {
    void editor.insert.placeholder()
    done()
  }

  const tile = (id: string, label: string, icon: ReactNode, tone: string, onClick: () => void, pressed?: boolean): ReactNode => (
    <button type="button" className={styles.app} aria-pressed={pressed} data-testid={`tools-${id}`} onClick={onClick}>
      <span className={`${styles.appIcon} ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.appLabel}>{label}</span>
    </button>
  )

  return (
    <>
      <div className={styles.apps}>
        {tile('shapes', t.toolsPanel.shapes, <Shapes />, styles.mint, toggle('shapes'), open === 'shapes')}
        {tile('lines', t.toolsPanel.lines, <Spline />, styles.sky, toggle('lines'), open === 'lines')}
        {tile('text', t.toolsPanel.text, <Type />, styles.lilac, textTool)}
        {tile('frame', t.toolsPanel.frame, <Frame />, styles.butter, frame)}
      </div>
      {open === 'shapes' ? <TileGrid cards={shapes} done={done} /> : null}
      {open === 'lines' ? <TileGrid cards={lines} done={done} /> : null}

      {/* El fondo trae su propio título («Fondo de página»): va directo, sin otro encabezado encima. */}
      <BackgroundPanel />
    </>
  )
}
