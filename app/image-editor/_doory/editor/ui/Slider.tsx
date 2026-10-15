import { type CSSProperties, useId, useState } from 'react'
import styles from './Slider.module.css'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** Text shown at the right of the label. */
  display?: string
  /**
   * Canva: una caja numérica a la derecha del rótulo para escribir el valor (Brillo, Tamaño ×, Calidad…).
   * Reemplaza a `display`.
   */
  withInput?: boolean
  /** Decimales que muestra y acepta la caja numérica. */
  decimals?: number
  className?: string
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))
const fmt = (n: number, decimals: number): string => String(Number(n.toFixed(decimals)))

export function Slider({ label, value, min, max, step = 1, onChange, display, withInput, decimals = 0, className }: SliderProps) {
  const id = useId()
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  /** Lo que se está escribiendo en la caja; `null` mientras la caja refleja `value`. */
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string): void => {
    const n = Number.parseFloat(raw.replace(',', '.'))
    if (Number.isFinite(n)) onChange(clamp(Number(n.toFixed(decimals)), min, max))
  }

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {withInput ? (
          <input
            className={styles.box}
            inputMode="decimal"
            aria-label={label}
            value={draft ?? fmt(value, decimals)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== null) commit(draft)
              setDraft(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              else if (e.key === 'Escape') {
                setDraft(null)
                e.currentTarget.blur()
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                setDraft(null)
                const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
                onChange(clamp(Number((value + delta).toFixed(decimals)), min, max))
              }
            }}
          />
        ) : display !== undefined ? (
          <span className={styles.value}>{display}</span>
        ) : null}
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
