import { Check, Lock, LockOpen, RectangleHorizontal, RectangleVertical, Search, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DocUnit } from '@/app/image-editor/_doory/types/document'
import { useDocument, useEditor } from '../context'
import type { ResizeScope } from '../engine/api/pages'
import { type ResizeMode, resizeDocument, resizePage } from '../engine/magicResize'
import { getPageSize, isUniform, pageSizes, sameSize } from '../engine/pageSizes'
import { pxToUnit, unitToPx } from '../engine/units'
import { t } from '../strings'
import { Button, IconButton } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { NumberField } from '../ui/NumberField'
import { Segmented } from '../ui/Segmented'
import { Select } from '../ui/Select'
import { CANVAS_SIDE_PX, type Limit, canvasSideRange, rangeHint } from '../toolbar/limits'
import styles from './dialogs.module.css'
import scopeStyles from './ResizeDialog.module.css'
import { ResizePreview } from './ResizePreview'
import { type ResizeGroup, type ResizeSize, searchSizes } from './resizeSizes'

const MODES: { id: ResizeMode; label: string; hint: string }[] = [
  { id: 'magic', label: t.dialog.resizeMagic, hint: t.dialog.resizeMagicHint },
  { id: 'scale', label: t.dialog.resizeScale, hint: t.dialog.resizeScaleHint },
  { id: 'keep', label: t.dialog.resizeKeep, hint: t.dialog.resizeKeepHint },
]

/** Las unidades de Canva: las del documento de Doory más centímetros (que se convierten acá, por milímetros). */
type Unit = DocUnit | 'cm'
const UNITS: readonly Unit[] = ['px', 'in', 'mm', 'cm']

const toPx = (value: number, unit: Unit): number => (unit === 'cm' ? unitToPx(value * 10, 'mm') : unitToPx(value, unit))
const fromPx = (px: number, unit: Unit): number => (unit === 'cm' ? pxToUnit(px, 'mm') / 10 : pxToUnit(px, unit))
const decimalsOf = (unit: Unit): number => (unit === 'px' ? 0 : unit === 'mm' ? 1 : 2)

/** El rango del lado del lienzo en la unidad elegida (el de Doory; en cm, el de mm dividido por 10). */
function rangeOf(unit: Unit): Limit {
  if (unit !== 'cm') return canvasSideRange(unit)
  const mm = canvasSideRange('mm')
  return { min: Math.ceil((mm.min / 10) * 100) / 100, max: Math.floor((mm.max / 10) * 100) / 100, step: 0.1, decimals: 2 }
}

function ShapeIcon({ size }: { size: ResizeSize }) {
  if (size.width === size.height) return <Square size={18} aria-hidden="true" />
  return size.width > size.height ? <RectangleHorizontal size={18} aria-hidden="true" /> : <RectangleVertical size={18} aria-hidden="true" />
}

/**
 * «Redimensionar» de Canva (relevamiento §9.2): buscador, lista de tamaños, «Tamaño personalizado» (ancho, alto,
 * unidades y candado) y «Redimensionar este diseño». Doory suma lo suyo y no se pierde: qué hacer con el contenido,
 * a qué páginas aplicarlo y la vista previa.
 *
 * Props: `pageId` (default the page in view) names the page whose size is shown and previewed, `scope` says which
 * pages Resize reaches (default: every page of a design of one size, this page when the sizes already differ),
 * `width` / `height` pre-fill the fields.
 */
export function ResizeDialog({ props }: { props?: Record<string, unknown> }) {
  const editor = useEditor()
  const doc = useDocument()
  const pageId = typeof props?.pageId === 'string' && doc.pages.some((p) => p.id === props.pageId) ? props.pageId : editor.state.activePageId
  const current = getPageSize(doc, pageId)
  const multiple = doc.pages.length > 1
  const initW = typeof props?.width === 'number' ? props.width : current.width
  const initH = typeof props?.height === 'number' ? props.height : current.height
  const [unit, setUnit] = useState<Unit>(doc.unit)
  const [w, setW] = useState(initW)
  const [h, setH] = useState(initH)
  const [lock, setLock] = useState(false)
  const [mode, setMode] = useState<ResizeMode>('scale')
  const [scope, setScope] = useState<ResizeScope>(!multiple ? 'all' : props?.scope === 'page' || props?.scope === 'all' ? props.scope : isUniform(doc) ? 'all' : 'page')
  const [query, setQuery] = useState('')
  const [presetId, setPresetId] = useState<string | null>(null)
  const ratio = current.width / current.height
  const dec = decimalsOf(unit)
  const range = rangeOf(unit)
  const show = (px: number): number => Number(fromPx(px, unit).toFixed(dec))
  const next = { width: Math.round(w), height: Math.round(h) }
  const unchanged = scope === 'all' ? pageSizes(doc).every((size) => sameSize(size, next)) : sameSize(current, next)
  const results = useMemo(() => searchSizes(query), [query])
  const groups = [...new Set(results.map((s) => s.group))] as ResizeGroup[]

  // With the ratio locked the other side follows, but it cannot leave the canvas limits either.
  const withinLimits = (px: number): number => Math.min(CANVAS_SIDE_PX.max, Math.max(CANVAS_SIDE_PX.min, px))
  const setWidth = (px: number): void => {
    setPresetId(null)
    setW(px)
    if (lock) setH(withinLimits(px / ratio))
  }
  const setHeight = (px: number): void => {
    setPresetId(null)
    setH(px)
    if (lock) setW(withinLimits(px * ratio))
  }
  const choose = (size: ResizeSize): void => {
    setPresetId(size.id)
    setW(size.width)
    setH(size.height)
  }

  const apply = (): void => {
    editor.pages.resize(w, h, mode, { scope, pageId })
    editor.closeDialog()
  }

  // «Copiar y redimensionar» de Canva: el diseño redimensionado se guarda como uno NUEVO (lo crea la cáscara por el
  // adaptador) y éste queda como estaba. Mismas reglas que «Redimensionar» (alcance, contenido), sin tocar el historial.
  const duplicate = editor.adapter.duplicateDesign
  const [copying, setCopying] = useState(false)
  const copy = async (): Promise<void> => {
    if (!duplicate || copying) return
    setCopying(true)
    const base = editor.getDocument()
    const resized = scope === 'all' ? resizeDocument(base, next.width, next.height, mode) : resizePage(base, pageId, next.width, next.height, mode)
    // El tamaño elegido de la lista queda como preset de la copia; uno escrito a mano, sin preset (como `pages.resize`).
    const document = { ...resized, meta: { ...resized.meta, presetId: presetId ?? undefined } }
    try {
      await editor.persistence.saveNow()
      await duplicate({ title: editor.state.title, document })
      editor.closeDialog()
    } catch {
      setCopying(false)
      editor.toast(t.dialog.resizeCopyFailed, 'error')
    }
  }

  return (
    <Dialog title={t.dialog.resizeTitle} onClose={() => editor.closeDialog()} width={780}>
      <div className={styles.resize}>
        <div className={styles.sizesCol}>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input type="search" value={query} placeholder={t.dialog.resizeSearch} aria-label={t.dialog.resizeSearch} onChange={(e) => setQuery(e.target.value)} data-autofocus />
          </label>
          <div className={styles.presets} data-testid="resize-sizes">
            {groups.map((g) => (
              <section key={g}>
                <h3 className={styles.groupTitle}>{t.dialog.resizeGroups[g]}</h3>
                <div className={styles.presetList}>
                  {results
                    .filter((s) => s.group === g)
                    .map((s) => {
                      const on = presetId === s.id || (presetId === null && next.width === s.width && next.height === s.height)
                      return (
                        <button key={s.id} type="button" className={`${styles.preset} ${on ? styles.presetOn : ''}`} aria-pressed={on} onClick={() => choose(s)}>
                          <span className={styles.presetIcon}>
                            <ShapeIcon size={s} />
                          </span>
                          <span className={styles.presetText}>
                            <span>{t.dialog.resizeSizes[s.id]}</span>
                            <small>{s.display}</small>
                          </span>
                          {on ? <Check size={18} className={styles.presetCheck} aria-hidden="true" /> : null}
                        </button>
                      )
                    })}
                </div>
              </section>
            ))}
            {results.length === 0 ? <p className={styles.muted}>{t.dialog.resizeNoResults}</p> : null}
          </div>
        </div>

        <div className={styles.custom}>
          <h3 className={styles.sectionTitle}>{t.dialog.resizeCustom}</h3>
          <div className={styles.sizeRow}>
            <NumberField label={t.dialog.resizeWidth} showLabel value={show(w)} decimals={dec} min={range.min} max={range.max} hint={rangeHint(range, unit)} step={range.step} onChange={(v) => setWidth(toPx(v, unit))} />
            <IconButton label={t.dialog.resizeLock} pressed={lock} onClick={() => setLock((l) => !l)}>
              {lock ? <Lock size={16} /> : <LockOpen size={16} />}
            </IconButton>
            <NumberField label={t.dialog.resizeHeight} showLabel value={show(h)} decimals={dec} min={range.min} max={range.max} hint={rangeHint(range, unit)} step={range.step} onChange={(v) => setHeight(toPx(v, unit))} />
            <Select className={styles.unitSelect} value={unit} aria-label={t.dialog.resizeUnit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
          <p className={styles.muted}>
            {t.dialog.resizeCurrent}: {current.width} × {current.height} px · {t.dialog.resizeNew(next.width, next.height)}
          </p>
          {multiple ? (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>{t.dialog.resizeScope}</span>
              <Segmented
                className={scopeStyles.scope}
                label={t.dialog.resizeScope}
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'all', label: t.dialog.resizeAllPages(doc.pages.length) },
                  { value: 'page', label: t.dialog.resizeThisPage },
                ]}
              />
            </div>
          ) : null}
          <div role="radiogroup" aria-label={t.dialog.resizeContent} className={styles.modes}>
            <span className={styles.fieldLabel}>{t.dialog.resizeContent}</span>
            {MODES.map((m) => (
              <label key={m.id} className={`${styles.mode} ${mode === m.id ? styles.modeOn : ''}`}>
                <input type="radio" name="resize-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
                <span>
                  <strong>{m.label}</strong>
                  <small>{m.hint}</small>
                </span>
              </label>
            ))}
          </div>
          <ResizePreview pageId={pageId} to={next} mode={mode} />
          {duplicate ? (
            <Button variant="default" className={styles.wide} disabled={unchanged || w < 1 || h < 1 || copying} onClick={() => void copy()} data-testid="resize-copy">
              {t.dialog.resizeCopy}
            </Button>
          ) : null}
          <Button variant="primary" className={styles.wide} disabled={unchanged || w < 1 || h < 1} onClick={apply} data-testid="resize-apply">
            {t.dialog.resizeApply}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
