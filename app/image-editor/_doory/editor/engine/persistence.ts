/**
 * Autosave and save state. The engine never knows *where* a design goes — it calls `adapter.save`:
 *
 *  - debounced ~1.5 s after the last change;
 *  - immediately when the page is hidden or about to unload while dirty;
 *  - never two saves at once: edits made during a save in flight queue exactly one follow-up save of the
 *    latest state, so nothing is lost;
 *  - `RevisionConflictError` (by `name`) → `conflict` state + callbacks (the shell decides what to do).
 */
import type { SaveState } from '@/app/image-editor/_doory/types/adapter'
import type { DoryDocument } from '@/app/image-editor/_doory/types/document'
import type { EditorEngine } from './editor'
import { renderPageToCanvas, canvasToBlob } from './render'
import { pageSize } from './docOps'
import { assertSaveable } from './assets'

export const AUTOSAVE_DELAY_MS = 1500
export const THUMBNAIL_WIDTH = 480

export function isRevisionConflict(err: unknown): boolean {
  return err instanceof Error && err.name === 'RevisionConflictError'
}

export interface PersistenceCallbacks {
  onSaveStateChange?: (state: SaveState) => void
  onConflict?: () => void
}

export class PersistenceController {
  private timer: ReturnType<typeof setTimeout> | null = null
  private saving: Promise<void> | null = null
  private again = false
  private lastSavedDoc: DoryDocument
  private lastSavedTitle: string
  private thumbnailPage: unknown = null
  private callbacks: PersistenceCallbacks = {}
  private disposers: (() => void)[] = []
  private disposed = false

  constructor(private readonly engine: EditorEngine) {
    this.lastSavedDoc = engine.state.doc
    this.lastSavedTitle = engine.state.title
  }

  /** Starts listening for changes and page lifecycle events. */
  start(callbacks: PersistenceCallbacks): void {
    this.disposed = false
    this.callbacks = callbacks
    if (this.engine.readOnly) return
    const unsub = this.engine.store.subscribe((state, prev) => {
      if (state.doc !== prev.doc || state.title !== prev.title) this.onChange()
    })
    this.disposers.push(unsub)
    const flush = (): void => {
      if (this.isDirty()) void this.flush()
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    this.disposers.push(() => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    })
  }

  /** The design as the server last stored it through this controller (as it was opened until the first save). */
  get savedDocument(): DoryDocument {
    return this.lastSavedDoc
  }

  isDirty(): boolean {
    const s = this.engine.state
    return s.doc !== this.lastSavedDoc || s.title !== this.lastSavedTitle
  }

  /** A title that came from the server is the saved one; it must not be sent back. */
  adoptTitle(title: string): void {
    this.lastSavedTitle = title
  }

  private setState(state: SaveState): void {
    this.engine.store.setState({ save: state, conflict: state.status === 'conflict' })
    this.callbacks.onSaveStateChange?.(state)
  }

  private onChange(): void {
    if (this.disposed || this.engine.readOnly) return
    if (this.engine.state.save.status === 'conflict') return
    if (!this.saving) this.setState({ status: 'dirty' })
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_DELAY_MS)
  }

  /** Saves immediately (also the manual "retry" / Ctrl+S path). Resolves when the latest state is saved. */
  async saveNow(): Promise<void> {
    if (this.engine.readOnly) return
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.engine.state.save.status === 'conflict') this.engine.store.setState({ conflict: false })
    await this.flush(true)
  }

  private async flush(force = false): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.saving) {
      this.again = true
      await this.saving
      return
    }
    if (!force && !this.isDirty()) return
    if (!force && this.engine.state.save.status === 'conflict') return
    const run = this.perform().finally(() => {
      this.saving = null
    })
    this.saving = run
    await run
    if (this.again && !this.disposed) {
      this.again = false
      if (this.isDirty() && this.engine.state.save.status !== 'conflict' && this.engine.state.save.status !== 'error') await this.flush()
    }
  }

  private async perform(): Promise<void> {
    const engine = this.engine
    const snapshotDoc = engine.state.doc
    const snapshotTitle = engine.state.title
    this.setState({ status: 'saving' })
    try {
      const document = await engine.assets.persistInline(snapshotDoc)
      assertSaveable(document)
      const thumbnail = await this.thumbnail(snapshotDoc)
      const result = await engine.adapter.save({ document, title: snapshotTitle, thumbnail })
      this.lastSavedDoc = snapshotDoc
      this.lastSavedTitle = snapshotTitle
      if (thumbnail || this.thumbnailPage === null) this.thumbnailPage = snapshotDoc.pages[0]
      const stillDirty = this.isDirty()
      this.setState(
        stillDirty
          ? { status: 'dirty' }
          : this.engine.state.mode === 'guest'
            ? { status: 'local', savedAt: result.savedAt }
            : { status: 'saved', savedAt: result.savedAt },
      )
      if (stillDirty) this.onChange()
    } catch (err) {
      if (isRevisionConflict(err)) {
        this.setState({ status: 'conflict' })
        this.callbacks.onConflict?.()
      } else {
        this.setState({ status: 'error', message: err instanceof Error ? err.message : 'No se pudo guardar el diseño.' })
      }
    }
  }

  /** First-page thumbnail (~480 px WebP/PNG). Skipped when page 1 has not changed since the last one. */
  private async thumbnail(doc: DoryDocument): Promise<Blob | undefined> {
    const first = doc.pages[0]
    if (this.thumbnailPage === first) return undefined
    try {
      const size = pageSize(doc, first)
      const canvas = await renderPageToCanvas(first, size, this.engine.loadContext, { multiplier: Math.min(1, THUMBNAIL_WIDTH / size.width) })
      return await canvasToBlob(canvas, 'image/webp', 0.85)
    } catch {
      return undefined
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.timer) clearTimeout(this.timer)
    for (const off of this.disposers) off()
    this.disposers = []
  }
}
