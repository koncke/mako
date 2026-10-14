import { Download, Eye, FilePlus, FileText, History, Keyboard, Maximize, MonitorPlay, PencilLine, Play, Presentation, Redo2, RotateCcw, Save, Scaling, Settings, Share, SquarePlus, Undo2, Users } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useCollabState } from './collab/context'
import { PresenceStack } from './chrome/PresenceStack'
import { openAccountDialog } from './chrome/accountGate'
import { useChrome, useOpenTool } from './chrome/ChromeContext'
import { useEditor, useEditorState } from './context'
import { type Command, commands, isCommandEnabled } from './commands'
import { formatSize, getPageSize } from './engine/pageSizes'
import { type ExportFormat, exportFormats, DEFAULT_EXPORT_OPTIONS } from './engine/export/registry'
import { downloadFiles, runExport } from './engine/export/exporter'
import { useNotesOpen } from './panels/notesVisibility'
import { useTimelineView } from './workspace/timelineVisibility'
import { type PanelDefinition } from './panels/registry'
import { preloadDialog } from './dialogs/registry'
import { useVisiblePanels } from './panels/useVisiblePanels'
import { SaveStatus } from './SaveStatus'
import { t } from './strings'
import { BarMenu, type BarMenuItem } from './TopBarMenu'
import { Tooltip } from './ui/Tooltip'
import { Toolbar } from './ui/Toolbar'
import styles from './TopBar.module.css'

/*
 * La barra superior de Canva (docs/editor-imagen/relevamiento-canva-armazon.md §2): degradado celeste→violeta,
 * 56 px, texto blanco. A la izquierda «Inicio» (el slot `start` de la cáscara), «Archivo», «Redimensionar»,
 * Deshacer/Rehacer y el estado de guardado; a la derecha el nombre con las medidas, Comentarios, «Presentar» y
 * «Compartir» (botón claro). Las herramientas para agregar (Texto, Elementos, Subidos…) ya no viven acá: en
 * escritorio están en el riel izquierdo; debajo de 1024 px van en la tira de abajo (`CompactTools`) y abren
 * como hoja inferior.
 */

interface TopBarProps {
  start?: ReactNode
  end?: ReactNode
  onTitle: (title: string) => void
  onPresent: () => void
}

/**
 * Cuánto lugar hay. `wide`: todo con rótulo. `tight`: el nombre sin medidas y «Presentar» sólo ícono.
 * `narrow`: «Redimensionar» y Comentarios pasan al menú Archivo. `tiny` (teléfono): el nombre y «Presentar»
 * también pasan a Archivo.
 */
type BarSize = 'wide' | 'tight' | 'narrow' | 'tiny'

function sizeFor(width: number): BarSize {
  if (width === 0 || width >= 1180) return 'wide'
  if (width >= 900) return 'tight'
  if (width >= 640) return 'narrow'
  return 'tiny'
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

/** «Diseño sin título - 1080 × 1080 px»: el nombre se edita en el lugar; las medidas son de la página activa. */
function TitleField({ onTitle, showSize }: { onTitle: (title: string) => void; showSize: boolean }) {
  const editor = useEditor()
  const title = useEditorState((s) => s.title)
  const size = useEditorState((s) => formatSize(getPageSize(s.doc, s.activePageId), s.doc.unit))
  const locked = useEditorState((s) => s.readOnly)
  const cannotRename = useCollabState((s) => !s.canRename) === true
  const readOnly = locked || cannotRename
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? title
  const commit = (next: string): void => {
    setDraft(null)
    editor.setTitle(next)
    onTitle(editor.state.title)
  }
  return (
    <div className={`${styles.titleBox} ${readOnly ? styles.titleLocked : ''}`}>
      <span className={styles.titleSizer} data-value={value || t.untitled}>
        <input
          className={styles.title}
          value={value}
          placeholder={t.untitled}
          readOnly={readOnly}
          size={1}
          aria-label={t.topbar.title}
          title={readOnly ? undefined : t.topbar.title}
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
      </span>
      {showSize ? (
        <span className={styles.titleSize} data-testid="ed-topbar-size">
          {t.topbar.titleSize(size)}
        </span>
      ) : null}
    </div>
  )
}

/** Un botón de herramienta (ícono sobre rótulo) de la tira compacta; registra su ancla para el cajón. */
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

/**
 * Las herramientas para agregar en pantallas chicas (<1024 px), como la barra de abajo de Canva en el teléfono:
 * cada una abre su hoja inferior (`DrawerHost` → `Sheet`). En escritorio no se dibuja: ahí está el riel.
 */
export function CompactTools() {
  const compact = useEditorState((s) => s.ui.compact)
  const readOnly = useEditorState((s) => s.readOnly)
  const visible = useVisiblePanels()
  const { openId, toggle } = useOpenTool()
  const all = visible.filter((p) => p.slot !== 'end' && (!readOnly || p.readOnly))
  // Las mismas pestañas del riel (`rail`); si ningún panel las marca todavía, todas las herramientas.
  const rail = all.filter((p) => p.rail)
  const tools = rail.length > 0 ? rail : all
  if (!compact || tools.length === 0) return null
  return (
    <Toolbar label={t.chrome.tools} className={styles.compactTools}>
      {tools.map((p) => (
        <ToolEntry key={p.id} panel={p} open={openId === p.id} onToggle={() => toggle(p.id)} />
      ))}
    </Toolbar>
  )
}

/** Una herramienta que vive como botón de ícono a la derecha de la barra (Comentarios). */
function EndTool({ panel, open, onToggle }: { panel: PanelDefinition; open: boolean; onToggle: () => void }) {
  const chrome = useChrome()
  const ref = useCallback((el: HTMLButtonElement | null) => chrome.setAnchor(panel.id, el), [chrome, panel.id])
  return (
    <Tooltip label={panel.label}>
      <button ref={ref} type="button" className={`${styles.hbtn} ${styles.square} ${styles.outlined}`} aria-label={panel.label} aria-pressed={open} data-testid={`ed-end-${panel.id}`} onPointerEnter={panel.preload} onFocus={panel.preload} onClick={onToggle}>
        {panel.icon}
      </button>
    </Tooltip>
  )
}

/** «Archivo»: lo que antes estaba en el «Más» de Doory, ordenado como el menú Archivo de Canva (§9.3). */
function FileMenu({ items }: { items: BarMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={anchor} type="button" className={styles.hbtn} aria-haspopup="menu" aria-expanded={open} data-testid="ed-file" onClick={() => setOpen((o) => !o)}>
        {t.topbar.file}
      </button>
      {open ? <BarMenu label={t.topbar.file} items={items} anchorRef={anchor} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/** «Presentar»: pantalla completa o vista de presentador (§9.8). */
function PresentMenu({ items, iconOnly }: { items: BarMenuItem[]; iconOnly: boolean }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const button = (
    <button
      ref={anchor}
      type="button"
      className={`${styles.hbtn} ${styles.outlined} ${iconOnly ? styles.square : ''}`}
      aria-label={iconOnly ? t.topbar.present : undefined}
      aria-haspopup="menu"
      aria-expanded={open}
      data-testid="ed-present"
      onPointerEnter={() => preloadDialog('presenter')}
      onClick={() => setOpen((o) => !o)}
    >
      <Presentation size={18} aria-hidden="true" />
      {iconOnly ? null : <span>{t.topbar.present}</span>}
    </button>
  )
  return (
    <>
      {iconOnly ? (
        <Tooltip label={t.topbar.present} disabled={open}>
          {button}
        </Tooltip>
      ) : (
        button
      )}
      {open ? <BarMenu label={t.topbar.present} items={items} anchorRef={anchor} align="end" onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/**
 * «Compartir»: el botón claro sobre el degradado. Abre la descarga (el «Compartir → Descargar» de Canva, §9.1):
 * el panel completo, los formatos rápidos de Doory y, si el adaptador comparte, invitar personas.
 */
function ShareMenu({ iconOnly }: { iconOnly: boolean }) {
  const editor = useEditor()
  const mode = useEditorState((s) => s.mode)
  const readOnly = useEditorState((s) => s.readOnly)
  const formats = useSyncExternalStore(exportFormats.subscribe, exportFormats.getSnapshot)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Sin `disabled` mientras abre: un botón deshabilitado pierde el foco, y el diálogo se lo devuelve a quien lo abrió.
  const sharing = useRef(false)
  const anchor = useRef<HTMLButtonElement>(null)

  const quick = async (format: ExportFormat): Promise<void> => {
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
  }

  const canShare = !readOnly && (mode === 'guest' || !!editor.adapter.services.sharing)
  const quickFormats = formats.filter((f) => ['jpg', 'png', 'pdf', 'svg'].includes(f.id) && (!f.available || f.available(editor)))
  const items: BarMenuItem[] = [
    { id: 'download', label: t.topbar.download, icon: <Download size={18} aria-hidden="true" />, primary: true, onSelect: () => editor.openDialog('download') },
    { id: 'sep-quick', separator: true },
    ...quickFormats.map((f): BarMenuItem => ({ id: `quick-${f.id}`, label: f.label, hint: t.topbar.formatHint[f.id as 'jpg'], onSelect: () => void quick(f) })),
    { id: 'video', label: t.topbar.videoDownload, hint: t.topbar.videoDownloadHint, onSelect: () => editor.openDialog('download', { format: 'mp4' }) },
    ...(canShare
      ? [
          { id: 'sep-share', separator: true },
          {
            id: 'share',
            label: t.topbar.shareWithPeople,
            icon: <Users size={18} aria-hidden="true" />,
            onSelect: () => {
              if (sharing.current) return
              sharing.current = true
              void openAccountDialog(editor, 'share', 'share', (x) => !!x.adapter.services.sharing, t.share.unavailable).finally(() => {
                sharing.current = false
              })
            },
          },
        ]
      : []),
  ]

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`${styles.share} ${iconOnly ? styles.shareIcon : ''}`}
        aria-label={iconOnly ? t.topbar.share : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={busy || undefined}
        data-testid="ed-share"
        onPointerEnter={() => preloadDialog('download')}
        onFocus={() => preloadDialog('download')}
        onClick={() => setOpen((o) => !o)}
      >
        <Share size={18} aria-hidden="true" />
        {iconOnly ? null : <span>{busy ? t.dialog.downloadWorking : t.topbar.share}</span>}
      </button>
      {open ? <BarMenu label={t.topbar.share} heading={t.topbar.shareTitle} items={items} anchorRef={anchor} align="end" width={320} onClose={() => setOpen(false)} /> : null}
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
  // Suscripta al registro: «Crear un diseño nuevo» lo registra la cáscara (PantallaEditor) al montar.
  useSyncExternalStore(commands.subscribe, commands.getSnapshot)
  const visible = useVisiblePanels()
  const { openId, toggle } = useOpenTool()
  const barRef = useRef<HTMLElement>(null)
  const barWidth = useWidth(barRef)
  const size = sizeFor(barWidth)
  const narrow = size === 'narrow' || size === 'tiny'
  const tiny = size === 'tiny'

  const endTools = visible.filter((p) => p.slot === 'end' && (!readOnly || p.readOnly))

  const cmd = (id: string, over?: Partial<BarMenuItem>): BarMenuItem[] => {
    const c: Command | undefined = commands.get(id)
    if (!c) return []
    return [
      {
        id,
        label: c.label,
        shortcut: c.shortcut,
        icon: c.icon,
        disabled: !isCommandEnabled(c, { editor, state: editor.state }),
        onSelect: () => void c.run(editor),
        ...over,
      },
    ]
  }
  const presentItems: BarMenuItem[] = [
    ...cmd('file.present', { label: t.topbar.presentFullscreen, icon: <Maximize size={18} aria-hidden="true" />, onSelect: onPresent }),
    ...cmd('file.presentNotes', { label: t.topbar.presentWithNotes, icon: <MonitorPlay size={18} aria-hidden="true" /> }),
  ]
  const viewItems: BarMenuItem[] = [
    ...cmd('view.notes', { label: t.topbar.notes, icon: undefined, checked: notesOpen }),
    ...cmd('view.timeline', { label: t.topbar.timeline, icon: undefined, checked: timelineOpen }),
    ...cmd('view.playPage', { label: t.topbar.playPage, icon: <Play size={18} aria-hidden="true" /> }),
  ]
  const settingsItems: BarMenuItem[] = [
    { id: 'rulers', label: t.menu.rulers, shortcut: commands.get('view.rulers')?.shortcut, checked: ui.rulers, onSelect: () => editor.patchUi({ rulers: !editor.state.ui.rulers }) },
    { id: 'grid', label: t.menu.grid, shortcut: commands.get('view.grid')?.shortcut, checked: ui.grid, onSelect: () => editor.patchUi({ grid: !editor.state.ui.grid }) },
    { id: 'guides', label: t.menu.guides, checked: ui.guides, onSelect: () => editor.patchUi({ guides: !editor.state.ui.guides }) },
    { id: 'snap', label: t.menu.snapping, checked: ui.snapping, onSelect: () => editor.patchUi({ snapping: !editor.state.ui.snapping }) },
    { id: 'bleed', label: t.menu.bleed, checked: ui.bleed, onSelect: () => editor.patchUi({ bleed: !editor.state.ui.bleed }) },
    ...(guideCount > 0 ? [{ id: 'sep-guides', separator: true }, { id: 'clear-guides', label: t.design.clearGuides(guideCount), onSelect: () => editor.pages.setGuides(editor.state.activePageId, []) }] : []),
  ]
  const notesDownload: BarMenuItem = {
    id: 'notes-download',
    label: t.topbar.downloadNotes,
    icon: <FileText size={18} aria-hidden="true" />,
    submenu: [...cmd('file.notesMarkdown', { icon: undefined }), ...cmd('file.notesText', { icon: undefined })],
  }
  // Lo que no entra en la barra angosta baja a Archivo: nada deja de estar alcanzable.
  const movedItems: BarMenuItem[] = [
    ...(tiny ? presentItems.map((i) => ({ ...i, id: `moved-${i.id}`, label: i.id === 'file.present' ? t.topbar.present : i.label })) : []),
    ...(narrow ? endTools.map((p): BarMenuItem => ({ id: `tool-${p.id}`, label: p.label, icon: p.icon, onSelect: () => toggle(p.id) })) : []),
  ]
  const fileList: BarMenuItem[] = [
    ...cmd('file.new', { icon: <FilePlus size={18} aria-hidden="true" /> }),
    { id: 'sep-new', separator: true },
    ...(readOnly ? [] : [{ id: 'settings', label: t.topbar.settings, icon: <Settings size={18} aria-hidden="true" />, submenu: settingsItems }]),
    { id: 'view', label: t.topbar.view, icon: <Eye size={18} aria-hidden="true" />, submenu: viewItems },
    { id: 'sep-design', separator: true },
    ...(readOnly
      ? []
      : [
          ...(narrow ? cmd('file.resize', { label: t.topbar.resize, icon: <Scaling size={18} aria-hidden="true" /> }) : []),
          ...cmd('page.add', { label: t.menu.newPage, icon: <SquarePlus size={18} aria-hidden="true" /> }),
          ...cmd('file.rename', { label: t.topbar.rename, icon: <PencilLine size={18} aria-hidden="true" /> }),
          ...cmd('file.save', { label: t.topbar.save, icon: <Save size={18} aria-hidden="true" /> }),
          ...(editor.adapter.services.versions ? cmd('file.history', { label: t.topbar.versionHistory, icon: <History size={18} aria-hidden="true" /> }) : []),
          ...cmd('file.reset', { icon: <RotateCcw size={18} aria-hidden="true" /> }),
          { id: 'sep-download', separator: true },
        ]),
    ...cmd('file.download', { label: t.topbar.download, icon: <Download size={18} aria-hidden="true" /> }),
    notesDownload,
    { id: 'sep-end', separator: true },
    ...movedItems,
    ...cmd('file.shortcuts', { label: t.topbar.shortcuts, icon: <Keyboard size={18} aria-hidden="true" /> }),
  ]
  // Sin separadores al principio ni dos seguidos (los grupos que no aplican quedan vacíos).
  const fileItems = fileList.filter((item, i, all) => !item.separator || (i > 0 && !all[i - 1].separator))

  // Al pasar a solo lectura se cierra la herramienta abierta.
  useEffect(() => {
    if (readOnly) editor.patchUi({ panelId: null })
  }, [readOnly, editor])

  return (
    <header ref={barRef} className={styles.bar} data-testid="ed-topbar" data-size={size}>
      <div className={styles.left}>
        {start ? <div className={styles.start}>{start}</div> : null}
        <FileMenu items={fileItems} />
        {readOnly || narrow ? null : (
          <button type="button" className={styles.hbtn} data-testid="ed-resize" onPointerEnter={() => preloadDialog('resize')} onClick={() => editor.openDialog('resize')}>
            {t.topbar.resize}
          </button>
        )}
        {readOnly ? null : (
          <>
            <span className={styles.sep} aria-hidden="true" />
            <Tooltip label={history.undoLabel ? `${t.topbar.undo} ${history.undoLabel.toLowerCase()}` : t.topbar.undo} shortcut="Mod+Z" disabled={!history.canUndo}>
              <button type="button" className={`${styles.hbtn} ${styles.square}`} aria-label={t.topbar.undo} disabled={!history.canUndo} data-testid="ed-undo" onClick={() => void editor.undo()}>
                <Undo2 size={20} aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip label={history.redoLabel ? `${t.topbar.redo} ${history.redoLabel.toLowerCase()}` : t.topbar.redo} shortcut="Mod+Shift+Z" disabled={!history.canRedo}>
              <button type="button" className={`${styles.hbtn} ${styles.square}`} aria-label={t.topbar.redo} disabled={!history.canRedo} data-testid="ed-redo" onClick={() => void editor.redo()}>
                <Redo2 size={20} aria-hidden="true" />
              </button>
            </Tooltip>
            <span className={styles.sep} aria-hidden="true" />
          </>
        )}
        <SaveStatus />
      </div>

      <div className={styles.right}>
        {tiny ? null : <TitleField onTitle={onTitle} showSize={size === 'wide'} />}
        <div className={styles.presence}>
          <PresenceStack />
        </div>
        {narrow ? null : endTools.map((p) => <EndTool key={p.id} panel={p} open={openId === p.id} onToggle={() => toggle(p.id)} />)}
        {tiny ? null : <PresentMenu items={presentItems} iconOnly={size !== 'wide'} />}
        <ShareMenu iconOnly={tiny} />
        {end ? <div className={styles.end}>{end}</div> : null}
      </div>
    </header>
  )
}
