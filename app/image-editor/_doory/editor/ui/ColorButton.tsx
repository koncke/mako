import { ChevronLeft } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { type FillSpec } from '../engine/objects/fills'
import { fillCssPreview } from '../engine/objects/fills'
import { t } from '../strings'
import { ColorPanel } from './ColorPanel'
import { ColorPicker } from './ColorPicker'
import { FillEditor } from './FillEditor'
import { Popover } from './Popover'
import { Tooltip } from './Tooltip'
import styles from './ColorButton.module.css'

interface ColorButtonProps {
  label: string
  value: FillSpec
  onChange: (fill: FillSpec) => void
  solidOnly?: boolean
  /** `swatch` is a round chip; `bar` shows an icon with a colour underline (text colour). */
  variant?: 'swatch' | 'bar' | 'chip'
  icon?: ReactNode
  extraSwatches?: { label: string; colors: readonly string[] }
  /** Show a "none" state (transparent). */
  none?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Colour control: shows the current fill and opens the Canva colour panel (document colours, defaults, gradients);
 * its rainbow tile «Agregar un color nuevo» switches to the picker / gradient editor.
 */
export function ColorButton({ label, value, onChange, solidOnly, variant = 'swatch', icon, extraSwatches, none, disabled, className }: ColorButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'swatches' | 'custom'>('swatches')
  const bg = fillCssPreview(value)
  const close = (): void => {
    setOpen(false)
    setView('swatches')
  }
  return (
    <>
      <Tooltip label={label} disabled={open}>
        <button
          ref={ref}
          type="button"
          className={`${styles.btn} ${styles[variant]} ${none ? styles.none : ''} ${className ?? ''}`}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => (open ? close() : setOpen(true))}
        >
          {variant === 'bar' ? (
            <>
              <span className={styles.glyph}>{icon}</span>
              <span className={styles.underline} style={{ background: bg }} />
            </>
          ) : (
            <span className={styles.chip} style={{ background: none ? undefined : bg }} />
          )}
        </button>
      </Tooltip>
      <Popover open={open} onClose={close} anchorRef={ref} label={label} placement="bottom-start">
        {view === 'swatches' ? (
          <ColorPanel value={value} onChange={onChange} onCustom={() => setView('custom')} allowGradient={!solidOnly} extraSwatches={extraSwatches} />
        ) : (
          <div className={styles.custom}>
            <button type="button" className={styles.back} onClick={() => setView('swatches')}>
              <ChevronLeft size={18} aria-hidden="true" />
              {t.swatches.back}
            </button>
            {solidOnly && value.type === 'solid' ? (
              <ColorPicker value={value.color} onChange={(color) => onChange({ type: 'solid', color })} showSwatches={false} />
            ) : (
              <FillEditor value={value} onChange={onChange} solidOnly={solidOnly} showSwatches={false} />
            )}
          </div>
        )}
      </Popover>
    </>
  )
}
