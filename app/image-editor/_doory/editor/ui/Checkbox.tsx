import { type ReactNode, useEffect, useRef } from 'react'
import styles from './Checkbox.module.css'

interface CheckboxProps {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  /** Estado intermedio («algunas»): la casilla muestra una raya. */
  indeterminate?: boolean
  hint?: string
  disabled?: boolean
  className?: string
}

/** Casilla de Canva: cuadrado de 16 px con radio 4, violeta #8B3DFF y tilde blanca al marcarla. */
export function Checkbox({ label, checked, onChange, indeterminate = false, hint, disabled, className }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label className={`${styles.row} ${disabled ? styles.disabled : ''} ${className ?? ''}`}>
      <input ref={ref} type="checkbox" className={styles.input} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.box} aria-hidden="true">
        {indeterminate ? (
          <svg viewBox="0 0 16 16" width="12" height="12">
            <path d="M3.5 8h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="12" height="12">
            <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
    </label>
  )
}
