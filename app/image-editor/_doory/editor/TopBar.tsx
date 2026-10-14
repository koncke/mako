import { Download, MoreHorizontal, Presentation, Share2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useCollabState } from './collab/context'
import { PresenceStack } from './chrome/PresenceStack'
import { openAccountDialog } from './chrome/accountGate'
import { I } from './chrome/icons'
import { useChrome, useOpenTool } from './chrome/ChromeContext'
import { useEditor, useEditorState } from './context'
import { commands, isCommandEnabled } from './commands'
import { type ExportFormat, exportFormats } from './engine/export/registry'
import { downloadFiles, runExport } from './engine/export/exporter'
import { DEFAULT_EXPORT_OPTIONS } from './engine/export/registry'
import { useNotesOpen } from './panels/notesVisibility'
import { useTimelineView } from './workspace/timelineVisibility'
import { type PanelDefinition } from './panels/registry'
import { preloadDialog } from './dialogs/registry'
import { useVisiblePanels } from './panels/useVisiblePanels'
import { SaveStatus } from './SaveStatus'
import { t } from './strings'
import { Menu, type MenuItem } from './ui/Menu'
import { Tooltip } from './ui/Tooltip'
import { Toolbar } from './ui/Toolbar'
import ed from './chrome/ed.module.css'
import styles from './TopBar.module.css'
import { useSyncExternalStore } from 'react'

interface TopBarProps {
  start?: ReactNode
  end?: ReactNode
  onTitle: (title: string) => void
  onPresent: () => void
}

/** How much of the bar has to give way, from the available width (see `levelFor`). */
type Level = 0 | 1 | 2 | 3

/**
 * The bar has three groups: the design on the left, the add-to-design tools in the middle (kept centred) and
 * the actions on the right. Width goes to the most important group first: the right-hand secondary icons
 * move into the "More" menu, then the middle tools beyond the first six, then beyond the first four.
 */
function levelFor(available: number): Level {
  if (available >= 1480) return 0
  if (available >= 1340) return 1
  if (available >= 1180) return 2
  return 3
}
const TOOLS_AT_LEVEL: Record<Level, number> = { 0: 99, 1: 99, 2: 6, 3: 4 }
/** Below this bar width (and at the last level) one more tool moves into "More": the status next to the title needs the room. */
const TIGHT_BAR_WIDTH = 900

function TitleField({ onTitle }: { onTitle: (title: string) => void }) {
  const editor = useEditor()
  const title = useEditorState((s) => s.title)
  const locked = useEditorState((s) => s.readOnly)
  const cannotRename = useCollabState((s) => !s.canRename) === true
  const readOnly = locked || cannotRename
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (value: string): void => {
    setDraft(null)
    editor.setTitle(value)
    onTitle(editor.state.title)
  }
  return (
    <input
      className={styles.title}
      value={draft ?? title}
      readOnly={readOnly}
      aria-label={t.topbar.title}
      data-testid="ed-topbar-title"
      maxLength={120}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function ToolEntry({ panel, open, onToggle }: { panel: PanelDefinition; open: boolean; onToggle: () => void }) {
  const chrome = useChrome()
  const ref = useCallback((el: HTMLButtonElement | null) => chrome.setAnchor(panel.id, el), [chrome, panel.id])
  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.entry} ${open ? styles.entryOn : ''}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={panel.shortcut ? `${panel.label} (${panel.shortcut})` : panel.label}
      data-testid={`ed-add-entry-${panel.id}`}
      data-tool={panel.id}
      onPointerEnter={panel.preload}
      onFocus={panel.preload}
      onClick={(e) => {
        chrome.setKeyboardOpen(e.detail === 0)
        onToggle()
      }}
    >
      <span className={styles.entryIcon}>{panel.icon}</span>
      <span className={styles.entryLabel}>{panel.label}</span>
    </button>
  )
}

/** A tool that lives as an icon button at the right end of the bar (Comments). */
function EndTool({ panel, open, onToggle }: { panel: PanelDefinition; open: boolean; onToggle: () => void }) {
  const chrome = useChrome()
  const ref = useCallback((el: HTMLButtonElement | null) => chrome.setAnchor(panel.id, el), [chrome, panel.id])
  return (
    <Tooltip label={panel.label}>
      <button ref={ref} type="button" className={`${ed.btn} ${ed.iconOnly} ${ed.ghost} ${open ? ed.pressed : ''}`} aria-label={panel.label} aria-pressed={open} data-testid={`ed-end-${panel.id}`} onPointerEnter={panel.preload} onFocus={panel.preload} onClick={onToggle}>
        {panel.icon}
      </button>
    </Tooltip>
  )
}

function ShareButton() {
  const editor = useEditor()
  const mode = useEditorState((s) => s.mode)
  // Not `disabled` while busy: a disabled button drops focus, and the dialog gives focus back to its opener.
  const busy = useRef(false)
  if (mode !== 'guest' && !editor.adapter.services.sharing) return null
  return (
    <button
      type="button"
      className={`${ed.btn} ${ed.primary} ${styles.share}`}
      aria-haspopup="dialog"
      data-testid="ed-share"
      onPointerEnter={() => preloadDialog('share')}
      onFocus={() => preloadDialog('share')}
      onClick={() => {
        if (busy.current) return
        busy.current = true
        void openAccountDialog(editor, 'share', 'share', (x) => !!x.adapter.services.sharing, t.share.unavailable).finally(() => {
          busy.current = false
        })
      }}
    >
      <Share2 size={15} aria-hidden="true" />
      <span className={styles.btnLabel}>{t.topbar.share}</span>
    </button>
  )
}

function MoreTools({ panels, openId, onToggle }: { panels: readonly PanelDefinition[]; openId: string | null; onToggle: (id: string) => void }) {
  const chrome = useChrome()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const setRef = useCallback(
    (el: HTMLButtonElement | null) => {
      anchor.current = el
      chrome.setAnchor('more', el)
    },
    [chrome],
  )
  const items: MenuItem[] = panels.map((p) => ({ id: p.id, label: p.label, icon: p.icon, checked: undefined, onSelect: () => onToggle(p.id) }))
  const active = panels.some((p) => p.id === openId)
  return (
    <>
      <button ref={setRef} type="button" className={`${styles.entry} ${active || open ? styles.entryOn : ''}`} aria-haspopup="menu" aria-expanded={open} data-testid="ed-add-entry-more" onClick={() => setOpen((o) => !o)} onPointerEnter={() => panels.forEach((p) => p.preload?.())}>
        <span className={styles.entryIcon}>
          <MoreHorizontal size={18} />
        </span>
        <span className={styles.entryLabel}>{t.chrome.more}</span>
      </button>
      {open ? <Menu label={t.chrome.moreTools} items={items} anchorRef={anchor} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

function DownloadMenu() {
  const editor = useEditor()
  const formats = useSyncExternalStore(exportFormats.subscribe, exportFormats.getSnapshot)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)

  const quick = useCallback(
    async (format: ExportFormat): Promise<void> => {
      setBusy(true)
      try {
        const files = await runExport(editor, { formatId: format.id, pages: { kind: 'all' }, options: format.id === 'png' ? { ...DEFAULT_EXPORT_OPTIONS, transparent: true } : DEFAULT_EXPORT_OPTIONS })
        downloadFiles(files)
        editor.toast(t.dialog.downloadDone, 'success')
      } catch (err) {
        editor.toast(err instanceof Error && err.message ? err.message : t.dialog.downloadFailed, 'error')
      } finally {
        setBusy(false)
      }
    },
    [editor],
  )

  const quickFormats = formats.filter((f) => ['jpg', 'png', 'pdf', 'svg'].includes(f.id) && (!f.available || f.available(editor)))
  const items: MenuItem[] = [
    ...quickFormats.map((f) => ({ id: f.id, label: f.label, hint: t.topbar.formatHint[f.id as 'jpg'], onSelect: () => void quick(f) })),
    { id: 'sep', separator: true },
    { id: 'video', label: t.topbar.videoDownload, hint: t.topbar.videoDownloadHint, onSelect: () => editor.openDialog('download', { format: 'mp4' }) },
    { id: 'more', label: t.topbar.moreDownloadOptions, onSelect: () => editor.openDialog('download') },
  ]
  return (
    <>
      <button ref={anchor} type="button" className={`${ed.btn} ${ed.ghost} ${styles.download}`} aria-haspopup="menu" aria-expanded={open} disabled={busy} data-testid="ed-download" onPointerEnter={() => preloadDialog('download')} onFocus={() => preloadDialog('download')} onClick={() => setOpen((o) => !o)}>
        <Download size={15} aria-hidden="true" />
        <span className={styles.btnLabel}>{busy ? t.dialog.downloadWorking : t.dialog.downloadButton}</span>
      </button>
      {open ? <Menu label={t.dialog.downloadButton} items={items} anchorRef={anchor} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function TopBar({ start, end, onTitle, onPresent }: TopBarProps) {
  const editor = useEditor()
  const history = useEditorState((s) => s.history)
  const readOnly = useEditorState((s) => s.readOnly)
  const ui = useEditorState((s) => s.ui)
  const notesOpen = useNotesOpen()
  const timelineOpen = useTimelineView().open
  const guideCount = useEditorState((s) => s.doc.pages.find((p) => p.id === s.activePageId)?.guides?.length ?? 0)
  const visible = useVisiblePanels()
  const { openId, toggle } = useOpenTool()
  const barRef = useRef<HTMLElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const barWidth = useWidth(barRef)
  const endWidth = useWidth(endRef)
  /** The avatar stack takes room from the right-hand group, so the bar collapses its tools a step earlier while it is there. */
  const stackWidth = useWidth(stackRef)
  const level = levelFor(barWidth - endWidth - stackWidth)
  /** Phone widths: the end tools (Comments) move into the More menu so the bar keeps room for the title. */
  const narrow = barWidth > 0 && barWidth < 720
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLButtonElement>(null)

  const tools = visible.filter((p) => p.slot !== 'end' && (!readOnly || p.readOnly))
  const endTools = visible.filter((p) => p.slot === 'end' && (!readOnly || p.readOnly))
  const limit = level === 3 && barWidth > 0 && barWidth < TIGHT_BAR_WIDTH ? TOOLS_AT_LEVEL[3] - 1 : TOOLS_AT_LEVEL[level]
  const shown = tools.slice(0, limit)
  const hidden = tools.slice(limit)

  const cmd = (id: string, label?: string): MenuItem => {
    const c = commands.get(id)
    return {
      id,
      label: label ?? c?.label ?? id,
      shortcut: c?.shortcut,
      icon: c?.icon,
      disabled: c ? !isCommandEnabled(c, { editor, state: editor.state }) : true,
      onSelect: () => c && void c.run(editor),
    }
  }
  const notesItems: MenuItem[] = [{ ...cmd('view.notes'), checked: notesOpen }, cmd('file.notesMarkdown'), cmd('file.notesText')]
  const animationItems: MenuItem[] = [{ ...cmd('view.timeline'), checked: timelineOpen }, cmd('view.playPage')]
  const endItems: MenuItem[] = narrow ? endTools.map((p) => ({ id: `tool-${p.id}`, label: p.label, icon: p.icon, checked: openId === p.id || undefined, onSelect: () => toggle(p.id) })) : []
  const moreItems: MenuItem[] = readOnly
    ? [...endItems, cmd('file.download'), ...notesItems, ...animationItems, { id: 'present', label: t.topbar.present, onSelect: onPresent }, cmd('file.presentNotes'), cmd('file.shortcuts')]
    : [
        ...endItems,
        cmd('file.rename'),
        cmd('file.reset'),
        cmd('file.save'),
        { id: 's1', separator: true },
        cmd('page.add', t.menu.newPage),
        cmd('file.resize'),
        cmd('file.download'),
        cmd('file.history'),
        { id: 's-notes', separator: true },
        ...notesItems,
        ...animationItems,
        { id: 's2', separator: true },
        { id: 'rulers', label: t.menu.rulers, checked: ui.rulers, onSelect: () => editor.patchUi({ rulers: !ui.rulers }) },
        { id: 'grid', label: t.menu.grid, checked: ui.grid, onSelect: () => editor.patchUi({ grid: !ui.grid }) },
        { id: 'guides', label: t.menu.guides, checked: ui.guides, onSelect: () => editor.patchUi({ guides: !ui.guides }) },
        { id: 'snap', label: t.menu.snapping, checked: ui.snapping, onSelect: () => editor.patchUi({ snapping: !ui.snapping }) },
        { id: 'bleed', label: t.menu.bleed, checked: ui.bleed, onSelect: () => editor.patchUi({ bleed: !ui.bleed }) },
        ...(guideCount > 0 ? [{ id: 'clear-guides', label: t.design.clearGuides(guideCount), onSelect: () => editor.pages.setGuides(editor.state.activePageId, []) }] : []),
        { id: 's3', separator: true },
        ...(level >= 1 ? [{ id: 'present', label: t.topbar.present, onSelect: onPresent }] : []),
        cmd('file.presentNotes'),
        cmd('file.shortcuts'),
      ]

  // Closing a tool when the bar collapses it into "More" is not needed: its drawer anchors to the More button.
  useEffect(() => {
    if (readOnly) editor.patchUi({ panelId: null })
  }, [readOnly, editor])

  return (
    <header ref={barRef} className={styles.bar} data-testid="ed-topbar" data-level={level}>
      <div className={styles.left}>
        {start}
        <TitleField onTitle={onTitle} />
        <SaveStatus />
      </div>

      <Toolbar label={t.chrome.tools} className={styles.center}>
        {shown.map((p) => (
          <ToolEntry key={p.id} panel={p} open={openId === p.id} onToggle={() => toggle(p.id)} />
        ))}
        {hidden.length > 0 ? <MoreTools panels={hidden} openId={openId} onToggle={toggle} /> : null}
      </Toolbar>

      <div className={styles.right}>
        <div ref={stackRef} className={styles.presence}>
          <PresenceStack />
        </div>
        {readOnly ? null : (
          <>
            <Tooltip label={history.undoLabel ? `${t.topbar.undo} ${history.undoLabel.toLowerCase()}` : t.topbar.undo} shortcut="Mod+Z" disabled={!history.canUndo}>
              <button type="button" className={`${ed.btn} ${ed.iconOnly} ${ed.ghost}`} aria-label={t.topbar.undo} disabled={!history.canUndo} data-testid="ed-undo" onClick={() => void editor.undo()}>
                {I.undo}
              </button>
            </Tooltip>
            <Tooltip label={history.redoLabel ? `${t.topbar.redo} ${history.redoLabel.toLowerCase()}` : t.topbar.redo} shortcut="Mod+Shift+Z" disabled={!history.canRedo}>
              <button type="button" className={`${ed.btn} ${ed.iconOnly} ${ed.ghost}`} aria-label={t.topbar.redo} disabled={!history.canRedo} data-testid="ed-redo" onClick={() => void editor.redo()}>
                {I.redo}
              </button>
            </Tooltip>
          </>
        )}
        {!narrow ? endTools.map((p) => <EndTool key={p.id} panel={p} open={openId === p.id} onToggle={() => toggle(p.id)} />) : null}
        {level === 0 || readOnly ? (
          <Tooltip label={t.topbar.present}>
            <button type="button" className={`${ed.btn} ${ed.iconOnly} ${ed.ghost}`} aria-label={t.topbar.present} data-testid="ed-present" onClick={onPresent}>
              <Presentation size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        ) : null}
        <Tooltip label={t.chrome.more} disabled={moreOpen}>
          <button ref={moreRef} type="button" className={`${ed.btn} ${ed.iconOnly} ${ed.ghost}`} aria-label={t.chrome.more} aria-haspopup="menu" aria-expanded={moreOpen} data-testid="ed-more" onClick={() => setMoreOpen((o) => !o)}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
        </Tooltip>
        {moreOpen ? <Menu label={t.chrome.more} items={moreItems} anchorRef={moreRef} onClose={() => setMoreOpen(false)} /> : null}
        <DownloadMenu />
        {readOnly ? null : <ShareButton />}
        <div ref={endRef} className={styles.end}>
          {end}
        </div>
      </div>
    </header>
  )
}
