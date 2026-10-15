import { type ReactNode, useCallback, useRef, useState } from 'react'
import { Popover, type Placement } from '../ui/Popover'
import { Tooltip } from '../ui/Tooltip'
import styles from './parts.module.css'

interface ToolButtonProps {
  label: string
  shortcut?: string
  pressed?: boolean
  disabled?: boolean
  danger?: boolean
  featured?: boolean
  onClick: () => void
  /** El ícono (o el glifo) del botón. */
  children?: ReactNode
  /** Rótulo visible al lado del ícono, como «Efectos» o «Recortar» en Canva. Sin él, el botón es de ícono (32 px). */
  text?: string
  testId?: string
}

/** Botón de la barra: de ícono (32 × 32, hover gris) o con rótulo. */
export function ToolButton({ label, shortcut, pressed, disabled, danger, featured, onClick, children, text, testId }: ToolButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} disabled={disabled}>
      <button
        type="button"
        className={`${styles.btn} ${text ? styles.textBtn : ''} ${pressed ? styles.on : ''} ${danger ? styles.danger : ''} ${featured ? styles.featured : ''}`}
        aria-label={text && text === label ? undefined : label}
        aria-pressed={pressed}
        disabled={disabled}
        data-testid={testId}
        onClick={onClick}
      >
        {children}
        {text ? <span>{text}</span> : null}
      </button>
    </Tooltip>
  )
}

interface PopoverToolProps {
  label: string
  /** Ícono o glifo del botón. */
  trigger?: ReactNode
  /** Rótulo visible del botón («Efectos», «Editar foto», «Voltear»). */
  text?: string
  children: ReactNode | ((close: () => void) => ReactNode)
  placement?: Placement
  width?: number | string
  pressed?: boolean
  disabled?: boolean
  shortcut?: string
  testId?: string
  /** El cuerpo del popover sin el relleno de 16 px (listas, selectores). */
  flush?: boolean
  /** El cuerpo en fila (botones uno al lado del otro). */
  inline?: boolean
}

/** Botón de la barra que abre un popover debajo. */
export function PopoverTool({ label, trigger, text, children, placement = 'bottom', width, pressed, disabled, shortcut, testId, flush, inline }: PopoverToolProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  /** Abierto con Enter o Espacio: el foco entra al popover. Un clic deja el foco donde estaba. */
  const [keyboard, setKeyboard] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <Tooltip label={label} shortcut={shortcut} disabled={open || disabled}>
        <button
          ref={ref}
          type="button"
          className={`${styles.btn} ${text ? styles.textBtn : ''} ${pressed || open ? styles.on : ''}`}
          aria-label={text && text === label ? undefined : label}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          onClick={(e) => {
            setKeyboard(e.detail === 0)
            setOpen((o) => !o)
          }}
        >
          {trigger}
          {text ? <span>{text}</span> : null}
        </button>
      </Tooltip>
      <Popover open={open} onClose={close} anchorRef={ref} label={label} placement={placement} width={width} variant="plain" cover focusOnOpen={keyboard}>
        <div className={inline ? styles.popInline : flush ? undefined : styles.popBody} data-testid={testId ? `${testId}-pop` : undefined}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      </Popover>
    </>
  )
}

/** Separador fino entre grupos de la barra. */
export function Divider() {
  return <span className={styles.divider} role="separator" aria-orientation="vertical" />
}

/** Mosaico de color de la barra (envuelve a `ColorTool` y le da la forma de Canva). */
export function ColorSlot({ children }: { children: ReactNode }) {
  return <span className={styles.colorSlot}>{children}</span>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  )
}

export function PopoverStack({ children, width = 240 }: { children: ReactNode; width?: number }) {
  return (
    <div className={styles.stack} style={{ width }}>
      {children}
    </div>
  )
}
