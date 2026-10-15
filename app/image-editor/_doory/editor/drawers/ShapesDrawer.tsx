import type { ReactNode } from 'react'
import { useEditor } from '../context'
import { createLine, defaultShapeSize } from '../engine/objects/factories'
import { MASK_SHAPE_IDS, PATH_SHAPES, maskPath } from '../engine/objects/shapeGeometry'
import type { ShapeKind } from '../engine/api/insert'
import { t } from '../strings'
import { CHART_KINDS, type ChartKind, chartSvg } from './charts'
import { pageCentre } from './insertAt'
import styles from './Drawers.module.css'

/**
 * Las piezas de «Líneas y formas», «Marcos», «Gráficos de datos» y «Código QR» de Canva, hechas con lo que Doory
 * sabe insertar (antes el cajón «Formas» de Doory). Las usan el panel «Elementos» (vista previa, «Ver todo» y
 * búsqueda) y «Herramientas». Como en Canva, las formas se ven como glifos grises sin rótulo (el nombre va en el
 * tooltip).
 */
export interface ShapeCard {
  id: string
  label: string
  icon: ReactNode
  run: () => void | Promise<void>
  /** Más palabras para el buscador de «Elementos» (las formas de Doory traen las suyas, en inglés). */
  keywords?: readonly string[]
}

const chartPreview = (kind: ChartKind): string => `data:image/svg+xml;utf8,${encodeURIComponent(chartSvg(kind))}`

/** Glifo de 28×28: las formas van rellenas (como en Canva), las líneas con trazo. */
const glyph = (children: ReactNode): ReactNode => (
  <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
    {children}
  </svg>
)
const solid = { fill: 'currentColor' } as const
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** Sin tildes ni mayúsculas, para que «linea» encuentre «Línea». */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function matches(q: string, ...texts: (string | undefined)[]): boolean {
  const needle = normalize(q)
  return !needle || texts.some((x) => x !== undefined && normalize(x).includes(needle))
}

/** Las formas básicas, las líneas y los «útiles» (código QR y marco de foto) como tarjetas con su acción. */
export function useShapeCards(): { shapes: ShapeCard[]; lines: ShapeCard[]; qr: ShapeCard; placeholder: ShapeCard } {
  const editor = useEditor()
  const shape = (kind: ShapeKind) => (): Promise<void> => editor.insert.shape(kind)

  const arrowBoth = (): Promise<void> => {
    const page = editor.pageSizeOf(editor.state.activePageId)
    const l = createLine(pageCentre(editor), { length: defaultShapeSize(page) * 1.4, arrowStart: 'triangle', arrowEnd: 'triangle' })
    return editor.insert.add([l], t.history.addArrow)
  }
  const dotted = (): Promise<void> => {
    const page = editor.pageSizeOf(editor.state.activePageId)
    const l = createLine(pageCentre(editor), { length: defaultShapeSize(page) * 1.4, width: 6, dash: [0.1, 12] })
    l.set({ strokeLineCap: 'round' })
    return editor.insert.add([l], t.history.addLine)
  }

  const shapes: ShapeCard[] = [
    { id: 'rect', label: t.basicShapes.rectangle, icon: glyph(<rect x="3" y="3" width="22" height="22" {...solid} />), run: shape('rect') },
    { id: 'ellipse', label: t.basicShapes.circle, icon: glyph(<circle cx="14" cy="14" r="11.5" {...solid} />), run: shape('ellipse') },
    { id: 'triangle', label: t.basicShapes.triangle, icon: glyph(<path d="M14 3 26 25H2z" {...solid} />), run: shape('triangle') },
    { id: 'rounded', label: t.basicShapes.roundedRectangle, icon: glyph(<rect x="3" y="3" width="22" height="22" rx="6" {...solid} />), run: shape('rounded') },
    { id: 'diamond', label: t.shapes.diamond, icon: glyph(<path d="M14 2 26 14 14 26 2 14z" {...solid} />), run: shape('diamond') },
    { id: 'star', label: t.basicShapes.star, icon: glyph(<path d="m14 2 3.5 7.5L25 11l-5.5 5 1.5 8L14 20.5 7 24l1.5-8L3 11l7.5-1.5z" {...solid} />), run: shape('star') },
    { id: 'polygon', label: t.basicShapes.polygon, icon: glyph(<path d="m14 2.5 10 5.75v11.5L14 25.5 4 19.75V8.25z" {...solid} />), run: shape('polygon') },
    { id: 'frame', label: t.drawers.frame, icon: glyph(<rect x="4" y="3" width="20" height="22" rx="1.5" {...line} />), run: shape('frame') },
  ]
  const lines: ShapeCard[] = [
    { id: 'line', label: t.basicShapes.line, icon: glyph(<path d="M3 14h22" {...line} />), run: shape('line') },
    { id: 'arrow', label: t.drawers.arrow, icon: glyph(<path d="M3 14h21M17 7l7 7-7 7" {...line} />), run: shape('arrow') },
    { id: 'arrow-both', label: t.drawers.doubleArrow, icon: glyph(<path d="M4 14h20M10 8l-6 6 6 6M18 8l6 6-6 6" {...line} />), run: arrowBoth },
    { id: 'dotted', label: t.drawers.dottedLine, icon: glyph(<path d="M3 14h.01M8.5 14h.01M14 14h.01M19.5 14h.01M25 14h.01" {...line} strokeWidth={3.4} />), run: dotted },
    { id: 'divider', label: t.drawers.divider, icon: glyph(<path d="M2 14h24" {...line} strokeWidth={1.4} strokeDasharray="4 3" />), run: shape('divider') },
  ]
  const qr: ShapeCard = {
    id: 'qr',
    label: t.drawers.qrCode,
    icon: glyph(<path d="M4 4h8v8H4zM16 4h8v8h-8zM4 16h8v8H4zM16 16h3v3h-3zM21 21h3v3h-3zM21 16h3M16 21h3" {...line} strokeWidth={1.8} />),
    run: () => editor.insert.qr(),
  }
  const placeholder: ShapeCard = {
    id: 'placeholder',
    label: t.drawers.photoPlaceholder,
    icon: glyph(<path d="M4 5h20v18H4zM4 18l6-6 4 4 3-3 7 7" {...line} strokeWidth={1.8} />),
    run: () => editor.insert.placeholder(),
  }
  return { shapes, lines, qr, placeholder }
}

/** Una baldosa de Canva: el glifo sobre gris claro, el nombre en el tooltip (o abajo, con `labelled`). */
export function Tile({ card, done, labelled }: { card: ShapeCard; done: () => void; labelled?: boolean }) {
  return (
    <button
      type="button"
      className={`${styles.tile} ${labelled ? styles.tileLabelled : ''}`}
      title={card.label}
      aria-label={card.label}
      data-testid={`shape-${card.id}`}
      onClick={() => {
        void card.run()
        done()
      }}
    >
      <span className={styles.tileGlyph}>{card.icon}</span>
      {labelled ? <span className={styles.tileLabel}>{card.label}</span> : null}
    </button>
  )
}

export function TileGrid({ cards, done, labelled, columns = 4 }: { cards: readonly ShapeCard[]; done: () => void; labelled?: boolean; columns?: 3 | 4 }) {
  return (
    <div className={columns === 3 ? styles.tiles3 : styles.tiles}>
      {cards.map((c) => (
        <Tile key={c.id} card={c} done={done} labelled={labelled} />
      ))}
    </div>
  )
}

/** Las formas extra de Doory (corazón, nube, globo…), rellenas, en la misma grilla. */
export function usePathShapeCards(): ShapeCard[] {
  const editor = useEditor()
  return PATH_SHAPES.map((p) => ({
    id: `path-${p.id}`,
    label: p.label,
    keywords: p.keywords,
    icon: (
      <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
        <path d={p.path} fill="currentColor" fillRule={p.evenOdd ? 'evenodd' : 'nonzero'} />
      </svg>
    ),
    run: () => editor.insert.pathShape(p.id, p.label),
  }))
}

/** «Marcos» de Canva: un marco de foto con cada recorte de Doory (se llena arrastrando o eligiendo una imagen). */
export function useFrameCards(): ShapeCard[] {
  const editor = useEditor()
  return [
    { id: 'frame-rect', label: t.drawers.photoPlaceholder, icon: glyph(<rect x="3" y="5" width="22" height="18" rx="1" {...solid} />), run: () => editor.insert.placeholder() },
    ...MASK_SHAPE_IDS.map((id) => {
      const d = maskPath(id)
      return {
        id: `frame-${id}`,
        label: `${t.drawers.frame}: ${t.masks[id].toLowerCase()}`,
        icon: d ? (
          <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
            <path d={d} fill="currentColor" />
          </svg>
        ) : id === 'circle' ? (
          glyph(<circle cx="14" cy="14" r="11.5" {...solid} />)
        ) : (
          glyph(<rect x="3" y="3" width="22" height="22" rx="7" {...solid} />)
        ),
        run: () => editor.insert.placeholder(id),
      }
    }),
  ]
}

/** «Gráficos de datos»: los cuatro de Doory (barras, líneas, circular, anillo), editables desde la barra del objeto. */
export function useChartCards(): ShapeCard[] {
  const editor = useEditor()
  return CHART_KINDS.map((kind) => ({
    id: `chart-${kind}`,
    label: t.drawers.chartNames[kind],
    icon: <img className={styles.chartThumb} src={chartPreview(kind)} alt="" draggable={false} />,
    run: () => editor.insert.svgElement(chartSvg(kind), `chart-${kind}`, t.drawers.chartNames[kind]),
  }))
}
