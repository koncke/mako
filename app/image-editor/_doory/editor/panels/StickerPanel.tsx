import { useMemo, useState } from 'react'
import type { ElementItem, ElementKind, ElementPack } from '@/app/image-editor/_doory/types/api'
import { useEditor } from '../context'
import { useAsyncList } from '../hooks/useAsyncList'
import { useDebounced } from '../hooks/useDebounced'
import { t } from '../strings'
import { Skeleton } from '../ui/Skeleton'
import ed from '../chrome/ed.module.css'
import { useSentinel } from '../hooks/useSentinel'
import { type CategoryEntry, CategoryMenu, LibrarySearch } from './library'
import styles from './Sticker.module.css'

type Filter = { type: 'all' } | { type: 'kind'; kind: ElementKind } | { type: 'pack'; pack: ElementPack }

const KINDS: ElementKind[] = ['icon', 'sticker', 'illustration', 'graphic', 'frame', 'shape', 'line']

function filterKey(f: Filter): string {
  return f.type === 'all' ? 'all' : f.type === 'kind' ? `k:${f.kind}` : `p:${f.pack.slug}`
}

interface StickerPanelProps {
  /** La búsqueda viene de afuera (el buscador «Buscar elementos» del panel Elementos): no dibuja la suya. */
  query?: string
  /** Vista previa de una sección de «Elementos»: sólo los primeros `preview`, en una fila, sin categorías. */
  preview?: number
  /** Dentro de otra lista (resultados de «Buscar elementos»): sin categorías ni scroll propio; sigue cargando al bajar. */
  embedded?: boolean
  /** Después de agregar uno (en la hoja inferior cierra el panel). */
  done?: () => void
}

/** «Gráficos» (la biblioteca de elementos del catálogo): búsqueda, categorías y una grilla sin fin. */
export function StickerPanel({ query: external, preview, embedded, done }: StickerPanelProps = {}) {
  const editor = useEditor()
  const [own, setOwn] = useState('')
  const [filter, setFilter] = useState<Filter>({ type: 'all' })
  const q = useDebounced((external ?? own).trim(), 250)
  const paging = preview === undefined
  const showFilters = paging && !embedded

  const packs = useAsyncList<ElementPack>(() => editor.adapter.services.elements.packs().then((p) => ({ count: p.length, next: null, previous: null, results: p })), 'packs', showFilters)
  const list = useAsyncList<ElementItem>(
    (page) =>
      editor.adapter.services.elements.list({
        q: q || undefined,
        kind: filter.type === 'kind' ? filter.kind : undefined,
        pack: filter.type === 'pack' ? filter.pack.slug : undefined,
        page,
        page_size: preview ?? 36,
      }),
    `${q}|${filterKey(filter)}|${preview ?? 'all'}`,
  )

  const { loadMore } = list
  const sentinel = useSentinel(paging && list.hasMore && !list.loading && !list.error && list.items.length > 0, loadMore)

  const label = filter.type === 'all' ? t.stickers.all : filter.type === 'kind' ? t.stickers.kinds[filter.kind] : filter.pack.name
  const filters = useMemo(() => {
    const byId = new Map<string, Filter>([['all', { type: 'all' }]])
    const entries: CategoryEntry[] = [{ kind: 'option', id: 'all', label: t.stickers.all }]
    // Los tipos salen de los packs del catálogo: un tipo sin pack (en MaKo: ilustración, marco, forma, línea; las
    // formas y líneas las dibuja «Líneas y formas») daría una lista vacía.
    const kinds = KINDS.filter((k) => packs.items.some((p) => p.kind === k))
    if (kinds.length > 1) entries.push({ kind: 'group', id: 'g-type', label: t.stickers.byType })
    for (const k of kinds.length > 1 ? kinds : []) {
      byId.set(`k:${k}`, { type: 'kind', kind: k })
      entries.push({ kind: 'option', id: `k:${k}`, label: t.stickers.kinds[k] })
    }
    if (packs.items.length > 0) entries.push({ kind: 'group', id: 'g-pack', label: t.stickers.byPack })
    for (const p of packs.items) {
      byId.set(`p:${p.slug}`, { type: 'pack', pack: p })
      entries.push({ kind: 'option', id: `p:${p.slug}`, label: p.name, count: p.element_count })
    }
    return { byId, entries }
  }, [packs.items])

  const add = (item: ElementItem): void => {
    void editor.insert.element(item)
    done?.()
  }

  const items = preview === undefined ? list.items : list.items.slice(0, preview)
  const loading = list.loading && list.items.length === 0
  const grid = preview === undefined ? styles.grid : styles.row
  return (
    <>
      {external === undefined ? <LibrarySearch value={own} onChange={setOwn} placeholder={t.stickers.search} clearLabel={t.stickers.clearSearch} testId="sticker-search" /> : null}
      {showFilters ? <CategoryMenu name={t.stickers.category} label={label} entries={filters.entries} activeId={filterKey(filter)} onSelect={(id) => setFilter(filters.byId.get(id) ?? { type: 'all' })} testId="sticker-category" /> : null}

      <div className={showFilters ? styles.gridWrap : styles.previewWrap} data-testid="sticker-grid-wrap" data-embedded={embedded || undefined}>
        {list.error && list.items.length === 0 ? (
          <div className={styles.state} role="alert">
            <span>{t.stickers.failed}</span>
            <button type="button" className={`${ed.btn} ${ed.ghost}`} onClick={list.reload}>
              {t.stickers.retry}
            </button>
          </div>
        ) : null}
        {loading ? (
          <div className={grid} aria-busy="true" aria-label={t.stickers.loading}>
            {Array.from({ length: preview ?? 12 }, (_, i) => (
              <Skeleton key={i} className={styles.skel} height="auto" />
            ))}
          </div>
        ) : null}
        {!list.error && !list.loading && list.items.length === 0 ? <div className={styles.state}>{q ? t.stickers.noMatch(q) : t.stickers.empty}</div> : null}
        {items.length > 0 ? (
          <div className={grid} data-testid="sticker-grid">
            {items.map((item) => (
              <button key={item.id} type="button" className={styles.cell} title={item.name} aria-label={t.elementsPanel.addOf(item.name)} data-testid="sticker-cell" onClick={() => add(item)}>
                <img src={item.svg_url} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        ) : null}
        {paging && list.loading && list.items.length > 0 ? <div className={styles.state}>{t.stickers.loadingMore}</div> : null}
        {paging && list.error && list.items.length > 0 ? (
          <div className={styles.state} role="alert">
            <span>{t.stickers.failed}</span>
            <button type="button" className={`${ed.btn} ${ed.ghost}`} onClick={loadMore}>
              {t.stickers.retry}
            </button>
          </div>
        ) : null}
        {paging ? <div ref={sentinel} className={styles.sentinel} /> : null}
      </div>
    </>
  )
}
