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

/** Sticker library (docked sidebar): search, category menu and an endless grid. */
export function StickerPanel() {
  const editor = useEditor()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>({ type: 'all' })
  const q = useDebounced(query.trim(), 250)

  const packs = useAsyncList<ElementPack>(() => editor.adapter.services.elements.packs().then((p) => ({ count: p.length, next: null, previous: null, results: p })), 'packs')
  const list = useAsyncList<ElementItem>(
    (page) =>
      editor.adapter.services.elements.list({
        q: q || undefined,
        kind: filter.type === 'kind' ? filter.kind : undefined,
        pack: filter.type === 'pack' ? filter.pack.slug : undefined,
        page,
        page_size: 36,
      }),
    `${q}|${filterKey(filter)}`,
  )

  const { loadMore } = list
  const sentinel = useSentinel(list.hasMore && !list.loading && !list.error && list.items.length > 0, loadMore)

  const label = filter.type === 'all' ? t.stickers.all : filter.type === 'kind' ? t.stickers.kinds[filter.kind] : filter.pack.name
  const filters = useMemo(() => {
    const byId = new Map<string, Filter>([['all', { type: 'all' }]])
    const entries: CategoryEntry[] = [{ kind: 'option', id: 'all', label: t.stickers.all }]
    entries.push({ kind: 'group', id: 'g-type', label: t.stickers.byType })
    for (const k of KINDS) {
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

  const loading = list.loading && list.items.length === 0
  return (
    <>
      <LibrarySearch value={query} onChange={setQuery} placeholder={t.stickers.search} clearLabel={t.stickers.clearSearch} testId="sticker-search" />
      <CategoryMenu name={t.stickers.category} label={label} entries={filters.entries} activeId={filterKey(filter)} onSelect={(id) => setFilter(filters.byId.get(id) ?? { type: 'all' })} testId="sticker-category" />

      <div className={styles.gridWrap} data-testid="sticker-grid-wrap">
        {list.error && list.items.length === 0 ? (
          <div className={styles.state} role="alert">
            <span>{t.stickers.failed}</span>
            <button type="button" className={`${ed.btn} ${ed.ghost}`} onClick={list.reload}>
              {t.stickers.retry}
            </button>
          </div>
        ) : null}
        {loading ? (
          <div className={styles.grid} aria-busy="true" aria-label={t.stickers.loading}>
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className={styles.skel} height="auto" />
            ))}
          </div>
        ) : null}
        {!list.error && !list.loading && list.items.length === 0 ? <div className={styles.state}>{q ? t.stickers.noMatch(q) : t.stickers.empty}</div> : null}
        {list.items.length > 0 ? (
          <div className={styles.grid} data-testid="sticker-grid">
            {list.items.map((item) => (
              <button key={item.id} type="button" className={styles.cell} title={item.name} aria-label={t.elementsPanel.addOf(item.name)} data-testid="sticker-cell" onClick={() => void editor.insert.element(item)}>
                <img src={item.svg_url} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        ) : null}
        {list.loading && list.items.length > 0 ? <div className={styles.state}>{t.stickers.loadingMore}</div> : null}
        {list.error && list.items.length > 0 ? (
          <div className={styles.state} role="alert">
            <span>{t.stickers.failed}</span>
            <button type="button" className={`${ed.btn} ${ed.ghost}`} onClick={loadMore}>
              {t.stickers.retry}
            </button>
          </div>
        ) : null}
        <div ref={sentinel} className={styles.sentinel} />
      </div>
    </>
  )
}
