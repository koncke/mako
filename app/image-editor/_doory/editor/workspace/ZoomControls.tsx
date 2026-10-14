import { Check } from 'lucide-react'
import { type CSSProperties, useCallback, useRef, useState } from 'react'
import { useEditor, useEditorState } from '../context'
import { MAX_ZOOM, MIN_ZOOM } from '../engine/zoom'
import { t } from '../strings'
import { Popover } from '../ui/Popover'
import { Tooltip } from '../ui/Tooltip'
import styles from './BottomBar.module.css'

/** La lista del zoom de Canva, de mayor a menor. */
const PRESETS = [3, 2, 1.25, 1, 0.75, 0.5, 0.25, 0.1]

// Posición del deslizador 0..100 <-> zoom en escala logarítmica, para que cada tramo del zoom tenga el mismo recorrido.
const toSlider = (z: number): number => (Math.log(z / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM)) * 100
const fromSlider = (v: number): number => MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, v / 100)
/** «43 %», con el espacio del español (duro: el número y el signo no se separan). */
const percent = (z: number): string => `${Math.round(z * 100)}\u00a0%`

/**
 * El zoom de la barra inferior de Canva: el deslizador y la caja con el porcentaje, que abre la lista (los valores,
 * «Ajustar» y «Ajustar al ancho»). Acercar y alejar siguen en el teclado (Ctrl + / Ctrl −) y en Ctrl + rueda.
 */
export function ZoomControls() {
  const editor = useEditor()
  const zoom = useEditorState((s) => s.zoom)
  const mode = useEditorState((s) => s.zoomMode)
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const value = toSlider(zoom)

  const pick = (run: () => void) => () => {
    run()
    close()
  }
  const items: { id: string; label: string; checked: boolean; run: () => void }[] = [
    ...PRESETS.map((p) => ({ id: `z${p}`, label: percent(p), checked: mode === 'custom' && Math.abs(zoom - p) < 0.005, run: () => editor.view.setZoom(p) })),
    { id: 'fit-page', label: t.workspace.fitPage, checked: mode === 'fit-page', run: () => editor.view.fit('fit-page') },
    { id: 'fit-width', label: t.workspace.fitWidth, checked: mode === 'fit-width', run: () => editor.view.fit('fit-width') },
  ]

  return (
    <div className={styles.zoom} role="group" aria-label={t.workspace.zoomControls} data-testid="ed-zoombar">
      <input
        type="range"
        className={styles.slider}
        style={{ '--fill': `${value}%` } as CSSProperties}
        min={0}
        max={100}
        step={0.5}
        value={value}
        aria-label={t.workspace.zoomLevel}
        aria-valuetext={percent(zoom)}
        data-testid="ed-zoom-slider"
        onChange={(e) => editor.view.setZoom(fromSlider(Number(e.target.value)))}
      />
      <Tooltip label={t.workspace.zoomLevel} side="top" disabled={open}>
        <button
          ref={anchor}
          type="button"
          className={styles.percent}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${t.workspace.zoomLevel}: ${percent(zoom)}`}
          data-testid="ed-zoom-value"
          onClick={() => setOpen((o) => !o)}
        >
          {percent(zoom)}
        </button>
      </Tooltip>
      <Popover open={open} onClose={close} anchorRef={anchor} label={t.workspace.zoomLevel} placement="top" variant="plain" gap={8} className={styles.zoomPop} focusOnOpen>
        <div className={styles.zoomList} data-testid="ed-zoom-menu">
          {items.map((item, i) => (
            <div key={item.id} className={styles.zoomRow}>
              {i === PRESETS.length ? <hr className={styles.zoomSep} /> : null}
              <button type="button" className={styles.zoomItem} aria-pressed={item.checked} data-testid={`ed-zoom-${item.id}`} onClick={pick(item.run)}>
                <span>{item.label}</span>
                {item.checked ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            </div>
          ))}
        </div>
      </Popover>
    </div>
  )
}
