import { ChevronLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { type FillSpec, fillCssPreview } from '../engine/objects/fills'
import { t } from '../strings'
import { ColorPanel } from '../ui/ColorPanel'
import { ColorPicker } from '../ui/ColorPicker'
import { FillEditor } from '../ui/FillEditor'
import { Popover } from '../ui/Popover'
import { Tooltip } from '../ui/Tooltip'
import ed from './ed.module.css'
import styles from './ColorTool.module.css'

interface ColorToolProps {
  label: string
  value: FillSpec
  onChange: (fill: FillSpec, key?: string) => void
  /** Offers a "No fill" tile (fills of shapes, borders). */
  allowNone?: boolean
  /** Offers gradients (fills of shapes and text); borders are solid only. */
  allowGradient?: boolean
  /** Draw the swatch as a ring in the colour (a border swatch). */
  ring?: boolean
  /** `swatch`: el mosaico redondo. `text`: la «A» de Canva con la barra del color debajo (color del texto). */
  variant?: 'swatch' | 'text'
  testId: string
}

const isNone = (c: string): boolean => c === 'transparent' || c === ''

/**
 * El color de la barra del objeto, como en Canva: el mosaico (o la «A» del texto) abre el panel «Color» de la casa
 * (ui/ColorPanel: Colores del documento con la baldosa arcoíris, la marca y los predeterminados); la baldosa
 * arcoíris pasa al selector propio (espectro, hexadecimal, cuentagotas; degradados si se permiten).
 */
export function ColorTool({ label, value, onChange, allowNone, allowGradient, ring, variant = 'swatch', testId }: ColorToolProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  const [view, setView] = useState<'swatches' | 'custom'>('swatches')
  const none = value.type === 'solid' && isNone(value.color)
  const css = value.type === 'solid' ? (none ? undefined : value.color) : fillCssPreview(value)
  const close = (): void => {
    setOpen(false)
    setView('swatches')
  }
  const toggle = (e: React.MouseEvent): void => {
    setKeyboard(e.detail === 0)
    if (open) close()
    else setOpen(true)
  }
  const solid = (color: string, key?: string): void => onChange({ type: 'solid', color }, key)

  return (
    <>
      <Tooltip label={label} disabled={open}>
        {variant === 'text' ? (
          <button ref={ref} type="button" className={styles.textBtn} aria-label={label} aria-haspopup="dialog" aria-expanded={open} data-testid={testId} onClick={toggle}>
            <span className={styles.glyph} aria-hidden="true">
              A
            </span>
            <span className={styles.bar} style={{ background: css ?? 'transparent' }} aria-hidden="true" />
          </button>
        ) : (
          <button
            ref={ref}
            type="button"
            className={`${ed.swatch} ${none ? ed.swatchNone : ''}`}
            style={ring ? { background: 'transparent', border: `3px solid ${css ?? 'var(--ed-border)'}` } : css ? { background: css } : undefined}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            data-testid={testId}
            onClick={toggle}
          />
        )}
      </Tooltip>
      <Popover open={open} onClose={close} anchorRef={ref} label={label} placement="bottom" variant="plain" cover focusOnOpen={keyboard}>
        <div className={styles.pop} data-testid={`${testId}-popover`}>
          {view === 'swatches' ? (
            <ColorPanel value={value} onChange={(f) => onChange(f)} onCustom={() => setView('custom')} allowGradient={allowGradient} allowNone={allowNone} />
          ) : (
            <div className={styles.custom}>
              <button type="button" className={styles.back} onClick={() => setView('swatches')}>
                <ChevronLeft size={18} aria-hidden="true" />
                {t.swatches.back}
              </button>
              {allowGradient ? (
                <FillEditor value={value} onChange={(f) => onChange(f, 'fill-custom')} showSwatches={false} />
              ) : (
                <ColorPicker value={value.type === 'solid' && !none ? value.color : '#000000'} onChange={(c) => solid(c, 'fill-custom')} showSwatches={false} />
              )}
            </div>
          )}
        </div>
      </Popover>
    </>
  )
}
