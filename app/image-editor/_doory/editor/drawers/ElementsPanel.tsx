import { ChevronLeft } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { LibrarySearch } from '../panels/library'
import type { PanelProps } from '../panels/registry'
import { StickerPanel } from '../panels/StickerPanel'
import { t } from '../strings'
import { type ShapeCard, TileGrid, matches, useChartCards, useFrameCards, usePathShapeCards, useShapeCards } from './ShapesDrawer'
import { useInsertDone } from './useInsertDone'
import styles from './Drawers.module.css'

type View = 'home' | 'shapes' | 'graphics' | 'frames'

const TITLES: Record<Exclude<View, 'home'>, string> = {
  shapes: t.elementsHome.linesShapes,
  graphics: t.elementsHome.graphics,
  frames: t.elementsHome.frames,
}

/**
 * El panel «Elementos» de Canva (relevamiento §3.2): el buscador «Buscar elementos» arriba y, debajo, secciones
 * con una fila de vista previa y «Ver todo». Junta lo que en Doory eran tres herramientas: Formas (con líneas,
 * marcos, gráficos de datos y código QR), Stickers (ahora «Gráficos») y las formas extra.
 */
export function ElementsPanel({ close }: PanelProps) {
  const done = useInsertDone(close)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('home')
  const { shapes, lines, qr } = useShapeCards()
  const paths = usePathShapeCards()
  const frames = useFrameCards()
  const charts = useChartCards()
  const q = query.trim()

  const onSearch = (value: string): void => {
    setQuery(value)
    // Buscar desde «Ver todo» de formas o marcos vuelve a los resultados; en «Gráficos» filtra ahí mismo.
    if (value.trim() && view !== 'graphics') setView('home')
  }

  const head = (title: string, see?: Exclude<View, 'home'>): ReactNode => (
    <div className={styles.sectionHead}>
      <p className={styles.sectionTitle}>{title}</p>
      {see ? (
        <button type="button" className={styles.seeAll} data-testid={`elements-see-${see}`} onClick={() => setView(see)}>
          {t.elementsHome.seeAll}
        </button>
      ) : null}
    </div>
  )

  const search = <LibrarySearch value={query} onChange={onSearch} placeholder={t.elementsHome.search} clearLabel={t.stickers.clearSearch} testId="elements-search" />

  if (view !== 'home') {
    return (
      <>
        {search}
        <div className={styles.subHead}>
          <button type="button" className={styles.back} aria-label={t.chrome.back} title={t.chrome.back} data-testid="elements-back" onClick={() => setView('home')}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <p className={styles.subTitle}>{TITLES[view]}</p>
        </div>
        {view === 'shapes' ? (
          <>
            <p className={styles.sectionTitle}>{t.elementsHome.lines}</p>
            <TileGrid cards={lines} done={done} />
            <p className={styles.sectionTitle}>{t.elementsHome.shapes}</p>
            <TileGrid cards={[...shapes, ...paths]} done={done} />
          </>
        ) : null}
        {view === 'frames' ? <TileGrid cards={frames} done={done} /> : null}
        {view === 'graphics' ? <StickerPanel query={query} done={done} /> : null}
      </>
    )
  }

  if (q) {
    const hit = (cards: readonly ShapeCard[]): ShapeCard[] => cards.filter((c) => matches(q, c.label, ...(c.keywords ?? [])))
    const shapeHits = hit([...lines, ...shapes, ...paths])
    const frameHits = hit(frames)
    const chartHits = hit(charts)
    const qrHit = hit([qr])
    return (
      <>
        {search}
        {shapeHits.length > 0 ? (
          <>
            {head(t.elementsHome.linesShapes)}
            <TileGrid cards={shapeHits} done={done} />
          </>
        ) : null}
        {frameHits.length > 0 ? (
          <>
            {head(t.elementsHome.frames)}
            <TileGrid cards={frameHits} done={done} />
          </>
        ) : null}
        {chartHits.length > 0 ? (
          <>
            {head(t.elementsHome.charts)}
            <TileGrid cards={chartHits} done={done} />
          </>
        ) : null}
        {qrHit.length > 0 ? <TileGrid cards={qrHit} done={done} labelled columns={3} /> : null}
        {head(t.elementsHome.graphics)}
        <StickerPanel query={q} embedded done={done} />
      </>
    )
  }

  return (
    <>
      {search}
      {head(t.elementsHome.linesShapes, 'shapes')}
      <TileGrid cards={[lines[0], lines[1], shapes[0], shapes[1]]} done={done} />
      {head(t.elementsHome.graphics, 'graphics')}
      <StickerPanel query="" preview={4} done={done} />
      {head(t.elementsHome.frames, 'frames')}
      <TileGrid cards={frames.slice(0, 4)} done={done} />
      {head(t.elementsHome.charts)}
      <TileGrid cards={charts} done={done} />
      {head(t.elementsHome.qr)}
      <TileGrid cards={[qr]} done={done} labelled columns={3} />
    </>
  )
}
