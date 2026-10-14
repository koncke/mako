import { type ReactNode, useState } from 'react'
import { ChevronDown, CopyPlus, Minus, Plus, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { runCommand } from '../commands'
import { I } from '../chrome/icons'
import { useEditor, useEditorState, useSelection } from '../context'
import { formatShortcut } from '../shortcuts'
import { t } from '../strings'
import { Slider } from '../ui/Slider'
import { type Limit, clampTo, rangeHint } from './limits'
import { PopoverTool, ToolButton } from './parts'
import styles from './parts.module.css'

const outside = (raw: string, limit: Limit): boolean => {
  const n = Number(raw)
  return raw.trim() !== '' && Number.isFinite(n) && (n < limit.min || n > limit.max)
}

/** El atajo como lo escribe Canva en español: «Supr» para Delete. */
export function shortcutText(shortcut: string): string {
  return formatShortcut(shortcut).replace(/\bDel\b/, 'Supr')
}

/** `−  24  +` de Canva: el número en una caja con borde; un valor fuera del rango se recorta al confirmarlo. */
export function Stepper({ label, value, limit, onChange, testId }: { label: string; value: number; limit: Limit; onChange: (value: number, key?: string) => void; testId: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const { min, max, step } = limit
  const clamp = (n: number): number => clampTo(limit, Math.round(n))
  const commit = (raw: string): void => {
    setDraft(null)
    const n = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(n)) onChange(clamp(n))
  }
  const hint = rangeHint(limit)
  return (
    <div className={styles.stepper} role="group" aria-label={label} title={hint} data-testid={testId}>
      <button type="button" className={styles.stepBtn} aria-label={t.ctx.decreaseSize} title={t.ctx.decreaseSize} disabled={value <= min} data-testid={`${testId}-minus`} onClick={() => onChange(clamp(value - step), 'step')}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="number"
        className={styles.stepInput}
        aria-label={label}
        aria-invalid={draft !== null && outside(draft, limit) ? true : undefined}
        title={hint}
        data-testid={`${testId}-input`}
        value={draft ?? value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n), 'typing')
        }}
        onBlur={(e) => commit(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value)
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setDraft(null)
            e.currentTarget.blur()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            setDraft(null)
            onChange(clamp(value + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : step)), 'step')
          }
        }}
      />
      <button type="button" className={styles.stepBtn} aria-label={t.ctx.increaseSize} title={t.ctx.increaseSize} disabled={value >= max} data-testid={`${testId}-plus`} onClick={() => onChange(clamp(value + step), 'step')}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Un campo numérico con rótulo dentro de un popover (lados de un polígono, puntas de una estrella). Un valor dentro
 * del rango se aplica al escribirlo; uno fuera espera, queda marcado y se recorta al confirmarlo (Enter o al salir).
 */
export function LimitedNumber({ label, value, limit, onChange, testId }: { label: string; value: number; limit: Limit; onChange: (value: number) => void; testId: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const hint = rangeHint(limit)
  const shown = String(Number(value.toFixed(limit.decimals)))
  const commit = (raw: string): void => {
    setDraft(null)
    const n = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(n)) onChange(clampTo(limit, n))
  }
  return (
    <div>
      <div className={styles.label}>{label}</div>
      <input
        type="number"
        className={styles.input}
        aria-label={label}
        aria-invalid={draft !== null && outside(draft, limit) ? true : undefined}
        title={hint}
        data-testid={testId}
        value={draft ?? shown}
        min={limit.min}
        max={limit.max}
        step={limit.step}
        onChange={(e) => {
          const raw = e.target.value
          const n = Number(raw)
          if (raw.trim() !== '' && Number.isFinite(n) && n >= limit.min && n <= limit.max) {
            setDraft(null)
            onChange(clampTo(limit, n))
          } else setDraft(raw)
        }}
        onBlur={(e) => draft !== null && commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(e.currentTarget.value)
          else if (e.key === 'Escape') setDraft(null)
        }}
      />
    </div>
  )
}

/** Deslizador con la caja numérica a la derecha del rótulo (Canva: Transparencia, Grosor del borde, Interlineado…). */
export function RangeField({ label, value, limit, onChange }: { label: string; value: number; limit: Limit; onChange: (value: number) => void }) {
  return <Slider label={label} value={value} min={limit.min} max={limit.max} step={limit.step} decimals={limit.decimals} withInput onChange={(n) => onChange(clampTo(limit, n))} />
}

/** Los giros de un cuarto de vuelta como filas de menú (en «Voltear» y en «⋯ Más › Girar»). */
export function RotateItems({ onDone }: { onDone?: () => void }) {
  const editor = useEditor()
  const sel = useSelection()
  const angle = Math.round((((sel.bounds?.angle ?? 0) % 360) + 360) % 360)
  const run = (fn: () => void): void => {
    fn()
    onDone?.()
  }
  return (
    <>
      <button type="button" role="menuitem" className={styles.menuItem} disabled={sel.locked} onClick={() => run(() => editor.arrange.rotateBy(90))}>
        <span className={styles.menuIcon}>
          <RotateCw size={16} aria-hidden="true" />
        </span>
        <span className={styles.menuLabel}>{t.ctx.rotateRight}</span>
      </button>
      <button type="button" role="menuitem" className={styles.menuItem} disabled={sel.locked} onClick={() => run(() => editor.arrange.rotateBy(-90))}>
        <span className={styles.menuIcon}>
          <RotateCcw size={16} aria-hidden="true" />
        </span>
        <span className={styles.menuLabel}>{t.ctx.rotateLeft}</span>
      </button>
      <button type="button" role="menuitem" className={styles.menuItem} disabled={sel.locked} onClick={() => run(() => editor.arrange.rotateBy(180))}>
        <span className={styles.menuIcon}>{I.rotate}</span>
        <span className={styles.menuLabel}>{t.ctx.rotate180}</span>
      </button>
      <button type="button" role="menuitem" className={styles.menuItem} disabled={sel.locked || angle === 0} onClick={() => run(() => editor.arrange.setAngle(0))}>
        <span className={styles.menuIcon} />
        <span className={styles.menuLabel}>{t.ctx.rotateReset}</span>
        <span className={styles.menuKbd}>{angle}°</span>
      </button>
    </>
  )
}

/** «Voltear» de Canva: horizontal y vertical; abajo, los giros de un cuarto de vuelta que Doory ya tenía. */
export function FlipTool() {
  const editor = useEditor()
  const sel = useSelection()
  return (
    <PopoverTool label={t.toolbar.flip} text={t.toolbar.flip} flush testId="ed-flip">
      {(close) => (
        <div className={styles.menuList} role="menu" data-testid="ed-flip-menu">
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            data-testid="ed-flip-h"
            disabled={sel.locked}
            onClick={() => {
              editor.arrange.flip('horizontal')
              close()
            }}
          >
            <span className={styles.menuIcon}>{I.flipH}</span>
            <span className={styles.menuLabel}>{t.toolbar.flipH}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            data-testid="ed-flip-v"
            disabled={sel.locked}
            onClick={() => {
              editor.arrange.flip('vertical')
              close()
            }}
          >
            <span className={styles.menuIcon}>{I.flipV}</span>
            <span className={styles.menuLabel}>{t.toolbar.flipV}</span>
          </button>
          <div className={styles.menuSep} role="separator" />
          <RotateItems onDone={close} />
        </div>
      )}
    </PopoverTool>
  )
}

/** «Animar»: abre (o cierra) el panel de animación a la izquierda, como Canva. */
export function AnimateTool() {
  const editor = useEditor()
  const open = useEditorState((s) => s.ui.panelId === 'animate')
  return <ToolButton label={t.toolbar.animate} text={t.toolbar.animate} pressed={open} testId="ed-animate" onClick={() => runCommand(editor, 'view.animate')} />
}

/** «Posición»: abre (o cierra) el panel de Capas (ordenar, elegir y bloquear lo que hay en la página). */
export function PositionTool() {
  const editor = useEditor()
  const open = useEditorState((s) => s.ui.panelId === 'layers')
  return <ToolButton label={t.toolbar.position} text={t.toolbar.position} pressed={open} testId="ed-position" onClick={() => editor.patchUi({ panelId: open ? null : 'layers' })} />
}

export function LockTool() {
  const editor = useEditor()
  const sel = useSelection()
  return (
    <ToolButton label={sel.locked ? t.ctx.unlockPosition : t.ctx.lockPosition} shortcut="Alt+Shift+L" pressed={sel.locked} onClick={() => editor.arrange.toggleLock()} testId="ed-lock">
      {sel.locked ? I.lock : I.unlock}
    </ToolButton>
  )
}

/** «Transparencia»: el ícono de damero y un deslizador de 0 a 100 con su caja, como Canva. */
export function OpacityTool({ testId = 'ed-opacity' }: { testId?: string }) {
  const editor = useEditor()
  const sel = useSelection()
  const opacity = Number(sel.objects[0]?.opacity ?? 1)
  return (
    <PopoverTool label={t.toolbar.opacity} trigger={I.opacity} width={280} testId={testId}>
      <RangeField label={t.toolbar.opacity} value={Math.round(opacity * 100)} limit={{ min: 0, max: 100, step: 1, decimals: 0 }} onChange={(v) => editor.style.setOpacity(v / 100)} />
    </PopoverTool>
  )
}

/** Una sección con nombre del popover «⋯ Más», plegable. */
export function Accordion({ title, children, defaultOpen = false, testId }: { title: string; children: ReactNode; defaultOpen?: boolean; testId?: string }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={styles.accordion} data-testid={testId}>
      <button type="button" className={styles.accordionHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <ChevronDown size={16} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open ? <div className={styles.accordionBody}>{children}</div> : null}
    </section>
  )
}

/** Una fila de acción del «⋯ Más» (Duplicar, Eliminar…), con el atajo gris a la derecha. */
export function OverflowAction({ icon, label, shortcut, disabled, onClick, testId }: { icon: ReactNode; label: string; shortcut?: string; disabled?: boolean; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className={styles.menuItem} disabled={disabled} data-testid={testId} onClick={onClick}>
      <span className={styles.menuIcon}>{icon}</span>
      <span className={styles.menuLabel}>{label}</span>
      {shortcut ? <kbd className={styles.menuKbd}>{shortcutText(shortcut)}</kbd> : null}
    </button>
  )
}

/** El `⋯` al final de la barra: Duplicar y Eliminar arriba, y las opciones menos usadas en secciones plegables. */
export function OverflowTool({ children }: { children: ReactNode | ((close: () => void) => ReactNode) }) {
  const editor = useEditor()
  return (
    <PopoverTool label={t.toolbar.more} trigger={<span aria-hidden="true">⋯</span>} width={304} flush testId="ed-overflow">
      {(close) => (
        <div className={styles.overflow}>
          <OverflowAction
            icon={<CopyPlus size={16} aria-hidden="true" />}
            label={t.toolbar.duplicate}
            shortcut="Mod+D"
            testId="ed-duplicate"
            onClick={() => {
              close()
              void editor.arrange.duplicate()
            }}
          />
          <OverflowAction
            icon={<Trash2 size={16} aria-hidden="true" />}
            label={t.toolbar.delete}
            shortcut="Delete"
            testId="ed-delete"
            onClick={() => {
              close()
              editor.arrange.delete()
            }}
          />
          <div className={styles.menuSep} role="separator" />
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </PopoverTool>
  )
}
