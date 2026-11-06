import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { EditorAppProps, EditorHandle } from '@/app/image-editor/_doory/types/adapter'
import './builtins/commands'
import './builtins/audio'
import './builtins/panels'
import './builtins/toolbar'
import './animation/commands'
import './presenter/commands'
import './panels/commentsCommands'
import './engine/export/formats'
import { ConflictBanner } from './ConflictBanner'
import { MissingFontsNotice } from './fonts/MissingFontsNotice'
import { ContextMenuHost } from './ContextMenuHost'
import { DialogHost } from './dialogs/DialogHost'
import { AudioSyncHost } from './panels/AudioSyncHost'
import { BrandSync } from './panels/BrandSync'
import { NotesHost } from './panels/NotesBar'
import { useEditorState } from './context'
import { EditorProvider } from './EditorProvider'
import { EditorEngine } from './engine/editor'
import { useClipboardEvents, useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useLatest } from './hooks/useLatest'
import { ChromeProvider } from './chrome/ChromeContext'
import { DrawerHost, SidebarHost } from './chrome/ToolHost'
import { RielCanva } from './chrome/RielCanva'
import { ContextualToolbar } from './toolbar/ContextualToolbar'
import { CompactTools, TopBar } from './TopBar'
import { t } from './strings'
import { Toaster } from './ui/Toaster'
import { PageStrip } from './workspace/PageStrip'
import { LazyTimelineHost } from './workspace/TimelineLoader'
import { Workspace } from './workspace/Workspace'
import styles from './EditorApp.module.css'

function LiveRegion() {
  const message = useEditorState((s) => s.announcement)
  return (
    <div className={styles.live} role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}

/**
 * The Doory editor. Mount it with a document, meta and an `EditorAdapter`; everything else (canvas, tools,
 * panels, history, export, autosave triggering) lives inside.
 */
export const EditorApp = forwardRef<EditorHandle, EditorAppProps>(function EditorApp(props, ref) {
  const { document: doc, meta, adapter, onTitleChange, onSaveStateChange, onConflictResolve, topBarStart, topBarEnd, dentro } = props
  const [engine] = useState(() => new EditorEngine({ adapter, document: doc, meta }))
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [stripOpen, setStripOpen] = useState(false)
  const latest = useLatest({ onTitleChange, onSaveStateChange })

  useImperativeHandle(
    ref,
    () => ({
      saveNow: () => engine.persistence.saveNow(),
      getDocument: () => engine.getDocument(),
      isDirty: () => engine.persistence.isDirty(),
    }),
    [engine],
  )

  // Lifecycle: start/stop are re-entrant so StrictMode's mount → unmount → mount is harmless; the final
  // teardown only runs if nobody restarted the engine on the next tick.
  useEffect(() => {
    engine.start()
    engine.persistence.start({ onSaveStateChange: (s) => latest.current.onSaveStateChange?.(s) })
    return () => {
      engine.stop()
      setTimeout(() => {
        if (!engine.isRunning) engine.dispose()
      }, 0)
    }
  }, [engine, latest])

  useEffect(() => {
    engine.setAdapter(adapter)
  }, [engine, adapter])

  useEffect(() => {
    engine.setMode(meta.mode)
  }, [engine, meta.mode])

  useEffect(() => {
    engine.setTitle(meta.title)
  }, [engine, meta.title])

  useEffect(() => {
    engine.setDesignId(meta.id)
  }, [engine, meta.id])

  // A different design under the same mounted editor: replace the document.
  const firstId = useRef(meta.id)
  useEffect(() => {
    if (firstId.current === meta.id) return
    firstId.current = meta.id
    void engine.loadDocument(doc)
  }, [engine, meta.id, doc])

  // Responsive breakpoint: drawers and sidebars become bottom sheets below 1024px. Como en Canva, en escritorio el
  // editor abre con el panel «Diseño» a la vista; en pantallas chicas (hoja inferior) y en sólo lectura, cerrado.
  // Un panel recordado de otra sesión no se reabre.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const apply = (): void => engine.patchUi({ compact: mq.matches })
    engine.patchUi({ compact: mq.matches, panelId: mq.matches || engine.state.readOnly ? null : 'design' })
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [engine])

  useKeyboardShortcuts(engine, rootRef)
  useClipboardEvents(engine, rootRef)

  const setRootEl = useCallback((el: HTMLDivElement | null) => {
    rootRef.current = el
    setRoot(el)
  }, [])

  const onTitle = (title: string): void => latest.current.onTitleChange?.(title)

  return (
    <div ref={setRootEl} className={styles.root} data-editor-root aria-label={t.appLabel} role="application">
      <EditorProvider engine={engine} portalRoot={root}>
        <ChromeProvider>
          {/*
            El armazón de Canva 2025–26 (docs/editor-imagen/relevamiento-canva-armazon.md §1), con los colores de MaKo:
            arriba la barra; abajo, en fila sobre el cromo, el riel (72 px), el panel lateral como tarjeta
            flotante y el área del lienzo. La barra del objeto va ADENTRO del área, arriba, para flotar sobre el
            lienzo. Debajo de 1024 px el riel no está: las herramientas van en la tira de abajo (CompactTools) y
            abren como hoja inferior (DrawerHost).
          */}
          <TopBar start={topBarStart} end={topBarEnd} onTitle={onTitle} onPresent={() => engine.openDialog('presenter')} />
          <ConflictBanner onResolve={onConflictResolve} />
          <MissingFontsNotice />
          <div className={styles.body}>
            <RielCanva />
            <SidebarHost />
            <div className={styles.main}>
              <ContextualToolbar />
              <Workspace stripOpen={stripOpen} onToggleStrip={() => setStripOpen((o) => !o)} />
              <NotesHost />
              <LazyTimelineHost />
              {stripOpen ? <PageStrip /> : null}
            </div>
          </div>
          <CompactTools />
          <DrawerHost />
        </ChromeProvider>
        <DialogHost onTitle={onTitle} />
        <BrandSync />
        <AudioSyncHost />
        <ContextMenuHost />
        <Toaster />
        <LiveRegion />
        {dentro}
      </EditorProvider>
    </div>
  )
})
