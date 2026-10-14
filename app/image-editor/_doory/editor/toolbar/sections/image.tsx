import { Crop, Frame } from 'lucide-react'
import { I } from '../../chrome/icons'
import { useEditor, useSelection } from '../../context'
import { isBackgroundRemovalAvailable } from '../../engine/bgRemoval'
import { FILTER_PRESETS, FILTER_RANGES, TOGGLE_FILTERS, specValue } from '../../engine/objects/filters'
import { MASK_SHAPE_IDS, maskPath } from '../../engine/objects/shapeGeometry'
import type { ImageFilterSpec, MaskShape } from '@/app/image-editor/_doory/types/document'
import { t } from '../../strings'
import { Slider } from '../../ui/Slider'
import { Switch } from '../../ui/Switch'
import { FlipTool } from '../controls'
import { Field, PopoverStack, PopoverTool, ToolButton } from '../parts'
import bar from '../parts.module.css'
import styles from './sections.module.css'

function MaskGlyph({ id }: { id: (typeof MASK_SHAPE_IDS)[number] | 'none' }) {
  if (id === 'none') return <svg viewBox="0 0 100 100" aria-hidden="true"><rect x="12" y="12" width="76" height="76" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="10 8" /></svg>
  if (id === 'circle') return <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="currentColor" /></svg>
  if (id === 'rounded') return <svg viewBox="0 0 100 100" aria-hidden="true"><rect x="10" y="10" width="80" height="80" rx="20" fill="currentColor" /></svg>
  return <svg viewBox="0 0 100 100" aria-hidden="true"><path d={maskPath(id) ?? ''} fill="currentColor" /></svg>
}

/** «Marco»: la forma que recorta la foto (también la de los marcadores de imagen). */
export function FrameTool() {
  const editor = useEditor()
  const sel = useSelection()
  const o = sel.objects[0] ?? {}
  const current = typeof o.maskShape === 'string' ? o.maskShape : o.maskShape ? 'custom' : 'none'
  const radius = Math.round(Number(o.maskRadius ?? 0.18) * 100)
  return (
    <PopoverTool label={t.toolbar.mask} trigger={<Frame size={18} aria-hidden="true" />} pressed={current !== 'none'} width={296} testId="ed-frame">
      <PopoverStack width={264}>
        <div className={styles.maskGrid} role="group" aria-label={t.toolbar.mask}>
          {(['none', ...MASK_SHAPE_IDS] as const).map((id) => (
            <button key={id} type="button" className={`${styles.maskBtn} ${current === id ? styles.maskOn : ''}`} aria-label={id === 'none' ? t.toolbar.maskNone : t.masks[id]} aria-pressed={current === id} title={id === 'none' ? t.toolbar.maskNone : t.masks[id]} onClick={() => editor.style.setMask(id === 'none' ? undefined : (id as MaskShape))}>
              <MaskGlyph id={id} />
            </button>
          ))}
        </div>
        {current === 'rounded' ? <Slider label={t.toolbar.cornerRadius} value={radius} min={0} max={50} withInput onChange={(v) => editor.style.setMask('rounded', v / 100)} /> : null}
      </PopoverStack>
    </PopoverTool>
  )
}

/** Aproximación CSS de un filtro, sólo para las miniaturas. */
function presetCss(specs: readonly ImageFilterSpec[]): string {
  const parts: string[] = []
  for (const s of specs) {
    if (s.type === 'brightness') parts.push(`brightness(${1 + s.value})`)
    else if (s.type === 'contrast') parts.push(`contrast(${1 + s.value})`)
    else if (s.type === 'saturation') parts.push(`saturate(${1 + s.value})`)
    else if (s.type === 'hue') parts.push(`hue-rotate(${s.value * 180}deg)`)
    else if (s.type === 'grayscale') parts.push('grayscale(1)')
    else if (s.type === 'sepia') parts.push('sepia(1)')
    else if (s.type === 'blur') parts.push(`blur(${s.value * 4}px)`)
  }
  return parts.join(' ') || 'none'
}

/** «Editar foto» de Canva: quitar el fondo (si está disponible), «Filtros» y «Ajustar». */
export function AdjustPanel({ onRemoveBackground }: { onRemoveBackground?: () => void }) {
  const editor = useEditor()
  const sel = useSelection()
  const specs = (sel.objects[0]?.filters ?? []) as ImageFilterSpec[]
  return (
    <PopoverStack width={288}>
      {onRemoveBackground ? (
        <button type="button" className={`${bar.button} ${bar.buttonWide}`} data-testid="ed-remove-bg" onClick={onRemoveBackground}>
          {I.removeBg}
          {t.ctx.removeBackground}
        </button>
      ) : null}
      <Field label={t.toolbar.filterPresets}>
        <div className={styles.presetGrid}>
          {FILTER_PRESETS.map((p) => (
            <button key={p.id} type="button" className={styles.presetBtn} onClick={() => editor.style.applyFilterPreset(p.id)} aria-label={t.tools.filterOf(p.label)}>
              <div aria-hidden="true" style={{ filter: presetCss(p.specs) }} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label={t.toolbar.filters}>
        <div className={bar.stack} style={{ gap: 12 }}>
          {FILTER_RANGES.map((r) => {
            const v = specValue(specs, r.type)
            return <Slider key={r.type} label={t.toolbar[r.type]} value={v} min={r.min} max={r.max} step={r.step} display={`${Math.round(v * r.display)}${r.suffix}`} onChange={(n) => editor.style.setFilter(r.type, n)} />
          })}
          {TOGGLE_FILTERS.map((f) => (
            <Switch key={f} label={t.toolbar[f]} checked={specValue(specs, f) > 0} onChange={(on) => editor.style.setFilter(f, on ? 1 : 0)} />
          ))}
        </div>
      </Field>
      <button type="button" className={`${bar.button} ${bar.buttonWide}`} disabled={specs.length === 0} onClick={() => editor.style.setFilters([])}>
        {t.toolbar.reset}
      </button>
    </PopoverStack>
  )
}

/**
 * Imagen: «Editar foto», «Recortar» y «Voltear», como Canva; el «Marco» de Doory al lado. Reemplazar la imagen está en
 * «⋯ Más» y en el clic derecho. Una foto que llena un marcador ofrece «Volver a marcador» en lugar de recortar.
 */
export function ImageSection() {
  const editor = useEditor()
  const sel = useSelection()
  const fillsPlaceholder = sel.objects[0]?.slot !== undefined
  const removeBg = isBackgroundRemovalAvailable()
  return (
    <>
      <PopoverTool label={t.toolbar.editPhoto} text={t.toolbar.editPhoto} width={320} testId="ed-adjust">
        {(close) => (
          <AdjustPanel
            onRemoveBackground={
              removeBg
                ? () => {
                    close()
                    editor.openDialog('background-removal')
                  }
                : undefined
            }
          />
        )}
      </PopoverTool>
      {fillsPlaceholder ? (
        <ToolButton label={t.ctx.resetPlaceholder} text={t.ctx.resetPlaceholder} testId="ed-reset-placeholder" onClick={() => editor.style.resetToPlaceholder()} />
      ) : (
        <ToolButton label={t.toolbar.crop} text={t.toolbar.crop} shortcut="Enter" testId="ed-crop" onClick={() => void editor.crop.start()}>
          <Crop size={18} aria-hidden="true" />
        </ToolButton>
      )}
      <FlipTool />
      {fillsPlaceholder ? null : <FrameTool />}
    </>
  )
}
