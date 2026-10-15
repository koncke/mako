import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  BringToFront,
  ChevronRight,
  Layers,
  Link,
  MessageSquarePlus,
  Replace,
  SendToBack,
} from 'lucide-react'
import { commands, isCommandEnabled } from './commands'
import { useEditor, useEditorState, usePortalRoot } from './context'
import type { EditorEngine } from './engine/editor'
import { t } from './strings'
import type { ContextMenuState } from './store/editorStore'
import { shortcutText } from './toolbar/controls'
import { LinkPanel } from './toolbar/sections/common'
import styles from './ContextMenuHost.module.css'

/** Un menú abierto con Ctrl+K arranca en la vista «Vínculo» (el campo de la dirección). */
type OpenMenu = ContextMenuState & { view?: 'link' }

interface Entry {
  id: string
  label?: string
  icon?: ReactNode
  /** Atajo como lo escribe `shortcuts.ts` (`Mod+Alt+]`); se muestra en gris a la derecha. */
  shortcut?: string
  disabled?: boolean
  run?: () => void
  /** Filas del submenú (Capas ▸, Alinear con la página ▸). */
  children?: Entry[]
  separator?: boolean
}

const ICON = 18

/**
 * Ctrl+K: el menú del elemento abierto directo en «Vínculo», debajo de la barra del objeto (o arriba al centro si la
 * barra no está a la vista).
 */
export function requestLinkEditor(editor: EditorEngine): void {
  const bar = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-testid="ed-context-strip"]') : null
  const r = bar?.getBoundingClientRect()
  const menu: OpenMenu = {
    x: r ? r.left + r.width / 2 - 144 : window.innerWidth / 2 - 144,
    y: r ? r.bottom + 8 : 120,
    pageId: editor.state.activePageId,
    view: 'link',
  }
  editor.patchUi({ contextMenu: menu })
}

/** Una fila armada desde el registro de comandos (rótulo, atajo y si está habilitada salen de ahí). */
function fromCommand(editor: EditorEngine, id: string, extra: Partial<Entry> = {}): Entry | null {
  const cmd = commands.get(id)
  if (!cmd) return null
  return {
    id,
    label: cmd.label,
    icon: cmd.icon,
    shortcut: cmd.shortcut,
    disabled: !isCommandEnabled(cmd, { editor, state: editor.state }),
    run: () => void cmd.run(editor),
    ...extra,
  }
}

const sep = (id: string): Entry => ({ id, separator: true })

/** Las filas del menú, en el orden de Canva (relevamiento §5) con lo que Doory tiene. */
function buildEntries(editor: EditorEngine, onLink: () => void): Entry[] {
  const state = editor.state
  const selection = state.selection
  const pick = (...ids: string[]): Entry[] => ids.map((id) => fromCommand(editor, id)).filter((e): e is Entry => !!e)
  if (selection.ids.length === 0) {
    return [...pick('edit.paste', 'edit.selectAll'), sep('s1'), ...pick('page.add', 'file.resize')]
  }
  const single = selection.ids.length === 1
  const image = single && selection.kinds.length === 1 && selection.kinds[0] === 'image'
  const locked = selection.locked
  const arrange = (id: string, label: string, icon: ReactNode, shortcut: string): Entry | null => fromCommand(editor, id, { label, icon, shortcut })
  const layers: Entry[] = [
    arrange('arrange.forward', t.toolbar.forward, <BringToFront size={ICON} />, 'Mod+]'),
    arrange('arrange.front', t.toolbar.toFront, <ArrowUpToLine size={ICON} />, 'Mod+Alt+]'),
    arrange('arrange.backward', t.toolbar.backward, <SendToBack size={ICON} />, 'Mod+['),
    arrange('arrange.back', t.toolbar.toBack, <ArrowDownToLine size={ICON} />, 'Mod+Alt+['),
    sep('l1'),
    { id: 'layers.show', label: t.context.showLayers, icon: <Layers size={ICON} />, shortcut: 'Alt+1', run: () => editor.patchUi({ panelId: 'layers' }) },
  ].filter((e): e is Entry => !!e)
  const align = (id: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', label: string, icon: ReactNode): Entry => ({
    id: `align.${id}`,
    label,
    icon,
    disabled: locked,
    run: () => editor.arrange.align(id, 'page'),
  })
  const alignPage: Entry[] = [
    align('left', t.context.alignLeft, <AlignStartVertical size={ICON} />),
    align('center', t.context.alignCenter, <AlignCenterVertical size={ICON} />),
    align('right', t.context.alignRight, <AlignEndVertical size={ICON} />),
    align('top', t.context.alignTop, <AlignStartHorizontal size={ICON} />),
    align('middle', t.context.alignMiddle, <AlignCenterHorizontal size={ICON} />),
    align('bottom', t.context.alignBottom, <AlignEndHorizontal size={ICON} />),
  ]

  const list: Entry[] = [...pick('edit.copy', 'edit.cut', 'edit.paste', 'edit.duplicate', 'edit.delete'), sep('s1')]
  list.push({ id: 'layers', label: t.context.layers, icon: <Layers size={ICON} />, children: layers })
  list.push({ id: 'align', label: t.context.alignPage, icon: <AlignCenterVertical size={ICON} />, children: alignPage })
  list.push(sep('s2'))
  if (selection.ids.length > 1) list.push(...pick('edit.group'))
  if (single && selection.kinds.includes('group')) list.push(...pick('edit.ungroup'))
  const lock = fromCommand(editor, 'edit.lock', { label: locked ? t.menuMisc.unlock : t.menuMisc.lock, shortcut: 'Alt+Shift+L' })
  if (lock) list.push(lock)
  // Comentar sólo existe con el servicio de comentarios (etapa 2): sin él, la fila no se dibuja.
  const comment = fromCommand(editor, 'view.comments', { label: t.context.comment, icon: <MessageSquarePlus size={ICON} /> })
  if (comment && !comment.disabled) list.push(comment)
  list.push({ id: 'link', label: t.context.link, icon: <Link size={ICON} />, shortcut: 'Mod+K', disabled: locked, run: onLink })
  if (image) {
    list.push(sep('s3'), ...pick('image.crop'))
    list.push({ id: 'image.replace', label: t.toolbar.replaceImage, icon: <Replace size={ICON} />, run: () => void editor.insert.pickAndReplaceImage() })
  }
  return list
}

function enabledRows(panel: HTMLElement | null): HTMLElement[] {
  return [...(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])]
}

function moveFocus(panel: HTMLElement | null, dir: 1 | -1 | 'first' | 'last'): void {
  const rows = enabledRows(panel)
  if (rows.length === 0) return
  const current = rows.indexOf(document.activeElement as HTMLElement)
  const next = dir === 'first' ? 0 : dir === 'last' ? rows.length - 1 : (current + dir + rows.length) % rows.length
  rows[next].focus({ preventScroll: true })
}

/** Coloca un panel dentro de la ventana (8 px de margen); `flipX` lo pasa al otro lado del ancla si no entra. */
function usePlacement(ref: RefObject<HTMLDivElement | null>, x: number, y: number, flipX: number | undefined, contentKey: unknown): { left: number; top: number } | null {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    const r = panel.getBoundingClientRect()
    let left = x
    if (left + r.width > window.innerWidth - 8) left = flipX !== undefined ? flipX - r.width : window.innerWidth - r.width - 8
    left = Math.max(8, left)
    const top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8))
    setPos({ left, top })
  }, [ref, x, y, flipX, contentKey])
  return pos
}

function Row({ entry, open, onEnter, onActivate }: { entry: Entry; open: boolean; onEnter: (el: HTMLElement) => void; onActivate: (el: HTMLElement) => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={entry.disabled || undefined}
      aria-haspopup={entry.children ? 'menu' : undefined}
      aria-expanded={entry.children ? open : undefined}
      data-open={open || undefined}
      data-testid={`ed-menu-${entry.id}`}
      className={styles.item}
      onPointerEnter={(e) => onEnter(e.currentTarget)}
      onClick={(e) => {
        if (!entry.disabled) onActivate(e.currentTarget)
      }}
    >
      <span className={styles.icon} aria-hidden="true">
        {entry.icon}
      </span>
      <span className={styles.label}>{entry.label}</span>
      {entry.shortcut ? <kbd className={styles.kbd}>{shortcutText(entry.shortcut)}</kbd> : null}
      {entry.children ? <ChevronRight size={16} className={styles.chevron} aria-hidden="true" /> : null}
    </button>
  )
}

function Submenu({ entry, anchor, onPick, onBack }: { entry: Entry; anchor: DOMRect; onPick: (e: Entry) => void; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const pos = usePlacement(ref, anchor.right + 2, anchor.top - 8, anchor.left - 2, entry.id)
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={entry.label}
      className={styles.panel}
      data-placed={pos ? 'true' : 'false'}
      data-submenu=""
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
          e.preventDefault()
          e.stopPropagation()
          moveFocus(ref.current, e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'Home' ? 'first' : 'last')
        } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onBack()
        }
      }}
    >
      {(entry.children ?? []).map((c) => (c.separator ? <div key={c.id} role="separator" className={styles.sep} /> : <Row key={c.id} entry={c} open={false} onEnter={(el) => el.focus({ preventScroll: true })} onActivate={() => onPick(c)} />))}
    </div>
  )
}

/** El menú del clic derecho de Canva: Copiar, Pegar, Duplicar, Eliminar, Capas ▸, Alinear con la página ▸, Bloquear, Vínculo… */
export function ContextMenuHost() {
  const editor = useEditor()
  const root = usePortalRoot()
  const menu = useEditorState((s) => s.ui.contextMenu) as OpenMenu | null
  const selection = useEditorState((s) => s.selection)
  /** El menú para el que se eligió «Vínculo» (un menú nuevo vuelve a las filas). */
  const [linkFor, setLinkFor] = useState<OpenMenu | null>(null)
  const [sub, setSub] = useState<{ id: string; anchor: DOMRect; focus: boolean } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const showLink = !!menu && (menu.view === 'link' || linkFor === menu)

  const close = useCallback(() => editor.patchUi({ contextMenu: null }), [editor])
  // `selection` rehace las filas cuando cambia lo elegido con el menú abierto (bloquear, agrupar…).
  const entries = useMemo<Entry[]>(() => (menu && selection ? buildEntries(editor, () => setLinkFor(menu)) : []), [menu, selection, editor])
  const pos = usePlacement(panelRef, menu?.x ?? 0, menu?.y ?? 0, undefined, `${entries.length}:${showLink}:${menu?.x}:${menu?.y}`)

  // Un menú nuevo arranca sin submenú abierto.
  const [seen, setSeen] = useState<OpenMenu | null>(null)
  if (seen !== menu) {
    setSeen(menu)
    setSub(null)
  }

  useEffect(() => {
    if (!menu) return
    if (!showLink) moveFocus(panelRef.current, 'first')
    const onDown = (e: PointerEvent): void => {
      if (wrapRef.current?.contains(e.target as Node)) return
      close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.stopPropagation()
      close()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [menu, showLink, close])

  // Al abrir un submenú con el teclado, el foco entra a su primera fila.
  useEffect(() => {
    if (!sub?.focus) return
    const panel = wrapRef.current?.querySelector<HTMLElement>('[data-submenu]')
    moveFocus(panel ?? null, 'first')
  }, [sub])

  if (!menu || !root) return null

  const run = (entry: Entry): void => {
    if (entry.disabled || !entry.run) return
    // «Vínculo» cambia la vista del mismo menú; el resto cierra el menú y después actúa.
    if (entry.id !== 'link') close()
    entry.run()
  }
  const openSub = (entry: Entry, el: HTMLElement, focus: boolean): void => {
    if (entry.disabled) return
    setSub({ id: entry.id, anchor: el.getBoundingClientRect(), focus })
  }
  const subEntry = sub ? entries.find((e) => e.id === sub.id) : undefined

  const onKeyDown = (e: ReactKeyboardEvent): void => {
    const target = e.target as HTMLElement
    const entry = entries.find((x) => `ed-menu-${x.id}` === target.dataset.testid)
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        e.preventDefault()
        setSub(null)
        moveFocus(panelRef.current, e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'Home' ? 'first' : 'last')
        break
      case 'ArrowRight':
        if (entry?.children) {
          e.preventDefault()
          openSub(entry, target, true)
        }
        break
      case 'Tab':
        e.preventDefault()
        close()
        break
    }
  }

  return createPortal(
    <div ref={wrapRef} data-testid="ed-context-menu">
      <div
        ref={panelRef}
        role={showLink ? 'dialog' : 'menu'}
        aria-label={showLink ? t.context.link : t.context.menu}
        className={styles.panel}
        data-placed={pos ? 'true' : 'false'}
        style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
        onKeyDown={showLink ? undefined : onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {showLink ? (
          <div className={styles.linkView}>
            <p className={styles.linkTitle}>{t.context.link}</p>
            <LinkPanel onDone={close} />
          </div>
        ) : (
          entries.map((entry) =>
            entry.separator ? (
              <div key={entry.id} role="separator" className={styles.sep} />
            ) : (
              <Row
                key={entry.id}
                entry={entry}
                open={sub?.id === entry.id}
                onEnter={(el) => {
                  el.focus({ preventScroll: true })
                  if (entry.children) openSub(entry, el, false)
                  else setSub(null)
                }}
                onActivate={(el) => (entry.children ? openSub(entry, el, true) : run(entry))}
              />
            ),
          )
        )}
      </div>
      {!showLink && sub && subEntry?.children ? (
        <Submenu
          entry={subEntry}
          anchor={sub.anchor}
          onPick={run}
          onBack={() => {
            const parent = panelRef.current?.querySelector<HTMLElement>(`[data-testid="ed-menu-${sub.id}"]`)
            setSub(null)
            parent?.focus({ preventScroll: true })
          }}
        />
      ) : null}
    </div>,
    root,
  )
}
