import { Sparkles } from 'lucide-react'
import { useEditorState } from '../context'
import { PANEL_IA } from '../panels/registry'
import { useVisiblePanels } from '../panels/useVisiblePanels'
import { t } from '../strings'
import { Tooltip } from '../ui/Tooltip'
import { useChrome, useOpenTool } from './ChromeContext'
import styles from './RielCanva.module.css'

/**
 * El riel izquierdo de Canva (relevamiento-canva-armazon.md §1.1 y §3.1): una columna de 72 px sobre el gris del
 * cromo, cada pestaña con el ícono arriba y el rótulo de 11 px abajo, la abierta como baldosa blanca con sombra.
 * Un clic abre su panel a la izquierda (la tarjeta flotante de `SidebarHost`) y otro clic lo cierra. Las pestañas son los paneles registrados con `rail: true`, en su orden
 * (builtins/panels.tsx y mako/registro.ts). Abajo, el botón redondo de la IA de MaKo: abre y cierra el chat «MaKo IA»
 * (`PANEL_IA`, mako/chat/PanelMakoIA.tsx), que no es una pestaña.
 *
 * Canva además abre una «vista rápida» al pasar el mouse; acá el mouse sólo adelanta la descarga del panel.
 */
export function RielCanva() {
  const visible = useVisiblePanels()
  const readOnly = useEditorState((s) => s.readOnly)
  const compact = useEditorState((s) => s.ui.compact)
  const { openId, toggle } = useOpenTool()
  const chrome = useChrome()
  const tabs = visible.filter((p) => p.rail && (!readOnly || p.readOnly))
  const ia = visible.find((p) => p.id === PANEL_IA)
  // Sólo lectura (un enlace para ver): Canva no muestra el riel. Pantallas chicas (<1024 px): las mismas pestañas
  // van en la tira de abajo (`CompactTools` de TopBar.tsx) y cada panel sale como hoja inferior.
  if (tabs.length === 0 || compact) return null

  return (
    <nav className={styles.rail} aria-label={t.rail.label} data-testid="ed-rail">
      <div className={styles.tabs}>
        {tabs.map((p) => {
          const open = openId === p.id
          return (
            <button
              key={p.id}
              type="button"
              className={styles.tab}
              aria-expanded={open}
              aria-keyshortcuts={p.shortcut}
              data-testid={`rail-${p.id}`}
              data-tool={p.id}
              onPointerEnter={p.preload}
              onFocus={p.preload}
              onClick={(e) => {
                // Abierto con el teclado: el panel toma el foco al aparecer (con el mouse, el foco se queda acá).
                chrome.setKeyboardOpen(e.detail === 0)
                toggle(p.id)
              }}
            >
              <span className={styles.icon} aria-hidden="true">
                {p.icon}
              </span>
              <span className={styles.label}>{p.label}</span>
            </button>
          )
        })}
      </div>
      {readOnly || !ia ? null : (
        <div className={styles.foot}>
          <Tooltip label={ia.label} side="right">
            <button
              type="button"
              className={styles.ai}
              aria-label={ia.label}
              aria-expanded={openId === ia.id}
              data-testid="rail-ai"
              data-tool={ia.id}
              onClick={(e) => {
                chrome.setKeyboardOpen(e.detail === 0)
                toggle(ia.id)
              }}
            >
              <Sparkles size={20} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      )}
    </nav>
  )
}
