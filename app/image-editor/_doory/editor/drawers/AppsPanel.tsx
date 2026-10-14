import { Layers, MessageSquare, Music, QrCode, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useOpenTool } from '../chrome/ChromeContext'
import { useEditor } from '../context'
import type { PanelProps } from '../panels/registry'
import { useVisiblePanels } from '../panels/useVisiblePanels'
import { t } from '../strings'
import { useInsertDone } from './useInsertDone'
import styles from './Drawers.module.css'

interface AppTile {
  id: string
  label: string
  icon: ReactNode
  tone: string
  run: () => void
}

/**
 * El panel «Apps» de Canva (relevamiento §3.1–3.2): el catálogo de lo que no tiene pestaña propia en el riel. Acá
 * abre las herramientas de Doory que viven fuera del riel —Animar, Audio, Capas, Comentarios— en el mismo lugar del
 * panel, y agrega un código QR. Cada mosaico aparece sólo si su herramienta está disponible en este diseño.
 */
export function AppsPanel({ close }: PanelProps) {
  const editor = useEditor()
  const done = useInsertDone(close)
  const visible = useVisiblePanels()
  const { toggle } = useOpenTool()
  const has = (id: string): boolean => visible.some((p) => p.id === id)

  const panel = (id: string, label: string, icon: ReactNode, tone: string): AppTile[] => (has(id) ? [{ id, label, icon, tone, run: () => toggle(id) }] : [])
  const tiles: AppTile[] = [
    ...panel('animate', t.rail.animate, <Sparkles />, styles.lilac),
    ...panel('audio', t.rail.audio, <Music />, styles.pink),
    ...panel('layers', t.rail.layers, <Layers />, styles.sky),
    {
      id: 'qr',
      label: t.elementsHome.qr,
      icon: <QrCode />,
      tone: styles.mint,
      run: () => {
        void editor.insert.qr()
        done()
      },
    },
    ...panel('comments', t.rail.comments, <MessageSquare />, styles.butter),
  ]

  return (
    <div className={styles.apps} role="group" aria-label={t.appsPanel.title}>
      {tiles.map((a) => (
        <button key={a.id} type="button" className={styles.app} data-testid={`apps-${a.id}`} onClick={a.run}>
          <span className={`${styles.appIcon} ${a.tone}`} aria-hidden="true">
            {a.icon}
          </span>
          <span className={styles.appLabel}>{a.label}</span>
        </button>
      ))}
    </div>
  )
}
