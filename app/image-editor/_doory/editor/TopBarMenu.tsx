import { ChevronRight } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePortalRoot } from './context'
import { formatShortcut } from './shortcuts'
import styles from './TopBarMenu.module.css'

/*
 * Los menús de la barra superior, como los de Canva: tarjeta blanca flotante con sombra, ítems de 40 px con
 * ícono, atajo a la derecha y submenús que se abren al costado («Configuración ▸»). El `ui/Menu` de Doory no
 * tiene submenús ni encabezado, por eso la barra trae el suyo.
 */

export interface BarMenuItem {
  id: string
  label?: string
  icon?: ReactNode
  shortcut?: string
  /** Nota gris a la derecha («Transparente», «Vectorial»). */
  hint?: string
  /** Casilla: el menú queda abierto al tocarla, como las de «Configuración» de Canva. */
  checked?: boolean
  disabled?: boolean
  separator?: boolean
  /** La acción principal del menú: el botón violeta de ancho completo de los paneles de Canva. */
  primary?: boolean
  submenu?: BarMenuItem[]
  onSelect?: () => void
}

interface BarMenuProps {
  label: string
  items: BarMenuItem[]
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  /** Título arriba del menú («Compartir este diseño»). */
  heading?: string
  /** `end`: el menú se alinea al borde derecho del botón (los de la derecha de la barra). */
  align?: 'start' | 'end'
  width?: number
}

const ITEM = '[role^="menuitem"]:not([aria-disabled="true"])'
const GAP = 8

function move(panel: HTMLElement | null, dir: 1 | -1 | 'first' | 'last'): void {
  const nodes = [...(panel?.querySelectorAll<HTMLElement>(ITEM) ?? [])]
  if (nodes.length === 0) return
  const current = nodes.indexOf(document.activeElement as HTMLElement)
  const next = dir === 'first' ? 0 : dir === 'last' ? nodes.length - 1 : (current + dir + nodes.length) % nodes.length
  nodes[next].focus()
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max))
}

interface OpenSub {
  id: string
  rect: DOMRect
  /** Abierto con el teclado: el foco entra al submenú. */
  focus: boolean
}

export function BarMenu({ label, items, anchorRef, onClose, heading, align = 'start', width }: BarMenuProps) {
  const root = usePortalRoot()
  const panelRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [sub, setSub] = useState<OpenSub | null>(null)
  const [subPos, setSubPos] = useState<{ id: string; left: number; top: number } | null>(null)
  const subItems = sub ? items.find((i) => i.id === sub.id)?.submenu : undefined

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const r = panel.getBoundingClientRect()
    let left = GAP
    let top = GAP
    const a = anchorRef.current?.getBoundingClientRect()
    if (a) {
      left = align === 'end' ? a.right - r.width : a.left
      top = a.bottom + GAP
    }
    setPos({ left: clamp(left, GAP, window.innerWidth - r.width - GAP), top: clamp(top, GAP, window.innerHeight - r.height - GAP) })
  }, [anchorRef, align, items.length, heading])

  useLayoutEffect(() => {
    const el = subRef.current
    if (!sub || !el) return
    const r = el.getBoundingClientRect()
    let left = sub.rect.right + 4
    if (left + r.width > window.innerWidth - GAP) left = Math.max(GAP, sub.rect.left - r.width - 4)
    setSubPos({ id: sub.id, left, top: clamp(sub.rect.top - GAP, GAP, window.innerHeight - r.height - GAP) })
    if (sub.focus) el.querySelector<HTMLElement>(ITEM)?.focus({ preventScroll: true })
  }, [sub])

  // La barra pasa `onClose` como flecha nueva en cada render: se guarda aparte para que los listeners (y el foco
  // del primer ítem) no se rearmen con cada cambio del editor.
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(ITEM)?.focus({ preventScroll: true })
    const onDown = (e: PointerEvent): void => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || subRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      closeRef.current()
    }
    // Escape cierra aunque el foco siga en el botón que abrió el menú.
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (panelRef.current?.contains(document.activeElement) || subRef.current?.contains(document.activeElement)) return
      e.stopPropagation()
      closeRef.current()
      anchorRef.current?.focus()
    }
    const onResize = (): void => closeRef.current()
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onResize)
    }
  }, [anchorRef])

  const openSub = (item: BarMenuItem, el: HTMLElement, focus: boolean): void => {
    if (sub?.id === item.id && !focus) return
    setSub({ id: item.id, rect: el.getBoundingClientRect(), focus })
  }

  const select = (item: BarMenuItem, el: HTMLElement): void => {
    if (item.disabled) return
    if (item.submenu) {
      openSub(item, el, true)
      return
    }
    // Una casilla se tilda y el menú queda abierto; el resto cierra y después actúa.
    if (item.checked !== undefined) {
      item.onSelect?.()
      return
    }
    onClose()
    item.onSelect?.()
  }

  const closeSub = (): void => {
    const id = sub?.id
    setSub(null)
    if (id) panelRef.current?.querySelector<HTMLElement>(`[data-item="${id}"]`)?.focus({ preventScroll: true })
  }

  // Las teclas del menú no siguen hasta los atajos del editor (una flecha movería el objeto elegido).
  const onRootKey = (e: React.KeyboardEvent): void => {
    const target = e.target as HTMLElement
    const item = items.find((i) => i.id === target.dataset.item)
    switch (e.key) {
      case 'ArrowDown':
        move(panelRef.current, 1)
        break
      case 'ArrowUp':
        move(panelRef.current, -1)
        break
      case 'Home':
        move(panelRef.current, 'first')
        break
      case 'End':
        move(panelRef.current, 'last')
        break
      case 'ArrowRight':
        if (item?.submenu && !item.disabled) openSub(item, target, true)
        break
      case 'Escape':
        onClose()
        anchorRef.current?.focus()
        break
      case 'Tab':
        onClose()
        break
      default:
        e.stopPropagation()
        return
    }
    if (e.key !== 'Tab') e.preventDefault()
    e.stopPropagation()
  }

  const onSubKey = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown':
        move(subRef.current, 1)
        break
      case 'ArrowUp':
        move(subRef.current, -1)
        break
      case 'Home':
        move(subRef.current, 'first')
        break
      case 'End':
        move(subRef.current, 'last')
        break
      case 'ArrowLeft':
      case 'Escape':
        closeSub()
        break
      case 'Tab':
        onClose()
        break
      default:
        e.stopPropagation()
        return
    }
    if (e.key !== 'Tab') e.preventDefault()
    e.stopPropagation()
  }

  if (!root) return null
  return createPortal(
    <>
      <div
        ref={panelRef}
        role="menu"
        aria-label={label}
        className={styles.menu}
        style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width, opacity: pos ? undefined : 0 }}
        onKeyDown={onRootKey}
      >
        {heading ? <div className={styles.heading}>{heading}</div> : null}
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            expanded={item.submenu ? sub?.id === item.id : undefined}
            onSelect={select}
            onHover={(el) => {
              if (item.submenu && !item.disabled) openSub(item, el, false)
              else if (sub) setSub(null)
            }}
          />
        ))}
      </div>
      {sub && subItems ? (
        <div
          ref={subRef}
          role="menu"
          aria-label={items.find((i) => i.id === sub.id)?.label ?? label}
          className={`${styles.menu} ${styles.sub}`}
          style={{ left: subPos?.id === sub.id ? subPos.left : 0, top: subPos?.id === sub.id ? subPos.top : 0, opacity: subPos?.id === sub.id ? undefined : 0 }}
          onKeyDown={onSubKey}
        >
          {subItems.map((item) => (
            <Row key={item.id} item={item} onSelect={select} onHover={() => {}} />
          ))}
        </div>
      ) : null}
    </>,
    root,
  )
}

function Row({ item, expanded, onSelect, onHover }: { item: BarMenuItem; expanded?: boolean; onSelect: (item: BarMenuItem, el: HTMLElement) => void; onHover: (el: HTMLElement) => void }) {
  if (item.separator) return <div role="separator" className={styles.sep} />
  const role = item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'
  return (
    <button
      type="button"
      role={role}
      aria-checked={item.checked}
      aria-disabled={item.disabled || undefined}
      aria-haspopup={item.submenu ? 'menu' : undefined}
      aria-expanded={expanded}
      tabIndex={-1}
      data-item={item.id}
      className={`${styles.item} ${item.primary ? styles.primary : ''}`}
      onPointerEnter={(e) => onHover(e.currentTarget)}
      onClick={(e) => onSelect(item, e.currentTarget)}
    >
      {item.primary && !item.icon ? null : <span className={styles.icon}>{item.icon}</span>}
      <span className={styles.label}>{item.label}</span>
      {item.hint ? <span className={styles.hint}>{item.hint}</span> : null}
      {item.shortcut ? <kbd className={styles.kbd}>{formatShortcut(item.shortcut)}</kbd> : null}
      {item.checked !== undefined ? <span className={styles.check}>{item.checked ? <CheckMark /> : null}</span> : null}
      {item.submenu ? <ChevronRight size={16} className={styles.chevron} aria-hidden="true" /> : null}
    </button>
  )
}

function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}
