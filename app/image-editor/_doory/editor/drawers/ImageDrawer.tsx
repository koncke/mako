import { CloudUpload, Trash2 } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'
import type { AssetRef } from '@/app/image-editor/_doory/types/adapter'
import type { Asset, StockPhoto } from '@/app/image-editor/_doory/types/api'
import { I } from '../chrome/icons'
import { useEditor, useEditorState, useEditorStateShallow } from '../context'
import { imageFilesFrom } from '../engine/files'
import { useAsyncList } from '../hooks/useAsyncList'
import { useDebounced } from '../hooks/useDebounced'
import { useResolvedSrc } from '../hooks/useResolvedSrc'
import type { PanelProps } from '../panels/registry'
import { t } from '../strings'
import { Skeleton } from '../ui/Skeleton'
import styles from './Drawers.module.css'
import { uploadToLibrary } from './uploads'
import { useInsertDone } from './useInsertDone'

function toRef(a: Asset): AssetRef {
  return { id: a.id, url: a.url, thumbUrl: a.thumb_url, width: a.width, height: a.height, name: a.name, kind: a.kind }
}

/** Una imagen subida: miniatura cuadrada (clic = agregarla al diseño) y el tacho al pasar el mouse, como en Canva. */
function Thumb({ asset, onPlace, onDelete }: { asset: AssetRef; onPlace: () => void; onDelete?: () => void }) {
  const url = useResolvedSrc(asset.thumbUrl || asset.url)
  return (
    <div className={styles.upItem}>
      <button type="button" className={styles.upThumb} title={asset.name} aria-label={asset.name} data-testid="uploaded-thumb" onClick={onPlace}>
        {url ? <img src={url} alt="" draggable={false} /> : <Skeleton width="100%" height="100%" radius={8} />}
      </button>
      {onDelete ? (
        <button type="button" className={styles.upDelete} aria-label={t.imageDrawer.remove(asset.name)} title={t.imageDrawer.remove(asset.name)} onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

/** «Subidos»: el botón violeta «Subir archivos» (también se sueltan archivos encima) y la grilla de lo subido. */
function UploadsTab({ close }: PanelProps) {
  const editor = useEditor()
  const done = useInsertDone(close)
  const session = useEditorStateShallow((s) => s.uploads)
  const uploading = useEditorState((s) => s.uploading)
  const library = useAsyncList<Asset>((page) => editor.adapter.services.assets.list({ page, page_size: 20 }), 'library')
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [over, setOver] = useState(false)
  const [failed, setFailed] = useState(false)

  const sessionIds = new Set(session.map((u) => u.id))
  const images: AssetRef[] = [...session, ...library.items.filter((a) => !sessionIds.has(a.id)).map(toRef)].filter((a) => !removed.has(a.id))

  const place = (asset: AssetRef): void => {
    void editor.insert.imageFromAsset(asset)
    done()
  }
  const remove = async (asset: AssetRef): Promise<void> => {
    setFailed(false)
    try {
      await editor.adapter.services.assets.remove(asset.id)
      setRemoved((cur) => new Set(cur).add(asset.id))
      editor.toast(t.imageDrawer.removed, 'info')
    } catch {
      setFailed(true)
    }
  }
  const onDrop = (e: React.DragEvent): void => {
    setOver(false)
    const files = imageFilesFrom(e.dataTransfer)
    if (files.length === 0) return
    e.preventDefault()
    void uploadToLibrary(editor, files)
  }

  return (
    <>
      <div
        className={styles.drop}
        data-testid="upload-zone"
        data-over={over || undefined}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <button type="button" className={styles.cta} data-testid="upload-files" onClick={() => void editor.insert.pickAndUpload()}>
          <CloudUpload size={18} aria-hidden="true" />
          {t.drawers.uploadFiles}
        </button>
        <p className={styles.dropHint}>{t.imageDrawer.dropHere}</p>
      </div>
      {uploading > 0 ? (
        <div className={styles.status} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          {t.imageDrawer.uploading(uploading)}
        </div>
      ) : null}
      {failed ? (
        <p className={styles.error} role="alert">
          {t.imageDrawer.removeFailed}
        </p>
      ) : null}
      {images.length > 0 ? (
        <>
          <p className={styles.sectionTitle}>{t.drawers.yourImages}</p>
          <div className={styles.uploads}>
            {images.map((img) => (
              <Thumb key={img.id} asset={img} onPlace={() => place(img)} onDelete={library.items.some((a) => a.id === img.id) || sessionIds.has(img.id) ? () => void remove(img) : undefined} />
            ))}
          </div>
        </>
      ) : null}
      {library.error && images.length === 0 ? (
        <p className={styles.error} role="alert">
          {t.imageDrawer.libraryFailed}
        </p>
      ) : null}
      {library.hasMore && library.items.length > 0 ? (
        <button type="button" className={styles.more} onClick={library.loadMore} disabled={library.loading}>
          {t.imageDrawer.loadMore}
        </button>
      ) : null}
      {!library.loading && !library.error && images.length === 0 ? <p className={styles.note}>{t.imageDrawer.noImages}</p> : null}
    </>
  )
}

/** Stock tab: search free photos, add one (the server imports it with its attribution). */
function StockTab({ close }: PanelProps) {
  const editor = useEditor()
  const done = useInsertDone(close)
  const stock = editor.adapter.services.stock
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 300)
  const [importing, setImporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const photos = useAsyncList<StockPhoto>(
    async (page) => {
      if (!stock) throw new Error(t.imageDrawer.stockOff)
      const res = await stock.search(q || 'nature', page)
      return { count: res.total, next: res.next_page === null ? null : String(res.next_page), previous: null, results: res.results }
    },
    q,
    stock !== null,
  )
  const searchId = useId()
  const observer = useRef<IntersectionObserver | null>(null)
  const { loadMore } = photos
  const canLoadMore = photos.hasMore && !photos.loading && !photos.error && photos.items.length > 0
  const sentinel = useCallback(
    (el: HTMLDivElement | null) => {
      observer.current?.disconnect()
      observer.current = null
      if (!el || !canLoadMore || typeof IntersectionObserver === 'undefined') return
      observer.current = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      }, { rootMargin: '200px' })
      observer.current.observe(el)
    },
    [canLoadMore, loadMore],
  )

  const add = async (photo: StockPhoto): Promise<void> => {
    if (!stock) return
    setImporting(photo.id)
    setError(null)
    try {
      const ref = await stock.importPhoto(photo)
      await editor.insert.imageFromAsset(ref)
      done()
    } catch {
      setError(t.imageDrawer.importFailed)
    } finally {
      setImporting(null)
    }
  }

  return (
    <>
      <label className={styles.search} htmlFor={searchId}>
        {I.search}
        <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.imageDrawer.searchStock} aria-label={t.imageDrawer.searchStock} data-testid="stock-search" />
      </label>
      {photos.loading && photos.items.length === 0 ? (
        <div className={styles.photos} aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height="auto" radius={8} style={{ aspectRatio: '4 / 3' }} />
          ))}
        </div>
      ) : null}
      <div className={styles.photos}>
        {photos.items.map((p) => (
          <button key={p.id} type="button" className={styles.photo} data-testid="stock-photo" aria-label={t.imageDrawer.addPhoto(p.author)} disabled={importing !== null} onClick={() => void add(p)}>
            <img src={p.thumb_url} alt="" loading="lazy" draggable={false} />
            <span className={styles.credit}>{t.imageDrawer.photoBy(p.author)}</span>
          </button>
        ))}
      </div>
      {importing ? (
        <div className={styles.status} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          {t.imageDrawer.importing}
        </div>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {photos.error ? (
        <p className={styles.error} role="alert">
          {t.imageDrawer.stockFailed}
        </p>
      ) : null}
      {!photos.loading && !photos.error && photos.items.length === 0 ? <p className={styles.note}>{t.imageDrawer.stockEmpty}</p> : null}
      <div ref={sentinel} style={{ height: 1 }} />
    </>
  )
}

/** El panel «Subidos»: lo que subiste y, si el servidor las ofrece, una pestaña de fotos de stock. */
export function ImageDrawer(props: PanelProps) {
  const editor = useEditor()
  const hasStock = editor.adapter.services.stock !== null
  const [tab, setTab] = useState<'uploads' | 'stock'>('uploads')
  return (
    <>
      {hasStock ? (
        <div className={styles.tabs} role="tablist" aria-label={t.imageDrawer.tabs}>
          <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'uploads'} data-testid="image-tab-uploads" onClick={() => setTab('uploads')}>
            {t.imageDrawer.uploads}
          </button>
          <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'stock'} data-testid="image-tab-stock" onClick={() => setTab('stock')}>
            {t.imageDrawer.stock}
          </button>
        </div>
      ) : null}
      {tab === 'uploads' || !hasStock ? <UploadsTab {...props} /> : <StockTab {...props} />}
    </>
  )
}
