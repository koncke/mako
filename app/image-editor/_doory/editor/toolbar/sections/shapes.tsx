import { useState } from 'react'
import type { ArrowHead } from '@/app/image-editor/_doory/types/document'
import { ColorTool } from '../../chrome/ColorTool'
import { useEditor, useSelection } from '../../context'
import { dashStyleOf } from '../../engine/api/style'
import { normalizeColor } from '../../engine/colors'
import { readFill } from '../../engine/objects/fills'
import { t } from '../../strings'
import { ColorButton } from '../../ui/ColorButton'
import { RangeField } from '../controls'
import { CORNER_RADIUS, LINE_WIDTH, STROKE_WIDTH, capLimit } from '../limits'
import { elementColors } from '../kinds'
import { ColorSlot, Field, PopoverStack, PopoverTool, ToolButton } from '../parts'
import { FrameTool } from './image'
import bar from '../parts.module.css'
import styles from './sections.module.css'

const DASHES = [
  { id: 'solid', label: t.toolbar.solid },
  { id: 'dashed', label: t.toolbar.dashed },
  { id: 'dotted', label: t.toolbar.dotted },
] as const

function DashPicker({ value, onChange }: { value: string; onChange: (dash: 'solid' | 'dashed' | 'dotted') => void }) {
  return (
    <div className={styles.segment} role="group" aria-label={t.toolbar.dash}>
      {DASHES.map((d) => (
        <button key={d.id} type="button" className={styles.segmentBtn} aria-pressed={value === d.id} data-testid={`ed-dash-${d.id}`} onClick={() => onChange(d.id)}>
          {d.label}
        </button>
      ))}
    </div>
  )
}

/** Ícono de «Estilo de borde» / «Estilo de línea»: una raya llena, una de guiones y una de puntos. */
function StrokeStyleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18" strokeWidth="2.4" />
      <path d="M3 12h18" strokeWidth="2" strokeDasharray="4 3" />
      <path d="M3 18h18" strokeWidth="2" strokeDasharray="0.5 3.5" />
    </svg>
  )
}

/** Forma: el mosaico de color, el borde (color) y «Estilo de borde» (estilo, grosor y redondeo de esquinas). */
export function ShapeSection() {
  const editor = useEditor()
  const sel = useSelection()
  const o = sel.objects[0] ?? {}
  const fill = readFill(o.fill, 'transparent')
  const strokeColor = typeof o.stroke === 'string' && Number(o.strokeWidth ?? 0) > 0 ? o.stroke : 'transparent'
  const kind = typeof o.shapeKind === 'string' ? o.shapeKind : ''
  const width = Math.round(Number(o.strokeWidth ?? 0))
  const radius = Math.round(Number(o.rx ?? 0))
  const maxRadius = Math.max(1, Math.round(Math.min(Number(o.width ?? 100), Number(o.height ?? 100)) / 2))
  const dash = dashStyleOf(Array.isArray(o.strokeDashArray) ? (o.strokeDashArray as number[]) : null)
  return (
    <>
      <ColorSlot>
        <ColorTool label={t.toolbar.color} value={fill} allowNone allowGradient testId="ed-fill" onChange={(f, key) => editor.style.setFill(f, key)} />
      </ColorSlot>
      <ColorSlot>
        <ColorTool
          label={t.toolbar.stroke}
          value={{ type: 'solid', color: strokeColor }}
          allowNone
          ring
          testId="ed-stroke"
          onChange={(f) => {
            if (f.type !== 'solid') return
            editor.style.setStroke(f.color === 'transparent' ? { color: null } : { color: f.color }, 'stroke-color')
          }}
        />
      </ColorSlot>
      <PopoverTool label={t.toolbar.dash} trigger={<StrokeStyleIcon />} width={296} testId="ed-shape-more">
        <PopoverStack width={264}>
          <DashPicker value={dash} onChange={(d) => editor.style.setStroke({ dash: d })} />
          <RangeField label={t.toolbar.strokeWidth} value={width} limit={STROKE_WIDTH} onChange={(w) => editor.style.setStroke({ width: w }, 'stroke-width')} />
          {kind === 'rect' ? <RangeField label={t.toolbar.cornerRadius} value={radius} limit={capLimit(CORNER_RADIUS, maxRadius)} onChange={(v) => editor.style.setCornerRadius(v)} /> : null}
        </PopoverStack>
      </PopoverTool>
    </>
  )
}

const HEADS: { id: ArrowHead; label: string; glyph: string }[] = [
  { id: 'none', label: t.tools.headNone, glyph: '—' },
  { id: 'triangle', label: t.tools.headTriangle, glyph: '▶' },
  { id: 'open', label: t.tools.headOpen, glyph: '›' },
  { id: 'circle', label: t.tools.headCircle, glyph: '●' },
  { id: 'diamond', label: t.tools.headDiamond, glyph: '◆' },
]

/** El glifo de un extremo, mirando hacia afuera (el inicio, a la izquierda). */
function headGlyph(key: 'arrowStart' | 'arrowEnd', id: ArrowHead): string {
  if (key === 'arrowStart' && id === 'triangle') return '◀'
  if (key === 'arrowStart' && id === 'open') return '‹'
  return HEADS.find((h) => h.id === id)?.glyph ?? '—'
}

/** «Inicio de línea» / «Final de línea»: la lista de extremos de Canva (sin, flecha, abierta, círculo, rombo). */
function LineEndTool({ which }: { which: 'arrowStart' | 'arrowEnd' }) {
  const editor = useEditor()
  const sel = useSelection()
  const current = ((sel.objects[0]?.[which] as ArrowHead | undefined) ?? 'none') as ArrowHead
  const label = which === 'arrowStart' ? t.toolbar.lineStart : t.toolbar.lineEnd
  return (
    <PopoverTool label={label} trigger={<span aria-hidden="true">{headGlyph(which, current)}</span>} flush testId={which === 'arrowStart' ? 'ed-line-start' : 'ed-line-end'}>
      {(close) => (
        <div className={bar.menuList} role="menu" aria-label={label}>
          {HEADS.map((h) => (
            <button
              key={h.id}
              type="button"
              role="menuitemradio"
              aria-checked={current === h.id}
              className={bar.menuItem}
              aria-label={t.tools.arrowheadOf(which === 'arrowStart' ? t.toolbar.arrowStart : t.toolbar.arrowEnd, h.label)}
              onClick={() => {
                editor.style.setLine({ [which]: h.id })
                close()
              }}
            >
              <span className={bar.menuIcon}>{headGlyph(which, h.id)}</span>
              <span className={bar.menuLabel}>{h.label}</span>
            </button>
          ))}
        </div>
      )}
    </PopoverTool>
  )
}

/** Línea: color, «Estilo de línea» (estilo y grosor) y los dos extremos, como Canva. */
export function LineSection() {
  const editor = useEditor()
  const sel = useSelection()
  const o = sel.objects[0] ?? {}
  const color = typeof o.stroke === 'string' ? o.stroke : '#000000'
  const width = Math.round(Number(o.strokeWidth ?? 6))
  const dash = dashStyleOf(Array.isArray(o.strokeDashArray) ? (o.strokeDashArray as number[]) : null)
  return (
    <>
      <ColorSlot>
        <ColorTool label={t.toolbar.color} value={{ type: 'solid', color: normalizeColor(color) }} testId="ed-stroke" onChange={(f) => (f.type === 'solid' ? editor.style.setLine({ color: f.color }) : undefined)} />
      </ColorSlot>
      <PopoverTool label={t.toolbar.lineStyle} trigger={<StrokeStyleIcon />} width={296} testId="ed-shape-more">
        <PopoverStack width={264}>
          <DashPicker value={dash} onChange={(d) => editor.style.setLine({ dash: d })} />
          <RangeField label={t.toolbar.lineWidth} value={width} limit={LINE_WIDTH} onChange={(w) => editor.style.setLine({ width: w })} />
        </PopoverStack>
      </PopoverTool>
      <LineEndTool which="arrowStart" />
      <LineEndTool which="arrowEnd" />
    </>
  )
}

/** Stickers y elementos del catálogo: un mosaico por cada color original. */
export function ElementSection() {
  const editor = useEditor()
  const sel = useSelection()
  const o = sel.objects[0] ?? {}
  const map = (o.colorMap ?? {}) as Record<string, string>
  const list = elementColors(o)
  if (list.length === 0) return null
  return (
    <div className={styles.row} role="group" aria-label={t.toolbar.recolor} data-testid="ed-recolor">
      {list.map((c) => (
        <ColorButton key={c} label={t.tools.recolorOf(c)} value={{ type: 'solid', color: map[c] ?? c }} solidOnly extraSwatches={{ label: t.tools.originalColors, colors: list }} onChange={(f) => (f.type === 'solid' ? editor.style.recolor(c, f.color) : undefined)} />
      ))}
      {Object.keys(map).length > 0 ? (
        <button type="button" className={`${bar.btn} ${bar.textBtn}`} onClick={() => editor.style.resetColors()}>
          {t.toolbar.reset}
        </button>
      ) : null}
    </div>
  )
}

export function QrSection() {
  const editor = useEditor()
  const sel = useSelection()
  const qr = (sel.objects[0]?.qr ?? { text: '', fg: '#000000', bg: '#ffffff' }) as { text: string; fg: string; bg: string }
  const [text, setText] = useState(qr.text)
  const [seen, setSeen] = useState(qr.text)
  if (qr.text !== seen) {
    setSeen(qr.text)
    setText(qr.text)
  }
  const apply = (): void => {
    if (text.trim() && text !== qr.text) void editor.style.setQr({ text })
  }
  return (
    <>
      <PopoverTool label={t.toolbar.qrText} text={t.toolbar.qrText} width={304} testId="ed-qr-text">
        <Field label={t.toolbar.qrText}>
          <textarea
            className={styles.textInput}
            value={text}
            maxLength={1000}
            aria-label={t.toolbar.qrText}
            onChange={(e) => setText(e.target.value)}
            onBlur={apply}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                apply()
              }
            }}
          />
        </Field>
      </PopoverTool>
      <ColorSlot>
        <ColorTool label={t.toolbar.qrForeground} value={{ type: 'solid', color: qr.fg }} testId="ed-qr-fg" onChange={(f) => (f.type === 'solid' ? void editor.style.setQr({ fg: f.color }) : undefined)} />
      </ColorSlot>
      <ColorSlot>
        <ColorTool label={t.toolbar.qrBackground} value={{ type: 'solid', color: qr.bg }} testId="ed-qr-bg" onChange={(f) => (f.type === 'solid' ? void editor.style.setQr({ bg: f.color }) : undefined)} />
      </ColorSlot>
    </>
  )
}

/** Un marcador de imagen: elegir la foto, la forma del recorte y el marco. */
export function PlaceholderSection() {
  const editor = useEditor()
  const sel = useSelection()
  const o = sel.objects[0] ?? {}
  const circle = o.maskShape === 'circle'
  return (
    <>
      <ToolButton label={t.panels.chooseImage} text={t.panels.chooseImage} testId="ed-placeholder-fill" onClick={() => void editor.insert.fillPlaceholder(editor.state.activePageId, sel.ids[0])} />
      <ToolButton label={t.ctx.cropBox} text={t.ctx.box} pressed={!circle} testId="ed-placeholder-box" onClick={() => editor.style.setMask(undefined)} />
      <ToolButton label={t.ctx.cropCircle} text={t.ctx.circle} pressed={circle} testId="ed-placeholder-circle" onClick={() => editor.style.setMask('circle')} />
      <FrameTool />
      <ToolButton label={t.ctx.placeholderOff} text={t.ctx.placeholderOn} pressed testId="ed-placeholder" onClick={() => editor.style.setPlaceholder(false)} />
    </>
  )
}
